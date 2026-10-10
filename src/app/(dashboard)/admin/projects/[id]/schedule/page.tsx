import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SchedulePresentationForm } from "@/components/admin/SchedulePresentationForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Planification Soutenance — ESCAE Hub" };

export default async function ScheduleProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Vérifier le rôle
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !["scheduler", "admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Récupérer le projet
  const { data: project } = await supabase
    .from("projects")
    .select(`
      id, title, status,
      profiles!owner_id (full_name)
    `)
    .eq("id", params.id)
    .single();

  if (!project) notFound();

  // On peut planifier seulement si accepté ou déjà en cours de planification
  const validStatuses = ["accepted_for_presentation", "scheduling"];
  if (!validStatuses.includes(project.status)) {
    redirect(`/admin/projects/${params.id}`);
  }

  // Récupérer l'éventuelle planification existante
  const { data: existingSchedule } = await supabase
    .from("presentations")
    .select("scheduled_date, scheduled_time, room, notes")
    .eq("project_id", params.id)
    .single();

  const owner = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;

  return (
    <div className="mx-auto max-w-4xl">
      <nav className="mb-6 flex items-center gap-2 text-xs text-white/30">
        <Link href="/admin" className="hover:text-white/60">Administration</Link>
        <span>/</span>
        <Link href={`/admin/projects/${project.id}`} className="hover:text-white/60 max-w-xs truncate">
          {project.title}
        </Link>
        <span>/</span>
        <span className="text-white/60">Planification</span>
      </nav>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Planifier la soutenance</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge variant="success">Projet accepté</Badge>
            <span className="text-xs text-white/40">
              Porteur : <strong className="text-white/60">{owner?.full_name}</strong>
            </span>
          </div>
        </div>
        <Link
          href={`/admin/projects/${project.id}`}
          className="flex-shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/60 hover:border-white/30 hover:text-white"
        >
          ← Retour
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <SchedulePresentationForm
          projectId={project.id}
          existingSchedule={existingSchedule ?? null}
        />
      </div>
    </div>
  );
}
