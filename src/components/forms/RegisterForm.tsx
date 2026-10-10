"use client";

import { useState } from "react";
import { registerAction } from "@/app/(auth)/actions";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
        // Redirection vers le formulaire OTP commentée pour utiliser les liens magiques
        // router.push(`/auth/verify?email=${encodeURIComponent(email)}`);
        setIsSuccess(true);
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

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-4 text-center">
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[#03A61C]/20 text-[#05F228]">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white">Vérifiez vos e-mails</h3>
        <p className="text-sm text-white/60">
          Nous vous avons envoyé un e-mail contenant un lien magique.
          <br /> Cliquez dessus pour activer votre compte.
        </p>
        <Link
          href="/auth/login"
          className="mt-4 w-full rounded-lg bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/20"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="fullName" className={labelClass}>Nom complet</label>
        <input id="fullName" name="fullName" type="text" required placeholder="Prénom Nom" className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>Adresse e-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" placeholder="votre@email.com" className={inputClass} />
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
        disabled={isLoading}
        className="mt-2 w-full rounded-lg bg-[#03A61C] py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_30px_rgba(5,242,40,0.5)] disabled:opacity-60"
      >
        {isLoading ? "Création en cours..." : "Créer mon compte"}
      </button>
    </form>
  );
}
