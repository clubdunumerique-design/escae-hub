/**
 * Écran de chargement pour la page de gestion des nominations.
 */
export default function AppointmentsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 animate-pulse">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/10" />
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-white/10" />
          <div className="h-4 w-48 rounded bg-white/5" />
        </div>
      </div>

      {/* Carte admin actif */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-white/10" />
            <div className="h-4 w-56 rounded bg-white/5" />
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="h-5 w-32 rounded bg-white/10" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-10 rounded-lg bg-white/10" />
          <div className="h-10 rounded-lg bg-white/10" />
        </div>
        <div className="h-20 rounded-lg bg-white/10" />
        <div className="h-10 w-40 rounded-xl bg-white/10 ml-auto" />
      </div>
    </div>
  );
}
