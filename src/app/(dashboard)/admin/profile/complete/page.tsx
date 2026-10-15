import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AdminProfileForm } from "@/components/admin/AdminProfileForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mon profil administrateur — ESCAE Innovation Hub",
};

export default async function AdminProfileCompletePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, department, created_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    // Le directeur peut aussi accéder mais est redirigé vers sa page admin
    if (profile?.role === "director") redirect("/admin/appointments");
    redirect("/dashboard");
  }

  // Charger le mandat actif ou en attente de cet admin
  const adminClient = createSupabaseAdminClient();
  const { data: appointment } = await adminClient
    .from("admin_appointments")
    .select(`
      id, status, mission_description, start_date, end_date,
      invitation_sent_at, invitation_accepted_at, created_at,
      director:profiles!admin_appointments_appointed_by_fkey(id, full_name)
    `)
    .eq("admin_id", user.id)
    .in("status", ["active", "pending_acceptance"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const director = appointment
    ? (Array.isArray(appointment.director) ? appointment.director[0] : appointment.director)
    : null;

  const isProfileComplete =
    !!profile.full_name && profile.full_name !== "Nouvel Utilisateur" && !!profile.department;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* En-tête */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-sky-400">
            Administrateur
          </span>
          {!isProfileComplete && (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              Profil incomplet
            </span>
          )}
        </div>
        <h1 className="text-2xl font-extrabold text-white">Mon profil</h1>
        <p className="mt-1 text-sm text-white/40">
          Complétez votre fiche pour activer pleinement votre compte administrateur.
        </p>
      </div>

      {/* Carte mandat */}
      {appointment && (
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-sky-400">
            Votre mandat
          </p>
          <div className="space-y-2 text-sm">
            {director && (
              <div className="flex items-center justify-between">
                <span className="text-white/50">Nommé par</span>
                <span className="font-medium text-white">{director.full_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-white/50">Statut du mandat</span>
              <span className={`font-medium ${appointment.status === "active" ? "text-emerald-400" : "text-amber-400"}`}>
                {appointment.status === "active" ? "En fonction" : "En attente d'activation"}
              </span>
            </div>
            {appointment.start_date && (
              <div className="flex items-center justify-between">
                <span className="text-white/50">Prise de fonction</span>
                <span className="text-white">
                  {new Date(appointment.start_date).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}
            {appointment.invitation_sent_at && (
              <div className="flex items-center justify-between">
                <span className="text-white/50">Invitation envoyée le</span>
                <span className="text-white/70">
                  {new Date(appointment.invitation_sent_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}
          </div>
          {appointment.mission_description && (
            <div className="mt-3 border-t border-sky-500/10 pt-3">
              <p className="text-xs text-white/40 mb-1">Mission</p>
              <p className="text-sm text-white/70 leading-relaxed">{appointment.mission_description}</p>
            </div>
          )}
        </div>
      )}

      {/* Formulaire de profil */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-5 font-semibold text-white">Informations personnelles</h2>
        <AdminProfileForm
          profile={{
            fullName: profile.full_name,
            email: profile.email,
            department: profile.department ?? "",
          }}
          appointment={
            appointment
              ? {
                  id: appointment.id,
                  status: appointment.status as string,
                  missionDescription: appointment.mission_description ?? "",
                  startDate: appointment.start_date ?? "",
                }
              : null
          }
        />
      </div>

      {/* Note de sécurité */}
      <div className="rounded-lg border border-white/5 bg-white/3 px-4 py-3">
        <p className="text-xs text-white/30 leading-relaxed">
          🔒 Vous ne pouvez pas modifier votre rôle, l&apos;auteur de votre nomination ni votre
          historique de mandat. Ces informations sont contrôlées par le directeur.
        </p>
      </div>
    </div>
  );
}
