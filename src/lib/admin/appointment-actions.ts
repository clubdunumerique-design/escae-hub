"use server";

/**
 * Actions serveur — Gestion des nominations des administrateurs.
 * Exclusivement réservé au rôle director.
 * Toutes les opérations sensibles utilisent le client admin (service_role)
 * UNIQUEMENT après vérification du rôle côté serveur.
 */

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ApiResponse } from "@/types";
import { sendNotification } from "@/lib/notifications/send";

// ---------------------------------------------------------------------------
// Schémas de validation
// ---------------------------------------------------------------------------

const nominateAdminSchema = z.object({
  fullName: z.string().min(2, "Le nom complet doit contenir au moins 2 caractères.").max(100),
  email: z.string().email("Adresse email invalide."),
  missionDescription: z.string().max(1000).optional(),
});

const closeAppointmentSchema = z.object({
  appointmentId: z.string().uuid("Identifiant de mandat invalide."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide (format AAAA-MM-JJ requis)."),
  revocationReason: z.string().max(500).optional(),
});

const confirmStartDateSchema = z.object({
  appointmentId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de prise de fonction invalide."),
  missionDescription: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Vérifie que l'appelant est authentifié et possède le rôle director.
 * Retourne le profil du directeur ou null si non autorisé.
 */
async function assertDirector() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, director: null, supabase };

  const { data: director } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!director || director.role !== "director") {
    return { user, director: null, supabase };
  }

  return { user, director, supabase };
}

/**
 * Insère une entrée dans le journal d'audit via le client admin.
 * Les erreurs d'audit ne doivent pas bloquer l'opération principale.
 */
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
    // Le journal d'audit ne doit jamais faire échouer l'opération principale.
    console.error("[audit] Échec de l'écriture du log :", action);
  }
}

// ---------------------------------------------------------------------------
// Action 1 : Nommer un administrateur et envoyer l'invitation
// ---------------------------------------------------------------------------

/**
 * Le directeur nomme un nouvel administrateur.
 * Flux :
 * 1. Vérifier que l'appelant est directeur
 * 2. Vérifier les doublons (compte existant / mandat actif)
 * 3. Créer ou inviter le compte Supabase Auth avec role=admin
 * 4. Créer l'enregistrement admin_appointments
 * 5. Journaliser l'action
 * 6. Notifier l'administrateur nommé (si compte existant)
 */
