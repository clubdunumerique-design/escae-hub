import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { claimCollectedMatricule } from "@/lib/matricule/auto-claim";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  admin_review: "En vérification",
  corrections_requested: "Corrections demandées",
  under_review: "En examen",
  jury_evaluation: "Évaluation jury",
  accepted_for_presentation: "Accepté",
  approved: "Approuvé",
  rejected: "Rejeté",
};

const STATUS_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "danger" | "neutral"> = {
  draft: "neutral",
  submitted: "info",
  admin_review: "info",
  corrections_requested: "warning",
  under_review: "info",
  jury_evaluation: "warning",
  accepted_for_presentation: "success",
  approved: "success",
  rejected: "danger",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [profileRes, projectsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role, is_verified, student_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("projects")
      .select("id, title, status, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  let profile = profileRes.data;
  const projects = projectsRes.data;

  // Retry matching for a confirmed student who visits after their registry
  // record has been validated or corrected. This also repairs existing accounts.
  if (
    profile?.role === "student" &&
    !profile.is_verified &&
    user.email_confirmed_at
  ) {
    const candidateMatricule = user.user_metadata?.student_id ?? profile?.student_id;
    const { matched } = await claimCollectedMatricule(user.id, candidateMatricule ?? null);
    if (matched) {
      const { data: refreshedProfile } = await supabase
        .from("profiles")
        .select("full_name, role, is_verified, student_id")
        .eq("id", user.id)
        .single();
      if (refreshedProfile) {
        profile = refreshedProfile;
      }
    }
  }

  // Rediriger les admin/director vers leur espace dédié
  if (profile?.role === "admin" || profile?.role === "director") {
    redirect("/admin");
  }

  const stats = {
    total: projects?.length ?? 0,
    drafts: projects?.filter((p) => p.status === "draft").length ?? 0,
    in_progress: projects?.filter((p) => 
      !["draft", "accepted_for_presentation", "scheduling", "approved", "rejected"].includes(p.status)
    ).length ?? 0,
    accepted: projects?.filter((p) => 
      ["accepted_for_presentation", "scheduling", "approved"].includes(p.status)
    ).length ?? 0,
    rejected: projects?.filter((p) => p.status === "rejected").length ?? 0,
  };

  return (
    <div>
      {/* Le rapprochement du matricule informe le profil, sans bloquer les projets. */}
      {profile && profile.role === "student" && !profile.is_verified && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20">
            <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-200">Matricule non rapproché</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-100/70">
              Renseignez votre matricule officiel depuis le formulaire d&apos;inscription, avec le même nom et la même adresse Gmail. Vous pouvez continuer à soumettre vos projets normalement.
            </p>
          </div>
          <Link
            href="/inscription-etudiant"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300/40 hover:bg-amber-300/15 focus:outline-none focus:ring-2 focus:ring-amber-300/50"
          >
            Renseigner mon matricule
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}


      {/* Titre + CTA */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#79F281]">Espace Étudiant</p>
          <h1 className="mt-1 text-3xl font-extrabold text-white">
            Bonjour, {profile?.full_name?.split(" ")[0] ?? "Étudiant"} 👋
          </h1>
          <p className="mt-1 text-sm text-white/40">{user.email}</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#03A61C] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.3)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_30px_rgba(5,242,40,0.4)]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau projet
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Brouillons", value: stats.drafts, color: "text-white/60" },
          { label: "En Évaluation", value: stats.in_progress, color: "text-sky-400" },
          { label: "Acceptés", value: stats.accepted, color: "text-[#05F228]" },
          { label: "Refusés", value: stats.rejected, color: "text-red-400" },
        ].map((s, idx) => (
          <div
            key={s.label}
            className={`rounded-xl border border-white/10 bg-white/5 p-3.5 sm:p-4 text-center transition-all hover:bg-white/10 hover:shadow-lg hover:border-white/20 ${
              idx === 4 ? "col-span-2 md:col-span-1" : ""
            }`}
          >
            <div className={`text-2xl sm:text-3xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Liste des projets */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-6 sm:py-4">
          <h2 className="font-semibold text-white">Mes projets</h2>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">{stats.total}</span>
        </div>

        {projects && projects.length > 0 ? (
          <div className="divide-y divide-white/5">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 transition-colors hover:bg-white/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white text-sm sm:text-base">{project.title}</p>
                  <p className="mt-0.5 text-xs text-white/30">
                    Modifié le {new Date(project.updated_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <Badge variant={STATUS_VARIANT[project.status] ?? "neutral"}>
                    {STATUS_LABELS[project.status] ?? project.status}
                  </Badge>
                  <Link
                    href={`/projects/${project.id}`}
                    className="rounded-lg bg-[#03A61C]/15 px-3 py-1.5 text-xs font-semibold text-[#05F228] transition-all hover:bg-[#03A61C]/30"
                  >
                    Voir →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white/20">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-semibold text-white/40">Aucun projet pour le moment</p>
            <p className="mt-1 text-sm text-white/20">Soumettez votre premier projet dès maintenant.</p>
            <Link
              href="/projects/new"
              className="mt-6 rounded-xl bg-[#03A61C] px-6 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.3)] transition-all hover:bg-[#05F228]"
            >
              Créer mon premier projet
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
