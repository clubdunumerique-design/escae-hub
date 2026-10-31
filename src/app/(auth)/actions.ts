"use server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { claimCollectedMatricule } from "@/lib/matricule/auto-claim";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import type { ApiResponse } from "@/types";
import { revalidatePath } from "next/cache";
import { getPublicAppUrl } from "@/lib/config/app-url";

export async function loginAction(
  formData: FormData,
): Promise<ApiResponse<{ id: string; role: string }>> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { success: false, error: "Veuillez vérifier vos identifiants." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { success: false, error: "Identifiants incorrects." };
  }

  // Lire le rôle depuis la table profiles côté serveur
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, student_id, university_id")
    .eq("id", data.user.id)
    .single();

  // Re-tenter la correspondance pour les comptes confirmés, y compris les anciens comptes.
  if (data.user.email_confirmed_at && (profile?.role === "student" || !profile?.role)) {
    const candidateMatricule = data.user.user_metadata?.student_id ?? profile?.student_id;
    const universityId = data.user.user_metadata?.university_id ?? profile?.university_id;
    await claimCollectedMatricule(data.user.id, universityId, candidateMatricule ?? null);
  }

  revalidatePath("/", "layout");
  const { data: effectiveRole } = await supabase.rpc("effective_user_role");
  return { success: true, data: { id: data.user.id, role: effectiveRole ?? "student" } };
}

export async function registerAction(formData: FormData): Promise<ApiResponse<{ id: string }>> {
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const studentId = (formData.get("studentId") as string) || undefined;
  const universityId = (formData.get("universityId") as string) || undefined;

  const parsed = registerSchema.safeParse({
    fullName,
    email,
    studentId,
    universityId,
    password,
    confirmPassword,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Veuillez vérifier les champs du formulaire.",
    };
  }

  const rawMatricule = parsed.data.studentId?.trim().toUpperCase() || null;
  const admin = createSupabaseAdminClient();
  const { data: university } = await admin
    .from("universities")
    .select("id")
    .eq("id", parsed.data.universityId)
    .eq("is_active", true)
    .maybeSingle();
  if (!university) {
    return { success: false, error: "Veuillez sélectionner une université active." };
  }
  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    return {
      success: false,
      error: "Le service d'inscription n'est pas configuré correctement. Contactez le support.",
    };
  }

  const supabase = await createSupabaseServerClient();

  // 2. Inscription dans Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        student_id: rawMatricule,
        university_id: university.id,
      },
      emailRedirectTo: `${appUrl}/auth/callback?next=/auth/confirmed`,
    },
  });

  if (error) {
    return {
      success: false,
      error: "L'inscription a échoué. L'adresse e-mail est peut-être déjà utilisée.",
    };
  }

  if (!data.user) {
    return { success: false, error: "Une erreur inattendue s'est produite." };
  }

  const newUserId = data.user.id;

  // Les comptes avec confirmation automatique activée suivent aussi le contrôle atomique.
  // Sinon, la tentative est effectuée après confirmation dans /auth/callback.
  if (data.user.email_confirmed_at && rawMatricule) {
    await claimCollectedMatricule(newUserId, university.id, rawMatricule);
  }

  revalidatePath("/", "layout");
  return { success: true, data: { id: newUserId } };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

/** Retry the automatic match after client-side confirmation flows establish a session. */
export async function completeStudentMatriculeClaimAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email_confirmed_at) return;

  const candidateMatricule = user.user_metadata?.student_id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("university_id")
    .eq("id", user.id)
    .single();
  const universityId = user.user_metadata?.university_id ?? profile?.university_id;
  await claimCollectedMatricule(user.id, universityId, candidateMatricule ?? null);
}

/** Accept a pending director-issued invitation only from its confirmed email session. */
export async function completeAdminInvitationAction(): Promise<{
  accepted: boolean;
  invitationPending: boolean;
  role: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email_confirmed_at) {
    return { accepted: false, invitationPending: false, role: null };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return {
    // Legacy confirmation pages are read-only. Only /auth/callback can accept
    // a nomination, after validating its appointment-bound one-time token.
    accepted: false,
    invitationPending: false,
    role: profile?.role ?? null,
  };
}

export async function verifyOtpAction(formData: FormData): Promise<ApiResponse<void>> {
  const email = formData.get("email") as string;
  const token = formData.get("token") as string;

  if (!email || !token) {
    return { success: false, error: "Email et code requis." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error) {
    return { success: false, error: "Code invalide ou expiré." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email_confirmed_at && user.user_metadata?.student_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("university_id")
      .eq("id", user.id)
      .single();
    await claimCollectedMatricule(
      user.id,
      user.user_metadata.university_id ?? profile?.university_id,
      user.user_metadata.student_id,
    );
  }

  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}

export async function resendOtpAction(email: string): Promise<ApiResponse<void>> {
  if (!email) {
    return { success: false, error: "Adresse email requise." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    return {
      success: false,
      error: "Délai de renvoi non atteint ou erreur réseau. Veuillez patienter une minute.",
    };
  }

  return { success: true, data: undefined };
}

export async function forgotPasswordAction(formData: FormData): Promise<ApiResponse<void>> {
  const email = formData.get("email") as string;

  if (!email) {
    return { success: false, error: "L'adresse e-mail est requise." };
  }

  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    return {
      success: false,
      error: "Le service de récupération n'est pas configuré correctement. Contactez le support.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/reset-password`,
  });

  if (error) {
    return { success: false, error: "Une erreur est survenue. Veuillez réessayer." };
  }

  // Réponse générique pour ne pas révéler si l'e-mail existe
  return { success: true, data: undefined };
}

export async function resetPasswordAction(formData: FormData): Promise<ApiResponse<void>> {
  const password = formData.get("password") as string;

  if (!password || password.length < 8) {
    return { success: false, error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      success: false,
      error: "Impossible de réinitialiser le mot de passe. Le lien a peut-être expiré.",
    };
  }

  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}
