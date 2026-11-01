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
      id, admin_id, appointed_by, status, university_id, access_scope,
      mission_description, start_date, end_date,
      invitation_sent_at, invitation_accepted_at,
      revocation_reason, created_at, updated_at,
      admin:profiles!admin_appointments_admin_id_fkey(id, email, full_name, department),
      director:profiles!admin_appointments_appointed_by_fkey(id, full_name)
    `
    )
    .order("created_at", { ascending: false });

  const today = new Date().toISOString().slice(0, 10);
  const active = appointments?.filter((a) => a.status === "active" && a.university_id && a.access_scope && (!a.end_date || a.end_date >= today)) ?? [];
  const pending = appointments?.filter((a) => a.status === "pending_acceptance" && a.university_id && a.access_scope) ?? [];
  const expired = appointments?.filter((a) => a.status === "active" && !!a.end_date && a.end_date < today)
    .map((a) => ({ ...a, status: "expired" as const })) ?? [];
  const history = [
    ...(appointments?.filter((a) => ["ended", "revoked"].includes(a.status)) ?? []),
    ...expired,
  ];

  const { data: universityRows } = await adminClient
    .from("universities")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name");
  const universities = universityRows ?? [];

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
              Attribuez les accès par université. La confirmation de l’e-mail active automatiquement le tableau de bord.
            </p>
          </div>
        </div>
      </div>

      {/* Administrateur en fonction */}
      {hasActiveAdmin && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/30">
            Accès administrateur actifs
          </h2>
          <div className="space-y-3">
            {active.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt as unknown as AdminAppointmentWithProfiles}
                universities={universities}
              />
            ))}
          </div>
        </section>
      )}

      {/* Confirmations e-mail en attente */}
      {hasPendingAdmin && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/30">
            En attente de confirmation par e-mail
          </h2>
          <div className="space-y-3">
            {pending.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt as unknown as AdminAppointmentWithProfiles}
                universities={universities}
              />
            ))}
          </div>
        </section>
      )}

      {/* Formulaire de nomination */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/30">
          "Attribuer un accès administrateur"
        </h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          {(hasActiveAdmin || hasPendingAdmin) && (
            <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3">
              <p className="text-xs text-sky-400">
                ℹ️ Plusieurs administrateurs peuvent être actifs simultanément. Un même compte peut avoir plusieurs périmètres universitaires.
              </p>
            </div>
          )}
          <NominateAdminForm universities={universities} />
        </div>
      </section>

      {/* Historique */}
      {history.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/30">
            Historique archivé ({history.length})
          </h2>
          <AppointmentHistory appointments={history as unknown as AdminAppointmentWithProfiles[]} />
        </section>
      )}

      {appointments?.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 py-12 text-center text-white/30">
          Aucun accès administrateur enregistré pour le moment.
        </div>
      )}
    </div>
  );
}
