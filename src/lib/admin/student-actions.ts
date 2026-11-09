"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ApiResponse } from "@/types";
import { z } from "zod";
import { getPublicAppUrl } from "@/lib/config/app-url";
import { ESCAE_ACADEMIC_LEVELS } from "@/config/academic-programs";

const assistedStudentSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.string().trim().email().toLowerCase(),
  universityId: z.string().uuid(),
  studentId: z.string().trim().toUpperCase().regex(/^ETU-\d{4}-\d{4}$/),
  department: z.string().trim().min(2).max(120),
  academicLevel: z.enum(ESCAE_ACADEMIC_LEVELS),
});

/** Recherche une fiche de collecte par e-mail ou matricule, limitée aux universités accessibles. */
export async function searchStudentMatriculeForAssistedAccountAction(
  universityId: string,
  search: string,
): Promise<ApiResponse<Array<{
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  matricule: string;
  field_of_study: string | null;
  academic_level: string | null;
  verification_status: string;
}>>> {
  const parsed = z.object({ universityId: z.string().uuid(), search: z.string().trim().min(3).max(254) }).safeParse({ universityId, search });
  if (!parsed.success) return { success: false, error: "Saisissez un e-mail ou un matricule valide.", code: "VALIDATION_ERROR" };
  const isEmailSearch = parsed.data.search.includes("@");
  if (isEmailSearch ? !z.string().email().safeParse(parsed.data.search).success : !/^ETU-\d{4}-\d{4}$/i.test(parsed.data.search)) {
    return { success: false, error: "Saisissez un e-mail complet ou un matricule au format ETU-AAAA-NNNN.", code: "VALIDATION_ERROR" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Connexion requise.", code: "UNAUTHORIZED" };
  const { data: role, error: roleError } = await supabase.rpc("effective_user_role");
  if (roleError || !["admin", "director"].includes(role ?? "")) {
    return { success: false, error: "Action réservée au personnel administratif.", code: "FORBIDDEN" };
  }
  if (role === "admin") {
    const { data: allowed, error } = await supabase.rpc("has_university_access", { p_university_id: parsed.data.universityId });
    if (error || allowed !== true) return { success: false, error: "Vous n'avez pas accès à cette université.", code: "FORBIDDEN" };
  }

  let query = supabase
    .from("student_matricule_registry")
    .select("id, first_name, last_name, full_name, email, matricule, field_of_study, academic_level, verification_status")
    .eq("university_id", parsed.data.universityId);
  if (isEmailSearch) {
    query = query.eq("email", parsed.data.search.toLowerCase());
  } else {
    query = query.ilike("matricule", parsed.data.search.toUpperCase());
  }
  const { data, error } = await query.order("submitted_at", { ascending: false }).limit(8);
  if (error) return { success: false, error: "Impossible de rechercher la fiche de matricule." };
  return { success: true, data: data ?? [] };
}

/** Crée un compte étudiant et envoie un lien Supabase pour définir son mot de passe. */
export async function createAssistedStudentAccountAction(
  formData: FormData,
): Promise<ApiResponse<{ id: string }>> {
  const parsed = assistedStudentSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    universityId: formData.get("universityId"),
    studentId: formData.get("studentId"),
    department: formData.get("department"),
    academicLevel: formData.get("academicLevel"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Vérifiez les champs saisis.", code: "VALIDATION_ERROR" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user: actor } } = await supabase.auth.getUser();
  if (!actor) return { success: false, error: "Connexion requise.", code: "UNAUTHORIZED" };
  const { data: role, error: roleError } = await supabase.rpc("effective_user_role");
  if (roleError || !["admin", "director"].includes(role ?? "")) {
    return { success: false, error: "Seuls les administrateurs peuvent créer un compte étudiant.", code: "FORBIDDEN" };
  }
  if (role === "admin") {
    const { data: allowed, error } = await supabase.rpc("has_university_access", {
      p_university_id: parsed.data.universityId,
    });
    if (error || allowed !== true) {
      return { success: false, error: "Vous n'avez pas accès à cette université.", code: "FORBIDDEN" };
    }
  }

  const adminClient = createSupabaseAdminClient();
  const [{ data: university }, { data: existingProfiles }, { data: registryEntries }] = await Promise.all([
    adminClient.from("universities").select("id").eq("id", parsed.data.universityId).eq("is_active", true).maybeSingle(),
    adminClient.from("profiles").select("id, student_id").eq("university_id", parsed.data.universityId),
    adminClient.from("student_matricule_registry").select("matricule, claimed_by_user_id, email, full_name").eq("university_id", parsed.data.universityId),
  ]);
  if (!university) return { success: false, error: "Sélectionnez une université active.", code: "VALIDATION_ERROR" };
  const normalizedMatricule = parsed.data.studentId.replace(/\s+/g, "").toUpperCase();
  if (existingProfiles?.some((profile) => profile.student_id?.replace(/\s+/g, "").toUpperCase() === normalizedMatricule)) {
    return { success: false, error: "Ce matricule est déjà associé à un compte dans cette université.", code: "ALREADY_EXISTS" };
  }
  const existingRegistry = registryEntries?.find((entry) => entry.matricule.replace(/\s+/g, "").toUpperCase() === normalizedMatricule);
  if (existingRegistry?.claimed_by_user_id) {
    return { success: false, error: "Cette fiche de matricule est déjà associée à un compte.", code: "ALREADY_EXISTS" };
  }

  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`;
  if (existingRegistry && (
    existingRegistry.email.trim().toLowerCase() !== parsed.data.email ||
    existingRegistry.full_name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase() !== fullName.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()
  )) {
    return { success: false, error: "Une fiche existe déjà pour ce matricule avec des informations différentes. Corrigez d'abord la fiche dans le registre.", code: "IDENTITY_MISMATCH" };
  }

  const appUrl = getPublicAppUrl();
  if (!appUrl) return { success: false, error: "L'adresse publique du site n'est pas configurée.", code: "CONFIG_ERROR" };

  const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent("/auth/reset-password?setup=1")}`;
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      full_name: fullName,
      student_id: normalizedMatricule,
      university_id: parsed.data.universityId,
      department: parsed.data.department,
    },
    redirectTo,
  });
  if (inviteError || !invited.user) {
    return { success: false, error: inviteError?.message.toLowerCase().includes("already")
      ? "Un compte existe déjà avec cet e-mail. L'étudiant peut utiliser « Mot de passe oublié » pour le retrouver."
      : "Impossible de créer le compte ou d'envoyer l'e-mail. Vérifiez la configuration des e-mails Supabase.", code: "INVITATION_FAILED" };
  }

  const { error: profileError } = await adminClient.from("profiles").update({
    full_name: fullName,
    student_id: normalizedMatricule,
    department: parsed.data.department,
    university_id: parsed.data.universityId,
    is_verified: false,
  }).eq("id", invited.user.id);
  if (profileError) {
    await adminClient.auth.admin.deleteUser(invited.user.id);
    return { success: false, error: "Le profil étudiant n'a pas pu être initialisé. Aucun compte incomplet n'a été conservé.", code: "PROFILE_CREATION_FAILED" };
  }

  // Une fiche existante est conservée; une nouvelle fiche reste pending et ne certifie pas le compte.
  if (!existingRegistry) {
    const { error: registryError } = await adminClient.from("student_matricule_registry").insert({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      full_name: fullName,
      matricule: normalizedMatricule,
      email: parsed.data.email,
      university_id: parsed.data.universityId,
      field_of_study: parsed.data.department,
      academic_level: parsed.data.academicLevel,
      verification_status: "pending",
    });
    if (registryError) {
      await adminClient.auth.admin.deleteUser(invited.user.id);
      return { success: false, error: "La fiche de matricule n'a pas pu être créée. Vérifiez qu'elle n'existe pas déjà.", code: "REGISTRY_CREATION_FAILED" };
    }
  }

  await adminClient.from("audit_logs").insert({
    actor_id: actor.id,
    action: "student.assisted_account_invited",
    target_id: invited.user.id,
    target_type: "profile",
    details: { university_id: parsed.data.universityId },
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/matricules");
  return { success: true, data: { id: invited.user.id } };
}

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
