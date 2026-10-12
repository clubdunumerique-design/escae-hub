export default function ProjectDetailsLoading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Retour + Titre + Badges */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-white/10" />
          <div className="h-8 w-64 sm:w-96 rounded-lg bg-white/15" />
          <div className="h-3.5 w-48 rounded bg-white/5" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-7 w-24 rounded-full bg-white/10" />
          <div className="h-9 w-28 rounded-xl bg-white/10" />
        </div>
      </div>

      {/* Grille principale avec 2 colonnes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne gauche (détails du projet) */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="h-5 w-40 rounded bg-white/15" />
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-5/6 rounded bg-white/10" />
            <div className="h-4 w-4/6 rounded bg-white/10" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="h-5 w-32 rounded bg-white/15" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-16 rounded-lg bg-white/5 p-3" />
              <div className="h-16 rounded-lg bg-white/5 p-3" />
            </div>
          </div>
        </div>

        {/* Colonne droite (membres + documents) */}
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="h-5 w-32 rounded bg-white/15" />
            <div className="space-y-3">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/10" />
                  <div className="space-y-1">
                    <div className="h-3 w-28 rounded bg-white/10" />
                    <div className="h-2.5 w-16 rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="h-5 w-32 rounded bg-white/15" />
            <div className="h-20 rounded-xl bg-white/5 border border-dashed border-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
