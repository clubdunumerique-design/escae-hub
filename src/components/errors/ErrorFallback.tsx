"use client";

export function ErrorFallback({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-6 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">ESCAE-BÉNIN Innovation Hub</p>
        <h1 className="mt-4 text-2xl font-bold">Une erreur est survenue</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          La page n’a pas pu être chargée. Réessayez ou revenez à l’accueil de votre espace.
        </p>
        {error.digest && <p className="mt-3 text-xs text-white/30">Référence : {error.digest}</p>}
        <button
          type="button"
          onClick={retry}
          className="mt-6 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
        >
          Réessayer
        </button>
      </section>
    </main>
  );
}
