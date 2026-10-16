"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ApiResponse } from "@/types";
import { sendNotification } from "@/lib/notifications/send";

const scheduleSchema = z.object({
  projectId: z.string().uuid(),
  scheduled_date: z.string().min(1, "La date est requise."),
  scheduled_time: z.string().min(1, "L'heure est requise."),
  room: z.string().min(2, "La salle doit contenir au moins 2 caractères."),
  notes: z.string().optional(),
});

/**
 * Planifie la présentation (soutenance) pour un projet accepté.
 * Réservé aux rôles "admin" et "director".
 */
export async function schedulePresentationAction(
  formData: FormData
): Promise<ApiResponse<void>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Non autorisé.", code: "UNAUTHORIZED" };
  }

  // Vérification du rôle côté serveur
  const { data: staff } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!staff || !["admin", "director"].includes(staff.role)) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  // Validation des données
  const parsed = scheduleSchema.safeParse({
    projectId: formData.get("projectId"),
    scheduled_date: formData.get("scheduled_date"),
    scheduled_time: formData.get("scheduled_time"),
    room: formData.get("room"),
    notes: formData.get("notes")?.toString() || "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0].message,
      code: "VALIDATION_ERROR",
    };
  }

  const { projectId, scheduled_date, scheduled_time, room, notes } = parsed.data;

  // Vérifier que le projet est bien accepté pour présentation ou déjà en cours de planification
  const { data: project } = await supabase
    .from("projects")
    .select("status, title, owner_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { success: false, error: "Projet introuvable." };
  }

  const validStatuses = ["accepted_for_presentation", "scheduling"];
  if (!validStatuses.includes(project.status)) {
    return {
      success: false,
      error: `Ce projet n'est pas éligible à la planification (statut actuel : ${project.status}).`,
    };
  }

  // Upsert dans la table presentations
  const { error: upsertError } = await supabase
    .from("presentations")
    .upsert(
      {
        project_id: projectId,
        scheduled_date,
        scheduled_time,
        room,
        notes,
        scheduled_by: user.id,
      },
      { onConflict: "project_id" }
    );

  if (upsertError) {
    return { success: false, error: "Erreur lors de la sauvegarde de la planification." };
  }

  // Si le statut était accepted_for_presentation, on peut le passer en scheduling
  if (project.status === "accepted_for_presentation") {
    const { data: transitioned, error: transitionError } = await supabase.rpc("transition_project_status", {
      p_project_id: projectId,
      p_expected_status: "accepted_for_presentation",
      p_new_status: "scheduling",
      p_comment: "Planification de la soutenance initialisée.",
    });
    if (transitionError) {
      console.error("schedulePresentationAction transition error:", transitionError);
      return { success: false, error: "La planification est sauvegardée, mais le changement de statut n'a pas été historisé. Réessayez." };
    }
    if (transitioned !== true) {
      const { data: latest } = await supabase.from("projects").select("status").eq("id", projectId).single();
      if (latest?.status !== "scheduling") {
        return { success: false, error: "La planification est sauvegardée, mais le projet n'a pas pu passer au statut prévu. Actualisez la page." };
      }
    }
  }

  // Notification à l'étudiant
  await sendNotification({
    userId: project.owner_id,
    type: "presentation_scheduled",
    title: "📅 Soutenance planifiée",
    message: `La soutenance de "${project.title}" est prévue le ${new Date(scheduled_date).toLocaleDateString("fr-FR")} à ${scheduled_time.substring(0, 5)} en salle ${room}.`,
    linkUrl: `/projects/${projectId}`,
  });

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/admin");

  return { success: true, data: undefined };
}
