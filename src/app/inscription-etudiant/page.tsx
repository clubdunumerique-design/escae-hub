import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicMatriculeForm } from "@/components/matricule/PublicMatriculeForm";

export const metadata: Metadata = {
  title: "Enregistrement du Matricule Étudiant — ESCAE Innovation Hub",
  description:
    "Formulaire officiel d'enregistrement et de vérification des matricules étudiants pour la plateforme ESCAE-BÉNIN Innovation Hub.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function InscriptionEtudiantPage() {
  return (
    <div className="relative min-h-screen bg-[#0A0A0A] text-white overflow-hidden flex flex-col justify-between">
      {/* Arrière-plan avec halos et dégradés */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[700px] rounded-full bg-[#03A61C]/15 blur-[120px]" />
        <div className="absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-[#05F228]/8 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#03A61C]/10 blur-[130px]" />
      </div>

      {/* ── Barre de navigation simplifiée ── */}
      <header className="border-b border-white/10 bg-[#0D0D0D]/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-85">
            <Image
              src="/logo-escae.png"
              alt="ESCAE-BÉNIN"
              width={120}
              height={48}
              className="h-10 w-auto object-contain"
              priority
            />
            <div className="hidden sm:block h-5 w-px bg-white/20" />
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold tracking-wider text-white/50 uppercase">
              <Image src="/logo-hub.png" alt="Hub" width={20} height={20} className="h-4 w-auto opacity-70" />
              <span>Innovation Hub</span>
            </div>
          </Link>

          <Link
            href="/auth/login"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Espace Connexion &rarr;
          </Link>
        </div>
      </header>

      {/* ── Contenu principal ── */}
      <main className="flex-1 py-10 sm:py-16 px-4">
        <div className="mx-auto max-w-2xl">
          {/* En-tête de la page */}
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#03A61C]/30 bg-[#03A61C]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#05F228] mb-3">
              <span>🏛️ Scolarité & Contrôle Académique</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Identification & Vérification des Étudiants
            </h1>

            <p className="mt-3 text-sm sm:text-base text-white/60 max-w-lg mx-auto leading-relaxed">
              Enregistrez votre matricule officiel ESCAE pour rapprocher votre profil. La soumission de projets reste accessible à tous les étudiants.
            </p>
          </div>

          {/* Formulaire */}
          <PublicMatriculeForm />
        </div>
      </main>

      {/* ── Pied de page institutionnel ── */}
      <footer className="border-t border-white/10 bg-[#080808] py-6 px-4 text-center text-xs text-white/40">
        <p>
          ESCAE-BÉNIN — École Supérieure de Commerce et d&apos;Administration des Entreprises
        </p>
        <p className="mt-1 text-[11px] text-white/30">
          Carrefour Cica-Toyota, Cotonou · Plateforme sécurisée officielle ESCAE Innovation Hub © 2026
        </p>
      </footer>
    </div>
  );
}
