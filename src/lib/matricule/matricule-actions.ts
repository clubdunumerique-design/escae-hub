"use server";

/**
 * Actions serveur — Registre des matricules étudiants et vérification.
 * - Soumission publique (sans authentification) : submitStudentMatriculeAction
 * - Gestion administrative (réservé aux rôles admin & director) :
 *   getMatriculeRegistryAction, approveMatriculeAction, rejectMatriculeAction, createOfficialMatriculeAction
 */

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ApiResponse, MatriculeVerificationStatus, StudentMatriculeEntry } from "@/types";
import { sendNotification } from "@/lib/notifications/send";

// ---------------------------------------------------------------------------
// Schémas de validation
// ---------------------------------------------------------------------------

const publicMatriculeSubmissionSchema = z.object({
  firstName: z
    .string()
    .min(2, "Le prénom doit comporter au moins 2 caractères.")
    .max(60, "Le prénom est trop long.")
    .trim(),
  lastName: z
    .string()
    .min(2, "Le nom doit comporter au moins 2 caractères.")
    .max(60, "Le nom est trop long.")
    .trim(),
  matricule: z
    .string()
    .min(3, "Le matricule doit comporter au moins 3 caractères.")
    .max(30, "Le matricule ne doit pas dépasser 30 caractères.")
    .regex(/^[A-Za-z0-9\-_./]+$/, "Format de matricule invalide (caractères alphanumériques autorisés).")
    .trim(),
  email: z.string().email("Adresse email invalide.").trim().toLowerCase(),
  fieldOfStudy: z.string().max(100).optional(),
  academicLevel: z.string().max(50).optional(),
  honeypot: z.string().max(0, "Tentative de spam détectée.").optional(),
});

const reviewMatriculeSchema = z.object({
  registryId: z.string().uuid("Identifiant invalide."),
  reason: z.string().max(500, "Le motif est trop long.").optional(),
});

const manualAddMatriculeSchema = z.object({
  firstName: z.string().min(2).max(60).trim(),
  lastName: z.string().min(2).max(60).trim(),
  matricule: z.string().min(3).max(30).trim(),
  email: z.string().email().trim().toLowerCase(),
  fieldOfStudy: z.string().max(100).optional(),
  academicLevel: z.string().max(50).optional(),
  verificationStatus: z.enum(["pending", "verified"]).default("verified"),
});

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

async function assertStaff() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, staff: null };

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!staff || !["admin", "director"].includes(staff.role)) {
    return { user, staff: null };
  }

  return { user, staff };
}

async function writeAuditLog({
  actorId,
  action,
  targetId,
  targetType,
  details,
}: {
  actorId: string | null;
  action: string;
  targetId?: string | null;
  targetType?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const adminClient = createSupabaseAdminClient();
    await adminClient.from("audit_logs").insert({
      actor_id: actorId,
      action,
      target_id: targetId ?? null,
      target_type: targetType ?? null,
      details: details ?? null,
    });
  } catch {
    console.error("[audit] Échec de l'écriture du log matricule :", action);
  }
}

function extractField(data: FormData | Record<string, unknown>, key: string, fallbackKey?: string): string | undefined {
  if (typeof (data as any)?.get === "function") {
    const val = (data as FormData).get(key) ?? (fallbackKey ? (data as FormData).get(fallbackKey) : null);
    return typeof val === "string" ? val : undefined;
  }
  const obj = data as Record<string, unknown>;
  const val = obj[key] ?? (fallbackKey ? obj[fallbackKey] : undefined);
  return typeof val === "string" ? val : undefined;
}

// ---------------------------------------------------------------------------
// Action 1 : Soumission publique d'un matricule étudiant (visiteurs sans compte)
// ---------------------------------------------------------------------------

export async function submitStudentMatriculeAction(
  formData: FormData | Record<string, unknown>
): Promise<
  ApiResponse<{
    matricule: string;
    fullName: string;
    status: MatriculeVerificationStatus;
    isExistingUser: boolean;
  }>
