"use client";

/**
 * Formulaire de complétion du profil administrateur.
 * L'admin peut modifier son nom, département et description de mission.
 * Il ne peut PAS modifier son rôle, la date de nomination ou l'auteur de sa nomination.
 * La confirmation de prise de fonction est gérée via un sous-formulaire dédié.
 */

import { useState, useTransition } from "react";
import {
  updateAdminProfileAction,
  confirmAppointmentStartAction,
} from "@/lib/admin/appointment-actions";

interface AdminProfileFormProps {
  profile: {
    fullName: string;
    email: string;
    department: string;
  };
  appointment: {
    id: string;
    status: string;
    missionDescription: string;
    startDate: string;
  } | null;
}

export function AdminProfileForm({ profile, appointment }: AdminProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isStartPending, startStartTransition] = useTransition();
  const [profileResult, setProfileResult] = useState<{ success: boolean; message: string } | null>(null);
  const [startResult, setStartResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showStartForm, setShowStartForm] = useState(false);

  function handleProfileSubmit(formData: FormData) {
    setProfileResult(null);
    if (appointment?.id) formData.append("appointmentId", appointment.id);
    startTransition(async () => {
      const res = await updateAdminProfileAction(formData);
      setProfileResult({
        success: res.success,
        message: res.success ? "Profil mis à jour avec succès." : res.error,
      });
    });
  }

  function handleConfirmStart(formData: FormData) {
    setStartResult(null);
    if (!appointment?.id) return;
    formData.append("appointmentId", appointment.id);
    startStartTransition(async () => {
      const res = await confirmAppointmentStartAction(formData);
      if (res.success) {
        setStartResult({ success: true, message: "Prise de fonction confirmée ! Votre mandat est maintenant actif." });
        setShowStartForm(false);
      } else {
        setStartResult({ success: false, message: res.error });
      }
    });
  }

  const isPendingAcceptance = appointment?.status === "pending_acceptance";
  const isActive = appointment?.status === "active";

  return (
    <div className="space-y-6">
      {/* Formulaire principal */}
      <form action={handleProfileSubmit} className="space-y-5">
        {/* Nom complet */}
        <div>
          <label htmlFor="admin-fullName" className="mb-1.5 block text-sm font-medium text-white/70">
            Nom complet
          </label>
          <input
            id="admin-fullName"
            name="fullName"
            type="text"
            defaultValue={profile.fullName}
            minLength={2}
            maxLength={100}
            disabled={isPending}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50"
          />
        </div>

        {/* Email (lecture seule) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/50">
            Adresse email{" "}
            <span className="text-white/30">(non modifiable)</span>
          </label>
          <input
            type="email"
            value={profile.email}
            readOnly
            disabled
            className="w-full rounded-lg border border-white/5 bg-white/3 px-4 py-2.5 text-sm text-white/40 cursor-not-allowed"
          />
        </div>

        {/* Département */}
        <div>
          <label htmlFor="admin-department" className="mb-1.5 block text-sm font-medium text-white/70">
            Département / Service
          </label>
          <input
            id="admin-department"
            name="department"
            type="text"
            defaultValue={profile.department}
            maxLength={100}
            placeholder="Ex : Scolarité, Administration…"
            disabled={isPending}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50"
          />
        </div>

        {/* Description de mission (si mandat présent) */}
        {appointment && (
          <div>
            <label htmlFor="admin-mission" className="mb-1.5 block text-sm font-medium text-white/70">
              Description de ma mission
            </label>
            <textarea
              id="admin-mission"
              name="missionDescription"
              rows={3}
              maxLength={1000}
              defaultValue={appointment.missionDescription}
              placeholder="Décrivez vos responsabilités et objectifs…"
              disabled={isPending}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50 resize-none"
            />
          </div>
        )}

        {/* Message de retour */}
        {profileResult && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              profileResult.success
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border border-red-500/30 bg-red-500/10 text-red-300"
            }`}
            role="alert"
          >
            {profileResult.success ? "✅ " : "❌ "}
            {profileResult.message}
          </div>
        )}

        <button
          id="admin-profile-save-btn"
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-sky-500/20 py-2.5 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/30 hover:text-white disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Enregistrer le profil"}
        </button>
      </form>

      {/* Confirmation de prise de fonction (uniquement si statut pending) */}
      {appointment && isPendingAcceptance && (
        <div className="border-t border-white/10 pt-5">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="mb-2 text-sm font-semibold text-amber-300">
              📅 Confirmer votre prise de fonction
            </p>
            <p className="mb-3 text-xs text-white/50">
              Indiquez la date à laquelle vous prenez officiellement vos fonctions.
              Cette date sera enregistrée dans l&apos;historique et ne pourra pas être modifiée librement.
            </p>

            {!showStartForm ? (
              <button
                id="show-confirm-start-btn"
                onClick={() => setShowStartForm(true)}
                className="rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/30"
              >
                Confirmer ma prise de fonction
              </button>
            ) : (
              <form action={handleConfirmStart} className="space-y-3">
                <div>
                  <label htmlFor="start-date-confirm" className="mb-1 block text-xs text-white/60">
                    Date de prise de fonction <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="start-date-confirm"
                    name="startDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    max={new Date().toISOString().split("T")[0]}
                    disabled={isStartPending}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                  />
                </div>

                {startResult && (
                  <div
                    className={`rounded-lg px-3 py-2.5 text-xs ${
                      startResult.success
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border border-red-500/30 bg-red-500/10 text-red-300"
                    }`}
                  >
                    {startResult.message}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    id="confirm-start-date-btn"
                    type="submit"
                    disabled={isStartPending}
                    className="rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    {isStartPending ? "En cours…" : "Activer mon mandat"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStartForm(false)}
                    className="rounded-lg px-4 py-2 text-xs text-white/40 hover:text-white"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Statut mandat actif */}
      {appointment && isActive && appointment.startDate && (
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Mandat actif depuis le{" "}
            {new Date(appointment.startDate).toLocaleDateString("fr-FR")}
          </div>
        </div>
      )}
    </div>
  );
}
