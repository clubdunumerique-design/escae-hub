"use client";

import { useState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/(auth)/actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await loginAction(formData);
      if (!response.success) setError(response.error);
    } catch {
      setError("Une erreur inattendue est survenue.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
          Adresse e-mail
        </label>
        <input
          id="email" name="email" type="email" required autoComplete="email"
          placeholder="votre@email.com"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
        />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-white/50">
            Mot de passe
          </label>
          <Link href="/auth/forgot-password" className="text-xs text-[#05F228]/70 hover:text-[#05F228] hover:underline transition-colors">
            Mot de passe oublié ?
          </Link>
        </div>
        <input
          id="password" name="password" type="password" required autoComplete="current-password"
          placeholder="••••••••"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="relative mt-2 w-full overflow-hidden rounded-lg bg-[#03A61C] py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_30px_rgba(5,242,40,0.5)] disabled:opacity-60"
      >
        {isLoading ? "Connexion en cours..." : "Se connecter"}
      </button>
    </form>
  );
}
