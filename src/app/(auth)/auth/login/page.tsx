import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/forms/LoginForm";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
      {/* En-tête de la carte */}
      <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/40 to-[#152614]/40 px-8 py-6 text-center">
        <div className="mb-1 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#03A61C]/20 text-[#05F228]">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-white">Bon retour</h1>
        <p className="mt-1 text-sm text-white/40">Connectez-vous à votre espace projet.</p>
      </div>
      {/* Formulaire */}
      <div className="px-8 py-6">
        <LoginForm initialError={error} />
        <div className="mt-6 text-center text-sm text-white/30">
          Pas encore de compte ?{" "}
          <Link href="/auth/register" className="font-semibold text-[#05F228] hover:underline">
            S&apos;inscrire
          </Link>
        </div>
      </div>
    </div>
  );
}
