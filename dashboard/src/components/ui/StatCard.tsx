import type { ReactNode } from "react";
import clsx from "clsx";

export type StatTone =
  | "neutral"
  | "success"
  | "accent"
  | "warning"
  | "danger"
  | "violet";

const GRADIENT: Record<StatTone, string> = {
  neutral: "from-white/10 via-white/[0.02] to-transparent",
  success: "from-emerald-500/25 via-emerald-500/5 to-transparent",
  accent: "from-sky-500/25 via-sky-500/5 to-transparent",
  warning: "from-amber-400/25 via-amber-400/5 to-transparent",
  danger: "from-rose-500/30 via-rose-500/5 to-transparent",
  violet: "from-violet-500/25 via-violet-500/5 to-transparent",
};

const ICON_TONE: Record<StatTone, string> = {
  neutral: "bg-white/10 text-white/80 ring-1 ring-white/15",
  success: "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/30",
  accent: "bg-sky-400/15 text-sky-200 ring-1 ring-sky-400/30",
  warning: "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/30",
  danger: "bg-rose-400/15 text-rose-200 ring-1 ring-rose-400/30",
  violet: "bg-violet-400/15 text-violet-200 ring-1 ring-violet-400/30",
};

interface Props {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  delta?: ReactNode;
  tone?: StatTone;
  icon?: ReactNode;
  spark?: ReactNode;
  onClick?: () => void;
}

export default function StatCard({
  label,
  value,
  sublabel,
  delta,
  tone = "neutral",
  icon,
  spark,
  onClick,
}: Props) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={clsx(
        "group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] text-left shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-all duration-300",
        onClick && "hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
      )}
    >
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
          GRADIENT[tone]
        )}
      />
      <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/[0.04] blur-3xl" />

      <div className="relative flex flex-col gap-6 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="eyebrow">{label}</div>
          {icon && (
            <div
              className={clsx(
                "flex h-10 w-10 items-center justify-center rounded-2xl",
                ICON_TONE[tone]
              )}
            >
              {icon}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="num text-[2rem] font-semibold leading-none tracking-tight text-white">
            {value}
          </div>
          {sublabel && (
            <div className="text-[11px] font-medium text-white/50">
              {sublabel}
            </div>
          )}
        </div>
        {(delta || spark) && (
          <div className="flex items-center justify-between gap-3 text-[11px] text-white/55">
            <div className="min-w-0 truncate">{delta}</div>
            {spark && <div className="h-7 w-20 shrink-0">{spark}</div>}
          </div>
        )}
      </div>
    </Wrapper>
  );
}
