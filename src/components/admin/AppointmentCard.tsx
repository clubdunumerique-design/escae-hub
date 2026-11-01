"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  resendAdminInvitationAction,
  revokeAppointmentAction,
} from "@/lib/admin/appointment-actions";
import type { AdminAppointmentWithProfiles } from "@/types";

export function AppointmentCard({
  appointment,
  universities,
}: {
  appointment: AdminAppointmentWithProfiles;
  universities: { id: string; name: string; code: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const admin = Array.isArray(appointment.admin) ? appointment.admin[0] : appointment.admin;
  const university = universities.find((item) => item.id === appointment.university_id);
  const isAwaitingEmail = appointment.status === "pending_acceptance";

  function resend() {
    setError(null);
    setNotice(null);
    const formData = new FormData();
    formData.set("appointmentId", appointment.id);
    startTransition(async () => {
      const result = await resendAdminInvitationAction(formData);
      if (result.success) setNotice("Un nouvel e-mail de confirmation a été envoyé.");
      else setError(result.error);
    });
  }

  function revoke() {
    setError(null);
    const formData = new FormData();
    formData.set("appointmentId", appointment.id);
    formData.set("revocationReason", "Accès administrateur révoqué par la direction");
    startTransition(async () => {
      const result = await revokeAppointmentAction(formData);
      if (result.success) setConfirmRevoke(false);
      else setError(result.error);
    });
  }

  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{admin?.full_name ?? "Administrateur"}</h3>
            <Badge variant={isAwaitingEmail ? "warning" : "success"}>
              {isAwaitingEmail ? "Confirmation e-mail en attente" : "Accès actif"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-white/55">{admin?.email ?? "Adresse indisponible"}</p>
          <p className="mt-2 text-xs text-sky-300">
            {university?.name ?? "Université non définie"} · {appointment.access_scope === "all_universities" ? "Accès aux deux universités" : "Accès limité à cette université"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          {isAwaitingEmail && (
            <button type="button" onClick={resend} disabled={isPending} className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/15 disabled:opacity-50">
              {isPending ? "Envoi…" : "Renvoyer l’e-mail"}
            </button>
          )}
          {!confirmRevoke ? (
            <button type="button" onClick={() => setConfirmRevoke(true)} disabled={isPending} className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/15 disabled:opacity-50">
              Révoquer l’accès
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Confirmer ?</span>
              <button type="button" onClick={revoke} disabled={isPending} className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-50">
                {isPending ? "Révocation…" : "Oui, révoquer"}
              </button>
              <button type="button" onClick={() => setConfirmRevoke(false)} disabled={isPending} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/70">Annuler</button>
            </div>
          )}
        </div>
      </div>
      {notice && <p role="status" className="mt-4 text-sm text-emerald-300">{notice}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    </article>
  );
}
