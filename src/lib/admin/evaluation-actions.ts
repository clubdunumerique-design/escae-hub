"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const evaluationSchema = z.object({
  projectId: z.string().uuid(),
  innovation_score: z.coerce.number().int().min(0).max(10),
  feasibility_score: z.coerce.number().int().min(0).max(10),
  impact_score: z.coerce.number().int().min(0).max(10),
  comments: z.string().min(20, "Le commentaire doit faire au moins 20 caractères."),
});

/**
 * Soumet ou met à jour l'évaluation d'un jury pour un projet.
 * Réservé aux rôles "admin" et "director".
 * Les étudiants ne peuvent jamais accéder à leurs propres évaluations.
 */
export async function submitEvaluationAction(
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
  const { data: evaluator } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!evaluator || !["admin", "director"].includes(evaluator.role)) {
    return { success: false, error: "Permissions insuffisantes.", code: "FORBIDDEN" };
  }

  // Validation des données
  const parsed = evaluationSchema.safeParse({
    projectId: formData.get("projectId"),
    innovation_score: formData.get("innovation_score"),
    feasibility_score: formData.get("feasibility_score"),
    impact_score: formData.get("impact_score"),
    comments: formData.get("comments"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0].message,
      code: "VALIDATION_ERROR",
    };
  }

  const { projectId, innovation_score, feasibility_score, impact_score, comments } =
    parsed.data;

  // Vérifier que le projet est dans un statut permettant l'évaluation
  const { data: project } = await supabase
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { success: false, error: "Projet introuvable." };
  }

  const evaluableStatuses = ["under_review", "jury_evaluation", "director_validation"];
  if (!evaluableStatuses.includes(project.status)) {
    return {
      success: false,
      error: `Le projet doit être en examen jury pour être évalué (statut actuel : ${project.status}).`,
    };
  }

  // Upsert : insert ou update si l'évaluateur a déjà évalué ce projet
  const { error: upsertError } = await supabase
    .from("evaluations")
    .upsert(
      {
        project_id: projectId,
        evaluator_id: user.id,
        innovation_score,
        feasibility_score,
        impact_score,
        comments,
      },
      { onConflict: "project_id,evaluator_id" }
    );

  if (upsertError) {
    return { success: false, error: "Erreur lors de la sauvegarde de l'évaluation." };
  }

  // Si le projet est encore "under_review", le passer automatiquement à "jury_evaluation"
  if (project.status === "under_review") {
    const { data: transitioned, error: transitionError } = await supabase.rpc("transition_project_status", {
      p_project_id: projectId,
      p_expected_status: "under_review",
      p_new_status: "jury_evaluation",
      p_comment: "Première évaluation soumise.",
    });
    if (transitionError) {
      console.error("submitEvaluationAction transition error:", transitionError);
      return { success: false, error: "L'évaluation est enregistrée, mais le passage au jury n'a pas pu être historisé. Réessayez." };
    }
    if (transitioned !== true) {
      const { data: latest } = await supabase.from("projects").select("status").eq("id", projectId).single();
      if (latest?.status !== "jury_evaluation") {
        return { success: false, error: "L'évaluation est enregistrée, mais le projet n'a pas pu passer au jury. Actualisez la page." };
      }
    }
  }

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/evaluate`);
  revalidatePath("/admin");

  return { success: true, data: undefined };
}
