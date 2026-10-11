"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectSchema, teamMemberSchema } from "@/lib/validations/project";
import type { ApiResponse, Project, ProjectSummary } from "@/types";
import { revalidatePath } from "next/cache";

/**
 * Crée un nouveau brouillon de projet.
 */
export async function createProjectAction(
  formData: FormData
): Promise<ApiResponse<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Non autorisé", code: "UNAUTHORIZED" };
  }

  // Vérifier que l'étudiant est vérifié par l'administration
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_verified, role")
    .eq("id", user.id)
    .single();

  // Seuls les étudiants non vérifiés sont bloqués
  // Le personnel (admin, jury, etc.) n'est pas soumis à cette contrainte
  if (profile?.role === "student" && !profile?.is_verified) {
    return {
      success: false,
      error: "Votre compte n'est pas encore vérifié par l'administration. Vous ne pouvez pas créer de projet pour le moment.",
      code: "NOT_VERIFIED",
    };
  }

  const rawData = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    objectives: formData.get("objectives") as string,
    problem: formData.get("problem") as string,
    solution: formData.get("solution") as string,
    feasibility: formData.get("feasibility") as string,
    impact: formData.get("impact") as string,
    budget: formData.get("budget"),
  };

  const parsed = projectSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: "Données invalides.", code: "VALIDATION_ERROR" };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      objectives: parsed.data.objectives,
      problem: parsed.data.problem,
      solution: parsed.data.solution,
      feasibility: parsed.data.feasibility,
      impact: parsed.data.impact,
      budget: parsed.data.budget,
      owner_id: user.id,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createProjectAction error:", error);
    return { success: false, error: error?.message || "Erreur lors de la création du projet." };
  }

  revalidatePath("/dashboard");
  return { success: true, data: { id: data.id } };
}

/**
 * Soumet définitivement un projet (passe de draft à submitted).
 */
export async function submitProjectAction(
  projectId: string
): Promise<ApiResponse<void>> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Non autorisé" };
  }

  // Vérifier que l'étudiant est vérifié avant de permettre la soumission
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("is_verified, role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role === "student" && !callerProfile?.is_verified) {
    return {
      success: false,
      error: "Votre compte n'est pas encore vérifié par l'administration.",
      code: "NOT_VERIFIED",
    };
  }

  // 1. Vérifier si le projet appartient bien à l'utilisateur et est en brouillon
  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("status, owner_id")
    .eq("id", projectId)
    .single();

  if (fetchError || !project) {
    return { success: false, error: "Projet introuvable." };
  }

  if (project.owner_id !== user.id) {
    return { success: false, error: "Vous n'êtes pas propriétaire de ce projet." };
  }

  if (project.status !== "draft") {
    return { success: false, error: "Seul un brouillon peut être soumis." };
  }

  // 2. Mettre à jour le statut
  const { error: updateError } = await supabase
    .from("projects")
    .update({ status: "submitted" })
    .eq("id", projectId);

  if (updateError) {
    return { success: false, error: "Erreur lors de la soumission." };
  }

  // 3. Historiser la transition (Service Role ou RLS)
  // RLS autorise l'insertion si owner_id == user.id (via RLS sur projects)
  await supabase.from("status_history").insert({
    project_id: projectId,
    from_status: "draft",
    to_status: "submitted",
    changed_by: user.id,
    comment: "Soumission initiale par l'étudiant.",
  });

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  
  return { success: true, data: undefined };
}

/**
 * Ajoute un membre à l'équipe du projet.
 */
