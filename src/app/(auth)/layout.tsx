import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { APP_CONFIG } from "@/config/app.config";

export const metadata: Metadata = {
  title: "Authentification — ESCAE Innovation Hub",
  description: "Connectez-vous ou inscrivez-vous à " + APP_CONFIG.name,
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#0D0D0D] text-white">
      {/* Fond radial lumineux */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#03A61C]/15 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-[#05F228]/8 blur-[100px]" />
        {/* Grille décorative */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(3,166,28,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(3,166,28,0.8) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Header */}
      {/* Header Responsive */}
      <header className="relative z-10 border-b border-white/10 bg-[#0D0D0D]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo gauche ESCAE */}
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Image
              src="/logo-escae.png"
              alt="ESCAE-BÉNIN"
              width={100}
              height={40}
              className="h-8 w-auto object-contain sm:h-10"
              priority
            />
          </Link>

          {/* Titre central - masqué sur les tout petits écrans pour éviter le chevauchement, visible à partir de sm */}
          <div className="hidden text-center sm:flex sm:flex-col sm:items-center">
            <p className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/30">ESCAE-BÉNIN</p>
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#05F228] drop-shadow-[0_0_10px_rgba(5,242,40,0.4)] md:text-sm">
              Innovation Hub
            </p>
          </div>

          {/* Logo droit Hub */}
          <div className="flex items-center gap-2">
            <Image
              src="/logo-hub.png"
              alt="Hub"
              width={36}
              height={36}
              className="h-7 w-auto object-contain opacity-85 sm:h-9"
              priority
            />
            <div className="text-left">
              <p className="text-[10px] font-bold text-white/80 leading-tight sm:text-xs">Hub Innovation</p>
              <p className="text-[8px] text-[#79F281] leading-tight sm:text-[9px]">ESCAE-BÉNIN</p>
            </div>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#03A61C]/40 to-transparent" />
      </header>

      {/* Contenu centré responsive */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6 md:py-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-4 py-4 text-center text-xs text-white/30">
        {APP_CONFIG.name} — v{APP_CONFIG.version}
      </footer>
    </div>
  );
}


