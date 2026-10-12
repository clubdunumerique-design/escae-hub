"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface MobileNavProps {
  userEmail: string;
  userName: string;
  userRole: string;
  roleLabel: string;
  isAdmin: boolean;
  navItems: NavItem[];
  adminNavItems: NavItem[];
  notifications: any[];
}

export function DashboardHeader({
  userEmail,
  userName,
  userRole: _userRole,
  roleLabel,
  isAdmin,
  navItems,
  adminNavItems,
  notifications,
}: MobileNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {/* ── HEADER NAVIGATION ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0D0D0D]/95 px-4 py-3.5 backdrop-blur-md sm:px-6 md:px-8">
        <div className="flex items-center gap-3">
          {/* Bouton burger mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Ouvrir le menu de navigation"
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Logo visible sur mobile dans le header */}
          <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
            <Image
              src="/logo-escae.png"
              alt="ESCAE-BÉNIN"
              width={110}
              height={44}
              className="h-9 w-auto object-contain"
            />
          </Link>

          {/* Label sur desktop */}
          <div className="hidden items-center gap-2 text-xs font-medium text-white/40 md:flex">
            <Image src="/logo-hub.png" alt="Hub" width={24} height={24} className="h-5 w-auto opacity-70" />
            <span className="tracking-widest uppercase">ESCAE INNOVATION HUB</span>
          </div>
        </div>

        {/* Côté droit : bascule de thème, notifications et profil résumé */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <ThemeToggle />
          <NotificationBell initialNotifications={notifications || []} />
          <div className="hidden items-center gap-2.5 pl-2 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#03A61C]/20 text-xs font-bold text-[#05F228]">
              {(userName || userEmail || "?")[0].toUpperCase()}
            </div>
            <div className="max-w-[140px] truncate text-xs text-white/60">
              {userName || userEmail}
            </div>
          </div>
        </div>
      </header>

      {/* ── TIROIR MOBILE (OVERLAY & DRAWER) ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop sombre flouté */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={closeMenu}
          />

          {/* Contenu du tiroir latéral */}
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-white/10 bg-[#0D0D0D] shadow-2xl">
            {/* Haut du tiroir */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <Link href="/dashboard" onClick={closeMenu}>
                <Image
                  src="/logo-escae.png"
                  alt="ESCAE-BÉNIN"
                  width={120}
                  height={48}
                  className="h-10 w-auto object-contain"
                />
              </Link>
              <button
                type="button"
                onClick={closeMenu}
                className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Profil utilisateur dans le tiroir */}
            <div className="border-b border-white/10 bg-white/[0.02] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#03A61C]/20 text-base font-bold text-[#05F228]">
                  {(userName || userEmail || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{userName || "Utilisateur"}</p>
                  <p className="truncate text-xs text-[#79F281] font-semibold">{roleLabel}</p>
                  <p className="truncate text-[11px] text-white/40">{userEmail}</p>
                </div>
              </div>
            </div>

            {/* Navigation principale mobile */}
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                Espace Étudiant
              </div>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={closeMenu}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#03A61C]/20 text-[#05F228] font-semibold"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className={isActive ? "text-[#05F228]" : "text-[#03A61C]"}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}

              {/* Section Admin si autorise */}
              {isAdmin && (
                <>
                  <div className="mb-2 mt-6 px-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                    Administration
                  </div>
                  {adminNavItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={true}
                        onClick={closeMenu}
                        className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all ${
                          isActive
                            ? "bg-amber-500/20 text-amber-300 font-semibold"
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="text-amber-400">{item.icon}</span>
                        {item.label}
                      </Link>
                    );
                  })}
                </>
              )}
            </nav>

            {/* Bouton déconnexion en bas */}
            <div className="border-t border-white/10 p-4">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Déconnexion
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
