"use client";

import { useState } from "react";
import { forgotPasswordAction } from "@/app/(auth)/actions";

export function ForgotPasswordForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await forgotPasswordAction(formData);
      if (response.success) {
        setStatus("success");
        setMessage("Un e-mail de réinitialisation vous a été envoyé. Vérifiez votre boîte de réception.");
      } else {
        setStatus("error");
        setMessage(response.error ?? "Une erreur est survenue.");
      }
    } catch {
      setStatus("error");
      setMessage("Une erreur inattendue est survenue.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#03A61C]/20">
          <svg className="h-8 w-8 text-[#05F228]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm text-white/70">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {status === "error" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {message}
        </div>
      )}
      <div>
        <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="votre@email.com"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:bg-white/8 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="relative mt-2 w-full overflow-hidden rounded-lg bg-[#03A61C] py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_30px_rgba(5,242,40,0.5)] disabled:opacity-60"
      >
        {status === "loading" ? "Envoi en cours..." : "Envoyer le lien"}
      </button>
    </form>
  );
}
