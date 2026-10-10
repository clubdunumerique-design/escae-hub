import { ProjectForm } from "@/components/forms/ProjectForm";
import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Nouveau projet" };

export default async function NewProjectPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_verified, role")
    .eq("id", user.id)
    .single();

  // Bloquer les étudiants non vérifiés côté serveur
  const isBlockedStudent = profile?.role === "student" && !profile?.is_verified;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-white/30 transition-colors hover:text-white/60">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour au tableau de bord
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-[#79F281]">Nouvelle soumission</p>
        <h1 className="mt-1 text-3xl font-extrabold text-white">Créer un projet</h1>
        <p className="mt-2 text-sm text-white/40">
          Remplissez les informations de base. Vous pourrez ajouter les membres et les documents après.
        </p>
      </div>

      {isBlockedStudent ? (
        /* Bloc d'accès refusé pour étudiants non vérifiés */
        <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20">
              <svg className="h-7 w-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h2 className="text-lg font-bold text-amber-300">Compte non vérifié</h2>
          <p className="mt-2 text-sm text-amber-200/70">
            Votre compte est en attente de vérification par l&apos;administration. Vous pourrez créer et soumettre des projets dès que votre inscription aura été validée.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-300 transition-all hover:bg-amber-500/10"
          >
            ← Retour au tableau de bord
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-6 py-4">
            <h2 className="font-semibold text-white">Informations générales</h2>
          </div>
          <div className="p-6">
            <ProjectForm />
          </div>
        </div>
      )}
    </div>
  );
}

