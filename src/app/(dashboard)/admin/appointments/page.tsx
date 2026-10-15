import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { NominateAdminForm } from "@/components/admin/NominateAdminForm";
import { AppointmentCard } from "@/components/admin/AppointmentCard";
import { AppointmentHistory } from "@/components/admin/AppointmentHistory";
import type { AdminAppointmentWithProfiles } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestion des administrateurs — ESCAE Innovation Hub",
};

export default async function AdminAppointmentsPage() {
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

  if (!profile || profile.role !== "director") redirect("/admin");

  // Charger les mandats via le client admin (bypass RLS pour lecture complète)
  const adminClient = createSupabaseAdminClient();

  const { data: appointments } = await adminClient
    .from("admin_appointments")
    .select(
      `
      id, admin_id, appointed_by, status,
      mission_description, start_date, end_date,
      invitation_sent_at, invitation_accepted_at,
      revocation_reason, created_at, updated_at,
      admin:profiles!admin_appointments_admin_id_fkey(id, email, full_name, department),
      director:profiles!admin_appointments_appointed_by_fkey(id, full_name)
    `
    )
    .order("created_at", { ascending: false });

  const active = appointments?.filter((a) => a.status === "active") ?? [];
  const pending = appointments?.filter((a) => a.status === "pending_acceptance") ?? [];
  const history = appointments?.filter((a) =>
    ["ended", "revoked"].includes(a.status)
  ) ?? [];

  const hasActiveAdmin = active.length > 0;
  const hasPendingAdmin = pending.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* En-tête */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15">
            <svg
              className="h-5 w-5 text-sky-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Gestion des administrateurs</h1>
            <p className="text-sm text-white/40">
              Nomination, suivi et historique des mandats — exclusif au directeur.
            </p>
          </div>
        </div>
      </div>

      {/* Alerte si un admin est déjà en fonction */}
      {hasActiveAdmin && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <svg className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-300">Un administrateur est déjà en fonction</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Vous devez clôturer le mandat en cours avant de nommer un nouveau administrateur.
            </p>
          </div>
        </div>
      )}

      {/* Administrateur en fonction */}
      {hasActiveAdmin && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/30">
            Administrateur en fonction
          </h2>
          <div className="space-y-3">
            {active.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt as unknown as AdminAppointmentWithProfiles}
                canClose={true}
                canRevoke={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* Invitations en attente */}
      {hasPendingAdmin && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/30">
            Invitations en attente d&apos;acceptation
          </h2>
          <div className="space-y-3">
            {pending.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt as unknown as AdminAppointmentWithProfiles}
                canClose={false}
                canRevoke={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* Formulaire de nomination */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/30">
          {hasActiveAdmin || hasPendingAdmin
            ? "Préparer le prochain mandat"
            : "Nommer un nouvel administrateur"}
        </h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          {(hasActiveAdmin || hasPendingAdmin) && (
            <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3">
              <p className="text-xs text-sky-400">
                ℹ️ Vous pouvez préparer la nomination du prochain administrateur. Elle restera en attente
                jusqu&apos;à la clôture du mandat actif.
              </p>
            </div>
          )}
          <NominateAdminForm />
        </div>
      </section>

      {/* Historique */}
      {history.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/30">
            Historique des mandats ({history.length})
          </h2>
          <AppointmentHistory appointments={history as unknown as AdminAppointmentWithProfiles[]} />
        </section>
      )}

      {appointments?.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 py-12 text-center text-white/30">
          Aucun mandat enregistré pour le moment.
        </div>
      )}
    </div>
  );
}
