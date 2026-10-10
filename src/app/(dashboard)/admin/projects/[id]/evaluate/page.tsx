import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { EvaluationForm } from "@/components/admin/EvaluationForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Évaluation du projet — Jury" };

const STATUS_LABELS: Record<string, string> = {
  under_review: "En examen jury",
  jury_evaluation: "Évaluation en cours",
  director_validation: "Validation direction",
};

const STATUS_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "danger" | "neutral"> = {
  under_review: "info",
  jury_evaluation: "warning",
  director_validation: "success",
};

export default async function EvaluateProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Vérification rôle — seuls reviewer et admin
  const { data: evaluator } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!evaluator || !["reviewer", "admin"].includes(evaluator.role)) {
    redirect("/dashboard");
  }

  // Récupérer le projet
  const { data: project } = await supabase
    .from("projects")
    .select(`
      id, title, description, objectives, problem, solution,
      feasibility, impact, budget, status,
      profiles!owner_id (full_name, email, department)
    `)
    .eq("id", params.id)
    .single();

  if (!project) notFound();

  // Vérifier que le projet est évaluable
  const evaluableStatuses = ["under_review", "jury_evaluation", "director_validation"];
  if (!evaluableStatuses.includes(project.status)) {
    redirect(`/admin/projects/${params.id}`);
  }

  // Récupérer l'évaluation existante de cet évaluateur pour ce projet
  const { data: myEvaluation } = await supabase
    .from("evaluations")
    .select("innovation_score, feasibility_score, impact_score, comments, created_at")
    .eq("project_id", params.id)
    .eq("evaluator_id", user.id)
    .single();

  // Récupérer toutes les évaluations des autres membres du jury (pour la vue agrégée)
  const { data: allEvaluations } = await supabase
    .from("evaluations")
    .select(`
      id, innovation_score, feasibility_score, impact_score, comments, created_at,
      profiles!evaluator_id (full_name)
    `)
    .eq("project_id", params.id)
    .order("created_at", { ascending: true });

  // Calcul de la moyenne globale de toutes les évaluations
  const avgScore =
    allEvaluations && allEvaluations.length > 0
      ? (
          allEvaluations.reduce(
            (acc, ev) =>
              acc + (ev.innovation_score + ev.feasibility_score + ev.impact_score) / 3,
            0
          ) / allEvaluations.length
        ).toFixed(2)
      : null;

  const owner = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Breadcrumb ── */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-white/30">
        <Link href="/admin" className="hover:text-white/60">Administration</Link>
        <span>/</span>
        <Link href={`/admin/projects/${project.id}`} className="hover:text-white/60 max-w-xs truncate">
          {project.title}
        </Link>
        <span>/</span>
        <span className="text-white/60">Évaluation</span>
      </nav>

      {/* ── En-tête ── */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#79F281]">
            Module d'évaluation jury
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-white">{project.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge variant={STATUS_VARIANT[project.status] ?? "neutral"}>
              {STATUS_LABELS[project.status] ?? project.status}
            </Badge>
            <span className="text-xs text-white/40">
              Porteur : <strong className="text-white/60">{owner?.full_name}</strong>
            </span>
            {owner?.department && (
              <span className="text-xs text-white/30">— {owner.department}</span>
            )}
          </div>
        </div>
        <Link
          href={`/admin/projects/${project.id}`}
          className="flex-shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/60 hover:border-white/30 hover:text-white"
        >
          ← Retour au projet
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* ── Colonne gauche : Récapitulatif du projet ── */}
        <div className="space-y-5 lg:col-span-2">
          {/* Résumé jury */}
          {avgScore && (
            <div className="rounded-xl border border-[#03A61C]/40 bg-[#03A61C]/10 px-5 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#79F281]">
                Score moyen jury ({allEvaluations?.length} évaluation{allEvaluations && allEvaluations.length > 1 ? "s" : ""})
              </p>
              <p className="mt-1 text-5xl font-extrabold text-[#05F228]">{avgScore}<span className="text-xl text-white/40">/10</span></p>
            </div>
          )}

          {/* Résumé du projet */}
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">Résumé</h3>
            <p className="text-sm leading-relaxed text-white/70">{project.description}</p>
            {project.problem && (
              <div>
                <p className="mb-1 text-xs font-semibold text-white/40">Problème</p>
                <p className="text-sm text-white/60">{project.problem}</p>
              </div>
            )}
            {project.solution && (
              <div>
                <p className="mb-1 text-xs font-semibold text-white/40">Solution</p>
                <p className="text-sm text-white/60">{project.solution}</p>
              </div>
            )}
            {project.budget !== null && project.budget !== undefined && (
              <div className="flex justify-between border-t border-white/10 pt-3 text-sm">
                <span className="text-white/40">Budget estimé</span>
                <span className="font-bold text-[#05F228]">
                  {Number(project.budget).toLocaleString("fr-FR")} FCFA
                </span>
              </div>
            )}
          </div>

          {/* Évaluations du jury (agrégées) */}
          {allEvaluations && allEvaluations.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">
                Autres évaluateurs
              </h3>
              <div className="space-y-4">
                {allEvaluations.map((ev) => {
                  const evOwner = Array.isArray(ev.profiles) ? ev.profiles[0] : ev.profiles;
                  const evAvg = ((ev.innovation_score + ev.feasibility_score + ev.impact_score) / 3).toFixed(1);
                  const isMe = false; // could compare evaluator_id if we had it
                  return (
                    <div key={ev.id} className="border-b border-white/5 pb-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-white">
                          {(evOwner as any)?.full_name ?? "Évaluateur"}
                        </span>
                        <span className="text-lg font-bold text-[#05F228]">{evAvg}/10</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {[
                          { label: "Innov.", val: ev.innovation_score },
                          { label: "Faisab.", val: ev.feasibility_score },
                          { label: "Impact", val: ev.impact_score },
                        ].map((c) => (
                          <div key={c.label} className="rounded bg-white/5 py-1">
                            <div className="font-bold text-white">{c.val}/10</div>
                            <div className="text-white/30">{c.label}</div>
                          </div>
                        ))}
                      </div>
                      {ev.comments && (
                        <p className="mt-2 text-xs italic text-white/40">
                          &ldquo;{ev.comments.substring(0, 100)}{ev.comments.length > 100 ? "..." : ""}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne droite : Formulaire d'évaluation ── */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-1 text-lg font-bold text-white">
              {myEvaluation ? "Modifier mon évaluation" : "Soumettre mon évaluation"}
            </h2>
            <p className="mb-6 text-xs text-white/40">
              Évaluation par : <strong className="text-white/60">{evaluator.full_name}</strong>
              {myEvaluation && (
                <span className="ml-3 text-amber-400">
                  (Soumise le {new Date(myEvaluation.created_at).toLocaleDateString("fr-FR")})
                </span>
              )}
            </p>
            <EvaluationForm
              projectId={project.id}
              existingEvaluation={myEvaluation ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
