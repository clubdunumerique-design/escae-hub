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
import { claimCollectedMatricule } from "@/lib/matricule/auto-claim";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import nodemailer from "nodemailer";
import { STUDENT_MATRICULE_PATTERN, studentMatriculeSchema } from "@/lib/validations/auth";

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
  universityId: z.string().uuid("Veuillez choisir une université."),
  matricule: studentMatriculeSchema,
  email: z.string().email("Adresse email invalide.").trim().toLowerCase()
    .refine((value) => value.endsWith("@gmail.com"), "Veuillez utiliser une adresse Gmail."),
  fieldOfStudy: z.string().max(100).optional(),
  academicLevel: z.string().max(50).optional(),
  honeypot: z.string().max(0, "Tentative de spam détectée.").optional(),
});

const reviewMatriculeSchema = z.object({
  registryId: z.string().uuid("Identifiant invalide."),
  reason: z.string().max(500, "Le motif est trop long.").optional(),
});

const manualAddMatriculeSchema = z.object({
  universityId: z.string().uuid("Veuillez choisir une université."),
  firstName: z.string().min(2).max(60).trim(),
  lastName: z.string().min(2).max(60).trim(),
  matricule: studentMatriculeSchema,
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

  if (!user) return { user: null, staff: null, supabase };

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, role, full_name, university_id")
    .eq("id", user.id)
    .single();

  const { data: effectiveRole } = await supabase.rpc("effective_user_role");
  if (!staff || !["admin", "director"].includes(effectiveRole ?? "")) {
    return { user, staff: null, supabase };
  }

  return { user, staff: { ...staff, role: effectiveRole as string }, supabase };
}

async function staffCanAccessUniversity(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  staff: { role: string },
  universityId: string,
) {
  if (staff.role === "director") return true;
  const { data, error } = await supabase.rpc("has_university_access", {
    p_university_id: universityId,
  });
  return !error && data === true;
}

function sameIdentity(left: string, right: string) {
  const normalize = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return normalize(left) === normalize(right);
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
    email: string;
    universityId: string;
    status: MatriculeVerificationStatus;
    isExistingUser: boolean;
    isExistingRecord: boolean;
    isSignedIn: boolean;
  }>
> {
  const parsed = publicMatriculeSubmissionSchema.safeParse({
    firstName: extractField(formData, "firstName", "first_name"),
    lastName: extractField(formData, "lastName", "last_name"),
    universityId: extractField(formData, "universityId", "university_id"),
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

  const { firstName, lastName, email, universityId, fieldOfStudy, academicLevel } = parsed.data;
  const normalizedMatricule = parsed.data.matricule;
  const fullName = `${firstName.trim()} ${lastName.trim()}`;

  const adminClient = createSupabaseAdminClient();
  const sessionClient = await createSupabaseServerClient();
  const { data: { user: signedInUser } } = await sessionClient.auth.getUser();

  // Limit public submissions by a keyed IP hash; never store the raw address.
  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-real-ip")
    ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  const rateLimitKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rateLimitKey) {
    return { success: false, error: "Le service de collecte est temporairement indisponible." };
  }
  const ipHash = createHmac("sha256", rateLimitKey).update(ipAddress).digest("hex");
  const { data: allowed, error: rateLimitError } = await adminClient.rpc(
    "consume_public_matricule_rate_limit",
    { p_ip_hash: ipHash },
  );
  if (rateLimitError || allowed !== true) {
    return {
      success: false,
      error: rateLimitError
        ? "Le service de collecte est temporairement indisponible."
        : "Trop de demandes depuis cette connexion. Réessayez dans quelques minutes.",
    };
  }

  const { data: activeUniversity } = await adminClient
    .from("universities")
    .select("id")
    .eq("id", universityId)
    .eq("is_active", true)
    .maybeSingle();
  if (!activeUniversity || activeUniversity.id !== universityId) {
    return { success: false, error: "Veuillez choisir une université active.", code: "VALIDATION_ERROR" };
  }

  // 1. Matricules are unique only inside their selected university.
  const { data: existingEntry, error: lookupError } = await adminClient
    .from("student_matricule_registry")
    .select("id, matricule, first_name, last_name, full_name, field_of_study, academic_level, verification_status, email, claimed_by_user_id")
    .eq("university_id", universityId)
    .ilike("matricule", normalizedMatricule.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (lookupError) {
    return { success: false, error: "Erreur lors de la recherche de votre fiche." };
  }

  if (existingEntry) {
    const matchesSubmittedIdentity =
      sameIdentity(existingEntry.full_name, fullName) &&
      sameIdentity(existingEntry.email, email);

    if (existingEntry.verification_status !== "rejected") {
      if (!matchesSubmittedIdentity) {
        return { success: false, error: "Ce matricule est déjà enregistré dans cette université. Vérifiez vos informations ou contactez la scolarité.", code: "DUPLICATE_MATRICULE" };
      }

      let matchedExistingUser = false;
      if (existingEntry.verification_status === "verified" && signedInUser?.email_confirmed_at) {
        const { matched } = await claimCollectedMatricule(signedInUser.id, universityId, normalizedMatricule);
        matchedExistingUser = matched;
      }

      if (existingEntry.verification_status === "pending") {
        const completedFields = {
          field_of_study: existingEntry.field_of_study ?? fieldOfStudy ?? null,
          academic_level: existingEntry.academic_level ?? academicLevel ?? null,
        };
        if (
          completedFields.field_of_study !== (existingEntry.field_of_study ?? null) ||
          completedFields.academic_level !== (existingEntry.academic_level ?? null)
        ) {
          const { error: completionError } = await adminClient
            .from("student_matricule_registry")
            .update({ ...completedFields, updated_at: new Date().toISOString() })
            .eq("id", existingEntry.id)
            .eq("university_id", universityId)
            .eq("verification_status", "pending");
          if (completionError) {
            return { success: false, error: "La fiche existe, mais les informations complémentaires n'ont pas pu être enregistrées." };
          }
          await writeAuditLog({
            actorId: signedInUser?.id ?? null,
            action: "student.matricule_details_completed",
            targetId: existingEntry.id,
            targetType: "student_matricule_registry",
            details: { university_id: universityId },
          });
        }
      }

      await writeAuditLog({
        actorId: signedInUser?.id ?? null,
        action: "student.matricule_existing_record_reused",
        targetId: existingEntry.id,
        targetType: "student_matricule_registry",
        details: { university_id: universityId, status: existingEntry.verification_status },
      });

      return {
        success: true,
        data: {
          matricule: normalizedMatricule,
          fullName: existingEntry.full_name,
          email: existingEntry.email,
          universityId,
          status: existingEntry.verification_status,
          isExistingUser: matchedExistingUser,
          isExistingRecord: true,
          isSignedIn: Boolean(signedInUser),
        },
      };
    }

    if (existingEntry.claimed_by_user_id) {
      return { success: false, error: "Cette fiche a déjà été associée à un compte et ne peut pas être remplacée.", code: "ALREADY_CLAIMED" };
    }

    // Reuse a rejected row instead of creating another; the new submission returns it to pending.
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
        verified_by: null,
        verified_at: null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingEntry.id)
      .eq("university_id", universityId);

    if (updateError) return { success: false, error: "Erreur lors de la mise à jour de la demande." };

    await writeAuditLog({
      actorId: signedInUser?.id ?? null,
      action: "student.matricule_resubmitted",
      targetId: existingEntry.id,
      targetType: "student_matricule_registry",
      details: { university_id: universityId },
    });

    return {
      success: true,
      data: {
        matricule: normalizedMatricule,
        fullName,
        email,
        universityId,
        status: "pending",
        isExistingUser: false,
        isExistingRecord: true,
        isSignedIn: Boolean(signedInUser),
      },
    };
  }

  // 2. Collecter la fiche sans lui associer un compte sur la base d'un email déclaré.
  const { data: newEntry, error: insertError } = await adminClient
    .from("student_matricule_registry")
    .insert({
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      university_id: universityId,
      matricule: normalizedMatricule,
      email,
      field_of_study: fieldOfStudy ?? null,
      academic_level: academicLevel ?? null,
      verification_status: "pending",
      claimed_by_user_id: null,
      claimed_at: null,
    })
    .select("id, verification_status")
    .single();

  if (insertError || !newEntry) {
    if (insertError?.code === "23505" || insertError?.message?.includes("idx_student_registry_university_matricule_unique")) {
      return {
        success: false,
        error: "Une fiche avec ce matricule a déjà été enregistrée.",
        code: "DUPLICATE_MATRICULE",
      };
    }
    return { success: false, error: "Erreur lors de l'enregistrement de votre matricule." };
  }

  // 3. Journalisation d'audit (sans acteur connecté)
  await writeAuditLog({
    actorId: null,
    action: "student.matricule_submitted",
    targetId: newEntry.id,
    targetType: "student_matricule_registry",
    details: {
      matricule: normalizedMatricule,
      email,
      is_claimed: false,
    },
  });

  // If a confirmed student is already signed in, attempt to match this newly
  // submitted record immediately. The database RPC still checks email, name,
  // student role, ownership, and confirmation atomically.
  let matchedSignedInUser = false;
  if (signedInUser?.email_confirmed_at) {
    const { matched } = await claimCollectedMatricule(signedInUser.id, universityId, normalizedMatricule);
    matchedSignedInUser = matched;
  }

  revalidatePath("/admin/matricules");

  return {
    success: true,
    data: {
      matricule: normalizedMatricule,
      fullName,
      email,
      universityId,
      status: "pending",
      isExistingUser: matchedSignedInUser,
      isExistingRecord: false,
      isSignedIn: Boolean(signedInUser),
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
  universityId?: string;
}): Promise<ApiResponse<StudentMatriculeEntry[]>> {
  const { user, staff, supabase } = await assertStaff();

  if (!user || !staff) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: universities } = await supabase
    .from("universities")
    .select("id")
    .eq("is_active", true);
  const accessibleUniversityIds: string[] = [];
  for (const university of universities ?? []) {
    if (await staffCanAccessUniversity(supabase, staff, university.id)) {
      accessibleUniversityIds.push(university.id);
    }
  }
  if (options?.universityId && !accessibleUniversityIds.includes(options.universityId)) {
    return { success: false, error: "Vous n'avez pas accès à cette université.", code: "FORBIDDEN" };
  }
  const targetUniversityIds = options?.universityId
    ? [options.universityId]
    : accessibleUniversityIds;
  if (targetUniversityIds.length === 0) {
    return { success: true, data: [] };
  }

  let query = adminClient
    .from("student_matricule_registry")
    .select(`
      id, university_id, first_name, last_name, full_name, matricule, email,
      field_of_study, academic_level, verification_status, rejection_reason,
      claimed_by_user_id, claimed_at, verified_by, verified_at,
      submitted_at, created_at, updated_at,
      verifier:profiles!student_matricule_registry_verified_by_fkey(id, full_name),
      claimed_profile:profiles!student_matricule_registry_claimed_by_user_id_fkey(id, full_name, email)
    `)
    .in("university_id", targetUniversityIds)
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

export async function getAccessibleUniversitiesAction(): Promise<ApiResponse<Array<{ id: string; code: string; name: string }>>> {
  const { user, staff, supabase } = await assertStaff();
  if (!user || !staff) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }
  const { data: universities, error } = await supabase
    .from("universities")
    .select("id, code, name")
    .eq("is_active", true)
    .order("name");
  if (error) return { success: false, error: "Impossible de charger les universités." };

  const accessible = [];
  for (const university of universities ?? []) {
    if (await staffCanAccessUniversity(supabase, staff, university.id)) accessible.push(university);
  }
  return { success: true, data: accessible };
}

// ---------------------------------------------------------------------------
// Action 3 : Valider officiellement un matricule (Staff)
// ---------------------------------------------------------------------------

export async function approveMatriculeAction(
  registryId: string
): Promise<ApiResponse<void>> {
  const { user, staff, supabase } = await assertStaff();

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
    .select("id, university_id, matricule, full_name, email, claimed_by_user_id")
    .eq("id", registryId)
    .single();

  if (!entry) {
    return { success: false, error: "Fiche de matricule introuvable." };
  }
  if (!(await staffCanAccessUniversity(supabase, staff, entry.university_id))) {
    return { success: false, error: "Vous n'avez pas accès à cette université.", code: "FORBIDDEN" };
  }
  if (!STUDENT_MATRICULE_PATTERN.test(entry.matricule.trim())) {
    return {
      success: false,
      error: "Ce matricule ne peut pas être validé : format attendu ETU-AAAA-NNNN. Demandez une correction à l'étudiant.",
      code: "VALIDATION_ERROR",
    };
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

  // 2. Tenter la correspondance automatique. Le RPC vérifie l'email confirmé,
  // le nom, le matricule et l'absence de conflit sous verrou de ligne.
  let targetStudentId = entry.claimed_by_user_id;

  if (!targetStudentId) {
    const { data: matchedProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("university_id", entry.university_id)
      .ilike("email", entry.email.trim())
      .maybeSingle();
    targetStudentId = matchedProfile?.id ?? null;
  }

  if (targetStudentId) {
    const { data: matched, error: claimError } = await adminClient.rpc("claim_student_matricule", {
      p_user_id: targetStudentId,
      p_university_id: entry.university_id,
      p_matricule: entry.matricule,
    });
    if (claimError) {
      console.error("[matricule] Échec de la correspondance après mise à jour du registre.");
    } else if (matched === true) {
      await sendNotification({
        userId: targetStudentId,
        type: "status_changed",
        title: "✅ Matricule rapproché",
        message: "Votre email confirmé, votre nom et votre matricule correspondent à la fiche collectée.",
        linkUrl: "/dashboard",
      });
    }
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
  const { user, staff, supabase } = await assertStaff();

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
    .select("id, university_id, matricule, full_name, claimed_by_user_id")
    .eq("id", registryId)
    .single();

  if (!entry) {
    return { success: false, error: "Fiche introuvable." };
  }
  if (!(await staffCanAccessUniversity(supabase, staff, entry.university_id))) {
    return { success: false, error: "Vous n'avez pas accès à cette université.", code: "FORBIDDEN" };
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

/** Send a polite correction request to the email address on a malformed registry entry. */
export async function sendMatriculeReminderAction(registryId: string): Promise<ApiResponse<void>> {
  const { user, staff, supabase } = await assertStaff();
  if (!user || !staff) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }
  const parsedId = z.string().uuid().safeParse(registryId);
  if (!parsedId.success) return { success: false, error: "Fiche invalide.", code: "VALIDATION_ERROR" };

  const adminClient = createSupabaseAdminClient();
  const { data: entry, error } = await adminClient
    .from("student_matricule_registry")
    .select("id, university_id, first_name, email, matricule")
    .eq("id", parsedId.data)
    .single();
  if (error || !entry) return { success: false, error: "Fiche introuvable." };
  if (!(await staffCanAccessUniversity(supabase, staff, entry.university_id))) {
    return { success: false, error: "Vous n'avez pas accès à cette université.", code: "FORBIDDEN" };
  }
  if (STUDENT_MATRICULE_PATTERN.test(entry.matricule.trim())) {
    return { success: false, error: "Ce matricule respecte déjà le format attendu." };
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || username;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !username || !password || !from) {
    return { success: false, error: "L'envoi d'e-mails de relance n'est pas configuré. Vérifiez les variables SMTP privées du serveur." };
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: username, pass: password },
  });
  try {
    await transport.sendMail({
      from,
      to: entry.email,
      subject: "Action requise : corrigez votre matricule étudiant",
      text: `Bonjour ${entry.first_name},\n\nLe matricule transmis (${entry.matricule}) ne respecte pas le format attendu par ESCAE-BÉNIN : ETU-AAAA-NNNN (exemple : ETU-2026-0024).\n\nMerci de vérifier votre carte ou attestation d'inscription et de soumettre à nouveau le matricule exact sur le formulaire officiel. Cette relance ne constitue pas une sanction.\n\nESCAE-BÉNIN — Innovation Hub`,
      html: `<div style="font-family:Arial,sans-serif;color:#172018;line-height:1.6"><h2 style="color:#087d22">Correction de votre matricule étudiant</h2><p>Bonjour ${escapeHtml(entry.first_name)},</p><p>Le matricule transmis (<strong>${escapeHtml(entry.matricule)}</strong>) ne respecte pas le format attendu par ESCAE-BÉNIN : <strong>ETU-AAAA-NNNN</strong> (exemple : <strong>ETU-2026-0024</strong>).</p><p>Merci de vérifier votre carte ou attestation d'inscription et de soumettre à nouveau le matricule exact sur le formulaire officiel.</p><p style="color:#536156">Cette relance est un rappel de correction et ne constitue pas une sanction.</p><p>ESCAE-BÉNIN — Innovation Hub</p></div>`,
    });
  } catch {
    console.error("[matricule] Échec d'envoi du rappel par e-mail.");
    return { success: false, error: "L'e-mail n'a pas pu être envoyé. Vérifiez la configuration du service d'e-mail." };
  }

  await writeAuditLog({
    actorId: user.id,
    action: "student.matricule_correction_reminder_sent",
    targetId: entry.id,
    targetType: "student_matricule_registry",
    details: { staff_name: staff.full_name },
  });
  return { success: true, data: undefined };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

// ---------------------------------------------------------------------------
// Action 5 : Ajout direct de matricules certifiés par l'administration (Staff)
// ---------------------------------------------------------------------------

export async function createOfficialMatriculeAction(
  formData: FormData | Record<string, unknown>
): Promise<ApiResponse<{ id: string }>> {
  const { user, staff, supabase } = await assertStaff();

  if (!user || !staff) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  const rawStatus = extractField(formData, "verificationStatus", "verification_status");
  const isPreVerified = (formData as any)?.is_pre_verified;

  const parsed = manualAddMatriculeSchema.safeParse({
    universityId: extractField(formData, "universityId", "university_id"),
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

  const { universityId, firstName, lastName, email, fieldOfStudy, academicLevel, verificationStatus } = parsed.data;
  const normalizedMatricule = parsed.data.matricule;
  const fullName = `${firstName.trim()} ${lastName.trim()}`;

  const adminClient = createSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!(await staffCanAccessUniversity(supabase, staff, universityId))) {
    return { success: false, error: "Vous n'avez pas accès à cette université.", code: "FORBIDDEN" };
  }

  const { data: entry, error } = await adminClient
    .from("student_matricule_registry")
    .insert({
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      university_id: universityId,
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
    if (error?.code === "23505" || error?.message?.includes("idx_student_registry_university_matricule_unique")) {
      return { success: false, error: "Ce matricule existe déjà dans le registre." };
    }
    return { success: false, error: "Erreur lors de l'enregistrement." };
  }

  // If the student already has a confirmed Hub account, link it immediately;
  // otherwise registration confirmation/login/dashboard retries this claim.
  const { data: matchingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("university_id", universityId)
    .eq("email", email)
    .maybeSingle();
  if (matchingProfile?.id) {
    const { error: claimError } = await adminClient.rpc("claim_student_matricule", {
      p_user_id: matchingProfile.id,
      p_university_id: universityId,
      p_matricule: normalizedMatricule,
    });
    if (claimError) {
      console.error("[matricule] Échec de la correspondance après pré-enregistrement.");
    }
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
