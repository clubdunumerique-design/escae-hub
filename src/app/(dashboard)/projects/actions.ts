"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectSchema, teamMemberSchema } from "@/lib/validations/project";
import type { ApiResponse } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const projectDocumentMetadataSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  storagePath: z.string().min(1).max(500),
  mimeType: z.enum([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
  ]),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
});

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Échouer par défaut si le profil manque ou si le rôle n'est pas étudiant.
  if (profile?.role !== "student") {
    return {
      success: false,
      error: "La création de projets est réservée aux étudiants.",
      code: "FORBIDDEN",
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
    return { success: false, error: "Le brouillon n'a pas pu être enregistré. Vérifiez les informations et réessayez." };
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
    return { success: false, error: "Connectez-vous pour soumettre ce projet.", code: "UNAUTHORIZED" };
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Échouer par défaut si le profil manque ou si le rôle n'est pas étudiant.
  if (callerProfile?.role !== "student") {
    return {
      success: false,
      error: "La soumission de projets est réservée aux étudiants.",
      code: "FORBIDDEN",
    };
  }

  const { data: transitioned, error: transitionError } = await supabase.rpc(
    "transition_project_status",
    {
      p_project_id: projectId,
      p_expected_status: "draft",
      p_new_status: "submitted",
      p_comment: "Soumission initiale par l'étudiant.",
    },
  );
  if (transitionError) {
    console.error("submitProjectAction transition error:", transitionError);
    return { success: false, error: "La soumission n'a pas pu être enregistrée. Veuillez réessayer." };
  }
  if (transitioned !== true) {
    return { success: false, error: "Ce brouillon est introuvable, inaccessible ou déjà soumis." };
  }

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

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "student") {
    return { success: false, error: "Cette action est réservée aux étudiants.", code: "FORBIDDEN" };
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

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "student") {
    return { success: false, error: "Cette action est réservée aux étudiants.", code: "FORBIDDEN" };
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

  const parsed = projectDocumentMetadataSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Le fichier ou ses informations sont invalides (PDF, DOC, DOCX, JPG ou PNG, 10 Mo maximum).", code: "VALIDATION_ERROR" };
  }
  const metadata = parsed.data;

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "student") {
    return { success: false, error: "Cette action est réservée aux étudiants.", code: "FORBIDDEN" };
  }

  // Vérifier si le projet appartient bien à l'utilisateur et est en brouillon
  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("status, owner_id")
    .eq("id", metadata.projectId)
    .single();

  if (fetchError || !project) return { success: false, error: "Projet introuvable." };
  if (project.owner_id !== user.id) return { success: false, error: "Non propriétaire." };
  if (project.status !== "draft") return { success: false, error: "Projet non brouillon." };

  const expectedPrefix = `${metadata.projectId}/`;
  if (!metadata.storagePath.startsWith(expectedPrefix) || metadata.storagePath.includes("..")) {
    return { success: false, error: "Le fichier ou ses informations sont invalides (formats autorisés : PDF, DOC, DOCX, JPG, PNG ; 10 Mo maximum).", code: "VALIDATION_ERROR" };
  }

  const { error: insertError } = await supabase
    .from("project_documents")
    .insert({
      project_id: metadata.projectId,
      name: metadata.name,
      storage_path: metadata.storagePath,
      mime_type: metadata.mimeType,
      size_bytes: metadata.sizeBytes,
      uploaded_by: user.id,
    });

  if (insertError) {
    console.error("saveDocumentMetadataAction error:", insertError);
    return { success: false, error: "Le fichier a été envoyé, mais son enregistrement a échoué. Réessayez ou rechargez la page." };
  }

  revalidatePath(`/projects/${metadata.projectId}`);
  return { success: true, data: undefined };
}

/**
 * Supprime un document (Storage + BDD).
 */
export async function deleteDocumentAction(documentId: string, projectId: string): Promise<ApiResponse<void>> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Non autorisé" };

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "student") {
    return { success: false, error: "Cette action est réservée aux étudiants.", code: "FORBIDDEN" };
  }

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
    .eq("project_id", projectId)
    .single();

  if (!doc) return { success: false, error: "Document introuvable." };

  // 2. Supprimer de Storage (Admin client ou user client si RLS le permet)
  // Comme RLS le permet pour le owner, on peut utiliser le client courant
  const { error: storageError } = await supabase.storage
    .from("project_documents")
    .remove([doc.storage_path]);

  if (storageError) {
    console.error("deleteDocumentAction storage error:", storageError);
    return { success: false, error: "Le fichier n'a pas pu être supprimé du stockage. Les informations du projet ont été conservées." };
  }

  // Même s'il y a une erreur storage (ex: fichier déjà supprimé), on supprime la ligne BDD
  // 3. Supprimer de la BDD
  const { error: dbError } = await supabase
    .from("project_documents")
    .delete()
    .eq("id", documentId);

  if (dbError) {
    console.error("deleteDocumentAction database error:", dbError);
    return { success: false, error: "Le fichier a été supprimé du stockage, mais son enregistrement n'a pas pu être supprimé. Rechargez la page ou contactez le support." };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: undefined };
}
