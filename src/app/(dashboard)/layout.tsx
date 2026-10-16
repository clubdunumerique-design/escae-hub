import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export const metadata: Metadata = {
  title: "Tableau de bord — ESCAE Innovation Hub",
};

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Mes projets",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    href: "/projects/new",
    label: "Nouveau projet",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
];

const ADMIN_NAV_ITEMS = [
  {
    href: "/admin",
    label: "Administration",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Utilisateurs",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/appointments",
    label: "Nominations",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    // Ce lien n'est montré qu'au directeur (filtré dans le rendu ci-dessous)
    directorOnly: true,
  },
  {
    href: "/admin/matricules",
    label: "Registre Matricules",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];


export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Requêtes en parallèle pour accélérer considérablement le rendu
  const [profileRes, notifsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("notifications")
      .select("id, title, message, read, type, created_at, link")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const profile = profileRes.data;
  const notifications = notifsRes.data;

  const isAdmin = profile?.role === "admin" || profile?.role === "director";
  const roleLabels: Record<string, string> = {
    student: "Étudiant",
    admin: "Administrateur",
    director: "Directeur",
  };
  const currentRoleLabel = roleLabels[profile?.role ?? "student"] ?? profile?.role ?? "Étudiant";

  return (
    <div className="flex min-h-screen bg-[#0D0D0D] text-white">
      {/* ── SIDEBAR DESKTOP (caché sur mobile, affiché à partir de md) ── */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-white/10 bg-[#0D0D0D] md:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <Link href="/dashboard" prefetch={true} className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Image
              src="/logo-escae.png"
              alt="ESCAE-BÉNIN"
              width={140}
              height={56}
              className="h-12 w-auto object-contain drop-shadow"
              priority
            />
          </Link>
        </div>

        {/* Profil utilisateur */}
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#03A61C]/20 text-sm font-bold text-[#05F228]">
              {(profile?.full_name || user.email || "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {profile?.full_name || "Utilisateur"}
              </p>
              <p className="truncate text-xs text-[#79F281]">
                {currentRoleLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation étudiant */}
        <nav className="flex-1 px-3 py-4" aria-label="Navigation principale">
          <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Espace Étudiant
          </div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 transition-all hover:bg-white/5 hover:text-white"
            >
              <span className="text-[#03A61C]">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {/* Section admin si applicable */}
          {isAdmin && (
            <>
              <div className="mb-2 mt-6 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Administration
              </div>
              {ADMIN_NAV_ITEMS.filter(
                (item) => !("directorOnly" in item && item.directorOnly) || profile?.role === "director"
              ).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 transition-all hover:bg-white/5 hover:text-white"
                >
                  <span className="text-amber-400">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Déconnexion */}
        <div className="border-t border-white/10 px-3 py-4">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/40 transition-all hover:bg-red-500/10 hover:text-red-400"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header responsive avec menu burger et notifications */}
        <DashboardHeader
          userEmail={user.email || ""}
          userName={profile?.full_name || ""}
          userRole={profile?.role || "student"}
          roleLabel={currentRoleLabel}
          isAdmin={isAdmin}
          navItems={NAV_ITEMS}
          adminNavItems={ADMIN_NAV_ITEMS}
          notifications={notifications || []}
        />

        {/* Main scrollable avec padding responsive */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
