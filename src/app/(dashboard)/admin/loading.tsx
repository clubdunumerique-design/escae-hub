export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* En-tête */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg bg-white/10" />
        <div className="h-4 w-72 rounded bg-white/5" />
      </div>

      {/* Stats 5 colonnes */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        {[...Array(5)].map((_, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-white/5 bg-white/5 p-4 text-center flex flex-col items-center justify-center gap-2"
          >
            <div className="h-8 w-10 rounded bg-white/15" />
            <div className="h-2.5 w-20 rounded bg-white/5" />
          </div>
        ))}
      </div>

      {/* Tableau des projets */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="h-5 w-40 rounded bg-white/15" />
        </div>
        <div className="divide-y divide-white/5">
          {[...Array(5)].map((_, idx) => (
            <div key={idx} className="flex items-center justify-between px-6 py-4">
              <div className="space-y-2">
                <div className="h-4 w-60 sm:w-96 rounded bg-white/10" />
                <div className="h-3 w-40 rounded bg-white/5" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-24 rounded-full bg-white/10" />
                <div className="h-7 w-20 rounded-lg bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