> {
  const parsed = publicMatriculeSubmissionSchema.safeParse({
    firstName: extractField(formData, "firstName", "first_name"),
    lastName: extractField(formData, "lastName", "last_name"),
    matricule: extractField(formData, "matricule"),
    email: extractField(formData, "email"),
    fieldOfStudy: extractField(formData, "fieldOfStudy", "filiere") || undefined,
    academicLevel: extractField(formData, "academicLevel", "academic_level") || undefined,
    honeypot: extractField(formData, "website", "honeypot") || undefined, // champ piège anti-spam
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0].message,
      code: "VALIDATION_ERROR",
    };
  }

  const { firstName, lastName, email, fieldOfStudy, academicLevel } = parsed.data;
  const normalizedMatricule = parsed.data.matricule.toUpperCase().trim();
  const fullName = `${firstName.trim()} ${lastName.trim()}`;

  const adminClient = createSupabaseAdminClient();

  // 1. Vérifier si ce matricule existe déjà dans le registre
  const { data: existingEntry } = await adminClient
    .from("student_matricule_registry")
    .select("id, matricule, verification_status, email, claimed_by_user_id")
    .ilike("matricule", normalizedMatricule)
    .maybeSingle();

  if (existingEntry) {
    if (existingEntry.verification_status === "verified") {
      return {
        success: false,
        error: "Ce matricule est déjà enregistré et vérifié dans le registre officiel de l'ESCAE.",
        code: "ALREADY_VERIFIED",
      };
    }

    if (existingEntry.verification_status === "pending") {
      return {
        success: false,
        error: "Ce matricule a déjà été soumis et est actuellement en cours d'examen par la scolarité.",
        code: "ALREADY_PENDING",
      };
    }

    // Si rejeté précédemment, on autorise la mise à jour de la demande
    const { error: updateError } = await adminClient
      .from("student_matricule_registry")
      .update({
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email,
        field_of_study: fieldOfStudy ?? null,
        academic_level: academicLevel ?? null,
        verification_status: "pending",
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingEntry.id);

    if (updateError) {
      return { success: false, error: "Erreur lors de la mise à jour de la demande." };
    }

    return {
      success: true,
      data: {
        matricule: normalizedMatricule,
        fullName,
        status: "pending",
        isExistingUser: false,
      },
    };
  }

  // 2. Vérifier si un compte étudiant existe déjà avec cet email sur la plateforme
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id, role, student_id, is_verified")
    .eq("email", email)
    .maybeSingle();

  const claimedByUserId = existingProfile?.id ?? null;

  // 3. Insérer la nouvelle fiche dans le registre
  const { data: newEntry, error: insertError } = await adminClient
    .from("student_matricule_registry")
    .insert({
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      matricule: normalizedMatricule,
      email,
      field_of_study: fieldOfStudy ?? null,
      academic_level: academicLevel ?? null,
      verification_status: "pending",
      claimed_by_user_id: claimedByUserId,
      claimed_at: claimedByUserId ? new Date().toISOString() : null,
    })
    .select("id, verification_status")
    .single();

  if (insertError || !newEntry) {
    if (insertError?.message?.includes("idx_student_registry_matricule_unique")) {
      return {
        success: false,
        error: "Une fiche avec ce matricule a déjà été enregistrée.",
        code: "DUPLICATE_MATRICULE",
      };
    }
    return { success: false, error: "Erreur lors de l'enregistrement de votre matricule." };
  }

  // 4. Si l'étudiant est déjà inscrit sur Innovation Hub, associer son student_id
  if (existingProfile && !existingProfile.student_id) {
    await adminClient
      .from("profiles")
      .update({
        student_id: normalizedMatricule,
        department: fieldOfStudy || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingProfile.id);
  }

  // 5. Journalisation d'audit (sans acteur connecté)
  await writeAuditLog({
    actorId: null,
    action: "student.matricule_submitted",
    targetId: newEntry.id,
    targetType: "student_matricule_registry",
    details: {
      matricule: normalizedMatricule,
      email,
      is_claimed: !!claimedByUserId,
    },
  });

  revalidatePath("/admin/matricules");

  return {
    success: true,
    data: {
      matricule: normalizedMatricule,
      fullName,
      status: "pending",
      isExistingUser: !!claimedByUserId,
    },
  };
}

// ---------------------------------------------------------------------------
// Action 2 : Récupérer les fiches du registre (Staff : admin & director)
// ---------------------------------------------------------------------------

export async function getMatriculeRegistryAction(options?: {
  status?: string;
  search?: string;
  limit?: number;
}): Promise<ApiResponse<StudentMatriculeEntry[]>> {
  const { user, staff } = await assertStaff();

  if (!user || !staff) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  const adminClient = createSupabaseAdminClient();
  let query = adminClient
    .from("student_matricule_registry")
    .select(`
      id, first_name, last_name, full_name, matricule, email,
      field_of_study, academic_level, verification_status, rejection_reason,
      claimed_by_user_id, claimed_at, verified_by, verified_at,
      submitted_at, created_at, updated_at,
      verifier:profiles!student_matricule_registry_verified_by_fkey(id, full_name),
      claimed_profile:profiles!student_matricule_registry_claimed_by_user_id_fkey(id, full_name, email)
    `)
    .order("submitted_at", { ascending: false });

  if (options?.status && ["pending", "verified", "rejected"].includes(options.status)) {
    query = query.eq("verification_status", options.status);
  }

  if (options?.search && options.search.trim().length > 0) {
    const term = `%${options.search.trim()}%`;
    query = query.or(`matricule.ilike.${term},full_name.ilike.${term},email.ilike.${term}`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: "Erreur lors de la récupération du registre." };
  }

  return { success: true, data: (data as unknown as StudentMatriculeEntry[]) ?? [] };
}

// ---------------------------------------------------------------------------
// Action 3 : Valider officiellement un matricule (Staff)
// ---------------------------------------------------------------------------

export async function approveMatriculeAction(
  registryId: string
): Promise<ApiResponse<void>> {
  const { user, staff } = await assertStaff();

  if (!user || !staff) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  const parsed = reviewMatriculeSchema.safeParse({ registryId });
  if (!parsed.success) {
    return { success: false, error: "Identifiant invalide.", code: "VALIDATION_ERROR" };
  }

  const adminClient = createSupabaseAdminClient();

  // Charger la fiche
  const { data: entry } = await adminClient
    .from("student_matricule_registry")
    .select("id, matricule, full_name, email, claimed_by_user_id")
    .eq("id", registryId)
    .single();

  if (!entry) {
    return { success: false, error: "Fiche de matricule introuvable." };
  }

  const now = new Date().toISOString();

  // 1. Mettre à jour la fiche dans le registre
  const { error: updateError } = await adminClient
    .from("student_matricule_registry")
    .update({
      verification_status: "verified",
      rejection_reason: null,
      verified_by: user.id,
      verified_at: now,
      updated_at: now,
    })
    .eq("id", registryId);

  if (updateError) {
    return { success: false, error: "Erreur lors de la validation du matricule." };
  }

  // 2. Si un compte étudiant est déjà lié ou a cet email, lui attribuer le statut vérifié
  let targetStudentId = entry.claimed_by_user_id;

  if (!targetStudentId) {
    const { data: matchedProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", entry.email)
      .maybeSingle();
    targetStudentId = matchedProfile?.id ?? null;
  }

  if (targetStudentId) {
    await adminClient
      .from("profiles")
      .update({
        is_verified: true,
        student_id: entry.matricule,
        updated_at: now,
      })
      .eq("id", targetStudentId);

    // Mettre à jour le lien de réclamation si pas encore fait
    await adminClient
      .from("student_matricule_registry")
      .update({ claimed_by_user_id: targetStudentId, claimed_at: now })
      .eq("id", registryId);

    // Notification in-app à l'étudiant
    await sendNotification({
      userId: targetStudentId,
      type: "status_changed",
      title: "✅ Statut étudiant vérifié",
      message: `Votre matricule officiel (${entry.matricule}) a été validé par l'administration. Vous pouvez désormais soumettre des projets d'innovation.`,
      linkUrl: "/dashboard",
    });
  }

  // 3. Journal d'audit
  await writeAuditLog({
    actorId: user.id,
    action: "student.matricule_verified",
    targetId: registryId,
    targetType: "student_matricule_registry",
    details: {
      matricule: entry.matricule,
      student_name: entry.full_name,
      staff_name: staff.full_name,
      associated_user_id: targetStudentId,
    },
  });

  revalidatePath("/admin/matricules");
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Action 4 : Rejeter un matricule avec motif (Staff)
// ---------------------------------------------------------------------------

export async function rejectMatriculeAction(
  registryId: string,
  reason: string
): Promise<ApiResponse<void>> {
  const { user, staff } = await assertStaff();

  if (!user || !staff) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  const parsed = reviewMatriculeSchema.safeParse({ registryId, reason });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: entry } = await adminClient
    .from("student_matricule_registry")
    .select("id, matricule, full_name, claimed_by_user_id")
    .eq("id", registryId)
    .single();

  if (!entry) {
    return { success: false, error: "Fiche introuvable." };
  }

  const now = new Date().toISOString();

  // 1. Mettre à jour le registre
  const { error: updateError } = await adminClient
    .from("student_matricule_registry")
    .update({
      verification_status: "rejected",
      rejection_reason: reason.trim() || "Matricule non conforme aux registres de l'établissement.",
      verified_by: user.id,
      verified_at: now,
      updated_at: now,
    })
    .eq("id", registryId);

  if (updateError) {
    return { success: false, error: "Erreur lors du rejet du matricule." };
  }

  // 2. Si le compte étudiant était déjà lié, réajuster is_verified à false
  if (entry.claimed_by_user_id) {
    await adminClient
      .from("profiles")
      .update({
        is_verified: false,
        updated_at: now,
      })
      .eq("id", entry.claimed_by_user_id);

    await sendNotification({
      userId: entry.claimed_by_user_id,
      type: "status_changed",
      title: "Vérification de matricule rejetée",
      message: `Votre demande de validation de matricule (${entry.matricule}) a été rejetée : ${reason.trim()}`,
      linkUrl: "/dashboard",
    });
  }

  // 3. Journal d'audit
  await writeAuditLog({
    actorId: user.id,
    action: "student.matricule_rejected",
    targetId: registryId,
    targetType: "student_matricule_registry",
    details: {
      matricule: entry.matricule,
      student_name: entry.full_name,
      staff_name: staff.full_name,
      reason,
    },
  });

  revalidatePath("/admin/matricules");
  revalidatePath("/admin/users");

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Action 5 : Ajout direct de matricules certifiés par l'administration (Staff)
// ---------------------------------------------------------------------------

export async function createOfficialMatriculeAction(
  formData: FormData | Record<string, unknown>
): Promise<ApiResponse<{ id: string }>> {
  const { user, staff } = await assertStaff();

  if (!user || !staff) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  const rawStatus = extractField(formData, "verificationStatus", "verification_status");
  const isPreVerified = (formData as any)?.is_pre_verified;

  const parsed = manualAddMatriculeSchema.safeParse({
    firstName: extractField(formData, "firstName", "first_name"),
    lastName: extractField(formData, "lastName", "last_name"),
    matricule: extractField(formData, "matricule"),
    email: extractField(formData, "email"),
    fieldOfStudy: extractField(formData, "fieldOfStudy", "filiere") || undefined,
    academicLevel: extractField(formData, "academicLevel", "academic_level") || undefined,
    verificationStatus: rawStatus || (isPreVerified ? "verified" : "verified"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" };
  }

  const { firstName, lastName, email, fieldOfStudy, academicLevel, verificationStatus } = parsed.data;
  const normalizedMatricule = parsed.data.matricule.toUpperCase().trim();
  const fullName = `${firstName.trim()} ${lastName.trim()}`;

  const adminClient = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: entry, error } = await adminClient
    .from("student_matricule_registry")
    .insert({
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      matricule: normalizedMatricule,
      email,
      field_of_study: fieldOfStudy ?? null,
      academic_level: academicLevel ?? null,
      verification_status: verificationStatus,
      verified_by: verificationStatus === "verified" ? user.id : null,
      verified_at: verificationStatus === "verified" ? now : null,
    })
    .select("id")
    .single();

  if (error || !entry) {
    if (error?.message?.includes("idx_student_registry_matricule_unique")) {
      return { success: false, error: "Ce matricule existe déjà dans le registre." };
    }
    return { success: false, error: "Erreur lors de l'enregistrement." };
  }

  await writeAuditLog({
    actorId: user.id,
    action: "student.matricule_pre_registered",
    targetId: entry.id,
    targetType: "student_matricule_registry",
    details: {
      matricule: normalizedMatricule,
      full_name: fullName,
      status: verificationStatus,
    },
  });

  revalidatePath("/admin/matricules");
  return { success: true, data: { id: entry.id } };
}
