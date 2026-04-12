export function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-2xl bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03] bg-[length:200%_100%] ${className}`}
    />
  );
}

export function LoadingCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl space-y-3">
      <Shimmer className="h-3 w-24" />
      <Shimmer className="h-8 w-32" />
      <Shimmer className="h-3 w-20" />
    </div>
  );
}
