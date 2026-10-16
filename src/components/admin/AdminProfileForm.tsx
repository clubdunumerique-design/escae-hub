"use client";

/**
 * Formulaire de complétion et d'activation du profil administrateur.
 * - Si le mandat est en attente (pending_acceptance) : flux unifié "Zéro friction"
 *   (définition du mot de passe + département + activation en 1 clic -> redirection vers /admin).
 * - Si le mandat est actif (active) : mise à jour du profil.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateAdminProfileAction,
  activateAdminAccountAction,
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Visibilité des mots de passe
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isPendingAcceptance = appointment?.status === "pending_acceptance";
  const isActive = appointment?.status === "active";

  // Soumission pour activation initiale (nouveau compte invité)
  function handleActivation(formData: FormData) {
    setResult(null);
    if (appointment?.id) formData.append("appointmentId", appointment.id);

    startTransition(async () => {
      const res = await activateAdminAccountAction(formData);
      if (res.success) {
        setResult({
          success: true,
          message: "Compte activé avec succès ! Redirection vers votre espace administration...",
        });
        setTimeout(() => {
          router.push(res.data?.redirectTo || "/admin");
          router.refresh();
        }, 1200);
      } else {
        setResult({ success: false, message: res.error });
      }
    });
  }

  // Soumission pour mise à jour standard (mandat déjà actif)
  function handleProfileUpdate(formData: FormData) {
    setResult(null);
    if (appointment?.id) formData.append("appointmentId", appointment.id);

    startTransition(async () => {
      const res = await updateAdminProfileAction(formData);
      setResult({
        success: res.success,
        message: res.success ? "Profil mis à jour avec succès." : res.error,
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* ── CAS 1 : NOUVEL ADMINISTRATEUR EN ATTENTE D'ACTIVATION ── */}
      {isPendingAcceptance && (
        <form action={handleActivation} className="space-y-5">
          {/* Bannière explicative chaleureuse */}
          <div className="rounded-xl border border-[#03A61C]/30 bg-[#03A61C]/10 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">🎉</span>
              <div>
                <p className="text-sm font-bold text-[#05F228]">
                  Bienvenue dans l&apos;équipe administrative !
                </p>
                <p className="mt-0.5 text-xs text-white/70 leading-relaxed">
                  Pour finaliser votre accès en un seul clic, choisissez votre mot de passe personnel de connexion
                  et confirmez vos informations.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Nom complet */}
            <div>
              <label htmlFor="admin-fullName" className="mb-1.5 block text-xs font-medium text-white/70 uppercase tracking-wider">
                Nom complet <span className="text-red-400">*</span>
              </label>
              <input
                id="admin-fullName"
                name="fullName"
                type="text"
                required
                defaultValue={profile.fullName}
                minLength={2}
                maxLength={100}
                disabled={isPending}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#05F228] focus:ring-1 focus:ring-[#05F228]/40 disabled:opacity-50"
              />
            </div>

            {/* Email (lecture seule) */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50 uppercase tracking-wider">
                Adresse email <span className="text-white/30">(vérifiée)</span>
              </label>
              <input
                type="email"
                value={profile.email}
                readOnly
                disabled
                className="w-full rounded-lg border border-white/5 bg-white/3 px-4 py-2.5 text-sm text-white/40 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Département / Service */}
          <div>
            <label htmlFor="admin-department" className="mb-1.5 block text-xs font-medium text-white/70 uppercase tracking-wider">
              Département ou Service
            </label>
            <input
              id="admin-department"
              name="department"
              type="text"
              defaultValue={profile.department}
              maxLength={100}
              placeholder="Ex : Direction des études, Scolarité, Pôle Recherche…"
              disabled={isPending}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#05F228] focus:ring-1 focus:ring-[#05F228]/40 disabled:opacity-50"
            />
          </div>

          {/* Définition du mot de passe */}
          <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#79F281]">
              🔐 Définissez votre mot de passe
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Mot de passe */}
              <div>
                <label htmlFor="admin-password" className="mb-1.5 block text-xs font-medium text-white/70">
                  Nouveau mot de passe <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="Au moins 8 caractères"
                    disabled={isPending}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#05F228] focus:ring-1 focus:ring-[#05F228]/40 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    tabIndex={-1}
                  >
                    {showPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>

              {/* Confirmation */}
              <div>
                <label htmlFor="admin-confirmPassword" className="mb-1.5 block text-xs font-medium text-white/70">
                  Confirmer le mot de passe <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="admin-confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="Répétez le mot de passe"
                    disabled={isPending}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#05F228] focus:ring-1 focus:ring-[#05F228]/40 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-white/40">
              💡 Ce mot de passe vous permettra de vous reconnecter directement lors de vos prochaines visites.
            </p>
          </div>

          {/* Date de prise de fonction */}
          <div>
            <label htmlFor="start-date-confirm" className="mb-1.5 block text-xs font-medium text-white/70 uppercase tracking-wider">
              Date officielle de prise de fonction
            </label>
            <input
              id="start-date-confirm"
              name="startDate"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              max={new Date().toISOString().split("T")[0]}
              disabled={isPending}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-[#05F228]"
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

          {/* Bouton d'activation principal */}
          <button
            id="admin-profile-activate-btn"
            type="submit"
            disabled={isPending}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#03A61C] py-3.5 text-sm font-bold text-white shadow-[0_0_25px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:text-black hover:shadow-[0_0_35px_rgba(5,242,40,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Activation de votre compte en cours…
              </span>
            ) : (
              <>
                <span>Activer mon compte et accéder à l&apos;espace Administrateur</span>
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </form>
      )}

      {/* ── CAS 2 : ADMINISTRATEUR DÉJÀ ACTIF (MISE À JOUR DE FICHE) ── */}
      {isActive && (
        <form action={handleProfileUpdate} className="space-y-5">
          <div>
            <label htmlFor="admin-fullName-active" className="mb-1.5 block text-sm font-medium text-white/70">
              Nom complet
            </label>
            <input
              id="admin-fullName-active"
              name="fullName"
              type="text"
              defaultValue={profile.fullName}
              minLength={2}
              maxLength={100}
              disabled={isPending}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/50">
              Adresse email <span className="text-white/30">(non modifiable)</span>
            </label>
            <input
              type="email"
              value={profile.email}
              readOnly
              disabled
              className="w-full rounded-lg border border-white/5 bg-white/3 px-4 py-2.5 text-sm text-white/40 cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="admin-department-active" className="mb-1.5 block text-sm font-medium text-white/70">
              Département / Service
            </label>
            <input
              id="admin-department-active"
              name="department"
              type="text"
              defaultValue={profile.department}
              maxLength={100}
              placeholder="Ex : Scolarité, Administration…"
              disabled={isPending}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50"
            />
          </div>

          {appointment?.missionDescription && (
            <div>
              <label htmlFor="admin-mission-active" className="mb-1.5 block text-sm font-medium text-white/70">
                Description de la mission
              </label>
              <textarea
                id="admin-mission-active"
                name="missionDescription"
                rows={3}
                maxLength={1000}
                defaultValue={appointment.missionDescription}
                disabled={isPending}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50 resize-none"
              />
            </div>
          )}

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

          <button
            id="admin-profile-save-btn"
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-sky-500/20 py-2.5 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/30 hover:text-white disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>

          {appointment?.startDate && (
            <div className="border-t border-white/10 pt-4 text-center">
              <span className="inline-flex items-center gap-2 text-xs text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Mandat actif en cours depuis le {new Date(appointment.startDate).toLocaleDateString("fr-FR")}
              </span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
