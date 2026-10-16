"use client";

/**
 * Formulaire de nomination d'un nouvel administrateur.
 * Réservé au directeur — appelé depuis la page /admin/appointments.
 */

import { useState, useTransition } from "react";
import { nominateAdminAction } from "@/lib/admin/appointment-actions";

export function NominateAdminForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await nominateAdminAction(formData);
      if (res.success) {
        setResult({
          success: true,
          message: "Demande d'invitation envoyée. Vérifiez que le courriel arrive dans la boîte de réception ou les indésirables.",
        });
        // Réinitialiser le formulaire
        const form = document.getElementById("nominate-admin-form") as HTMLFormElement;
        form?.reset();
      } else {
        setResult({ success: false, message: res.error });
      }
    });
  }

  return (
    <form id="nominate-admin-form" action={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Nom complet */}
        <div>
          <label htmlFor="nominate-fullName" className="mb-1.5 block text-sm font-medium text-white/70">
            Nom complet <span className="text-red-400">*</span>
          </label>
          <input
            id="nominate-fullName"
            name="fullName"
            type="text"
            required
            minLength={2}
            maxLength={100}
            placeholder="Prénom Nom"
            disabled={isPending}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="nominate-email" className="mb-1.5 block text-sm font-medium text-white/70">
            Adresse email <span className="text-red-400">*</span>
          </label>
          <input
            id="nominate-email"
            name="email"
            type="email"
            required
            placeholder="admin@exemple.com"
            disabled={isPending}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Description de mission */}
      <div>
        <label htmlFor="nominate-mission" className="mb-1.5 block text-sm font-medium text-white/70">
          Description de la mission <span className="text-white/30">(optionnel)</span>
        </label>
        <textarea
          id="nominate-mission"
          name="missionDescription"
          rows={3}
          maxLength={1000}
          placeholder="Décrivez les responsabilités et objectifs de ce mandat…"
          disabled={isPending}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50 resize-none"
        />
      </div>

      {/* Message de retour */}
      {result && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            result.success
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border border-red-500/30 bg-red-500/10 text-red-300"
          }`}
          role="alert"
        >
          {result.success ? "✅ " : "❌ "}
          {result.message}
        </div>
      )}

      {/* Bouton de soumission */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-white/30">
          L&apos;administrateur recevra une invitation par email avec un lien sécurisé pour accéder à son compte.
        </p>
        <button
          id="nominate-submit-btn"
          type="submit"
          disabled={isPending}
          className="flex-shrink-0 rounded-xl bg-sky-500/20 px-6 py-2.5 text-sm font-semibold text-sky-300 transition-all hover:bg-sky-500/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Envoi en cours…
            </span>
          ) : (
            "Envoyer l'invitation →"
          )}
        </button>
      </div>
    </form>
  );
}
