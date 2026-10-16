/**
 * Rôles utilisateurs de la plateforme ESCAE-BÉNIN Innovation Hub.
 *
 * IMPORTANT : Ces rôles sont assignés et vérifiés côté serveur uniquement.
 * Ne jamais faire confiance à un rôle transmis par le navigateur.
 */
export type UserRole =
  | "student"    // Étudiant soumettant des projets
  | "admin"      // Administrateur de la plateforme
  | "director";  // Directeur — validation finale

/**
 * Cycle de vie complet d'un projet.
 * Les transitions sont contrôlées côté serveur.
 */
export type ProjectStatus =
  | "draft"                    // Brouillon — éditable par l'étudiant
  | "submitted"                // Soumis — en attente de vérification administrative
  | "admin_review"             // Vérification administrative en cours
  | "corrections_requested"    // Corrections demandées par l'administration
  | "under_review"             // En examen — transmis au jury
  | "jury_evaluation"          // Évaluation du jury en cours
  | "director_validation"      // En attente de validation de la direction
  | "accepted_for_presentation"// Accepté pour présentation (≠ approbation finale)
  | "scheduling"               // Programmation de la présentation en cours
  | "presentation_done"        // Présentation effectuée
  | "final_decision"           // Décision finale rendue
  | "approved"                 // Projet approuvé (décision finale positive)
  | "rejected"                 // Refusé
  | "under_re_examination"     // En réexamen
  | "postponed"                // Reporté
  | "cancelled";               // Annulé

/** Profil utilisateur complet (issu de la table `profiles`) */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_verified: boolean;       // Vérification manuelle par l'administration
  student_id: string | null;  // Numéro étudiant (null pour les non-étudiants)
  department: string | null;
  created_at: string;
  updated_at: string;
}

/** Résumé d'un projet (liste) */
export interface ProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/** Projet complet */
export interface Project extends ProjectSummary {
  description: string;
  objectives: string | null;
  team_members: TeamMember[];
  documents: ProjectDocument[];
  status_history: StatusHistoryEntry[];
}

/** Membre d'équipe */
export interface TeamMember {
  id: string;
  project_id: string;
  user_id: string | null;
  name: string;
  role_in_project: string;
}

/** Document lié à un projet */
export interface ProjectDocument {
  id: string;
  project_id: string;
  name: string;
  storage_path: string;   // Chemin dans Supabase Storage (privé)
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

/** Entrée d'historique de statut */
export interface StatusHistoryEntry {
  id: string;
  project_id: string;
  from_status: ProjectStatus | null;
  to_status: ProjectStatus;
  changed_by: string;
  comment: string | null;
  created_at: string;
}

/** Évaluation d'un projet par un membre du jury */
export interface Evaluation {
  id: string;
  project_id: string;
  evaluator_id: string;
  innovation_score: number;    // /10
  feasibility_score: number;   // /10
  impact_score: number;        // /10
  comments: string;
  created_at: string;
  updated_at: string;
}

/** Critères d'évaluation */
export interface EvaluationCriteria {
  key: keyof Pick<Evaluation, "innovation_score" | "feasibility_score" | "impact_score">;
  label: string;
  description: string;
}

/** Planification d'une présentation (soutenance) */
export interface Presentation {
  id: string;
  project_id: string;
  scheduled_date: string;
  scheduled_time: string;
  room: string;
  notes: string | null;
  scheduled_by: string;
  created_at: string;
  updated_at: string;
}

/** Réponse API générique */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/** Statut d'un mandat administrateur */
export type AppointmentStatus =
  | "pending_acceptance"  // Invitation envoyée, en attente d'acceptation
  | "active"              // Administrateur en fonction
  | "ended"               // Fonction clôturée normalement
  | "revoked";            // Droits révoqués par le directeur

/** Enregistrement d'un mandat administrateur */
export interface AdminAppointment {
  id: string;
  admin_id: string;
  appointed_by: string;
  status: AppointmentStatus;
  mission_description: string | null;
  start_date: string | null;              // Date réelle de prise de fonction
  end_date: string | null;               // Date réelle de fin de fonction
  invitation_sent_at: string | null;
  invitation_accepted_at: string | null;
  revocation_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** Mandat avec profils joints (pour l'affichage) */
export interface AdminAppointmentWithProfiles extends AdminAppointment {
  admin: Pick<UserProfile, "id" | "email" | "full_name" | "department"> | null;
  director: Pick<UserProfile, "id" | "full_name"> | null;
}

/** Entrée du journal d'audit */
export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_id: string | null;
  target_type: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

/** Statut de vérification d'un matricule étudiant */
export type MatriculeVerificationStatus = "pending" | "verified" | "rejected";

/** Fiche du registre des matricules étudiants */
export interface StudentMatriculeEntry {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  matricule: string;
  email: string;
  field_of_study: string | null;
  academic_level: string | null;
  verification_status: MatriculeVerificationStatus;
  rejection_reason: string | null;
  claimed_by_user_id: string | null;
  claimed_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  verifier?: Pick<UserProfile, "id" | "full_name"> | null;
  claimed_profile?: Pick<UserProfile, "id" | "full_name" | "email"> | null;
}
