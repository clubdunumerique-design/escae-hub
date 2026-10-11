"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ApiResponse, ProjectStatus } from "@/types";

/**
 * Statuts cibles autorisés par rôle.
 * Ces contraintes sont vérifiées côté serveur — ne jamais faire confiance au client.
 */
const ROLE_ALLOWED_TARGET_STATUSES: Record<string, ProjectStatus[]> = {
  admin: [
    "admin_review",
    "corrections_requested",
    "under_review",
    "jury_evaluation",
    "director_validation",
    "accepted_for_presentation",
    "scheduling",
    "presentation_done",
    "final_decision",
    "approved",
    "rejected",
    "cancelled",
  ],
  director: [
    "admin_review",
    "under_review",
    "jury_evaluation",
    "accepted_for_presentation",
    "scheduling",
    "presentation_done",
    "director_validation",
    "approved",
    "rejected",
    "final_decision",
  ],
};

/**
 * Met à jour le statut d'un projet et enregistre la transition dans l'historique.
 * Vérifie les permissions côté serveur selon le rôle de l'appelant.
 */
export async function updateProjectStatusAction(
  projectId: string,
  newStatus: ProjectStatus,
  comment?: string
): Promise<ApiResponse<void>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Non autorisé.", code: "UNAUTHORIZED" };
  }

  // Vérification du rôle côté serveur
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.role === "student") {
    return {
      success: false,
      error: "Permissions insuffisantes.",
      code: "FORBIDDEN",
    };
  }

  // Vérifier que ce rôle peut cibler ce statut
  const allowedStatuses = ROLE_ALLOWED_TARGET_STATUSES[callerProfile.role] ?? [];
  if (!allowedStatuses.includes(newStatus)) {
    return {
      success: false,
      error: `Votre rôle (${callerProfile.role}) ne permet pas de définir le statut "${newStatus}".`,
      code: "FORBIDDEN",
    };
  }

  // Récupérer le statut actuel pour l'historique
  const { data: project } = await supabase
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { success: false, error: "Projet introuvable." };
  }

  // Mise à jour du statut
  const { error: updateError } = await supabase
    .from("projects")
    .update({ status: newStatus })
    .eq("id", projectId);

  if (updateError) {
    return { success: false, error: "Erreur lors de la mise à jour du statut." };
  }

  // Enregistrement dans l'historique
  await supabase.from("status_history").insert({
    project_id: projectId,
    from_status: project.status,
    to_status: newStatus,
    changed_by: user.id,
    comment: comment?.trim() || null,
  });

  // Invalider les caches concernés
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");

  return { success: true, data: undefined };
}
