import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { APP_CONFIG } from "@/config/app.config";
import { FooterSignature } from "@/components/layout/FooterSignature";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const metadata: Metadata = {
  title: "ESCAE-BÉNIN Innovation Hub — Plateforme de projets étudiants",
  description: APP_CONFIG.description,
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0D0D0D] text-white">

      {/* ── NAVIGATION ── */}
      <header className="sticky top-0 z-50 border-b border-[#03A61C]/30 bg-[#0D0D0D]/90 backdrop-blur-xl">
        {/* Lueur verte subtile derrière le centre */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-20 w-96 rounded-full bg-[#03A61C]/10 blur-3xl" />
        </div>

        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">

          {/* ── ZONE GAUCHE : Logo ESCAE ── */}
          <div className="flex items-center">
            <Link href="/" className="group flex items-center gap-2 sm:gap-3 transition-opacity hover:opacity-85">
              <Image
                src="/logo-escae.png"
                alt="Logo ESCAE-BÉNIN"
                width={140}
                height={56}
                className="h-9 w-auto object-contain drop-shadow-lg sm:h-12 md:h-14"
                priority
              />
            </Link>
          </div>

          {/* ── ZONE CENTRE : Titre plateforme (visible sur desktop/tablette large) ── */}
          <div className="hidden items-center justify-center gap-3 lg:flex">
            <div className="h-8 w-px bg-gradient-to-b from-transparent via-[#03A61C]/50 to-transparent" />
            <div className="text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/40">
                ESCAE-BÉNIN
              </p>
              <p className="text-base font-extrabold uppercase tracking-[0.15em] text-[#05F228] drop-shadow-[0_0_12px_rgba(5,242,40,0.5)]">
                Innovation Hub
              </p>
            </div>
            <div className="h-8 w-px bg-gradient-to-b from-transparent via-[#03A61C]/50 to-transparent" />
          </div>

          {/* ── ZONE DROITE : Logo Hub + Actions ── */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden items-center gap-2 md:flex">
              <Image
                src="/logo-hub.png"
                alt="Hub Innovation"
                width={48}
                height={48}
                className="h-10 w-auto object-contain drop-shadow-[0_0_8px_rgba(5,242,40,0.3)]"
                priority
              />
              <div className="text-left">
                <p className="text-xs font-bold text-white leading-tight">Hub Innovation</p>
                <p className="text-[10px] text-[#79F281] leading-tight">ESCAE-BÉNIN</p>
              </div>
            </div>
            <div className="hidden h-6 w-px bg-white/10 md:block" />
            <ThemeToggle />
            <nav className="flex items-center gap-2" aria-label="Navigation principale">
              <Link
                href="/auth/login"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition-all hover:border-white/30 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
              >
                Connexion
              </Link>
              <Link
                href="/auth/register"
                id="cta-register-nav"
                className="rounded-lg bg-[#03A61C] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_24px_rgba(5,242,40,0.5)] sm:px-4 sm:py-2 sm:text-sm"
              >
                S&apos;inscrire
              </Link>
            </nav>
          </div>

        </div>
        {/* Ligne verte en bas */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#03A61C]/60 to-transparent" />
      </header>

      {/* ── HERO ── */}
      <main className="flex flex-1 flex-col" id="main-content">
        <section
          className="relative overflow-hidden py-12 md:py-20"
          aria-labelledby="hero-heading"
        >
          {/* Fond radial lumineux */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#03A61C]/20 blur-[120px]" />
            <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[#05F228]/10 blur-[100px]" />
          </div>

          {/* Grille décorative */}
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(3,166,28,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(3,166,28,0.3) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          <div className="relative mx-auto max-w-5xl px-6 text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#03A61C]/40 bg-[#03A61C]/10 px-5 py-2 text-sm font-medium text-[#79F281] backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#05F228] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#05F228]" />
              </span>
              Plateforme officielle ESCAE-BÉNIN
            </div>

            <h1
              id="hero-heading"
              className="text-5xl font-extrabold leading-tight tracking-tight md:text-7xl"
            >
              <span className="text-white">Innovez.</span>
              <br />
              <span className="bg-gradient-to-r from-[#05F228] via-[#79F281] to-[#C2F279] bg-clip-text text-transparent">
                Soumettez.
              </span>
              <br />
              <span className="text-white">Brillez.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl">
              La plateforme centrale pour soumettre, suivre et présenter vos projets innovants devant le jury de l&apos;ESCAE-BÉNIN.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/auth/register"
                id="cta-register"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-[#03A61C] px-8 py-4 text-base font-bold text-white shadow-[0_0_40px_rgba(3,166,28,0.5)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_60px_rgba(5,242,40,0.6)]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Déposer mon projet
              </Link>
              <Link
                href="/auth/login"
                id="cta-login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:border-[#03A61C]/50 hover:bg-white/10"
              >
                Accéder à mon espace
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="border-y border-white/10 bg-[#074015]/30 py-10">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-extrabold text-[#05F228] md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-white/50">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PROCESSUS ── */}
        <section className="py-24" aria-labelledby="process-heading">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-16 text-center">
              <h2
                id="process-heading"
                className="text-3xl font-bold text-white md:text-4xl"
              >
                Comment ça fonctionne
              </h2>
              <p className="mt-4 text-white/50">Quatre étapes pour mettre en valeur votre innovation.</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PROCESS_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#152614]/50 p-6 backdrop-blur-sm transition-all hover:border-[#03A61C]/50 hover:bg-[#152614]/80 hover:shadow-[0_0_30px_rgba(3,166,28,0.15)]"
                >
                  {/* Numéro décoratif en arrière-plan */}
                  <div className="pointer-events-none absolute right-4 top-2 text-6xl font-black text-white/5 select-none">
                    {index + 1}
                  </div>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#03A61C]/20 text-[#05F228]">
                    {step.icon}
                  </div>
                  <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[#79F281]">
                    Étape {index + 1}
                  </div>
                  <h3 className="mb-2 font-bold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FONCTIONNALITÉS ── */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-4 text-center">
              <span className="inline-block rounded-full border border-[#03A61C]/30 bg-[#03A61C]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#79F281]">
                Fonctionnalités
              </span>
            </div>
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold text-white md:text-4xl">Ce que vous pouvez faire</h2>
              <p className="mt-3 text-white/40">Une plateforme complète pour gérer votre projet du début à la présentation.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#152614]/60 to-[#074015]/30 p-6 backdrop-blur-sm opacity-0 animate-slide-up transition-all duration-300 hover:-translate-y-1 hover:border-[#03A61C]/40 hover:shadow-[0_8px_40px_rgba(3,166,28,0.15)]"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  {/* Ligne verte décorative en haut au hover */}
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#03A61C] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#03A61C]/15 text-[#05F228] transition-all duration-300 group-hover:bg-[#03A61C]/30 group-hover:shadow-[0_0_20px_rgba(3,166,28,0.3)]">
                    {f.icon}
                  </div>
                  <h3 className="mb-2 font-bold text-white">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section className="relative overflow-hidden py-24">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-r from-[#074015] via-[#152614] to-[#074015]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-transparent to-[#0D0D0D]" />
          </div>
          <div className="relative mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-4xl font-extrabold text-white md:text-5xl">
              Prêt à soumettre votre
              <span className="block bg-gradient-to-r from-[#05F228] to-[#C2F279] bg-clip-text text-transparent">
                projet innovant ?
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
              Rejoignez les étudiants de l&apos;ESCAE-BÉNIN qui façonnent l&apos;avenir du Bénin par l&apos;innovation.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href="/auth/register"
                className="rounded-xl bg-[#03A61C] px-10 py-4 text-base font-bold text-white shadow-[0_0_40px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_60px_rgba(5,242,40,0.5)]"
              >
                Créer mon compte gratuitement
              </Link>
              <Link
                href="/auth/login"
                className="rounded-xl border border-white/20 px-10 py-4 text-base font-semibold text-white/80 transition-all hover:border-white/40 hover:text-white"
              >
                J&apos;ai déjà un compte
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/10 bg-[#0D0D0D] py-10">
        <div className="mx-auto max-w-6xl px-6 space-y-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <Image src="/logo-escae.png" alt="ESCAE" width={80} height={32} className="h-8 w-auto object-contain opacity-70" />
            </div>
            <p className="text-center text-sm text-white/30">
              {APP_CONFIG.name} — Version {APP_CONFIG.version} · Plateforme officielle d&apos;innovation étudiante.
            </p>
            <Image src="/logo-hub.png" alt="Hub" width={32} height={32} className="h-8 w-auto object-contain opacity-70" />
          </div>

          <div className="border-t border-white/5 pt-6">
            <FooterSignature variant="full" />
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── DONNÉES ──────────────────────────────────────────────

const STATS = [
  { value: "500+", label: "Étudiants inscrits" },
  { value: "120+", label: "Projets soumis" },
  { value: "12", label: "Jurys d'évaluation" },
  { value: "3", label: "Promotions" },
];

const PROCESS_STEPS = [
  {
    id: "register",
    title: "Créer un compte",
    description: "Inscrivez-vous avec votre adresse institutionnelle. Votre profil étudiant est créé automatiquement.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    id: "submit",
    title: "Soumettre un projet",
    description: "Rédigez votre dossier, ajoutez vos documents et soumettez-le pour évaluation par le jury.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "evaluate",
    title: "Évaluation du jury",
    description: "Votre dossier est instruit puis évalué. Des retours personnalisés peuvent être demandés.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "present",
    title: "Présenter votre projet",
    description: "Une fois sélectionné, présentez votre innovation devant le jury lors de la journée officielle.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
] as const;

const FEATURES = [
  {
    title: "Dépôt de dossiers",
    description: "Soumettez vos projets avec tous les documents requis : rapport, présentation, budget. Stockage sécurisé.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    title: "Suivi en temps réel",
    description: "Consultez à tout moment le statut de votre dossier : en cours de vérification, validé, ou sélectionné.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: "Projets d'équipe",
    description: "Invitez vos coéquipiers et travaillez ensemble sur un dossier commun.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Notifications e-mail",
    description: "Recevez des alertes par e-mail à chaque changement de statut de votre projet.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    title: "Calendrier de présentation",
    description: "Consultez votre créneau de passage et préparez-vous sereinement le jour J.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Données sécurisées",
    description: "Vos dossiers sont protégés et accessibles uniquement aux personnes autorisées.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];
