"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitStudentMatriculeAction } from "@/lib/matricule/matricule-actions";
import type { MatriculeVerificationStatus } from "@/types";
import type { UniversityOption } from "@/types";
import { AcademicProgramFields } from "@/components/matricule/AcademicProgramFields";

const ACADEMIC_LEVELS = [
  "Licence 1 (L1)",
  "Licence 2 (L2)",
  "Licence 3 (L3)",
  "Master 1 (M1)",
  "Master 2 (M2)",
  "Doctorat / Recherche",
];

const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/CPpS2KZb4yH8rL5V4XMz9j?s=sw&p=a&iam=2";

export function PublicMatriculeForm({ universities }: { universities: UniversityOption[] }) {
  const [isPending, startTransition] = useTransition();
  const [academicLevel, setAcademicLevel] = useState("");
  const [isLevelMenuOpen, setIsLevelMenuOpen] = useState(false);
  const [communityJoined, setCommunityJoined] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    data?: {
      matricule: string;
      fullName: string;
      email: string;
      universityId: string;
      status: MatriculeVerificationStatus;
      isExistingUser: boolean;
      isExistingRecord: boolean;
      isSignedIn: boolean;
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
    "w-full min-w-0 max-w-full rounded-xl border border-white/20 bg-[#1b211c] px-4 py-3 text-sm text-white placeholder-white/55 transition-all hover:border-white/30 focus:border-[#05F228] focus:bg-[#202820] focus:outline-none focus:ring-2 focus:ring-[#05F228]/30 disabled:opacity-60";
  const labelClass =
    "mb-2 block text-xs font-semibold uppercase tracking-wider text-white/85";

  // Écran de confirmation de soumission
  if (submissionResult?.success && submissionResult.data) {
    const resultData = submissionResult.data;
    const { fullName, matricule, isSignedIn } = resultData;

    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <section className="mx-auto max-w-lg text-center" aria-labelledby="community-step-title">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 text-red-400 ring-1 ring-red-400/40">
            <svg aria-hidden="true" className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.3 3.9 1.9 18.5A1.8 1.8 0 0 0 3.5 21h17a1.8 1.8 0 0 0 1.6-2.5L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <p className="text-sm font-extrabold uppercase tracking-wider text-red-400">Attention — obligatoire</p>
          <h2 id="community-step-title" className="mt-2 text-2xl font-extrabold text-white">
            Rejoignez la communauté pour continuer
          </h2>
          <a
            href={WHATSAPP_COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-4 text-base font-extrabold text-[#062b12] transition hover:bg-[#75f09b]"
          >
            Rejoindre la communauté ↗
          </a>
          <label className="mt-5 flex cursor-pointer items-center justify-center gap-3 text-sm text-white/80">
            <input type="checkbox" checked={communityJoined} onChange={(event) => setCommunityJoined(event.target.checked)} className="h-5 w-5 accent-[#03A61C]" />
            <span>J’ai rejoint la communauté</span>
          </label>
        </section>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Link
            aria-disabled={!communityJoined}
            tabIndex={communityJoined ? undefined : -1}
            href={communityJoined ? (isSignedIn ? "/dashboard" : "/auth/register") : "#community-step-title"}
            onClick={(event) => {
              if (!communityJoined) {
                event.preventDefault();
                return;
              }
              if (isSignedIn) return;
              sessionStorage.setItem("escae-community-joined", "yes");
              sessionStorage.setItem("escae-registration-prefill", JSON.stringify({
                fullName,
                email: resultData.email,
                studentId: matricule,
                universityId: resultData.universityId,
              }));
            }}
            className={`flex-1 text-center rounded-xl py-3.5 text-sm font-bold transition-all ${communityJoined ? "bg-[#03A61C] text-white shadow-[0_0_20px_rgba(3,166,28,0.4)] hover:bg-[#05F228] hover:text-black hover:shadow-[0_0_30px_rgba(5,242,40,0.6)]" : "cursor-not-allowed bg-white/10 text-white/35"}`}
          >
            {isSignedIn ? "Continuer vers mon espace" : "Continuer vers l’inscription HUB"} &rarr;
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
    <form onSubmit={handleSubmit} className="min-w-0 space-y-5 rounded-3xl border border-[#03A61C]/40 bg-gradient-to-br from-[#171d18] to-[#101310] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] ring-1 ring-[#05F228]/10 sm:p-8">
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
      <div>
        <label htmlFor="universityId" className={labelClass}>
          Université <span className="text-red-400">*</span>
        </label>
        <select
          id="universityId"
          name="universityId"
          required
          disabled={isPending || universities.length === 0}
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>Sélectionnez votre université</option>
          {universities.map((university) => (
            <option key={university.id} value={university.id}>{university.name}</option>
          ))}
        </select>
        {universities.length === 0 && <p className="mt-1 text-xs text-amber-300">La liste des universités est temporairement indisponible.</p>}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={labelClass}>
            Prénom(s) <span className="text-red-400">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            placeholder="Ex : Romaric"
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
            placeholder="Ex : VIGNON"
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
        </div>
        <input
          id="matricule"
          name="matricule"
          type="text"
          required
          placeholder="Ex : ETU-2026-XXXX"
          pattern="ETU-[0-9]{4}-[0-9]{4}"
          title="Format attendu : ETU-AAAA-NNNN (ex. ETU-2026-0024)"
          maxLength={13}
          onChange={(event) => {
            event.currentTarget.value = event.currentTarget.value
              .replace(/[‐‑‒–—―−－]/g, "-")
              .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
              .toUpperCase();
          }}
          disabled={isPending}
          className={`${inputClass} font-mono tracking-wider uppercase`}
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/65">
          Format obligatoire : ETU-AAAA-NNNN, par exemple ETU-2026-0024. Recopiez le matricule de votre carte ou attestation.
        </p>
      </div>

      {/* Adresse email */}
      <div>
        <label htmlFor="email" className={labelClass}>
            Adresse Gmail <span className="text-red-400">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
            placeholder="prenom.nom@gmail.com"
          disabled={isPending}
          className={inputClass}
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/65">
          Utilisez de préférence l&apos;adresse email avec laquelle vous vous inscrirez sur la plateforme.
        </p>
      </div>

      {/* Filière et Niveau */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <AcademicProgramFields
          idPrefix="student-program"
          disabled={isPending}
          inputClassName={`${inputClass} bg-[#141414]`}
          labelClassName={labelClass}
        />

        <div>
          <label htmlFor="academicLevel" className={labelClass}>
            Niveau d&apos;études
          </label>
          <input type="hidden" name="academicLevel" value={academicLevel} />
          <div
            className="relative min-w-0"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsLevelMenuOpen(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setIsLevelMenuOpen(false);
            }}
          >
            <button
              id="academicLevel"
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={isLevelMenuOpen}
              aria-controls="academic-level-options"
              disabled={isPending}
              onClick={() => setIsLevelMenuOpen((open) => !open)}
              className={`${inputClass} flex items-center justify-between gap-3 bg-[#141414] text-left`}
            >
              <span className={`truncate ${academicLevel ? "text-white" : "text-white/55"}`}>
                {academicLevel || "Sélectionnez votre niveau"}
              </span>
              <svg className={`h-4 w-4 shrink-0 text-white/60 transition-transform ${isLevelMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
            {isLevelMenuOpen && (
              <div
                id="academic-level-options"
                role="listbox"
                aria-labelledby="academicLevel"
                className="absolute left-0 right-0 top-full z-30 mt-2 max-h-52 w-full min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-white/15 bg-[#171917] p-1.5 shadow-2xl shadow-black/50"
              >
                {ACADEMIC_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="option"
                    aria-selected={academicLevel === level}
                    onClick={() => {
                      setAcademicLevel(level);
                      setIsLevelMenuOpen(false);
                    }}
                    className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm leading-snug transition ${academicLevel === level ? "bg-[#03A61C]/20 text-[#79F281]" : "text-white/85 hover:bg-white/[0.07]"}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Champ honeypot anti-spam (invisible pour les vrais utilisateurs) */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Note d'intégrité */}
      <div className="rounded-xl border border-[#03A61C]/25 bg-[#03A61C]/[0.07] p-3 text-[11px] leading-relaxed text-white/70">
        🔒 Vos données sont confidentielles et utilisées exclusivement pour la certification académique de votre profil au sein d&apos;ESCAE-BÉNIN.
      </div>

      {/* Bouton de soumission */}
      <button
        type="submit"
        disabled={isPending || universities.length === 0}
        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#03A61C] py-3.5 text-sm font-bold text-white shadow-[0_0_25px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:text-black hover:shadow-[0_0_35px_rgba(5,242,40,0.6)] disabled:cursor-not-allowed disabled:opacity-70"
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
        <p className="text-xs text-white/65">
          Vous avez déjà un compte ?{" "}
          <Link href="/auth/login" className="font-semibold text-[#05F228] hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </form>
  );
}