export async function nominateAdminAction(
  formData: FormData
): Promise<ApiResponse<{ appointmentId: string }>> {
  const { user, director } = await assertDirector();

  if (!user || !director) {
    return { success: false, error: "Seul le directeur peut nommer un administrateur.", code: "FORBIDDEN" };
  }

  const parsed = nominateAdminSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    missionDescription: formData.get("missionDescription") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" };
  }

  const { fullName, email, missionDescription } = parsed.data;
  const adminClient = createSupabaseAdminClient();

  // 2a. Vérifier si un compte avec cet email existe déjà
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existingAuthUser = existingUsers?.users?.find((u) => u.email === email);

  let targetUserId: string;
  let originalRole: string | null = null;

  if (existingAuthUser) {
    // L'utilisateur existe déjà dans Auth
    targetUserId = existingAuthUser.id;

    // Vérifier son profil dans la table profiles
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", targetUserId)
      .single();

    if (!existingProfile) {
      return { success: false, error: "Compte existant mais profil introuvable. Contactez le support." };
    }

    originalRole = existingProfile.role;

    if (existingProfile.role === "director") {
      return { success: false, error: "Cet utilisateur est déjà directeur. Impossible de le nommer administrateur." };
    }

    // Vérifier qu'il n'a pas déjà un mandat actif ou en attente
    const { data: existingAppointment } = await adminClient
      .from("admin_appointments")
      .select("id, status")
      .eq("admin_id", targetUserId)
      .in("status", ["pending_acceptance", "active"])
      .maybeSingle();

    if (existingAppointment) {
      return {
        success: false,
        error: `Cet utilisateur a déjà un mandat en cours (statut : ${existingAppointment.status}). Clôturez-le avant d'en créer un nouveau.`,
        code: "DUPLICATE_APPOINTMENT",
      };
    }

    // Mettre à jour son rôle à 'admin' s'il n'est pas déjà admin
    if (existingProfile.role !== "admin") {
      const { error: roleError } = await adminClient
        .from("profiles")
        .update({ role: "admin", updated_at: new Date().toISOString() })
        .eq("id", targetUserId);

      if (roleError) {
        return { success: false, error: "Erreur lors de la mise à jour du rôle." };
      }
    }
  } else {
    // Inviter un nouveau compte — utilise inviteUserByEmail pour envoyer le lien magique
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: fullName,
          role: "admin",
        },
        redirectTo: `${appUrl}/auth/callback?next=/admin/profile/complete`,
      }
    );

    if (inviteError || !inviteData?.user) {
      // Cas particulier : email déjà existant mais non retrouvé dans listUsers
      const errMsg = inviteError?.message ?? "Erreur inconnue";
      if (errMsg.includes("already been registered") || errMsg.includes("already registered")) {
        return {
          success: false,
          error: "Une invitation ou un compte existe déjà pour cet email. Vérifiez la liste des utilisateurs.",
          code: "DUPLICATE_EMAIL",
        };
      }
      await writeAuditLog({
        actorId: user.id,
        action: "admin.invitation_failed",
        details: { email, error: errMsg },
      });
      return { success: false, error: `L'envoi de l'invitation a échoué : ${errMsg}` };
    }

    targetUserId = inviteData.user.id;

    // Mettre à jour le profil avec le nom complet et le rôle admin
    // (garantit que l'élévation de privilège est effectuée exclusivement par le serveur du directeur)
    await adminClient
      .from("profiles")
      .update({ full_name: fullName, role: "admin", updated_at: new Date().toISOString() })
      .eq("id", targetUserId);
  }

  // 3. Vérifier qu'il n'y a pas déjà un admin actif (contrainte métier : un seul à la fois)
  const { data: activeAppointment } = await adminClient
    .from("admin_appointments")
    .select("id, admin_id")
    .eq("status", "active")
    .maybeSingle();

  if (activeAppointment) {
    // Il y a déjà un admin actif : on peut quand même créer un mandat pending
    // mais on prévient le directeur
    console.warn("[nominations] Un admin est déjà en fonction. Le nouveau mandat sera en attente d'acceptation.");
  }

  // 4. Créer l'enregistrement de nomination
  const now = new Date().toISOString();
  const { data: appointment, error: appointmentError } = await adminClient
    .from("admin_appointments")
    .insert({
      admin_id: targetUserId,
      appointed_by: director.id,
      status: "pending_acceptance",
      mission_description: missionDescription ?? null,
      invitation_sent_at: now,
    })
    .select("id")
    .single();

  if (appointmentError || !appointment) {
    // Nettoyage / compensation en cas d'échec partiel pour garantir l'intégrité
    try {
      if (!existingAuthUser) {
        // Nouveau compte : supprimer le compte Auth et le profil orphelins
        await adminClient.auth.admin.deleteUser(targetUserId);
        await adminClient.from("profiles").delete().eq("id", targetUserId);
      } else if (originalRole && originalRole !== "admin") {
        // Compte existant : rétablir son rôle d'origine
        await adminClient
          .from("profiles")
          .update({ role: originalRole, updated_at: new Date().toISOString() })
          .eq("id", targetUserId);
      }
    } catch {
      console.error("[nominate] Échec du rollback de compensation");
    }

    // Si la contrainte unique_active est violée, message clair
    if (
      appointmentError?.message?.includes("seul administrateur") ||
      appointmentError?.message?.includes("idx_admin_appointments_single_active")
    ) {
      return {
        success: false,
        error: "Un administrateur est déjà en fonction. Clôturez son mandat avant d'en nommer un nouveau.",
        code: "SINGLE_ADMIN_CONSTRAINT",
      };
    }
    return { success: false, error: "Erreur lors de la création du mandat." };
  }

  // 5. Journal d'audit
  await writeAuditLog({
    actorId: user.id,
    action: "admin.nominated",
    targetId: appointment.id,
    targetType: "admin_appointment",
    details: {
      admin_id: targetUserId,
      admin_email: email,
      admin_name: fullName,
      director_name: director.full_name,
      is_new_user: !existingAuthUser,
    },
  });

  // 6. Notification in-app si le compte existait déjà (l'utilisateur peut se connecter)
  if (existingAuthUser) {
    await sendNotification({
      userId: targetUserId,
      type: "admin_nominated",
      title: "🎉 Vous avez été nommé administrateur",
      message: `${director.full_name} vous a nommé(e) administrateur(rice) de la plateforme ESCAE-BÉNIN Innovation Hub. Complétez votre fiche de profil.`,
      linkUrl: "/admin/profile/complete",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/users");

  return { success: true, data: { appointmentId: appointment.id } };
}

// ---------------------------------------------------------------------------
// Action 2 : Clôturer un mandat (directeur)
// ---------------------------------------------------------------------------

/**
 * Le directeur clôture le mandat d'un administrateur.
 * - Met le statut à 'ended'
 * - Enregistre la date de fin
 * - Retire le rôle admin (repasse à student)
 * - Journalise
 */
export async function closeAppointmentAction(
  formData: FormData
): Promise<ApiResponse<void>> {
  const { user, director } = await assertDirector();

  if (!user || !director) {
    return { success: false, error: "Seul le directeur peut clôturer un mandat.", code: "FORBIDDEN" };
  }

  const parsed = closeAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    endDate: formData.get("endDate"),
    revocationReason: formData.get("revocationReason") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" };
  }

  const { appointmentId, endDate, revocationReason } = parsed.data;
  const adminClient = createSupabaseAdminClient();

  // Charger le mandat
  const { data: appointment } = await adminClient
    .from("admin_appointments")
    .select("id, admin_id, status, start_date")
    .eq("id", appointmentId)
    .single();

  if (!appointment) {
    return { success: false, error: "Mandat introuvable." };
  }

  if (appointment.status === "ended" || appointment.status === "revoked") {
    return { success: false, error: "Ce mandat est déjà clôturé." };
  }

  // Vérifier cohérence des dates
  if (appointment.start_date && endDate < appointment.start_date) {
    return {
      success: false,
      error: "La date de fin ne peut pas être antérieure à la date de prise de fonction.",
    };
  }

  // Mettre à jour le mandat
  const { error: updateError } = await adminClient
    .from("admin_appointments")
    .update({
      status: "ended",
      end_date: endDate,
      revocation_reason: revocationReason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (updateError) {
    return { success: false, error: "Erreur lors de la clôture du mandat." };
  }

  // Retirer le rôle admin → repasser à student
  const { error: roleError } = await adminClient
    .from("profiles")
    .update({ role: "student", updated_at: new Date().toISOString() })
    .eq("id", appointment.admin_id);

  if (roleError) {
    // Log l'erreur mais ne bloque pas (le mandat est déjà clos)
    await writeAuditLog({
      actorId: user.id,
      action: "admin.role_revocation_failed",
      targetId: appointment.admin_id,
      targetType: "profile",
      details: { appointmentId, error: roleError.message },
    });
  }

  // Notification
  await sendNotification({
    userId: appointment.admin_id,
    type: "admin_appointment_ended",
    title: "Fin de votre mandat administrateur",
    message: `Votre mandat d'administrateur a été clôturé par ${director.full_name} le ${new Date(endDate).toLocaleDateString("fr-FR")}. Vos droits administratifs ont été retirés.`,
    linkUrl: "/dashboard",
  });

  // Journal
  await writeAuditLog({
    actorId: user.id,
    action: "admin.appointment_closed",
    targetId: appointmentId,
    targetType: "admin_appointment",
    details: {
      admin_id: appointment.admin_id,
      end_date: endDate,
      revocation_reason: revocationReason,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/appointments");

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Action 3 : Révoquer un mandat (directeur) — révocation immédiate
// ---------------------------------------------------------------------------

export async function revokeAppointmentAction(
  formData: FormData
): Promise<ApiResponse<void>> {
  const { user, director } = await assertDirector();

  if (!user || !director) {
    return { success: false, error: "Seul le directeur peut révoquer un mandat.", code: "FORBIDDEN" };
  }

  const appointmentId = formData.get("appointmentId") as string;
  const revocationReason = (formData.get("revocationReason") as string) || null;

  if (!appointmentId) {
    return { success: false, error: "Identifiant de mandat requis." };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: appointment } = await adminClient
    .from("admin_appointments")
    .select("id, admin_id, status")
    .eq("id", appointmentId)
    .single();

  if (!appointment) {
    return { success: false, error: "Mandat introuvable." };
  }

  if (appointment.status === "ended" || appointment.status === "revoked") {
    return { success: false, error: "Ce mandat est déjà clôturé ou révoqué." };
  }

  const today = new Date().toISOString().split("T")[0];

  const { error: updateError } = await adminClient
    .from("admin_appointments")
    .update({
      status: "revoked",
      end_date: today,
      revocation_reason: revocationReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (updateError) {
    return { success: false, error: "Erreur lors de la révocation." };
  }

  // Retirer les droits
  await adminClient
    .from("profiles")
    .update({ role: "student", updated_at: new Date().toISOString() })
    .eq("id", appointment.admin_id);

  await sendNotification({
    userId: appointment.admin_id,
    type: "admin_appointment_revoked",
    title: "Révocation de vos droits administrateurs",
    message: `Vos droits d'administrateur ont été révoqués par ${director.full_name}.`,
    linkUrl: "/dashboard",
  });

  await writeAuditLog({
    actorId: user.id,
    action: "admin.appointment_revoked",
    targetId: appointmentId,
    targetType: "admin_appointment",
    details: { admin_id: appointment.admin_id, revocation_reason: revocationReason },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/appointments");

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Action 4 : Confirmer la date de prise de fonction (admin sur son propre mandat)
// ---------------------------------------------------------------------------

/**
 * L'administrateur confirme sa date de prise de fonction et active son mandat.
 * Seul l'administrateur concerné peut appeler cette action.
 */
export async function confirmAppointmentStartAction(
  formData: FormData
): Promise<ApiResponse<void>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Non autorisé.", code: "UNAUTHORIZED" };
  }

  // Vérifier que l'appelant est bien admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "Seul un administrateur peut confirmer sa prise de fonction.", code: "FORBIDDEN" };
  }

  const parsed = confirmStartDateSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    startDate: formData.get("startDate"),
    missionDescription: formData.get("missionDescription") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" };
  }

  const { appointmentId, startDate, missionDescription } = parsed.data;
  const adminClient = createSupabaseAdminClient();

  // Vérifier que ce mandat appartient bien à cet utilisateur
  const { data: appointment } = await adminClient
    .from("admin_appointments")
    .select("id, admin_id, status")
    .eq("id", appointmentId)
    .eq("admin_id", user.id)
    .single();

  if (!appointment) {
    return { success: false, error: "Mandat introuvable ou non autorisé." };
  }

  if (appointment.status === "ended" || appointment.status === "revoked") {
    return { success: false, error: "Ce mandat est clôturé." };
  }

  // Activer le mandat
  const updatePayload: Record<string, unknown> = {
    status: "active",
    start_date: startDate,
    invitation_accepted_at: appointment.status === "pending_acceptance" ? new Date().toISOString() : undefined,
    updated_at: new Date().toISOString(),
  };

  if (missionDescription !== undefined) {
    updatePayload.mission_description = missionDescription;
  }

  const { error: updateError } = await adminClient
    .from("admin_appointments")
    .update(updatePayload)
    .eq("id", appointmentId);

  if (updateError) {
    // Vérifier contrainte d'unicité
    if (updateError.message?.includes("seul administrateur")) {
      return {
        success: false,
        error: "Un autre administrateur est déjà en fonction. Contactez le directeur.",
        code: "SINGLE_ADMIN_CONSTRAINT",
      };
    }
    return { success: false, error: "Erreur lors de la confirmation de la prise de fonction." };
  }

  await writeAuditLog({
    actorId: user.id,
    action: "admin.appointment_activated",
    targetId: appointmentId,
    targetType: "admin_appointment",
    details: { start_date: startDate, admin_name: profile.full_name },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/profile/complete");

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Action 5 : Mettre à jour la fiche profil admin (par l'admin lui-même)
// ---------------------------------------------------------------------------

const updateAdminProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  department: z.string().max(100).optional(),
  missionDescription: z.string().max(1000).optional(),
  appointmentId: z.string().uuid().optional(),
});

export async function updateAdminProfileAction(
  formData: FormData
): Promise<ApiResponse<void>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Non autorisé.", code: "UNAUTHORIZED" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "director"].includes(profile.role)) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  const parsed = updateAdminProfileSchema.safeParse({
    fullName: formData.get("fullName") || undefined,
    department: formData.get("department") || undefined,
    missionDescription: formData.get("missionDescription") || undefined,
    appointmentId: formData.get("appointmentId") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" };
  }

  const { fullName, department, missionDescription, appointmentId } = parsed.data;
  const adminClient = createSupabaseAdminClient();

  // Mettre à jour les champs profil autorisés (pas le rôle)
  const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fullName) profileUpdates.full_name = fullName;
  if (department !== undefined) profileUpdates.department = department;

  if (Object.keys(profileUpdates).length > 1) {
    const { error: profileError } = await adminClient
      .from("profiles")
      .update(profileUpdates)
      .eq("id", user.id);

    if (profileError) {
      return { success: false, error: "Erreur lors de la mise à jour du profil." };
    }
  }

  // Mettre à jour la description de mission sur le mandat si fourni
  if (appointmentId && missionDescription !== undefined) {
    // L'admin ne peut modifier que son propre mandat actif
    const { data: appt } = await adminClient
      .from("admin_appointments")
      .select("id, admin_id, status")
      .eq("id", appointmentId)
      .eq("admin_id", user.id)
      .in("status", ["active", "pending_acceptance"])
      .single();

    if (appt) {
      await adminClient
        .from("admin_appointments")
        .update({
          mission_description: missionDescription,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);
    }
  }

  await writeAuditLog({
    actorId: user.id,
    action: "admin.profile_updated",
    targetId: user.id,
    targetType: "profile",
    details: { updated_fields: Object.keys(profileUpdates) },
  });

  revalidatePath("/admin/profile/complete");
  revalidatePath("/admin/users");

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Lecture : récupérer tous les mandats (directeur)
// ---------------------------------------------------------------------------

export async function getAppointmentsAction(): Promise<
  ApiResponse<{
    active: unknown[];
    pending: unknown[];
    history: unknown[];
  }>
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Non autorisé.", code: "UNAUTHORIZED" };

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || !["director", "admin"].includes(callerProfile.role)) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: appointments, error } = await adminClient
    .from("admin_appointments")
    .select(`
      id, admin_id, appointed_by, status,
      mission_description, start_date, end_date,
      invitation_sent_at, invitation_accepted_at,
      revocation_reason, created_at, updated_at,
      admin:profiles!admin_appointments_admin_id_fkey(id, email, full_name, department),
      director:profiles!admin_appointments_appointed_by_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: "Erreur lors de la récupération des mandats." };
  }

  const active = appointments?.filter((a) => a.status === "active") ?? [];
  const pending = appointments?.filter((a) => a.status === "pending_acceptance") ?? [];
  const history = appointments?.filter((a) => ["ended", "revoked"].includes(a.status)) ?? [];

  return { success: true, data: { active, pending, history } };
}

// ---------------------------------------------------------------------------
// Lecture : récupérer le mandat courant de l'admin connecté
// ---------------------------------------------------------------------------

export async function getMyAppointmentAction(): Promise<ApiResponse<unknown>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Non autorisé.", code: "UNAUTHORIZED" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "director"].includes(profile.role)) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: appointment } = await adminClient
    .from("admin_appointments")
    .select(`
      id, admin_id, appointed_by, status,
      mission_description, start_date, end_date,
      invitation_sent_at, invitation_accepted_at,
      created_at, updated_at,
      director:profiles!admin_appointments_appointed_by_fkey(id, full_name)
    `)
    .eq("admin_id", user.id)
    .in("status", ["active", "pending_acceptance"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { success: true, data: appointment };
}

// ---------------------------------------------------------------------------
// Lecture : journal d'audit (directeur)
// ---------------------------------------------------------------------------

export async function getAuditLogsAction(limit = 50): Promise<ApiResponse<unknown[]>> {
  const { user, director } = await assertDirector();

  if (!user || !director) {
    return { success: false, error: "Seul le directeur peut consulter le journal d'audit.", code: "FORBIDDEN" };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: logs, error } = await adminClient
    .from("audit_logs")
    .select(`
      id, actor_id, action, target_id, target_type,
      details, created_at,
      actor:profiles!audit_logs_actor_id_fkey(id, full_name, role)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { success: false, error: "Erreur lors de la récupération du journal." };
  }

  return { success: true, data: logs ?? [] };
}
