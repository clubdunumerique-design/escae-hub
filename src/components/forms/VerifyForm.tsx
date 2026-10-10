"use client";

import { useState } from "react";
import { verifyOtpAction } from "@/app/(auth)/actions";
import { useRouter, useSearchParams } from "next/navigation";

export function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    
    const formData = new FormData(event.currentTarget);
    try {
      const response = await verifyOtpAction(formData);
      if (response.success) {
        // Redirection vers le dashboard après vérification réussie
        router.push("/dashboard");
      } else {
        setError(response.error);
      }
    } catch {
      setError("Une erreur inattendue est survenue.");
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl tracking-[0.5em] font-bold text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40";
  const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      
      <input type="hidden" name="email" value={email} />
      
      <div>
        <label htmlFor="token" className={labelClass}>Code à 6 chiffres</label>
        <input
          id="token"
          name="token"
          type="text"
          maxLength={6}
          required
          placeholder="000000"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !email}
        className="mt-2 w-full rounded-lg bg-[#03A61C] px-4 py-3 font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.35)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_30px_rgba(5,242,40,0.5)] disabled:opacity-50"
      >
        {isLoading ? "Vérification..." : "Confirmer mon compte"}
      </button>
      
      {!email && (
        <p className="text-xs text-red-400 text-center">
          Erreur : Aucun email spécifié dans l'URL.
        </p>
      )}
    </form>
  );
}
