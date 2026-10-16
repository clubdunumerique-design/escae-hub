"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import type { ApiResponse } from "@/types";
import { revalidatePath } from "next/cache";

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
  const studentId = (formData.get("studentId") as string) || undefined;

  const parsed = registerSchema.safeParse({
    fullName,
    email,
    studentId,
    password,
    confirmPassword,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Veuillez vérifier les champs du formulaire." };
  }

  const adminClient = createSupabaseAdminClient();
  const rawMatricule = parsed.data.studentId?.trim().toUpperCase();

  // 1. Contrôle anti-usurpation préalable du matricule
  if (rawMatricule) {
    // Vérifier si un compte profil possède déjà ce matricule
    const { data: profileWithMatricule } = await adminClient
      .from("profiles")
      .select("id, email")
      .ilike("student_id", rawMatricule)
      .maybeSingle();

    if (profileWithMatricule) {
      return {
        success: false,
        error: "Ce matricule étudiant est déjà associé à un compte utilisateur. Contactez la scolarité en cas de litige.",
      };
    }

    // Vérifier si la fiche dans le registre est déjà réclamée par un autre utilisateur
    const { data: registryClaimed } = await adminClient
      .from("student_matricule_registry")
      .select("id, claimed_by_user_id")
      .ilike("matricule", rawMatricule)
      .not("claimed_by_user_id", "is", null)
      .maybeSingle();

    if (registryClaimed) {
      return {
        success: false,
        error: "Ce matricule étudiant est déjà réclamé. Contactez l'administration.",
      };
    }
  }

  const supabase = await createSupabaseServerClient();
  
  // 2. Inscription dans Supabase Auth
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
    return { success: false, error: "L'inscription a échoué. L'adresse e-mail est peut-être déjà utilisée." };
  }

  if (!data.user) {
    return { success: false, error: "Une erreur inattendue s'est produite." };
  }

  const newUserId = data.user.id;

  // 3. Traitement du matricule et vérification automatique côté serveur
  if (rawMatricule) {
    try {
      // Chercher la fiche correspondante dans le registre
      const { data: registryEntry } = await adminClient
        .from("student_matricule_registry")
        .select("id, matricule, verification_status, field_of_study")
        .ilike("matricule", rawMatricule)
        .maybeSingle();

      const isVerified = registryEntry?.verification_status === "verified";
      const now = new Date().toISOString();

      // Mettre à jour le profil de l'étudiant
      await adminClient
        .from("profiles")
        .update({
          student_id: rawMatricule,
          is_verified: isVerified,
          department: registryEntry?.field_of_study || undefined,
          updated_at: now,
        })
        .eq("id", newUserId);

      if (registryEntry) {
        // Associer la fiche du registre au nouvel utilisateur
        await adminClient
          .from("student_matricule_registry")
          .update({
            claimed_by_user_id: newUserId,
            claimed_at: now,
            updated_at: now,
          })
          .eq("id", registryEntry.id);
      } else {
        // Créer une fiche en attente dans le registre pour examen ultérieur par la scolarité
        const parts = parsed.data.fullName.trim().split(" ");
        const firstName = parts[0] || "Étudiant";
        const lastName = parts.slice(1).join(" ") || "Inscrit";

        await adminClient
          .from("student_matricule_registry")
          .insert({
            first_name: firstName,
            last_name: lastName,
            full_name: parsed.data.fullName.trim(),
            matricule: rawMatricule,
            email: parsed.data.email,
            verification_status: "pending",
            claimed_by_user_id: newUserId,
            claimed_at: now,
          });
      }
    } catch (e) {
      console.error("[register] Erreur lors de la liaison matricule :", e);
    }
  }

  revalidatePath("/", "layout");
  return { success: true, data: { id: newUserId } };
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

export async function resendOtpAction(
  email: string
): Promise<ApiResponse<void>> {
  if (!email) {
    return { success: false, error: "Adresse email requise." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    return { success: false, error: "Délai de renvoi non atteint ou erreur réseau. Veuillez patienter une minute." };
  }

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
