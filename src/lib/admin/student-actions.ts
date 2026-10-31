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
    .select("role, university_id")
    .eq("id", user.id)
    .single();

  const { data: effectiveRole } = await supabase.rpc("effective_user_role");

  const allowedRoles = ["admin", "director"];
  if (!callerProfile || !allowedRoles.includes(effectiveRole ?? "")) {
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
      .select("student_id, role, email, university_id")
      .eq("id", studentId)
      .single();

    if (!targetProfile || targetProfile.role !== "student") {
      return { success: false, error: "Étudiant introuvable.", code: "NOT_MATCHED" };
    }
    if (!targetProfile.university_id) {
      return { success: false, error: "L'université de ce profil n'est pas définie.", code: "NOT_MATCHED" };
    }

    if (effectiveRole === "admin") {
      const { data: hasAccess } = await supabase.rpc("has_university_access", {
        p_university_id: targetProfile.university_id,
      });
      if (hasAccess !== true) {
        return { success: false, error: "Vous n'avez pas accès à cette université.", code: "FORBIDDEN" };
      }
    }

    let candidateMatricule = targetProfile.student_id;
    if (!candidateMatricule && targetProfile.email) {
      const { data: reg } = await adminClient
        .from("student_matricule_registry")
        .select("matricule")
        .eq("university_id", targetProfile.university_id)
        .ilike("email", targetProfile.email.trim())
        .eq("verification_status", "verified")
        .maybeSingle();
      candidateMatricule = reg?.matricule ?? null;
    }

    if (!candidateMatricule) {
      return { success: false, error: "Aucune fiche explicitement vérifiée ne correspond à cet étudiant.", code: "NOT_MATCHED" };
    }

    const { data: matched, error: matchError } = await adminClient.rpc("claim_student_matricule", {
      p_user_id: studentId,
      p_university_id: targetProfile.university_id,
      p_matricule: candidateMatricule,
    });
    if (matchError || matched !== true) {
      return { success: false, error: "Le compte ne correspond pas à une fiche collectée avec email et nom valides.", code: "NOT_MATCHED" };
    }
    revalidatePath("/admin/users");
    revalidatePath("/admin/matricules");
    revalidatePath("/admin");
    return { success: true, data: undefined };
  }

  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("role, university_id")
    .eq("id", studentId)
    .single();
  if (!targetProfile || targetProfile.role !== "student") {
    return { success: false, error: "Étudiant introuvable.", code: "NOT_MATCHED" };
  }
  if (!targetProfile.university_id) {
    return { success: false, error: "L'université de ce profil n'est pas définie.", code: "NOT_MATCHED" };
  }
  if (effectiveRole === "admin") {
    const { data: hasAccess } = await supabase.rpc("has_university_access", {
      p_university_id: targetProfile.university_id,
    });
    if (hasAccess !== true) {
      return { success: false, error: "Vous n'avez pas accès à cette université.", code: "FORBIDDEN" };
    }
  }

  const { error } = await adminClient
    .from("profiles")
    .update({
      is_verified: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentId);

  await adminClient
    .from("student_matricule_registry")
    .update({
      claimed_by_user_id: null,
      claimed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("claimed_by_user_id", studentId);

  if (error) {
    return {
      success: false,
      error: "Erreur lors de la mise a jour du statut de verification.",
    };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/matricules");
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
  void targetId;
  void newRole;
  return {
    success: false,
    error: "Les rôles administratifs sont attribués et retirés exclusivement par les nominations du directeur.",
    code: "FORBIDDEN",
  };
}