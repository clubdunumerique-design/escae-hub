import { ProjectForm } from "@/components/forms/ProjectForm";
import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Nouveau projet" };

export default async function NewProjectPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Bloquer admin et director côté serveur
  if (profile?.role !== "student") redirect(profile?.role === "admin" || profile?.role === "director" ? "/admin" : "/auth/login");

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

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-6 py-4">
          <h2 className="font-semibold text-white">Informations générales</h2>
        </div>
        <div className="p-6">
          <ProjectForm />
        </div>
      </div>
    </div>
  );
}