export async function addTeamMemberAction(formData: FormData): Promise<ApiResponse<void>> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Non autorisé" };
  }

  const rawData = {
    projectId: formData.get("projectId") as string,
    name: formData.get("name") as string,
    role_in_project: formData.get("role_in_project") as string,
    user_id: formData.get("user_id") as string || undefined,
  };

  const parsed = teamMemberSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: "Données invalides.", code: "VALIDATION_ERROR" };
  }

  const { projectId, name, role_in_project, user_id } = parsed.data;

  // Vérifier si le projet appartient bien à l'utilisateur et est en brouillon
  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("status, owner_id")
    .eq("id", projectId)
    .single();

  if (fetchError || !project) {
    return { success: false, error: "Projet introuvable." };
  }

  if (project.owner_id !== user.id) {
    return { success: false, error: "Vous n'êtes pas propriétaire de ce projet." };
  }

  if (project.status !== "draft") {
    return { success: false, error: "L'équipe ne peut être modifiée que lorsque le projet est en brouillon." };
  }

  const { error: insertError } = await supabase
    .from("team_members")
    .insert({
      project_id: projectId,
      name,
      role_in_project,
      user_id: user_id || null,
    });

  if (insertError) {
    return { success: false, error: "Erreur lors de l'ajout du membre." };
  }

  revalidatePath(`/projects/${projectId}/team`);
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: undefined };
}

/**
 * Supprime un membre de l'équipe du projet.
 */
export async function removeTeamMemberAction(memberId: string, projectId: string): Promise<ApiResponse<void>> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Non autorisé" };
  }

  // Vérifier si le projet appartient bien à l'utilisateur et est en brouillon
  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("status, owner_id")
    .eq("id", projectId)
    .single();

  if (fetchError || !project) {
    return { success: false, error: "Projet introuvable." };
  }

  if (project.owner_id !== user.id) {
    return { success: false, error: "Vous n'êtes pas propriétaire de ce projet." };
  }

  if (project.status !== "draft") {
    return { success: false, error: "L'équipe ne peut être modifiée que lorsque le projet est en brouillon." };
  }

  const { error: deleteError } = await supabase
    .from("team_members")
    .delete()
    .eq("id", memberId)
    .eq("project_id", projectId); // S'assurer que le membre appartient bien au projet

  if (deleteError) {
    return { success: false, error: "Erreur lors de la suppression du membre." };
  }

  revalidatePath(`/projects/${projectId}/team`);
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: undefined };
}

/**
 * Sauvegarde les métadonnées d'un document uploadé.
 */
export async function saveDocumentMetadataAction(data: {
  projectId: string;
  name: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<ApiResponse<void>> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Non autorisé" };

  // Vérifier si le projet appartient bien à l'utilisateur et est en brouillon
  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("status, owner_id")
    .eq("id", data.projectId)
    .single();

  if (fetchError || !project) return { success: false, error: "Projet introuvable." };
  if (project.owner_id !== user.id) return { success: false, error: "Non propriétaire." };
  if (project.status !== "draft") return { success: false, error: "Projet non brouillon." };

  const { error: insertError } = await supabase
    .from("project_documents")
    .insert({
      project_id: data.projectId,
      name: data.name,
      storage_path: data.storagePath,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
    });

  if (insertError) return { success: false, error: "Erreur BDD." };

  revalidatePath(`/projects/${data.projectId}`);
  return { success: true, data: undefined };
}

/**
 * Supprime un document (Storage + BDD).
 */
export async function deleteDocumentAction(documentId: string, projectId: string): Promise<ApiResponse<void>> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Non autorisé" };

  const { data: project } = await supabase
    .from("projects")
    .select("status, owner_id")
    .eq("id", projectId)
    .single();

  if (!project || project.owner_id !== user.id || project.status !== "draft") {
    return { success: false, error: "Action non permise." };
  }

  // 1. Récupérer le storage_path
  const { data: doc } = await supabase
    .from("project_documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (!doc) return { success: false, error: "Document introuvable." };

  // 2. Supprimer de Storage (Admin client ou user client si RLS le permet)
  // Comme RLS le permet pour le owner, on peut utiliser le client courant
  const { error: storageError } = await supabase.storage
    .from("project_documents")
    .remove([doc.storage_path]);

  // Même s'il y a une erreur storage (ex: fichier déjà supprimé), on supprime la ligne BDD
  // 3. Supprimer de la BDD
  const { error: dbError } = await supabase
    .from("project_documents")
    .delete()
    .eq("id", documentId);

  if (dbError) return { success: false, error: "Erreur lors de la suppression BDD." };

  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: undefined };
}
