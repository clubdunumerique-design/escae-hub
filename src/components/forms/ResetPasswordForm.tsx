"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "@/app/(auth)/actions";

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData(event.currentTarget);

    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await resetPasswordAction(formData);
      if (response.success) {
        router.push("/auth/login?reset=success");
      } else {
        setError(response.error ?? "Une erreur est survenue.");
      }
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
        <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
          Nouveau mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="relative mt-2 w-full overflow-hidden rounded-lg bg-[#03A61C] py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_30px_rgba(5,242,40,0.5)] disabled:opacity-60"
      >
        {isLoading ? "Réinitialisation..." : "Changer le mot de passe"}
      </button>
    </form>
  );
}
