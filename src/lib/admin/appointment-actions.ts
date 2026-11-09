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
import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Schémas de validation
// ---------------------------------------------------------------------------

const nominateAdminSchema = z.object({
  fullName: z.string().min(2, "Le nom complet doit contenir au moins 2 caractères.").max(100),
  email: z.string().email("Adresse email invalide."),
  universityId: z.string().uuid("Université invalide."),
  accessScope: z.enum(["own_university", "all_universities"]),
});

const closeAppointmentSchema = z.object({
  appointmentId: z.string().uuid("Identifiant de mandat invalide."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide (format AAAA-MM-JJ requis)."),
  revocationReason: z.string().max(500).optional(),
});

function createAppointmentToken() {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  return tokenHash;
}

function adminAccessCallbackUrl(appUrl: string) {
  return `${appUrl}/auth/callback?next=%2Fauth%2Fconfirmed`;
}

async function sendClickableAdminInvitationEmail(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
  fullName: string,
  appUrl: string,
): Promise<{ error: Error | null }> {
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: adminAccessCallbackUrl(appUrl) },
  });
  if (error || !data?.properties.action_link) {
    return { error: error ?? new Error("Supabase n'a pas généré le lien de connexion.") };
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || username;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !username || !password || !from) {
    return { error: new Error("Configuration SMTP absente.") };
  }

  const safeName = escapeEmailHtml(fullName || "Administrateur");
  const safeLink = escapeEmailHtml(data.properties.action_link);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: username, pass: password },
  });
  try {
    await transport.sendMail({
      from,
      to: email,
      subject: "Confirmez votre accès administrateur — ESCAE Innovation Hub",
      text: `Bonjour ${fullName || ""},\n\nLa direction vous a accordé un accès administrateur à ESCAE Innovation Hub. Cliquez sur ce lien sécurisé pour confirmer votre adresse et activer votre espace :\n${data.properties.action_link}\n\nCe lien est personnel et à usage unique. Si vous n'attendiez pas cette invitation, ignorez ce message.\n\nESCAE-BÉNIN — Innovation Hub`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172018;max-width:600px;margin:auto"><h2 style="color:#087d22">Invitation administrateur</h2><p>Bonjour ${safeName},</p><p>La direction vous a accordé un accès administrateur à ESCAE Innovation Hub.</p><p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;background:#03a61c;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Confirmer et accéder à mon espace</a></p><p>Ce lien est personnel et à usage unique. Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p><p style="word-break:break-all"><a href="${safeLink}">${safeLink}</a></p><p>Si vous n'attendiez pas cette invitation, ignorez ce message.</p><p style="color:#536156">ESCAE-BÉNIN — Innovation Hub</p></div>`,
    });
    return { error: null };
  } catch (sendError) {
    console.error("[admin invitation] E-mail cliquable non envoyé.");
    return { error: sendError instanceof Error ? sendError : new Error("Échec d'envoi SMTP.") };
  }
}

function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

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
 * 3. Préparer le compte Supabase Auth sans accorder le rôle admin
 * 4. Créer une affectation d'accès en attente de confirmation de l'e-mail
 * 5. Journaliser l'action
 * 6. Notifier l'administrateur nommé (si compte existant)
 */
