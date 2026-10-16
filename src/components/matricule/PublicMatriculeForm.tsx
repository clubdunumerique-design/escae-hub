"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitStudentMatriculeAction } from "@/lib/matricule/matricule-actions";
import type { MatriculeVerificationStatus } from "@/types";

const ESCAE_FIELDS = [
  "Génie Logiciel & Systèmes d'Information (GL-SI)",
  "Réseaux, Sécurité & Télécommunications (RST)",
  "Intelligence Artificielle & Science des Données",
  "Comptabilité, Audit & Contrôle de Gestion",
  "Banque, Finance & Assurance",
  "Marketing, Communication & Commerce International",
  "Gestion des Ressources Humaines (GRH)",
  "Transport, Logistique & Supply Chain",
  "Droit des Affaires & Carrières Juridiques",
  "Autre filière",
];

const ACADEMIC_LEVELS = [
  "Licence 1 (L1)",
  "Licence 2 (L2)",
  "Licence 3 (L3)",
  "Master 1 (M1)",
  "Master 2 (M2)",
  "Doctorat / Recherche",
];

export function PublicMatriculeForm() {
  const [isPending, startTransition] = useTransition();
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    data?: {
      matricule: string;
      fullName: string;
      status: MatriculeVerificationStatus;
      isExistingUser: boolean;
    };
    error?: string;
  } | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const res = await submitStudentMatriculeAction(formData);
      if (res.success) {
        setSubmissionResult({ success: true, data: res.data });
      } else {
        setSubmissionResult({ success: false, error: res.error });
      }
    });
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#05F228] focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#05F228]/40 disabled:opacity-50";
  const labelClass =
    "mb-2 block text-xs font-semibold uppercase tracking-wider text-white/60";

  // Écran de confirmation de soumission
  if (submissionResult?.success && submissionResult.data) {
    const { matricule, fullName, status, isExistingUser } = submissionResult.data;
    const isVerified = status === "verified";

    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        {/* En-tête succès */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#03A61C]/20 text-[#05F228] shadow-[0_0_30px_rgba(5,242,40,0.3)]">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <span className="inline-block rounded-full bg-[#05F228]/10 px-3 py-1 text-xs font-semibold text-[#05F228]">
            {isVerified ? "Matricule Officiellement Certifié" : "Demande Enregistrée avec Succès"}
          </span>

          <h2 className="mt-3 text-2xl font-extrabold text-white">
            {isVerified ? "Vous êtes vérifié !" : "Fiche transmise à la scolarité"}
          </h2>

          <p className="mt-2 text-sm text-white/60 max-w-md mx-auto">
            {isVerified
              ? "Votre matricule officiel a été reconnu et certifié dans les registres de l'établissement."
              : "Vos informations ont bien été transmises au registre pour validation par les services administratifs d'ESCAE-BÉNIN."}
          </p>
        </div>

        {/* Récapitulatif */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/3 p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-white/40">Étudiant</span>
            <span className="font-semibold text-white">{fullName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/40">Matricule officiel</span>
            <span className="font-mono font-bold text-[#05F228] tracking-wider">{matricule}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/40">Statut actuel</span>
            <span className={`font-semibold ${isVerified ? "text-emerald-400" : "text-amber-400"}`}>
              {isVerified ? "Certifié" : "En cours d'examen"}
            </span>
          </div>
        </div>

        {/* Prochaines étapes */}
        <div className="mt-6 rounded-xl border border-[#03A61C]/20 bg-[#03A61C]/5 p-4 text-xs text-white/70 space-y-1.5">
          <p className="font-bold text-[#79F281]">💡 Prochaine étape :</p>
          {isExistingUser ? (
            <p>
              Votre compte Innovation Hub est déjà relié à ce matricule. Connectez-vous dès maintenant pour accéder à vos projets.
            </p>
          ) : (
            <p>
              Créez votre compte étudiant sur <strong>ESCAE Innovation Hub</strong> avec cette même adresse email. Votre statut vérifié y sera automatiquement rattaché !
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/auth/register"
            className="flex-1 text-center rounded-xl bg-[#03A61C] py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:text-black hover:shadow-[0_0_30px_rgba(5,242,40,0.6)]"
          >
            Créer mon compte sur Innovation Hub &rarr;
          </Link>
          <button
            type="button"
            onClick={() => setSubmissionResult(null)}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10"
          >
            Soumettre un autre matricule
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-5">
      {/* Message d'erreur */}
      {submissionResult && !submissionResult.success && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 flex items-start gap-3"
          role="alert"
        >
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold text-red-200">Impossible d&apos;enregistrer la fiche</p>
            <p className="mt-0.5 text-xs text-red-300/80">{submissionResult.error}</p>
          </div>
        </div>
      )}

      {/* Ligne : Prénom et Nom */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={labelClass}>
            Prénom(s) <span className="text-red-400">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            placeholder="Ex : Koffi"
            disabled={isPending}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="lastName" className={labelClass}>
            Nom de famille <span className="text-red-400">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            placeholder="Ex : MENSAH"
            disabled={isPending}
            className={inputClass}
          />
        </div>
      </div>

      {/* Matricule étudiant */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="matricule" className={labelClass.replace("mb-2 ", "")}>
            Matricule étudiant officiel <span className="text-red-400">*</span>
          </label>
          <span className="text-[11px] text-[#79F281] font-mono">Format : XX-XXXX-XXXX</span>
        </div>
        <input
          id="matricule"
          name="matricule"
          type="text"
          required
          placeholder="Ex : 24-INFO-0042 ou ESCAE-2024-XXXX"
          disabled={isPending}
          className={`${inputClass} font-mono tracking-wider uppercase`}
        />
        <p className="mt-1.5 text-[11px] text-white/40">
          Saisissez votre matricule tel qu&apos;il figure sur votre carte d&apos;étudiant ou votre attestation d&apos;inscription.
        </p>
      </div>

      {/* Adresse email */}
      <div>
        <label htmlFor="email" className={labelClass}>
          Adresse e-mail <span className="text-red-400">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="etudiant@escae.bj ou prenom.nom@gmail.com"
          disabled={isPending}
          className={inputClass}
        />
        <p className="mt-1.5 text-[11px] text-white/40">
          Utilisez de préférence l&apos;adresse email avec laquelle vous vous inscrirez sur la plateforme.
        </p>
      </div>

      {/* Filière et Niveau */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fieldOfStudy" className={labelClass}>
            Filière / Programme
          </label>
          <select
            id="fieldOfStudy"
            name="fieldOfStudy"
            disabled={isPending}
            className={`${inputClass} bg-[#141414]`}
            defaultValue=""
          >
            <option value="" disabled className="text-white/30">
              Sélectionnez votre filière
            </option>
            {ESCAE_FIELDS.map((f) => (
              <option key={f} value={f} className="bg-[#141414] text-white">
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="academicLevel" className={labelClass}>
            Niveau d&apos;études
          </label>
          <select
            id="academicLevel"
            name="academicLevel"
            disabled={isPending}
            className={`${inputClass} bg-[#141414]`}
            defaultValue=""
          >
            <option value="" disabled className="text-white/30">
              Sélectionnez votre niveau
            </option>
            {ACADEMIC_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl} className="bg-[#141414] text-white">
                {lvl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Champ honeypot anti-spam (invisible pour les vrais utilisateurs) */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Note d'intégrité */}
      <div className="rounded-xl border border-white/5 bg-white/2 p-3 text-[11px] text-white/40 leading-relaxed">
        🔒 Vos données sont confidentielles et utilisées exclusivement pour la certification académique de votre profil au sein d&apos;ESCAE-BÉNIN.
      </div>

      {/* Bouton de soumission */}
      <button
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
            Enregistrement de votre matricule…
          </span>
        ) : (
          <>
            <span>Enregistrer mon matricule étudiant</span>
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </>
        )}
      </button>

      {/* Lien vers connexion / inscription */}
      <div className="text-center pt-2">
        <p className="text-xs text-white/40">
          Vous avez déjà un compte ?{" "}
          <Link href="/auth/login" className="font-semibold text-[#05F228] hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </form>
  );
}
