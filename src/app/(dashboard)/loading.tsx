export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-28 rounded bg-white/10" />
        <div className="h-8 w-64 rounded-lg bg-white/10" />
        <div className="h-3 w-40 rounded bg-white/5" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-white/5 bg-white/5 p-4 flex flex-col justify-center items-center gap-2"
          >
            <div className="h-7 w-12 rounded bg-white/10" />
            <div className="h-2.5 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>

      {/* Content box skeleton */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="h-5 w-36 rounded bg-white/10 mb-6" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0"
            >
              <div className="space-y-2">
                <div className="h-4 w-48 sm:w-72 rounded bg-white/10" />
                <div className="h-3 w-24 rounded bg-white/5" />
              </div>
              <div className="h-7 w-20 rounded-lg bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
