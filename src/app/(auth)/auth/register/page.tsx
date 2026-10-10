import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/forms/RegisterForm";

export const metadata: Metadata = { title: "Inscription" };

export default function RegisterPage() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
      {/* En-tête de la carte */}
      <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/40 to-[#152614]/40 px-8 py-6 text-center">
        <div className="mb-1 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#03A61C]/20 text-[#05F228]">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-white">Créer un compte</h1>
        <p className="mt-1 text-sm text-white/40">Rejoignez la plateforme d&apos;innovation ESCAE-BÉNIN.</p>
      </div>
      {/* Formulaire */}
      <div className="px-8 py-6">
        <RegisterForm />
        <div className="mt-6 text-center text-sm text-white/30">
          Déjà un compte ?{" "}
          <Link href="/auth/login" className="font-semibold text-[#05F228] hover:underline">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
