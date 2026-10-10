"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ApiResponse } from "@/types";
import { sendNotification } from "@/lib/notifications/send";

type DirectorDecision = "accepted_for_presentation" | "rejected" | "under_re_examination";

const ALLOWED_DECISIONS: DirectorDecision[] = [
  "accepted_for_presentation",
  "rejected",
  "under_re_examination",
];

const decisionSchema = z.object({
  projectId: z.string().uuid(),
  decision: z.enum(["accepted_for_presentation", "rejected", "under_re_examination"]),
  comment: z.string().min(10, "Un commentaire d'au moins 10 caractères est requis pour la décision."),
});

/**
 * Enregistre la décision officielle de la direction pour un projet.
 * Seuls les rôles "director" et "admin" peuvent soumettre cette action.
 */
export async function submitDirectorDecisionAction(
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
  const { data: director } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!director || !["director", "admin"].includes(director.role)) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  // Validation des données
  const parsed = decisionSchema.safeParse({
    projectId: formData.get("projectId"),
    decision: formData.get("decision"),
    comment: formData.get("comment"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0].message,
      code: "VALIDATION_ERROR",
    };
  }

  const { projectId, decision, comment } = parsed.data;

  // Vérifier que le projet est bien en attente de validation direction
  const { data: project } = await supabase
    .from("projects")
    .select("status, title, owner_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { success: false, error: "Projet introuvable." };
  }

  if (project.status !== "director_validation") {
    return {
      success: false,
      error: `Ce projet n'est pas en attente de validation direction (statut actuel : ${project.status}).`,
    };
  }

  // Mise à jour du statut
  const { error: updateError } = await supabase
    .from("projects")
    .update({ status: decision })
    .eq("id", projectId);

  if (updateError) {
    return { success: false, error: "Erreur lors de la mise à jour du statut." };
  }

  // Historique
  await supabase.from("status_history").insert({
    project_id: projectId,
    from_status: "director_validation",
    to_status: decision,
    changed_by: user.id,
    comment: comment.trim(),
  });

  // Notification à l'étudiant
  let notifTitle = "";
  let notifMessage = "";
  if (decision === "accepted_for_presentation") {
    notifTitle = "🎉 Projet accepté !";
    notifMessage = `Votre projet "${project.title}" a été accepté par la direction. Une date de soutenance sera bientôt planifiée.`;
  } else if (decision === "rejected") {
    notifTitle = "❌ Projet refusé";
    notifMessage = `Votre projet "${project.title}" a été refusé par la direction.`;
  } else {
    notifTitle = "🔄 Réexamen demandé";
    notifMessage = `La direction a demandé un réexamen pour votre projet "${project.title}".`;
  }

  await sendNotification({
    userId: project.owner_id,
    type: "director_decision",
    title: notifTitle,
    message: notifMessage,
    linkUrl: `/projects/${projectId}`,
  });

  // Invalider les caches
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/validate`);
  revalidatePath("/admin");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");

  return { success: true, data: undefined };
}
