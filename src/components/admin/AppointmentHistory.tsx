/**
 * Tableau de l'historique des anciens mandats administrateurs.
 * Lecture seule — affiché au directeur.
 */

import { Badge } from "@/components/ui/Badge";
import type { AdminAppointmentWithProfiles, AppointmentStatus } from "@/types";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending_acceptance: "En attente",
  active: "En fonction",
  ended: "Clôturé",
  revoked: "Révoqué",
};

const STATUS_VARIANT: Record<
  AppointmentStatus,
  "default" | "info" | "success" | "warning" | "danger" | "neutral"
> = {
  pending_acceptance: "warning",
  active: "success",
  ended: "neutral",
  revoked: "danger",
};

interface AppointmentHistoryProps {
  appointments: AdminAppointmentWithProfiles[];
}

export function AppointmentHistory({ appointments }: AppointmentHistoryProps) {
  if (appointments.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 py-10 text-center text-sm text-white/30">
        Aucun ancien mandat enregistré.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-medium uppercase tracking-wider text-white/30">
              <th className="px-6 py-3">Administrateur</th>
              <th className="px-6 py-3">Prise de fonction</th>
              <th className="px-6 py-3">Fin de mandat</th>
              <th className="px-6 py-3">Statut</th>
              <th className="px-6 py-3">Nommé par</th>
              <th className="px-6 py-3">Mission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {appointments.map((appt) => {
              const admin = Array.isArray(appt.admin) ? appt.admin[0] : appt.admin;
              const director = Array.isArray(appt.director) ? appt.director[0] : appt.director;

              return (
                <tr key={appt.id} className="transition-colors hover:bg-white/5">
                  {/* Administrateur */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
                        {(admin?.full_name ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{admin?.full_name ?? "—"}</p>
                        <p className="truncate text-xs text-white/40">{admin?.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>

                  {/* Prise de fonction */}
                  <td className="px-6 py-4 text-white/60">
                    {appt.start_date
                      ? new Date(appt.start_date).toLocaleDateString("fr-FR")
                      : <span className="text-white/30">—</span>}
                  </td>

                  {/* Fin de mandat */}
                  <td className="px-6 py-4 text-white/60">
                    {appt.end_date
                      ? new Date(appt.end_date).toLocaleDateString("fr-FR")
                      : <span className="text-white/30">—</span>}
                  </td>

                  {/* Statut */}
                  <td className="px-6 py-4">
                    <Badge variant={STATUS_VARIANT[appt.status]}>
                      {STATUS_LABELS[appt.status]}
                    </Badge>
                    {appt.revocation_reason && (
                      <p className="mt-1 text-xs text-white/30 max-w-[200px] truncate" title={appt.revocation_reason}>
                        {appt.revocation_reason}
                      </p>
                    )}
                  </td>

                  {/* Directeur */}
                  <td className="px-6 py-4 text-white/50">
                    {director?.full_name ?? "—"}
                  </td>

                  {/* Mission */}
                  <td className="px-6 py-4 text-white/40 max-w-[200px]">
                    {appt.mission_description ? (
                      <span
                        className="block truncate text-xs"
                        title={appt.mission_description}
                      >
                        {appt.mission_description}
                      </span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
