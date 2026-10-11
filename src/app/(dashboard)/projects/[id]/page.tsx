import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { submitProjectAction } from "../actions";
import { DocumentUploadForm } from "@/components/forms/DocumentUploadForm";
import { RemoveDocumentButton } from "@/components/forms/RemoveDocumentButton";
import { DownloadPdfButton } from "@/components/pdf/DownloadPdfButton";

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // RLS assure que seul le propriétaire ou le staff peut voir ce projet
  const { data: project } = await supabase
    .from("projects")
    .select(`
      *,
      profiles!owner_id (id, full_name, email, department, student_id, is_verified)
    `)
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("name, role_in_project")
    .eq("project_id", project.id);

  const { data: documents } = await supabase
    .from("project_documents")
    .select("id, name, storage_path, size_bytes")
    .eq("project_id", project.id);

  const { data: presentation } = await supabase
    .from("presentations")
    .select("scheduled_date, scheduled_time, room, notes")
    .eq("project_id", project.id)
    .single();

  const isOwner = project.owner_id === user.id;
  const isDraft = project.status === "draft";

  // Action liée au bouton "Soumettre le projet"
  const submitProject = async () => {
    "use server";
    await submitProjectAction(project.id);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm font-medium text-white/60 hover:text-white">
          &larr; Retour au tableau de bord
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-white sm:text-3xl break-words">{project.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:gap-3">
            <Badge variant={isDraft ? "info" : "default"}>
              {isDraft ? "Brouillon" : project.status}
            </Badge>
            <span className="text-xs sm:text-sm text-white/60">
              Modifié le {new Date(project.updated_at).toLocaleDateString("fr-FR")}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
          <DownloadPdfButton
            project={project}
            teamMembers={teamMembers || []}
            className="rounded-lg border border-white/15 px-3.5 py-2 text-xs sm:text-sm font-medium text-white/60 transition-all hover:border-white/30 hover:text-white"
          />
          {isOwner && isDraft && (
            <form action={submitProject}>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm px-4 py-2">
                Soumettre définitivement
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent">
              <h2 className="font-semibold text-white">Description générale</h2>
            </CardHeader>
            <CardBody>
              <p className="whitespace-pre-wrap text-white/80 leading-relaxed">
                {project.description}
              </p>
            </CardBody>
          </Card>

          {project.objectives && (
            <Card>
              <CardHeader className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent">
                <h2 className="font-semibold text-white">Objectifs</h2>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-white/80 leading-relaxed">
                  {project.objectives}
                </p>
              </CardBody>
            </Card>
          )}

          {project.problem && (
            <Card>
              <CardHeader className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent">
                <h2 className="font-semibold text-white">Problème à résoudre</h2>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-white/80 leading-relaxed">
                  {project.problem}
                </p>
              </CardBody>
            </Card>
          )}

          {project.solution && (
            <Card>
              <CardHeader className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent">
                <h2 className="font-semibold text-white">Solution proposée</h2>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-white/80 leading-relaxed">
                  {project.solution}
                </p>
              </CardBody>
            </Card>
          )}

          {(project.feasibility || project.impact) && (
            <div className="grid gap-6 md:grid-cols-2">
              {project.feasibility && (
                <Card>
                  <CardHeader className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent">
                    <h2 className="font-semibold text-white">Faisabilité technique</h2>
                  </CardHeader>
                  <CardBody>
                    <p className="whitespace-pre-wrap text-white/80 leading-relaxed">
                      {project.feasibility}
                    </p>
                  </CardBody>
                </Card>
              )}
              {project.impact && (
                <Card>
                  <CardHeader className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent">
                    <h2 className="font-semibold text-white">Impact attendu</h2>
                  </CardHeader>
                  <CardBody>
                    <p className="whitespace-pre-wrap text-white/80 leading-relaxed">
                      {project.impact}
                    </p>
                  </CardBody>
                </Card>
              )}
            </div>
          )}

          {project.budget !== null && project.budget !== undefined && (
            <Card>
              <CardHeader className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent">
                <h2 className="font-semibold text-white">Budget estimé</h2>
              </CardHeader>
              <CardBody>
                <p className="text-xl font-bold text-[#05F228]">
                  {Number(project.budget).toLocaleString("fr-FR")} FCFA
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Planification (Soutenance) */}
          {presentation && (
            <Card>
              <CardHeader className="border-b border-blue-500/20 bg-gradient-to-r from-blue-900/40 to-transparent">
                <h2 className="font-semibold text-white">Soutenance planifiée</h2>
              </CardHeader>
              <CardBody className="text-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Date & Heure</span>
                    <span className="font-bold text-white">
                      {new Date(presentation.scheduled_date).toLocaleDateString("fr-FR")} à {presentation.scheduled_time.substring(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Salle</span>
                    <span className="font-bold text-white">{presentation.room}</span>
                  </div>
                  {presentation.notes && (
                    <div className="mt-2 rounded bg-white/5 p-3 text-white/80">
                      <span className="block mb-1 text-xs font-semibold text-white/50 uppercase tracking-wider">
                        Instructions du jury
                      </span>
                      {presentation.notes}
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent">
              <h2 className="font-semibold text-white">Documents</h2>
            </CardHeader>
            <CardBody className="text-sm text-white/60">
              {documents && documents.length > 0 ? (
                <ul className="mb-4 space-y-2">
                  {await Promise.all(documents.map(async (doc) => {
                    // Generate a 1-hour signed URL for download
                    const { data: signedUrlData } = await supabase.storage
                      .from("project_documents")
                      .createSignedUrl(doc.storage_path, 3600, { download: true });

                    return (
                      <li key={doc.id} className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <a 
                            href={signedUrlData?.signedUrl || "#"} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="truncate font-medium text-white hover:text-[#05F228] hover:underline"
                          >
                            {doc.name}
                          </a>
                          <p className="text-xs text-white/40">{(doc.size_bytes / 1024 / 1024).toFixed(2)} Mo</p>
                        </div>
                        <div className="flex items-center">
                          {isOwner && isDraft && (
                            <RemoveDocumentButton documentId={doc.id} projectId={project.id} />
                          )}
                        </div>
                      </li>
                    );
                  }))}
                </ul>
              ) : (
                <p className="mb-4">Aucun document soumis.</p>
              )}
              {isOwner && isDraft && (
                <DocumentUploadForm projectId={project.id} isDraft={isDraft} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="border-b border-white/10 bg-gradient-to-r from-[#074015]/30 to-transparent">
              <h2 className="font-semibold text-white">Membres de l'équipe</h2>
            </CardHeader>
            <CardBody className="text-sm text-white/60">
              {teamMembers && teamMembers.length > 0 ? (
                <ul className="mb-4 space-y-2">
                  <li className="flex justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-white">Vous</span>
                    <span className="text-xs text-[#05F228]">Porteur</span>
                  </li>
                  {teamMembers.map((member, idx) => (
                    <li key={idx} className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white">{member.name}</span>
                      <span className="text-xs text-white/40">{member.role_in_project}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-4">Vous êtes le seul membre pour l'instant.</p>
              )}
              {isOwner && isDraft && (
                <Link href={`/projects/${project.id}/team`}>
                  <Button variant="outline" size="sm" className="w-full">
                    Gérer l'équipe
                  </Button>
                </Link>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
