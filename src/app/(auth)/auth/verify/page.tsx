import type { Metadata } from "next";
import { VerifyForm } from "@/components/forms/VerifyForm";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Vérification OTP" };

export default function VerifyPage() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
      <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/40 to-[#152614]/40 px-8 py-6 text-center">
        <div className="mb-1 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#03A61C]/20 text-[#05F228]">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-white">Vérification de l'email</h1>
        <p className="mt-1 text-sm text-white/40">Saisissez le code à 6 chiffres reçu par email.</p>
      </div>
      <div className="px-8 py-6">
        <Suspense fallback={<div className="text-center text-white/50">Chargement...</div>}>
          <VerifyForm />
        </Suspense>
      </div>
    </div>
  );
}
