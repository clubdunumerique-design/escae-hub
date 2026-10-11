import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { verifyStudentAction } from "@/lib/admin/student-actions";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Gestion des utilisateurs — Admin" };

const ROLE_LABELS: Record<string, string> = {
  student: "Étudiant",
  admin: "Administrateur",
  director: "Directeur",
};

const ROLE_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "danger" | "neutral"> = {
  student: "neutral",
  admin: "warning",
  director: "success",
};

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Vérification du rôle — seuls admin et director ont accès
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const canAccess = ["admin", "director"].includes(callerProfile?.role ?? "");
  if (!canAccess) redirect("/dashboard");

  // Récupération de tous les profils
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const stats = {
    total: profiles?.length ?? 0,
    students: profiles?.filter((p) => p.role === "student").length ?? 0,
    verified: profiles?.filter((p) => p.role === "student" && p.is_verified).length ?? 0,
    unverified: profiles?.filter((p) => p.role === "student" && !p.is_verified).length ?? 0,
    staff: profiles?.filter((p) => p.role !== "student").length ?? 0,
  };

  return (
    <div>
      {/* ── En-tête ── */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#79F281]">Administration</p>
        <h1 className="mt-1 text-3xl font-extrabold text-white">Gestion des utilisateurs</h1>
        <p className="mt-1 text-sm text-white/40">
          Consultez et vérifiez les comptes étudiants et membres du personnel.
        </p>
      </div>

      {/* ── Statistiques ── */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Étudiants", value: stats.students, color: "text-white/70" },
          { label: "Vérifiés", value: stats.verified, color: "text-[#05F228]" },
          { label: "En attente", value: stats.unverified, color: "text-amber-400" },
          { label: "Personnel", value: stats.staff, color: "text-sky-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
          >
            <div className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</div>
            <div className="mt-1 text-xs text-white/40">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Bannière si comptes en attente ── */}
      {stats.unverified > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm">
          <svg className="h-5 w-5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-amber-300">
            <strong>{stats.unverified}</strong> compte{stats.unverified > 1 ? "s" : ""} étudiant
            {stats.unverified > 1 ? "s" : ""} en attente de vérification.
          </span>
        </div>
      )}

      {/* ── Tableau des utilisateurs ── */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="font-semibold text-white">Tous les comptes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-medium uppercase tracking-wider text-white/30">
                <th className="px-6 py-3">Utilisateur</th>
                <th className="px-6 py-3">Département</th>
                <th className="px-6 py-3">Rôle</th>
                <th className="px-6 py-3">Vérification</th>
                <th className="px-6 py-3">Inscrit le</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {profiles && profiles.length > 0 ? (
                profiles.map((profile) => {
                  const isStudent = profile.role === "student";
                  const canVerify = ["admin", "director"].includes(callerProfile?.role ?? "");

                  // Server Action liée pour ce profil spécifique
                  const verifyAction = async () => {
                    "use server";
                    await verifyStudentAction(profile.id, true);
                  };
                  const unverifyAction = async () => {
                    "use server";
                    await verifyStudentAction(profile.id, false);
                  };

                  return (
                    <tr key={profile.id} className="transition-colors hover:bg-white/5">
                      {/* Nom + email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#03A61C]/20 text-sm font-bold text-[#05F228]">
                            {(profile.full_name ?? profile.email ?? "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{profile.full_name}</p>
                            <p className="truncate text-xs text-white/40">{profile.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Département */}
                      <td className="px-6 py-4 text-white/50">
                        {profile.department ?? "—"}
                      </td>

                      {/* Rôle */}
                      <td className="px-6 py-4">
                        <Badge variant={ROLE_VARIANT[profile.role] ?? "neutral"}>
                          {ROLE_LABELS[profile.role] ?? profile.role}
                        </Badge>
                      </td>

                      {/* Statut de vérification */}
                      <td className="px-6 py-4">
                        {!isStudent ? (
                          <span className="text-xs text-white/30">N/A</span>
                        ) : profile.is_verified ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#05F228]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#05F228]" />
                            Vérifié
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            En attente
                          </span>
                        )}
                      </td>

                      {/* Date d'inscription */}
                      <td className="px-6 py-4 text-xs text-white/40">
                        {new Date(profile.created_at).toLocaleDateString("fr-FR")}
                      </td>

                      {/* Bouton d'action */}
                      <td className="px-6 py-4">
                        {isStudent && canVerify ? (
                          profile.is_verified ? (
                            <form action={unverifyAction}>
                              <button
                                type="submit"
                                id={`unverify-${profile.id}`}
                                className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20"
                              >
                                Retirer la vérification
                              </button>
                            </form>
                          ) : (
                            <form action={verifyAction}>
                              <button
                                type="submit"
                                id={`verify-${profile.id}`}
                                className="rounded-lg bg-[#03A61C]/20 px-3 py-1.5 text-xs font-semibold text-[#05F228] transition-all hover:bg-[#03A61C]/40"
                              >
                                Vérifier ✓
                              </button>
                            </form>
                          )
                        ) : (
                          <span className="text-xs text-white/20">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-white/30">
                    Aucun utilisateur enregistré.
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
