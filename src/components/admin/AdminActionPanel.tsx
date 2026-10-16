"use client";

import { useState } from "react";
import { updateProjectStatusAction } from "@/app/(dashboard)/admin/actions";
import type { ProjectStatus } from "@/types";

type ActionVariant = "primary" | "success" | "warning" | "danger";

interface ActionDef {
  label: string;
  newStatus: ProjectStatus;
  variant: ActionVariant;
  confirm?: string;
}

/**
 * Retourne les actions disponibles selon le statut courant et le rôle de l'utilisateur.
 */
function getActions(status: ProjectStatus, role: string): ActionDef[] {
  const actions: ActionDef[] = [];
  const isStaff = ["admin", "director"].includes(role);

  if (status === "submitted" && isStaff) {
    actions.push({ label: "Prendre en charge", newStatus: "admin_review", variant: "primary" });
  }

  if (status === "admin_review" && isStaff) {
    actions.push({ label: "Demander des corrections", newStatus: "corrections_requested", variant: "warning" });
    actions.push({ label: "Transmettre au jury", newStatus: "under_review", variant: "success" });
  }

  if (["submitted", "admin_review"].includes(status) && isStaff) {
    actions.push({
      label: "Rejeter le projet",
      newStatus: "rejected",
      variant: "danger",
      confirm: "Êtes-vous sûr de vouloir rejeter définitivement ce projet ?",
    });
  }

  if (status === "corrections_requested" && isStaff) {
    actions.push({ label: "Reprendre la vérification", newStatus: "admin_review", variant: "primary" });
  }

  if (status === "under_re_examination" && isStaff) {
    actions.push({ label: "Reprendre l'évaluation", newStatus: "under_review", variant: "primary" });
  }

  if (status === "under_review" && isStaff) {
    actions.push({ label: "Démarrer l'évaluation jury", newStatus: "jury_evaluation", variant: "primary" });
  }

  if (status === "jury_evaluation" && isStaff) {
    actions.push({ label: "Soumettre à la direction", newStatus: "director_validation", variant: "success" });
  }

  if (status === "director_validation" && isStaff) {
    actions.push({ label: "Accepter pour présentation", newStatus: "accepted_for_presentation", variant: "success" });
    actions.push({
      label: "Rejeter",
      newStatus: "rejected",
      variant: "danger",
      confirm: "Êtes-vous sûr de vouloir rejeter ce projet ?",
    });
  }

  if (status === "accepted_for_presentation" && isStaff) {
    actions.push({ label: "Planifier la présentation", newStatus: "scheduling", variant: "primary" });
  }

  if (status === "scheduling" && isStaff) {
    actions.push({ label: "Marquer comme présenté", newStatus: "presentation_done", variant: "success" });
  }

  if (status === "presentation_done" && isStaff) {
    actions.push({ label: "Approuver", newStatus: "approved", variant: "success" });
    actions.push({
      label: "Rejeter",
      newStatus: "rejected",
      variant: "danger",
      confirm: "Confirmer le rejet définitif ?",
    });
  }

  return actions;
}

const VARIANT_CLASSES: Record<ActionVariant, string> = {
  primary:
    "bg-[#03A61C] text-white hover:bg-[#05F228] shadow-[0_0_16px_rgba(3,166,28,0.3)] hover:shadow-[0_0_24px_rgba(5,242,40,0.4)]",
  success:
    "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40",
  warning:
    "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30",
  danger:
    "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30",
};

interface AdminActionPanelProps {
  projectId: string;
  currentStatus: ProjectStatus;
  userRole: string;
}

export function AdminActionPanel({
  projectId,
  currentStatus,
  userRole,
}: AdminActionPanelProps) {
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const actions = getActions(currentStatus, userRole);

  async function handleAction(newStatus: ProjectStatus, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await updateProjectStatusAction(projectId, newStatus, comment);
      if (result.success) {
        setSuccessMsg("Statut mis à jour avec succès.");
        setComment("");
      } else {
        setError(result.error ?? "Erreur inconnue.");
      }
    } catch {
      setError("Une erreur inattendue est survenue.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
        Actions disponibles
      </h3>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-[#03A61C]/30 bg-[#03A61C]/10 px-3 py-2 text-sm text-[#05F228]">
          {successMsg}
        </div>
      )}

      {actions.length === 0 ? (
        <p className="py-2 text-center text-sm text-white/30">
          Aucune action disponible pour votre rôle à ce stade.
        </p>
      ) : (
        <>
          {/* Champ commentaire */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Commentaire <span className="text-white/20">(optionnel)</span>
            </label>
            <textarea
              id="admin-action-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajouter un commentaire à l'historique..."
              rows={3}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
            />
          </div>

          {/* Boutons d'action */}
          <div className="space-y-2">
            {actions.map((action) => (
              <button
                key={action.newStatus}
                id={`action-${action.newStatus}`}
                onClick={() => handleAction(action.newStatus, action.confirm)}
                disabled={isLoading}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${VARIANT_CLASSES[action.variant]}`}
              >
                {isLoading ? "En cours..." : action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
