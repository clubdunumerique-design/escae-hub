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
  if (verified) {
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("student_id, role")
      .eq("id", studentId)
      .single();

    if (!targetProfile || targetProfile.role !== "student" || !targetProfile.student_id) {
      return { success: false, error: "Aucun matricule candidat à rapprocher.", code: "NOT_MATCHED" };
    }

    const { data: matched, error: matchError } = await adminClient.rpc("claim_student_matricule", {
      p_user_id: studentId,
      p_matricule: targetProfile.student_id,
    });
    if (matchError || matched !== true) {
      return { success: false, error: "Le compte ne correspond pas à une fiche collectée avec email confirmé.", code: "NOT_MATCHED" };
    }
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true, data: undefined };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({
      is_verified: false,
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

/**
 * Promeut ou rétrograde le rôle d'un utilisateur.
 * EXCLUSIVEMENT réservé au rôle : director.
 * Un directeur peut rendre un étudiant administrateur, ou retirer le rôle admin.
 * Il ne peut pas modifier un autre directeur.
 */
export async function changeUserRoleAction(
  targetId: string,
  newRole: "admin" | "student"
): Promise<ApiResponse<void>> {
  // 1. Vérifier que l'appelant est authentifié
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Non autorisé.", code: "UNAUTHORIZED" };
  }

  // 2. Vérifier que l'appelant est bien un directeur
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.role !== "director") {
    return {
      success: false,
      error: "Seul un Directeur peut modifier les rôles des utilisateurs.",
      code: "FORBIDDEN",
    };
  }

  // 3. Vérifier que la cible n'est pas un directeur (protection)
  const adminClient = createSupabaseAdminClient();
  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .single();

  if (!targetProfile) {
    return { success: false, error: "Utilisateur introuvable." };
  }

  if (targetProfile.role === "director") {
    return {
      success: false,
      error: "Impossible de modifier le rôle d'un Directeur.",
      code: "FORBIDDEN",
    };
  }

  // 4. Appliquer le changement de rôle via le client admin
  const { error } = await adminClient
    .from("profiles")
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetId);

  if (error) {
    return {
      success: false,
      error: "Erreur lors de la modification du rôle.",
    };
  }

  // 5. Journal d'audit (best-effort)
  try {
    await adminClient.from("audit_logs").insert({
      actor_id: user.id,
      action: "user.role_changed",
      target_id: targetId,
      target_type: "profile",
      details: {
        previous_role: targetProfile.role,
        new_role: newRole,
      },
    });
  } catch {
    console.error("[audit] Échec écriture log changeUserRole");
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true, data: undefined };
}
