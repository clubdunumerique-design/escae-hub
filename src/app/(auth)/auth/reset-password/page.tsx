import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";

export const metadata: Metadata = { title: "Réinitialiser le mot de passe" };

export default function ResetPasswordPage() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
      {/* En-tête */}
      <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/40 to-[#152614]/40 px-8 py-6 text-center">
        <div className="mb-1 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#03A61C]/20 text-[#05F228]">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-white">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-white/40">
          Choisissez un nouveau mot de passe sécurisé.
        </p>
      </div>

      {/* Formulaire */}
      <div className="px-8 py-6">
        <ResetPasswordForm />
        <div className="mt-6 text-center text-sm text-white/30">
          <Link href="/auth/login" className="font-semibold text-[#05F228] hover:underline">
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
