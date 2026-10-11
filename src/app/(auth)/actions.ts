"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import type { ApiResponse } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function loginAction(
  formData: FormData
): Promise<ApiResponse<{ id: string }>> {
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

  revalidatePath("/", "layout");
  return { success: true, data: { id: data.user.id } };
}

export async function registerAction(
  formData: FormData
): Promise<ApiResponse<{ id: string }>> {
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  const parsed = registerSchema.safeParse({
    fullName,
    email,
    password,
    confirmPassword,
  });

  if (!parsed.success) {
    return { success: false, error: "Veuillez vérifier les champs du formulaire." };
  }

  const supabase = await createSupabaseServerClient();
  
  // Inscription Supabase
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/confirmed`,
    },
  });

  if (error) {
    // Erreur de sécurité générique pour ne pas fuiter l'existence du compte
    return { success: false, error: "L'inscription a échoué. L'adresse e-mail est peut-être déjà utilisée." };
  }

  if (!data.user) {
    return { success: false, error: "Une erreur inattendue s'est produite." };
  }

  revalidatePath("/", "layout");
  return { success: true, data: { id: data.user.id } };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

export async function verifyOtpAction(
  formData: FormData
): Promise<ApiResponse<void>> {
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

  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}

export async function forgotPasswordAction(
  formData: FormData
): Promise<ApiResponse<void>> {
  const email = formData.get("email") as string;

  if (!email) {
    return { success: false, error: "L'adresse e-mail est requise." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  });

  if (error) {
    return { success: false, error: "Une erreur est survenue. Veuillez réessayer." };
  }

  // Réponse générique pour ne pas révéler si l'e-mail existe
  return { success: true, data: undefined };
}

export async function resetPasswordAction(
  formData: FormData
): Promise<ApiResponse<void>> {
  const password = formData.get("password") as string;

  if (!password || password.length < 8) {
    return { success: false, error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { success: false, error: "Impossible de réinitialiser le mot de passe. Le lien a peut-être expiré." };
  }

  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}
