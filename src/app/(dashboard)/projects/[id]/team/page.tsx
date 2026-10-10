import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { TeamMemberForm } from "@/components/forms/TeamMemberForm";
import { RemoveTeamMemberButton } from "@/components/forms/RemoveTeamMemberButton";

export const dynamic = "force-dynamic";

export default async function ProjectTeamPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Vérifier le projet
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, owner_id, status")
    .eq("id", params.id)
    .single();

  if (!project) notFound();

  // Seul le propriétaire peut gérer l'équipe (ou le staff en admin, mais ici on est dans la vue porteur)
  if (project.owner_id !== user.id) {
    redirect(`/projects/${project.id}`);
  }

  const isDraft = project.status === "draft";

  // Récupérer les membres de l'équipe
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, name, role_in_project, user_id, profiles(email)")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl">
      {/* ── Breadcrumb ── */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-white/30">
        <Link href="/dashboard" className="transition-colors hover:text-white/60">
          Tableau de bord
        </Link>
        <span>/</span>
        <Link href={`/projects/${project.id}`} className="transition-colors hover:text-white/60">
          {project.title}
        </Link>
        <span>/</span>
        <span className="text-white/60">Gestion de l'équipe</span>
      </nav>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Équipe du projet</h1>
          <p className="mt-1 text-sm text-white/40">Gérez les membres qui collaborent sur ce projet.</p>
        </div>
        <Link
          href={`/projects/${project.id}`}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/60 transition-all hover:border-white/30 hover:text-white"
        >
          Retour au projet
        </Link>
      </div>

      {!isDraft && (
        <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-300">
          <strong>Attention :</strong> Ce projet n'est plus en brouillon. Vous ne pouvez plus modifier la composition de l'équipe.
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-5">
        {/* Liste des membres */}
        <div className="md:col-span-3">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent px-5 py-3">
              <h2 className="font-semibold text-white">Membres actuels ({teamMembers?.length || 0})</h2>
            </div>
            
            <div className="divide-y divide-white/5">
              {/* Le porteur de projet est toujours là */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#03A61C]/20 text-sm font-bold text-[#05F228]">
                    P
                  </div>
                  <div>
                    <p className="font-medium text-white">Vous (Porteur de projet)</p>
                    <p className="text-xs text-white/40">Leader / Propriétaire</p>
                  </div>
                </div>
                <span className="rounded-full border border-[#05F228]/30 bg-[#05F228]/10 px-2.5 py-0.5 text-xs font-semibold text-[#05F228]">
                  Owner
                </span>
              </div>

              {/* Les autres membres */}
              {teamMembers && teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/60">
                      {member.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.name}</p>
                      <p className="text-xs text-white/40">{member.role_in_project}</p>
                      {member.profiles && !Array.isArray(member.profiles) && (
                        <p className="text-xs text-white/20">{(member.profiles as any).email}</p>
                      )}
                    </div>
                  </div>
                  {isDraft && (
                    <RemoveTeamMemberButton memberId={member.id} projectId={project.id} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Formulaire d'ajout */}
        <div className="md:col-span-2">
          {isDraft ? (
            <TeamMemberForm projectId={project.id} />
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/40">
              L'ajout de membres est bloqué car le projet est en statut : <strong>{project.status}</strong>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
