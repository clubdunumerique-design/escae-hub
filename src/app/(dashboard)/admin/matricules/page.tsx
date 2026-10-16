import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMatriculeRegistryAction } from "@/lib/matricule/matricule-actions";
import { MatriculeRegistryTable } from "@/components/admin/matricules/MatriculeRegistryTable";
import type { StudentMatriculeEntry } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Registre des matricules — ESCAE Innovation Hub",
  description: "Gestion et vérification des matricules étudiants ESCAE-BÉNIN",
};

export default async function AdminMatriculesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const canAccess = ["admin", "director"].includes(profile?.role ?? "");
  if (!canAccess) {
    redirect("/dashboard");
  }

  // Récupérer le registre
  const result = await getMatriculeRegistryAction();
  const entries: StudentMatriculeEntry[] = result.success ? result.data : [];

  const stats = {
    total: entries.length,
    pending: entries.filter((e) => e.verification_status === "pending").length,
    verified: entries.filter((e) => e.verification_status === "verified").length,
    rejected: entries.filter((e) => e.verification_status === "rejected").length,
    claimed: entries.filter((e) => Boolean(e.claimed_by_user_id)).length,
  };

  return (
    <div className="space-y-8">
      {/* ── En-tête de la page ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Registre des matricules étudiants
            </h1>
            <span className="rounded-full bg-[#03A61C]/20 px-2.5 py-0.5 text-xs font-semibold text-[#05F228] border border-[#03A61C]/30">
              {stats.total} fiche{stats.total > 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1 text-sm text-white/50">
            Validez les déclarations des étudiants et pré-enregistrez les matricules officiels de l&apos;ESCAE-BÉNIN.
          </p>
        </div>
      </div>

      {/* ── Cartes de statistiques ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-sm">
          <p className="text-xs font-medium text-white/50">En attente de vérification</p>
          <p className="mt-2 text-2xl font-bold text-amber-400">{stats.pending}</p>
          <p className="mt-1 text-[11px] text-white/40">À examiner par l&apos;équipe</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-sm">
          <p className="text-xs font-medium text-white/50">Matricules vérifiés</p>
          <p className="mt-2 text-2xl font-bold text-[#05F228]">{stats.verified}</p>
          <p className="mt-1 text-[11px] text-white/40">Confirment l&apos;identité étudiante</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-sm">
          <p className="text-xs font-medium text-white/50">Comptes Hub liés</p>
          <p className="mt-2 text-2xl font-bold text-blue-400">{stats.claimed}</p>
          <p className="mt-1 text-[11px] text-white/40">Inscrits avec badge vérifié</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-sm">
          <p className="text-xs font-medium text-white/50">Matricules rejetés</p>
          <p className="mt-2 text-2xl font-bold text-rose-400">{stats.rejected}</p>
          <p className="mt-1 text-[11px] text-white/40">Demandes non conformes</p>
        </div>
      </div>

      {/* ── Bannière lien public ── */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#03A61C]/30 bg-[#03A61C]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#03A61C]/20 text-[#05F228]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Lien du formulaire public officiel</p>
            <p className="text-xs text-white/60">
              Partageable sur le site officiel de l&apos;école et auprès des étudiants.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <code className="rounded bg-black/40 px-2.5 py-1 text-xs font-mono text-[#79F281]">
            /inscription-etudiant
          </code>
          <a
            href="/inscription-etudiant"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white hover:bg-white/10 transition-colors"
          >
            <span>Ouvrir</span>
            <svg className="h-3.5 w-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {/* ── Table du registre ── */}
      <MatriculeRegistryTable initialEntries={entries} />
    </div>
  );
}
