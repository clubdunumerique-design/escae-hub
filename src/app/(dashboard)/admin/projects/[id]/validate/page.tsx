import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { DirectorDecisionPanel } from "@/components/admin/DirectorDecisionPanel";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Validation Direction — ESCAE Hub" };

export default async function ValidateProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Seuls director et admin
  const { data: director } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!director || !["director", "admin"].includes(director.role)) {
    redirect("/dashboard");
  }

  // Récupérer le projet
  const { data: project } = await supabase
    .from("projects")
    .select(`
      id, title, description, objectives, problem, solution,
      feasibility, impact, budget, status, created_at,
      profiles!owner_id (full_name, email, department, student_id)
    `)
    .eq("id", params.id)
    .single();

  if (!project) notFound();

  // Le projet doit être en attente de validation direction
  if (project.status !== "director_validation") {
    redirect(`/admin/projects/${params.id}`);
  }

  // Récupérer toutes les évaluations avec le nom de l'évaluateur
  const { data: evaluations } = await supabase
    .from("evaluations")
    .select(`
      id, innovation_score, feasibility_score, impact_score, comments, created_at,
      profiles!evaluator_id (full_name)
    `)
    .eq("project_id", params.id)
    .order("created_at", { ascending: true });

  // Historique de statuts
  const { data: statusHistory } = await supabase
    .from("status_history")
    .select("from_status, to_status, comment, created_at, profiles!changed_by (full_name)")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Calcul des moyennes
  const avgScores =
    evaluations && evaluations.length > 0
      ? {
          innovation:
            evaluations.reduce((a, e) => a + e.innovation_score, 0) / evaluations.length,
          feasibility:
            evaluations.reduce((a, e) => a + e.feasibility_score, 0) / evaluations.length,
          impact:
            evaluations.reduce((a, e) => a + e.impact_score, 0) / evaluations.length,
          overall:
            evaluations.reduce(
              (a, e) =>
                a + (e.innovation_score + e.feasibility_score + e.impact_score) / 3,
              0
            ) / evaluations.length,
        }
      : null;

  const owner = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;

  const STATUS_LABELS: Record<string, string> = {
    director_validation: "En attente de validation direction",
  };

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
        <span className="text-white/60">Validation Direction</span>
      </nav>

      {/* ── En-tête ── */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            Décision de la direction requise
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-white">{project.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge variant="warning">En attente de validation direction</Badge>
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
          ← Retour au dossier
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* ── Colonne gauche : Synthèse ── */}
        <div className="space-y-6 lg:col-span-3">
          {/* Synthèse des évaluations jury */}
          {avgScores ? (
            <div className="overflow-hidden rounded-xl border border-[#03A61C]/30 bg-[#03A61C]/5">
              <div className="border-b border-[#03A61C]/20 bg-gradient-to-r from-[#074015]/40 to-transparent px-5 py-4">
                <h2 className="font-bold text-white">
                  Synthèse des évaluations jury{" "}
                  <span className="ml-2 rounded-full bg-[#03A61C]/20 px-2.5 py-0.5 text-xs text-[#05F228]">
                    {evaluations?.length} évaluation{evaluations && evaluations.length > 1 ? "s" : ""}
                  </span>
                </h2>
              </div>
              <div className="p-5">
                {/* Score global */}
                <div className="mb-6 flex items-center justify-between rounded-xl bg-white/5 px-6 py-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
                      Score moyen global
                    </p>
                    <p className="mt-1 text-xs text-white/30">Moyenne de toutes les évaluations jury</p>
                  </div>
                  <div className="text-right">
                    <span className="text-6xl font-extrabold text-[#05F228]">
                      {avgScores.overall.toFixed(1)}
                    </span>
                    <span className="text-xl text-white/40">/10</span>
                  </div>
                </div>

                {/* Détail par critère */}
                <div className="mb-6 grid grid-cols-3 gap-3">
                  {[
                    { label: "Innovation", icon: "💡", value: avgScores.innovation },
                    { label: "Faisabilité", icon: "⚙️", value: avgScores.feasibility },
                    { label: "Impact", icon: "🌍", value: avgScores.impact },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg bg-white/5 p-4 text-center">
                      <div className="text-2xl">{c.icon}</div>
                      <div className="mt-2 text-2xl font-bold text-[#05F228]">
                        {c.value.toFixed(1)}
                        <span className="text-sm text-white/30">/10</span>
                      </div>
                      <div className="mt-1 text-xs text-white/40">{c.label}</div>
                    </div>
                  ))}
                </div>

                {/* Évaluations individuelles */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
                    Détail par évaluateur
                  </p>
                  {evaluations?.map((ev) => {
                    const evOwner = Array.isArray(ev.profiles) ? ev.profiles[0] : ev.profiles;
                    const evAvg = ((ev.innovation_score + ev.feasibility_score + ev.impact_score) / 3).toFixed(1);
                    return (
                      <div key={ev.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold text-white">
                            {(evOwner as any)?.full_name ?? "—"}
                          </span>
                          <span className="text-xl font-extrabold text-[#05F228]">
                            {evAvg}/10
                          </span>
                        </div>
                        <div className="mb-2 grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded bg-white/5 py-1">
                            <div className="font-bold text-white">{ev.innovation_score}/10</div>
                            <div className="text-white/30">Innovation</div>
                          </div>
                          <div className="rounded bg-white/5 py-1">
                            <div className="font-bold text-white">{ev.feasibility_score}/10</div>
                            <div className="text-white/30">Faisabilité</div>
                          </div>
                          <div className="rounded bg-white/5 py-1">
                            <div className="font-bold text-white">{ev.impact_score}/10</div>
                            <div className="text-white/30">Impact</div>
                          </div>
                        </div>
                        {ev.comments && (
                          <p className="text-xs italic text-white/40">
                            &ldquo;{ev.comments}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-6 text-center">
              <p className="font-semibold text-amber-300">⚠ Aucune évaluation jury disponible</p>
              <p className="mt-1 text-sm text-white/40">
                Le projet n'a pas encore été évalué par le jury. Vous pouvez tout de même rendre une décision.
              </p>
            </div>
          )}

          {/* Résumé du projet */}
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="font-semibold text-white">Résumé du projet</h3>
            <p className="text-sm leading-relaxed text-white/70">{project.description}</p>
            {project.problem && (
              <div className="border-t border-white/10 pt-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/30">Problème</p>
                <p className="text-sm text-white/60">{project.problem}</p>
              </div>
            )}
            {project.solution && (
              <div className="border-t border-white/10 pt-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/30">Solution</p>
                <p className="text-sm text-white/60">{project.solution}</p>
              </div>
            )}
            {project.budget !== null && project.budget !== undefined && (
              <div className="flex justify-between border-t border-white/10 pt-4 text-sm">
                <span className="text-white/40">Budget estimé</span>
                <span className="font-bold text-[#05F228]">
                  {Number(project.budget).toLocaleString("fr-FR")} FCFA
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Colonne droite : Décision ── */}
        <div className="space-y-5 lg:col-span-2">
          {/* Infos directeur */}
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/40">
              Décision soumise par
            </p>
            <p className="font-semibold text-white">{director.full_name}</p>
            <Badge variant="success" className="mt-2">Direction</Badge>
          </div>

          {/* Panneau de décision */}
          <div className="rounded-xl border border-amber-500/30 bg-white/5 p-6">
            <h2 className="mb-1 text-lg font-bold text-white">Rendre la décision officielle</h2>
            <p className="mb-6 text-xs text-white/40">
              Cette décision sera archivée dans l'historique du projet et déclenchera la prochaine étape du processus.
            </p>
            <DirectorDecisionPanel projectId={project.id} />
          </div>

          {/* Historique récent */}
          {statusHistory && statusHistory.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">
                Historique récent
              </h3>
              <div className="space-y-3">
                {statusHistory.map((entry, i) => {
                  const changedBy = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
                  return (
                    <div key={i} className="text-xs border-b border-white/5 pb-2">
                      <div className="flex items-center gap-1 text-white/60">
                        {entry.from_status && (
                          <span className="rounded bg-white/10 px-1 py-0.5">{entry.from_status}</span>
                        )}
                        {entry.from_status && <span>→</span>}
                        <span className="rounded bg-white/10 px-1 py-0.5">{entry.to_status}</span>
                      </div>
                      <p className="mt-0.5 text-white/30">
                        {(changedBy as any)?.full_name ?? "—"} ·{" "}
                        {new Date(entry.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