export async function nominateAdminAction(
  formData: FormData
): Promise<ApiResponse<{ appointmentId: string }>> {
  const { user, director, supabase } = await assertDirector();

  if (!user || !director) {
    return { success: false, error: "Seul le directeur peut nommer un administrateur.", code: "FORBIDDEN" };
  }

  const parsed = nominateAdminSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    universityId: formData.get("universityId"),
    accessScope: formData.get("accessScope"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message, code: "VALIDATION_ERROR" };
  }

  const { fullName, email: submittedEmail, universityId, accessScope } = parsed.data;
  const email = submittedEmail.trim().toLowerCase();
  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    return { success: false, error: "L'URL publique de la plateforme n'est pas configurée. Aucune invitation n'a été envoyée." };
  }
  const adminClient = createSupabaseAdminClient();

  let targetUser: { id: string; email?: string | null } | null = null;
  for (let page = 1; page <= 100 && !targetUser; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return { success: false, error: "Impossible de vérifier les comptes existants." };
    targetUser = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === email) ?? null;
    if (data.users.length < 100) break;
  }

  if (targetUser) {
    const { data: existingProfile, error: profileError } = await adminClient
      .from("profiles").select("id, role").eq("id", targetUser.id).maybeSingle();
    if (profileError || !existingProfile) {
      return { success: false, error: "Compte Auth existant mais profil introuvable." };
    }
    if (existingProfile.role === "director") {
      return { success: false, error: "Le directeur ne peut pas être nommé administrateur." };
    }
  } else {
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        university_id: universityId,
        admin_setup_required: true,
      },
    });
    if (createError || !created.user) {
      return { success: false, error: createError?.message ?? "Impossible de préparer le compte invité." };
    }
    targetUser = created.user;
  }

  const tokenHash = createAppointmentToken();
  const { data: appointmentId, error: appointmentError } = await supabase.rpc(
    "create_admin_access_invitation",
    {
      p_admin_id: targetUser.id,
      p_recipient_email: email,
      p_university_id: universityId,
      p_access_scope: accessScope,
      p_token_hash: tokenHash,
    },
  );
  if (appointmentError || !appointmentId) {
    if (appointmentError?.code === "23505") {
      return { success: false, error: "Un accès administrateur actif ou en attente couvre déjà ce périmètre.", code: "DUPLICATE_APPOINTMENT" };
    }
    return { success: false, error: appointmentError?.message ?? "Échec de création du mandat." };
  }

  const { error: emailError } = await sendClickableAdminInvitationEmail(
    adminClient,
    email,
    fullName,
    appUrl,
  );
  if (emailError) {
    await supabase.rpc("finish_admin_appointment", {
      p_appointment_id: appointmentId,
      p_final_status: "revoked",
      p_end_date: new Date().toISOString().slice(0, 10),
      p_reason: "Échec d'envoi de l'invitation",
    });
    await writeAuditLog({ actorId: user.id, action: "admin.invitation_failed", targetId: appointmentId, targetType: "admin_appointment" });
    return { success: false, error: "Le lien sécurisé n'a pas pu être envoyé ; la nomination a été révoquée." };
  }

  if (targetUser) {
    await sendNotification({
      userId: targetUser.id,
      type: "admin_nominated",
      title: "🎉 Vous avez été nommé administrateur",
      message: `${director.full_name} vous a attribué un accès administrateur. Ouvrez le lien reçu par e-mail pour confirmer votre adresse; votre tableau de bord sera activé automatiquement.`,
      linkUrl: "/auth/login",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/users");

  return { success: true, data: { appointmentId } };
}

const updateAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  universityId: z.string().uuid(),
  accessScope: z.enum(["own_university", "all_universities"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  missionDescription: z.string().min(2).max(1000),
});

/** Director-only edits. The audit trigger records before/after values. */
export async function updateAdminAppointmentAction(formData: FormData): Promise<ApiResponse<void>> {
  const { user, director, supabase } = await assertDirector();
  if (!user || !director) return { success: false, error: "Seul le directeur peut modifier une nomination.", code: "FORBIDDEN" };
  const parsed = updateAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    universityId: formData.get("universityId"),
    accessScope: formData.get("accessScope"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    missionDescription: formData.get("missionDescription"),
  });
  if (!parsed.success || parsed.data.startDate > parsed.data.endDate) {
    return { success: false, error: parsed.success ? "La fin du mandat doit suivre son début." : parsed.error.errors[0].message, code: "VALIDATION_ERROR" };
  }
  const { appointmentId, universityId, accessScope, startDate, endDate, missionDescription } = parsed.data;
  const { data, error } = await supabase.rpc("update_admin_appointment", {
    p_appointment_id: appointmentId,
    p_university_id: universityId,
    p_access_scope: accessScope,
    p_start_date: startDate,
    p_end_date: endDate,
    p_mission_description: missionDescription.trim(),
  });
  if (error || data !== true) return { success: false, error: "Nomination introuvable ou non modifiable." };
  revalidatePath("/admin/appointments");
  revalidatePath("/admin");
  return { success: true, data: undefined };
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

  const tokenHash = createAppointmentToken();
  const sessionClient = await createSupabaseServerClient();
  const { data: issued, error: issueError } = await sessionClient.rpc(
    "issue_admin_appointment_invitation_token",
    { p_appointment_id: appointment.id, p_recipient_email: email, p_token_hash: tokenHash },
  );
  if (issueError || issued !== true) return { success: false, error: "Impossible de renouveler cette invitation." };

  const { error: emailError } = await sendClickableAdminInvitationEmail(
    adminClient,
    email,
    authUser.user?.user_metadata?.full_name ?? "Administrateur",
    appUrl,
  );
  if (emailError) {
    await writeAuditLog({ actorId: user.id, action: "admin.invitation_resend_failed", targetId: appointment.id, targetType: "admin_appointment", details: { error: emailError.message } });
    return { success: false, error: "Le lien sécurisé n'a pas pu être envoyé par e-mail." };
  }

  await writeAuditLog({ actorId: user.id, action: "admin.invitation_resent", targetId: appointment.id, targetType: "admin_appointment" });  revalidatePath("/admin/appointments");
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
  const sessionClient = await createSupabaseServerClient();
  const { data: finished, error: updateError } = await sessionClient.rpc("finish_admin_appointment", {
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

  const sessionClient = await createSupabaseServerClient();
  const { data: finished, error: updateError } = await sessionClient.rpc("finish_admin_appointment", {
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
export async function confirmAppointmentStartAction(_formData: FormData): Promise<ApiResponse<void>> {
  return {
    success: false,
    error: "Les dates et la mission du mandat sont fixées par le directeur.",
    code: "FORBIDDEN",
  };
}

// ---------------------------------------------------------------------------// Action 5 : Mettre à jour la fiche profil admin (par l'admin lui-même)
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

  const { data: effectiveRole } = await supabase.rpc("effective_user_role");
  if (!profile || !["admin", "director"].includes(effectiveRole ?? "")) {
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

  const { fullName, department } = parsed.data;
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

  if (!callerProfile || callerProfile.role !== "director") {
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

  const { data: effectiveRole } = await supabase.rpc("effective_user_role");
  if (!profile || !["admin", "director"].includes(effectiveRole ?? "")) {
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
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0].message,
      code: "VALIDATION_ERROR",
    };
  }

  const { appointmentId, fullName, department, password } = parsed.data;
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
  if (appointment.status !== "active" || !appointment.invitation_accepted_at) {
    return { success: false, error: "Cette nomination n'est pas acceptée ou active." };
  }

  // 1. Définir le mot de passe utilisateur dans Supabase Auth
  const { error: pwdError } = await adminClient.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { ...user.user_metadata, admin_setup_required: false },
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

  // Le mandat est déjà activé de façon atomique lors de l'acceptation du jeton.

  // 4. Journal d'audit
  await writeAuditLog({
    actorId: user.id,
    action: "admin.account_activated",
    targetId: appointmentId,
    targetType: "admin_appointment",
    details: {
      admin_id: user.id,
      admin_name: fullName,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/profile/complete");

  return { success: true, data: { redirectTo: "/admin" } };
}
