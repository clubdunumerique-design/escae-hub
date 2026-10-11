"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ApiResponse } from "@/types";

/**
 * Verifie ou de-verifie un compte etudiant.
 * Reserve aux roles : admin, director.
 * Utilise le client admin (service_role) pour contourner les RLS
 * apres verification du role cote serveur.
 */
export async function verifyStudentAction(
  studentId: string,
  verified: boolean
): Promise<ApiResponse<void>> {
  // 1. Verifier que l'utilisateur appelant est authentifie
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Non autorise.", code: "UNAUTHORIZED" };
  }

  // 2. Verifier son role cote serveur
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["admin", "director"];
  if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
    return {
      success: false,
      error: "Vous n'avez pas les permissions necessaires pour cette action.",
      code: "FORBIDDEN",
    };
  }

  // 3. Utiliser le client admin (contourne RLS) pour mettre a jour is_verified
  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({
      is_verified: verified,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentId);

  if (error) {
    return {
      success: false,
      error: "Erreur lors de la mise a jour du statut de verification.",
    };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true, data: undefined };
}
