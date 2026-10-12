import type { Metadata } from "next";
import { VerifyForm } from "@/components/forms/VerifyForm";
import { Suspense } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vérification OTP — ESCAE Innovation Hub",
  description: "Saisissez votre code à 6 chiffres pour valider votre compte.",
};

export default function VerifyPage() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121212]/80 shadow-[0_0_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      {/* Lueur d'ambiance verte en haut de la carte */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[#05F228]/15 blur-3xl" />
      
      {/* En-tête avec les Logos Officiels */}
      <div className="border-b border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent px-8 pb-6 pt-7 text-center">


        {/* Badge Icône de Sécurité */}
        <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#05F228]/30 bg-gradient-to-br from-[#03A61C]/30 to-[#074015]/40 text-[#05F228] shadow-[0_0_20px_rgba(5,242,40,0.25)]">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white">
          Vérification de sécurité
        </h1>
        <p className="mt-1.5 text-xs font-medium text-white/50">
          Un code de confirmation confidentiel vous a été envoyé par email.
        </p>
      </div>

      {/* Formulaire interactif */}
      <div className="px-6 py-6 sm:px-8">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-12 text-white/40">
              <svg className="h-6 w-6 animate-spin text-[#05F228]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="mt-2 text-xs">Chargement du formulaire...</span>
            </div>
          }
        >
          <VerifyForm />
        </Suspense>
      </div>

      {/* Pied de carte */}
      <div className="border-t border-white/5 bg-white/[0.01] px-6 py-3.5 text-center">
        <Link
          href="/auth/login"
          className="text-xs text-white/40 transition-colors hover:text-white"
        >
          ← Retour à la page de connexion
        </Link>
      </div>
    </div>
  );
}
