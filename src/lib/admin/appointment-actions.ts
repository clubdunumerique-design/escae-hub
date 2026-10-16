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
import { getPublicAppUrl } from "@/lib/config/app-url";

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
 * 3. Créer ou inviter le compte Supabase Auth sans accorder le rôle admin
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
  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    return { success: false, error: "L'URL publique de la plateforme n'est pas configurée. Aucune invitation n'a été envoyée." };
  }
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

    // Existing accounts are promoted only after redeeming an email link.
  } else {
    // Nouveau compte : Supabase utilise le modèle « Invite user ».
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

    // Keep the invited account at its default student role until the one-time
    // invitation link is redeemed. The callback promotes it atomically.
    const { error: invitedProfileError } = await adminClient
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", targetUserId);
    if (invitedProfileError) {
      await writeAuditLog({ actorId: user.id, action: "admin.invited_profile_update_failed", targetId: targetUserId, targetType: "profile" });
      return { success: false, error: "L'invitation est partie, mais le profil n'a pas pu être préparé. Le lien reste inutilisable avant validation du mandat." };
    }
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
      if (existingAuthUser && originalRole && originalRole !== "admin") {
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

  if (existingAuthUser) {
    // Compte existant : envoyer un lien de connexion à usage unique, jamais un
    // message de réinitialisation. Le modèle Supabase « Magic Link » est réservé
    // à cette nomination dans l'application et pointe vers l'acceptation du mandat.
    const { error: emailError } = await adminClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback?next=/admin/profile/complete`,
        shouldCreateUser: false,
      },
    });
    if (emailError) {
      await adminClient.from("admin_appointments").update({
        status: "revoked",
        revocation_reason: "Échec d'envoi de l'email d'invitation",
        updated_at: new Date().toISOString(),
      }).eq("id", appointment.id);
      return { success: false, error: "Le compte existe déjà, mais l'email sécurisé d'invitation n'a pas pu être envoyé." };
    }
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
// Action 1b : Renvoyer le lien distinct d'une nomination en attente
// ---------------------------------------------------------------------------

export async function resendAdminInvitationAction(
  formData: FormData
): Promise<ApiResponse<void>> {
  const { user, director } = await assertDirector();
  if (!user || !director) {
    return { success: false, error: "Seul le directeur peut renvoyer une invitation.", code: "FORBIDDEN" };
  }

  const parsed = z.object({ appointmentId: z.string().uuid() }).safeParse({
    appointmentId: formData.get("appointmentId"),
  });
  if (!parsed.success) {
    return { success: false, error: "Identifiant de mandat invalide.", code: "VALIDATION_ERROR" };
  }

  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    return { success: false, error: "L'URL publique de la plateforme n'est pas configurée." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: appointment, error: appointmentError } = await adminClient
    .from("admin_appointments")
    .select("id, admin_id, status, invitation_accepted_at")
    .eq("id", parsed.data.appointmentId)
    .single();

  if (appointmentError || !appointment) {
    return { success: false, error: "Nomination introuvable." };
  }
  if (appointment.status !== "pending_acceptance" || appointment.invitation_accepted_at) {
    return { success: false, error: "Cette nomination n'est plus en attente." };
  }

  const { data: authUser, error: authUserError } = await adminClient.auth.admin.getUserById(
    appointment.admin_id,
  );
  const email = authUser?.user?.email;
  if (authUserError || !email) {
    return { success: false, error: "Adresse e-mail du compte introuvable." };
  }

  // Renouveler la fenêtre de validité avant l'envoi. Un échec d'envoi ne donne
  // aucun rôle : l'acceptation reste atomiquement protégée par la base.
  const sentAt = new Date().toISOString();
  const { error: updateError } = await adminClient
    .from("admin_appointments")
    .update({ invitation_sent_at: sentAt, updated_at: sentAt })
    .eq("id", appointment.id)
    .eq("status", "pending_acceptance");
  if (updateError) {
    return { success: false, error: "Impossible de préparer le renvoi de l'invitation." };
  }

  const { error: emailError } = await adminClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=/admin/profile/complete`,
      shouldCreateUser: false,
    },
  });
  if (emailError) {
    await writeAuditLog({
      actorId: user.id,
      action: "admin.invitation_resend_failed",
      targetId: appointment.id,
      targetType: "admin_appointment",
      details: { error: emailError.message },
    });
    return { success: false, error: "Le lien de nomination n'a pas pu être envoyé. Vérifiez le SMTP et les journaux Auth." };
  }

  await writeAuditLog({
    actorId: user.id,
    action: "admin.invitation_resent",
    targetId: appointment.id,
    targetType: "admin_appointment",
  });
  revalidatePath("/admin/appointments");
  return { success: true, data: undefined };
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
  const { data: finished, error: updateError } = await adminClient.rpc("finish_admin_appointment", {
    p_actor_id: user.id,
    p_appointment_id: appointmentId,
    p_final_status: "ended",
    p_end_date: endDate,
    p_reason: revocationReason ?? null,
  });

  if (updateError || finished !== true) {
    console.error("closeAppointmentAction failed:", updateError);
    return { success: false, error: "Erreur lors de la clôture du mandat." };
  }

  // Notification
  await sendNotification({
    userId: appointment.admin_id,
    type: "admin_appointment_ended",
    title: "Fin de votre mandat administrateur",
    message: `Votre mandat d'administrateur a été clôturé par ${director.full_name} le ${new Date(endDate).toLocaleDateString("fr-FR")}. Vos droits administratifs ont été retirés.`,
    linkUrl: "/dashboard",
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

  const parsed = closeAppointmentSchema.pick({ appointmentId: true, revocationReason: true }).safeParse({
    appointmentId: formData.get("appointmentId"),
    revocationReason: formData.get("revocationReason") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" };
  }
  const { appointmentId, revocationReason } = parsed.data;

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

  const { data: finished, error: updateError } = await adminClient.rpc("finish_admin_appointment", {
    p_actor_id: user.id,
    p_appointment_id: appointmentId,
    p_final_status: "revoked",
    p_end_date: today,
    p_reason: revocationReason ?? null,
  });

  if (updateError || finished !== true) {
    console.error("revokeAppointmentAction failed:", updateError);
    return { success: false, error: "Erreur lors de la révocation." };
  }

  await sendNotification({
    userId: appointment.admin_id,
    type: "admin_appointment_revoked",
    title: "Révocation de vos droits administrateurs",
    message: `Vos droits d'administrateur ont été révoqués par ${director.full_name}.`,
    linkUrl: "/dashboard",
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

// ---------------------------------------------------------------------------
// Action 6 : Activation complète du compte administrateur (Zéro friction)
// Définit le mot de passe, enregistre le profil et active le mandat en une seule étape.
// ---------------------------------------------------------------------------

const activateAdminAccountSchema = z
  .object({
    appointmentId: z.string().uuid("Mandat invalide."),
    fullName: z.string().min(2, "Le nom doit comporter au moins 2 caractères.").max(100),
    department: z.string().max(100).optional(),
    password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères.").max(100),
    confirmPassword: z.string(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export async function activateAdminAccountAction(
  formData: FormData
): Promise<ApiResponse<{ redirectTo: string }>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Non autorisé. Veuillez cliquer à nouveau sur le lien de votre email.",
      code: "UNAUTHORIZED",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return {
      success: false,
      error: "Seul un administrateur invité peut activer ce compte.",
      code: "FORBIDDEN",
    };
  }

  const parsed = activateAdminAccountSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    fullName: formData.get("fullName"),
    department: formData.get("department") || undefined,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    startDate: formData.get("startDate") || new Date().toISOString().split("T")[0],
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0].message,
      code: "VALIDATION_ERROR",
    };
  }

  const { appointmentId, fullName, department, password, startDate } = parsed.data;
  const adminClient = createSupabaseAdminClient();

  const { data: appointment, error: appointmentLookupError } = await adminClient
    .from("admin_appointments")
    .select("id, status, invitation_accepted_at")
    .eq("id", appointmentId)
    .eq("admin_id", user.id)
    .maybeSingle();
  if (appointmentLookupError || !appointment) {
    return { success: false, error: "Invitation introuvable pour ce compte." };
  }
  if (appointment.status !== "pending_acceptance" || !appointment.invitation_accepted_at) {
    return { success: false, error: "Cette invitation n'est plus en attente d'activation." };
  }

  // 1. Définir le mot de passe utilisateur dans Supabase Auth
  const { error: pwdError } = await adminClient.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });

  if (pwdError) {
    return {
      success: false,
      error: `Erreur lors de la définition du mot de passe : ${pwdError.message}`,
    };
  }

  // 2. Mettre à jour les informations du profil
  const { error: profileUpdateError } = await adminClient
    .from("profiles")
    .update({
      full_name: fullName,
      department: department ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (profileUpdateError) {
    return { success: false, error: "Le mot de passe est défini, mais le profil n'a pas pu être enregistré. Réessayez." };
  }

  // 3. Activer le mandat d'administrateur
  const today = startDate || new Date().toISOString().split("T")[0];
  const { data: activatedAppointment, error: apptError } = await adminClient
    .from("admin_appointments")
    .update({
      status: "active",
      start_date: today,
      invitation_accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("admin_id", user.id)
    .eq("status", "pending_acceptance")
    .select("id")
    .maybeSingle();

  if (apptError || !activatedAppointment) {
    if (
      apptError?.message?.includes("seul administrateur") ||
      apptError?.message?.includes("idx_admin_appointments_single_active")
    ) {
      return {
        success: false,
        error: "Un autre administrateur est déjà en fonction. Veuillez contacter la direction.",
        code: "SINGLE_ADMIN_CONSTRAINT",
      };
    }
    return { success: false, error: "Erreur lors de l'activation du mandat." };
  }

  // 4. Journal d'audit
  await writeAuditLog({
    actorId: user.id,
    action: "admin.account_activated",
    targetId: appointmentId,
    targetType: "admin_appointment",
    details: {
      admin_id: user.id,
      admin_name: fullName,
      start_date: today,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/profile/complete");

  return { success: true, data: { redirectTo: "/admin" } };
}
