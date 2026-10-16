import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-6 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">ESCAE-BÉNIN Innovation Hub</p>
        <p className="mt-6 text-6xl font-extrabold">404</p>
        <h1 className="mt-3 text-2xl font-bold">Cette page est introuvable</h1>
        <p className="mt-3 text-sm text-white/60">Le lien est peut-être incorrect ou la page a été déplacée.</p>
        <Link href="/" className="mt-6 inline-flex rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400">
          Retour à l’accueil
        </Link>
      </section>
    </main>
  );
}
