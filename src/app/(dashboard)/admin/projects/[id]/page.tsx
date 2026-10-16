import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { AdminActionPanel } from "@/components/admin/AdminActionPanel";

export const dynamic = "force-dynamic";
import { DownloadPdfButton } from "@/components/pdf/DownloadPdfButton";
import type { ProjectStatus } from "@/types";

// ── Labels et variantes de statuts ───────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  admin_review: "En vérification admin",
  corrections_requested: "Corrections demandées",
  under_review: "En examen jury",
  jury_evaluation: "Évaluation jury",
  director_validation: "Validation direction",
  accepted_for_presentation: "Accepté pour présentation",
  scheduling: "Planification",
  presentation_done: "Présenté",
  final_decision: "Décision finale",
  approved: "Approuvé",
  rejected: "Rejeté",
  under_re_examination: "En réexamen",
  postponed: "Reporté",
  cancelled: "Annulé",
};

const STATUS_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "danger" | "neutral"> = {
  draft: "neutral",
  submitted: "info",
  admin_review: "info",
  corrections_requested: "warning",
  under_review: "info",
  jury_evaluation: "warning",
  director_validation: "warning",
  accepted_for_presentation: "success",
  scheduling: "info",
  presentation_done: "success",
  final_decision: "warning",
  approved: "success",
  rejected: "danger",
  under_re_examination: "warning",
  postponed: "neutral",
  cancelled: "neutral",
};

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Vérification du rôle — accès réservé au personnel
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const staffRoles = ["admin", "director"];
  if (!callerProfile || !staffRoles.includes(callerProfile.role)) {
    redirect("/dashboard");
  }

  // Récupération du projet avec le profil du propriétaire
  const { data: project } = await supabase
    .from("projects")
    .select(`
      id, title, description, objectives, problem, solution, feasibility, impact, budget, status, created_at, updated_at,
      profiles!owner_id (id, full_name, email, department, student_id, is_verified)
    `)
    .eq("id", id)
    .single();

  if (!project) notFound();

  // Historique des statuts avec le nom de l'auteur de chaque changement
  const { data: statusHistory } = await supabase
    .from("status_history")
    .select(`
      id, from_status, to_status, comment, created_at,
      profiles!changed_by (full_name)
    `)
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  // Équipe du projet
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, name, role_in_project")
    .eq("project_id", id);

  // Documents du projet
  const { data: documents } = await supabase
    .from("project_documents")
    .select("id, name, storage_path, size_bytes")
    .eq("project_id", id);

  // Évaluations du projet (réservées au staff, jamais visibles par les étudiants)
  const { data: evaluations } = await supabase
    .from("evaluations")
    .select(`
      id, innovation_score, feasibility_score, impact_score, comments, created_at,
      profiles!evaluator_id (full_name)
    `)
    .eq("project_id", id);

  const avgScore =
    evaluations && evaluations.length > 0
      ? (
          evaluations.reduce(
            (acc, ev) =>
              acc + (ev.innovation_score + ev.feasibility_score + ev.impact_score) / 3,
            0
          ) / evaluations.length
        ).toFixed(2)
      : null;

  // Planification éventuelle
  const { data: presentation } = await supabase
    .from("presentations")
    .select("scheduled_date, scheduled_time, room, notes")
    .eq("project_id", id)
    .single();

  // Normalisation du join Supabase (peut retourner tableau ou objet)
  const owner = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Breadcrumb ── */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-white/30">
        <Link href="/admin" className="transition-colors hover:text-white/60">
          Administration
        </Link>
        <span>/</span>
        <span className="text-white/60 truncate max-w-xs">{project.title}</span>
      </nav>

      {/* ── En-tête ── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#79F281]">
            Dossier projet
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-white">{project.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge variant={STATUS_VARIANT[project.status] ?? "neutral"}>
              {STATUS_LABELS[project.status] ?? project.status}
            </Badge>
            <span className="text-xs text-white/30">
              Soumis le {new Date(project.created_at).toLocaleDateString("fr-FR")}
            </span>
            <span className="text-xs text-white/30">
              Modifié le {new Date(project.updated_at).toLocaleDateString("fr-FR")}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-2 items-center">
          <DownloadPdfButton
            project={project}
            teamMembers={teamMembers || []}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/60 transition-all hover:border-white/30 hover:text-white"
          />
          {["admin", "director"].includes(callerProfile.role) &&
            ["under_review", "jury_evaluation", "director_validation"].includes(project.status) && (
            <Link
              href={`/admin/projects/${project.id}/evaluate`}
              className="rounded-lg bg-[#03A61C] px-4 py-2 text-sm font-bold text-white shadow-[0_0_16px_rgba(3,166,28,0.3)] transition-all hover:bg-[#05F228]"
            >
              ★ Évaluer ce projet
            </Link>
          )}
          {["director", "admin"].includes(callerProfile.role) &&
            project.status === "director_validation" && (
            <Link
              href={`/admin/projects/${project.id}/validate`}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-[0_0_16px_rgba(245,158,11,0.3)] transition-all hover:bg-amber-500"
            >
              ⚖ Rendre la décision
            </Link>
          )}
          {["admin", "director"].includes(callerProfile.role) &&
            ["accepted_for_presentation", "scheduling"].includes(project.status) && (
            <Link
              href={`/admin/projects/${project.id}/schedule`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-[0_0_16px_rgba(37,99,235,0.3)] transition-all hover:bg-blue-500"
            >
              📅 Planifier
            </Link>
          )}
          <Link
            href="/admin"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/60 transition-all hover:border-white/30 hover:text-white"
          >
            ← Retour
          </Link>
        </div>
      </div>

      {/* ── Grille principale ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Colonne gauche (détails + historique) ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
              <h2 className="font-semibold text-white">Description générale</h2>
            </div>
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap leading-relaxed text-white/80">
                {project.description}
              </p>
            </div>
          </div>

          {/* Objectifs */}
          {project.objectives && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
                <h2 className="font-semibold text-white">Objectifs spécifiques</h2>
              </div>
              <div className="px-5 py-4">
                <p className="whitespace-pre-wrap leading-relaxed text-white/80">
                  {project.objectives}
                </p>
              </div>
            </div>
          )}

          {project.problem && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
                <h2 className="font-semibold text-white">Problème à résoudre</h2>
              </div>
              <div className="px-5 py-4">
                <p className="whitespace-pre-wrap leading-relaxed text-white/80">
                  {project.problem}
                </p>
              </div>
            </div>
          )}

          {project.solution && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
                <h2 className="font-semibold text-white">Solution proposée</h2>
              </div>
              <div className="px-5 py-4">
                <p className="whitespace-pre-wrap leading-relaxed text-white/80">
                  {project.solution}
                </p>
              </div>
            </div>
          )}

          {(project.feasibility || project.impact) && (
            <div className="grid gap-6 md:grid-cols-2">
              {project.feasibility && (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
                    <h2 className="font-semibold text-white">Faisabilité technique</h2>
                  </div>
                  <div className="px-5 py-4">
                    <p className="whitespace-pre-wrap leading-relaxed text-white/80">
                      {project.feasibility}
                    </p>
                  </div>
                </div>
              )}
              {project.impact && (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
                    <h2 className="font-semibold text-white">Impact attendu</h2>
                  </div>
                  <div className="px-5 py-4">
                    <p className="whitespace-pre-wrap leading-relaxed text-white/80">
                      {project.impact}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {project.budget !== null && project.budget !== undefined && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
                <h2 className="font-semibold text-white">Budget estimé</h2>
              </div>
              <div className="px-5 py-4">
                <p className="text-xl font-bold text-[#05F228]">
                  {Number(project.budget).toLocaleString("fr-FR")} FCFA
                </p>
              </div>
            </div>
          )}

          {/* Historique des statuts */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
              <h2 className="font-semibold text-white">Historique des statuts</h2>
            </div>
            <div className="divide-y divide-white/5 px-5">
              {statusHistory && statusHistory.length > 0 ? (
                statusHistory.map((entry) => {
                  const changedBy = Array.isArray(entry.profiles)
                    ? entry.profiles[0]
                    : entry.profiles;
                  return (
                    <div key={entry.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {entry.from_status && (
                          <>
                            <Badge variant={STATUS_VARIANT[entry.from_status] ?? "neutral"} className="text-xs">
                              {STATUS_LABELS[entry.from_status] ?? entry.from_status}
                            </Badge>
                            <span className="text-white/30">→</span>
                          </>
                        )}
                        <Badge variant={STATUS_VARIANT[entry.to_status] ?? "neutral"} className="text-xs">
                          {STATUS_LABELS[entry.to_status] ?? entry.to_status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-white/30">
                        <span>{changedBy?.full_name ?? "—"}</span>
                        <span>·</span>
                        <span>
                          {new Date(entry.created_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {entry.comment && (
                        <p className="mt-1 text-xs italic text-white/40">
                          &ldquo;{entry.comment}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="py-6 text-center text-sm text-white/30">
                  Aucune transition de statut enregistrée.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Colonne droite (propriétaire + actions) ── */}
        <div className="space-y-5">
          {/* Info propriétaire */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
              <h2 className="font-semibold text-white">Étudiant porteur</h2>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#03A61C]/20 text-sm font-bold text-[#05F228]">
                  {(owner?.full_name ?? "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {owner?.full_name ?? "—"}
                  </p>
                  <p className="truncate text-xs text-white/40">{owner?.email ?? "—"}</p>
                </div>
              </div>
              <div className="space-y-1.5 border-t border-white/5 pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Département</span>
                  <span className="text-white/70">{owner?.department ?? "Non renseigné"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">N° étudiant</span>
                  <span className="text-white/70">{owner?.student_id ?? "Non renseigné"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Matricule rapproché</span>
                  <span>
                    {owner?.is_verified ? (
                      <span className="font-medium text-[#05F228]">✓ Oui</span>
                    ) : (
                      <span className="font-medium text-amber-400">⚠ Non</span>
                    )}
                  </span>
                </div>
              </div>
              {owner?.id && (
                <Link
                  href={`/admin/users`}
                  className="block rounded-lg bg-white/5 px-3 py-2 text-center text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
                >
                  Voir dans la gestion des utilisateurs →
                </Link>
              )}
            </div>
          </div>

          {/* Documents */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
              <h2 className="font-semibold text-white">Documents joints</h2>
            </div>
            <div className="px-5 py-4 text-sm text-white/80">
              {documents && documents.length > 0 ? (
                <ul className="space-y-3">
                  {await Promise.all(documents.map(async (doc) => {
                    // Generate a 1-hour signed URL for download
                    const { data: signedUrlData } = await supabase.storage
                      .from("project_documents")
                      .createSignedUrl(doc.storage_path, 3600, { download: true });

                    return (
                      <li key={doc.id} className="flex justify-between border-b border-white/5 pb-2">
                        <a 
                          href={signedUrlData?.signedUrl || "#"} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="truncate font-medium text-white hover:text-[#05F228] hover:underline pr-2"
                        >
                          {doc.name}
                        </a>
                        <span className="text-xs text-white/40 flex-shrink-0">
                          {(doc.size_bytes / 1024 / 1024).toFixed(2)} Mo
                        </span>
                      </li>
                    );
                  }))}
                </ul>
              ) : (
                <p className="text-white/40 text-center">Aucun document joint.</p>
              )}
            </div>
          </div>

          {/* Planification (si existe) */}
          {presentation && (
            <div className="overflow-hidden rounded-xl border border-blue-500/30 bg-blue-500/5">
              <div className="border-b border-blue-500/20 bg-gradient-to-r from-blue-900/40 to-transparent px-5 py-3">
                <h2 className="font-semibold text-white">Soutenance planifiée</h2>
              </div>
              <div className="px-5 py-4 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-white/60">Date & Heure</span>
                  <span className="font-bold text-white">
                    {new Date(presentation.scheduled_date).toLocaleDateString("fr-FR")} à {presentation.scheduled_time.substring(0, 5)}
                  </span>
                </div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-white/60">Salle</span>
                  <span className="font-bold text-white">{presentation.room}</span>
                </div>
                {presentation.notes && (
                  <div className="mt-3 rounded bg-white/5 p-3 text-xs text-white/70">
                    <span className="block font-semibold text-white/40 mb-1">Notes:</span>
                    {presentation.notes}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Équipe */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
              <h2 className="font-semibold text-white">Équipe du projet</h2>
            </div>
            <div className="px-5 py-4 text-sm text-white/80">
              {teamMembers && teamMembers.length > 0 ? (
                <ul className="space-y-3">
                  <li className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-white">{(owner?.full_name ?? "?")}</span>
                    <span className="text-xs text-[#05F228]">Porteur</span>
                  </li>
                  {teamMembers.map((member) => (
                    <li key={member.id} className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white">{member.name}</span>
                      <span className="text-xs text-white/40">{member.role_in_project}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/40 text-center">Aucun membre supplémentaire.</p>
              )}
            </div>
          </div>

          {/* Résumé évaluations (réservé au staff) */}
          {evaluations && evaluations.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-[#03A61C]/30 bg-[#03A61C]/5">
              <div className="border-b border-[#03A61C]/20 bg-gradient-to-r from-[#074015]/40 to-transparent px-5 py-3">
                <h2 className="font-semibold text-white">
                  Évaluations jury{" "}
                  <span className="ml-1 rounded-full bg-[#03A61C]/20 px-2 py-0.5 text-xs text-[#05F228]">
                    {evaluations.length}
                  </span>
                </h2>
              </div>
              <div className="px-5 py-4 text-sm">
                {/* Score moyen */}
                {avgScore && (
                  <div className="mb-4 flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                      Moyenne jury
                    </span>
                    <span className="text-2xl font-extrabold text-[#05F228]">
                      {avgScore}<span className="text-sm text-white/40">/10</span>
                    </span>
                  </div>
                )}
                {/* Détail par évaluateur */}
                <div className="space-y-3">
                  {evaluations.map((ev) => {
                    const evOwner = Array.isArray(ev.profiles) ? ev.profiles[0] : ev.profiles;
                    const evAvg = ((ev.innovation_score + ev.feasibility_score + ev.impact_score) / 3).toFixed(1);
                    return (
                      <div key={ev.id} className="rounded-lg bg-white/5 px-3 py-3">
                        <div className="mb-2 flex justify-between text-xs">
                          <span className="font-semibold text-white">{(evOwner as any)?.full_name ?? "—"}</span>
                          <span className="font-bold text-[#05F228]">{evAvg}/10</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center text-xs text-white/50">
                          <div>💡 {ev.innovation_score}/10</div>
                          <div>⚙️ {ev.feasibility_score}/10</div>
                          <div>🌍 {ev.impact_score}/10</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {["admin", "director"].includes(callerProfile.role) && (
                  <Link
                    href={`/admin/projects/${project.id}/evaluate`}
                    className="mt-4 block rounded-lg border border-[#03A61C]/40 px-4 py-2 text-center text-xs font-semibold text-[#05F228] transition-all hover:bg-[#03A61C]/20"
                  >
                    Voir / modifier mon évaluation →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Panel d'actions */}
          <AdminActionPanel
            projectId={project.id}
            currentStatus={project.status as ProjectStatus}
            userRole={callerProfile.role}
          />
        </div>
      </div>
    </div>
  );
}
