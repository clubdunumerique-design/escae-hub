"use client";

import { useEffect, useState } from "react";
import { registerAction } from "@/app/(auth)/actions";
import { useRouter } from "next/navigation";
import type { UniversityOption } from "@/types";

interface RegisterFormProps {
  universities: UniversityOption[];
}

interface RegistrationPrefill {
  fullName: string;
  email: string;
  studentId: string;
  universityId: string;
}

const EMPTY_PREFILL: RegistrationPrefill = {
  fullName: "",
  email: "",
  studentId: "",
  universityId: "",
};

export function RegisterForm({ universities }: RegisterFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [prefill, setPrefill] = useState(EMPTY_PREFILL);

  useEffect(() => {
    const stored = sessionStorage.getItem("escae-registration-prefill");
    if (!stored) return;
    sessionStorage.removeItem("escae-registration-prefill");
    try {
      const candidate = JSON.parse(stored) as Partial<RegistrationPrefill>;
      if (
        typeof candidate.universityId === "string" &&
        universities.some((university) => university.id === candidate.universityId)
      ) {
        setPrefill({
          fullName: typeof candidate.fullName === "string" ? candidate.fullName : "",
          email: typeof candidate.email === "string" ? candidate.email : "",
          studentId: typeof candidate.studentId === "string" ? candidate.studentId : "",
          universityId: candidate.universityId,
        });
      }
    } catch {
      // Ignore malformed browser session data and leave the form blank.
    }
  }, [universities]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setIsLoading(false);
      return;
    }
    try {
      const response = await registerAction(formData);
      if (response.success) {
        router.push(`/auth/verify?email=${encodeURIComponent(email)}`);
      } else {
        setError(response.error);
      }
    } catch {
      setError("Une erreur inattendue est survenue.");
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40";
  const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="fullName" className={labelClass}>Nom complet</label>
        <input id="fullName" name="fullName" type="text" required placeholder="Prénom Nom" value={prefill.fullName} onChange={(event) => setPrefill((value) => ({ ...value, fullName: event.target.value }))} className={inputClass} />
      </div>
      <div>
        <label htmlFor="universityId" className={labelClass}>Université</label>
        <select id="universityId" name="universityId" required value={prefill.universityId} onChange={(event) => setPrefill((value) => ({ ...value, universityId: event.target.value }))} className={inputClass}>
          <option value="" disabled>Sélectionnez votre université</option>
          {universities.map((university) => (
            <option key={university.id} value={university.id}>{university.name}</option>
          ))}
        </select>
        {universities.length === 0 && <p className="mt-1 text-xs text-amber-300">La liste des universités est temporairement indisponible.</p>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="studentId" className={labelClass.replace("mb-2 ", "")}>
            Matricule étudiant
          </label>
          <span className="text-[10px] text-white/40 font-normal">Obligatoire</span>
        </div>
        <input
          id="studentId"
          name="studentId"
          type="text"
          placeholder="Ex : ETU-2026-XXXX"
          pattern="ETU-[0-9]{4}-[0-9]{4}"
          title="Format attendu : ETU-AAAA-NNNN (ex. ETU-2026-0024)"
          maxLength={13}
          required
          value={prefill.studentId}
          onChange={(event) => setPrefill((value) => ({ ...value, studentId: event.target.value.toUpperCase() }))}
          className={inputClass}
        />
        <p className="mt-1 text-[11px] text-white/35">
          Après confirmation de votre email, le matricule sera comparé aux données collectées.
        </p>
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>Adresse e-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" placeholder="votre@email.com" value={prefill.email} onChange={(event) => setPrefill((value) => ({ ...value, email: event.target.value }))} className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Mot de passe</label>
        <input id="password" name="password" type="password" required autoComplete="new-password" placeholder="Min. 8 caractères" className={inputClass} />
      </div>
      <div>
        <label htmlFor="confirmPassword" className={labelClass}>Confirmer le mot de passe</label>
        <input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" placeholder="••••••••" className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={isLoading || universities.length === 0}
        className="mt-2 w-full rounded-lg bg-[#03A61C] py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_30px_rgba(5,242,40,0.5)] disabled:opacity-60"
      >
        {isLoading ? "Création en cours..." : "Créer mon compte"}
      </button>
    </form>
  );
}
