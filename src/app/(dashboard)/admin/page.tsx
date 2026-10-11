import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  admin_review: "En vérification",
  corrections_requested: "Corrections demandées",
  under_review: "En examen",
  jury_evaluation: "Évaluation jury",
  director_validation: "Validation directeur",
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
  director_validation: "warning",
  accepted_for_presentation: "success",
  approved: "success",
  rejected: "danger",
};

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Vérification du rôle admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "director";
  if (!isAdmin) redirect("/dashboard");

  // Récupération de tous les projets avec le nom du propriétaire
  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id, title, status, created_at, updated_at,
      profiles!owner_id ( full_name, email, department )
    `)
    .order("created_at", { ascending: false });

  // Compteurs par statut
  const counts = {
    total: projects?.length ?? 0,
    new_submissions: projects?.filter((p) => p.status === "submitted" || p.status === "admin_review").length ?? 0,
    jury: projects?.filter((p) => p.status === "under_review" || p.status === "jury_evaluation").length ?? 0,
    direction: projects?.filter((p) => p.status === "director_validation").length ?? 0,
    accepted: projects?.filter((p) => p.status === "accepted_for_presentation" || p.status === "scheduling" || p.status === "approved").length ?? 0,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white">Administration</h1>
        <p className="mt-1 text-sm text-white/40">Gérez les projets soumis par les étudiants.</p>
      </div>

      {/* Statistiques */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: "Total Projets", value: counts.total, color: "text-white" },
          { label: "Vérif. Admin", value: counts.new_submissions, color: "text-sky-400" },
          { label: "Examen Jury", value: counts.jury, color: "text-amber-400" },
          { label: "Val. Direction", value: counts.direction, color: "text-purple-400" },
          { label: "Acceptés", value: counts.accepted, color: "text-[#05F228]" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/10 bg-white/5 p-4 text-center transition-all hover:bg-white/10 hover:shadow-lg hover:border-white/20"
          >
            <div className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-white/40">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tableau des projets */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="font-semibold text-white">Tous les projets</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-medium uppercase tracking-wider text-white/30">
                <th className="px-6 py-3">Projet</th>
                <th className="px-6 py-3">Étudiant</th>
                <th className="px-6 py-3">Département</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {projects && projects.length > 0 ? (
                projects.map((project) => {
                  const owner = Array.isArray(project.profiles)
                    ? project.profiles[0]
                    : project.profiles;
                  return (
                    <tr key={project.id} className="transition-colors hover:bg-white/5">
                      <td className="max-w-[200px] truncate px-6 py-4 font-medium text-white">
                        {project.title}
                      </td>
                      <td className="px-6 py-4 text-white/60">
                        {owner?.full_name ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-white/40">
                        {owner?.department ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={STATUS_VARIANT[project.status] ?? "neutral"}>
                          {STATUS_LABELS[project.status] ?? project.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-white/40">
                        {new Date(project.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/projects/${project.id}`}
                          className="rounded-lg bg-[#03A61C]/20 px-3 py-1.5 text-xs font-semibold text-[#05F228] transition-all hover:bg-[#03A61C]/40"
                        >
                          Gérer →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-white/30">
                    Aucun projet soumis pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
