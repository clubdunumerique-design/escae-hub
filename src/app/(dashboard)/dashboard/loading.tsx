export default function StudentDashboardLoading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Titre + CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-[#79F281]/20" />
          <div className="h-8 w-56 rounded-lg bg-white/10" />
          <div className="h-3.5 w-44 rounded bg-white/5" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-[#03A61C]/20" />
      </div>

      {/* Stats 5 colonnes */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        {[...Array(5)].map((_, idx) => (
          <div
            key={idx}
            className={`rounded-xl border border-white/5 bg-white/5 p-4 text-center flex flex-col items-center justify-center gap-2 ${
              idx === 4 ? "col-span-2 md:col-span-1" : ""
            }`}
          >
            <div className="h-8 w-12 rounded bg-white/15" />
            <div className="h-2.5 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>

      {/* Liste des projets */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="h-5 w-32 rounded bg-white/15" />
          <div className="h-4 w-8 rounded-full bg-white/10" />
        </div>
        <div className="divide-y divide-white/5">
          {[...Array(4)].map((_, idx) => (
            <div key={idx} className="flex items-center justify-between px-6 py-4">
              <div className="space-y-2">
                <div className="h-4 w-52 sm:w-80 rounded bg-white/10" />
                <div className="h-3 w-28 rounded bg-white/5" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-20 rounded-full bg-white/10" />
                <div className="h-7 w-16 rounded-lg bg-[#03A61C]/20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
