"use client";

/**
 * Carte d'affichage d'un mandat administrateur actif ou en attente.
 * Permet au directeur de clôturer ou révoquer le mandat.
 */

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  closeAppointmentAction,
  resendAdminInvitationAction,
  revokeAppointmentAction,
} from "@/lib/admin/appointment-actions";
import type { AdminAppointmentWithProfiles, AppointmentStatus } from "@/types";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending_acceptance: "En attente d'acceptation",
  active: "En fonction",
  ended: "Clôturé",
  revoked: "Révoqué",
};

const STATUS_VARIANT: Record<AppointmentStatus, "default" | "info" | "success" | "warning" | "danger" | "neutral"> = {
  pending_acceptance: "warning",
  active: "success",
  ended: "neutral",
  revoked: "danger",
};

interface AppointmentCardProps {
  appointment: AdminAppointmentWithProfiles;
  canClose: boolean;
  canRevoke: boolean;
}

export function AppointmentCard({ appointment, canClose, canRevoke }: AppointmentCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const admin = Array.isArray(appointment.admin) ? appointment.admin[0] : appointment.admin;
  const director = Array.isArray(appointment.director)
    ? appointment.director[0]
    : appointment.director;

  function handleClose(formData: FormData) {
    setError(null);
    formData.append("appointmentId", appointment.id);
    startTransition(async () => {
      const res = await closeAppointmentAction(formData);
      if (!res.success) {
        setError(res.error);
      } else {
        setShowCloseForm(false);
      }
    });
  }

  function handleRevoke(formData: FormData) {
    setError(null);
    formData.append("appointmentId", appointment.id);
    startTransition(async () => {
      const res = await revokeAppointmentAction(formData);
      if (!res.success) {
        setError(res.error);
      } else {
        setShowRevokeConfirm(false);
      }
    });
  }

  function handleResendInvitation() {
    setError(null);
    setNotice(null);
    const formData = new FormData();
    formData.set("appointmentId", appointment.id);
    startTransition(async () => {
      const res = await resendAdminInvitationAction(formData);
      if (!res.success) {
        setError(res.error);
      } else {
        setNotice("Nouveau lien de nomination envoyé. Il utilise le modèle d’invitation, pas celui de récupération du mot de passe.");
      }
    });
  }

  const initials = admin?.full_name
    ? admin.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:border-white/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Identité de l'administrateur */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sm font-bold text-sky-300">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="font-semibold text-white">{admin?.full_name ?? "—"}</p>
              <Badge variant={STATUS_VARIANT[appointment.status]}>
                {STATUS_LABELS[appointment.status]}
              </Badge>
            </div>
            <p className="text-sm text-white/50">{admin?.email ?? "—"}</p>
            {admin?.department && (
              <p className="mt-0.5 text-xs text-white/30">{admin.department}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/40">
              {appointment.invitation_sent_at && (
                <span>
                  Invitation : {new Date(appointment.invitation_sent_at).toLocaleDateString("fr-FR")}
                </span>
              )}
              {appointment.start_date && (
                <span>
                  Prise de fonction : {new Date(appointment.start_date).toLocaleDateString("fr-FR")}
                </span>
              )}
              {director && (
                <span>Nommé par : {director.full_name}</span>
              )}
            </div>
            {appointment.mission_description && (
              <p className="mt-2 text-xs text-white/50 leading-relaxed">
                {appointment.mission_description}
              </p>
            )}
          </div>
        </div>

        {/* Actions directeur */}
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          {canRevoke && appointment.status === "pending_acceptance" && !showCloseForm && !showRevokeConfirm && (
            <button
              id={`resend-appointment-invitation-${appointment.id}`}
              type="button"
              onClick={handleResendInvitation}
              disabled={isPending}
              className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/15 disabled:opacity-50"
            >
              {isPending ? "Envoi en cours…" : "Renvoyer l’invitation"}
            </button>
          )}
          {canClose && !showCloseForm && !showRevokeConfirm && (
            <button
              id={`close-appointment-${appointment.id}`}
              onClick={() => setShowCloseForm(true)}
              disabled={isPending}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              Clôturer le mandat
            </button>
          )}
          {canRevoke && !showCloseForm && !showRevokeConfirm && (
            <button
              id={`revoke-appointment-${appointment.id}`}
              onClick={() => setShowRevokeConfirm(true)}
              disabled={isPending}
              className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/15 disabled:opacity-50"
            >
              Révoquer
            </button>
          )}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          ❌ {error}
        </div>
      )}
      {notice && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300" role="status">
          ✅ {notice}
        </div>
      )}

      {/* Formulaire de clôture */}
      {showCloseForm && (
        <form action={handleClose} className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-white">Clôturer le mandat</p>
          <div>
            <label htmlFor={`end-date-${appointment.id}`} className="mb-1 block text-xs text-white/60">
              Date de fin de fonction <span className="text-red-400">*</span>
            </label>
            <input
              id={`end-date-${appointment.id}`}
              name="endDate"
              type="date"
              required
              max={new Date().toISOString().split("T")[0]}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
            />
          </div>
          <div>
            <label htmlFor={`close-reason-${appointment.id}`} className="mb-1 block text-xs text-white/60">
              Motif / commentaire <span className="text-white/30">(optionnel)</span>
            </label>
            <textarea
              id={`close-reason-${appointment.id}`}
              name="revocationReason"
              rows={2}
              maxLength={500}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-sky-500/50 resize-none"
              placeholder="Fin de mandat, départ, etc."
            />
          </div>
          <div className="flex gap-2">
            <button
              id={`confirm-close-${appointment.id}`}
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              {isPending ? "En cours…" : "Confirmer la clôture"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCloseForm(false); setError(null); }}
              className="rounded-lg px-4 py-2 text-xs text-white/40 hover:text-white"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Confirmation de révocation */}
      {showRevokeConfirm && (
        <form action={handleRevoke} className="mt-4 space-y-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm font-semibold text-red-300">⚠️ Confirmer la révocation</p>
          <p className="text-xs text-white/50">
            Cette action retirera immédiatement les droits administrateurs de cet utilisateur et
            clôturera son mandat. Cette opération est irréversible.
          </p>
          <div>
            <label htmlFor={`revoke-reason-${appointment.id}`} className="mb-1 block text-xs text-white/60">
              Motif de révocation <span className="text-white/30">(optionnel)</span>
            </label>
            <input
              id={`revoke-reason-${appointment.id}`}
              name="revocationReason"
              type="text"
              maxLength={500}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-red-500/50"
              placeholder="Motif de la révocation…"
            />
          </div>
          <div className="flex gap-2">
            <button
              id={`confirm-revoke-${appointment.id}`}
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/30 disabled:opacity-50"
            >
              {isPending ? "En cours…" : "Révoquer les droits"}
            </button>
            <button
              type="button"
              onClick={() => { setShowRevokeConfirm(false); setError(null); }}
              className="rounded-lg px-4 py-2 text-xs text-white/40 hover:text-white"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
