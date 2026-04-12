import clsx from "clsx";
import type { ReactNode } from "react";

export type StatusTone =
  | "neutral"
  | "good"
  | "warn"
  | "danger"
  | "accent"
  | "violet";

const TONE: Record<StatusTone, string> = {
  neutral: "border-white/10 bg-white/[0.05] text-white/75",
  good: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  danger: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  accent: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  violet: "border-violet-400/25 bg-violet-400/10 text-violet-200",
};

const DOT: Record<StatusTone, string> = {
  neutral: "bg-white/40",
  good: "bg-emerald-300",
  warn: "bg-amber-300",
  danger: "bg-rose-300",
  accent: "bg-sky-300",
  violet: "bg-violet-300",
};

interface Props {
  tone?: StatusTone;
  children: ReactNode;
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
  size?: "xs" | "sm";
}

export default function StatusPill({
  tone = "neutral",
  children,
  icon,
  dot,
  className,
  size = "sm",
}: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border backdrop-blur-sm",
        TONE[tone],
        size === "xs"
          ? "gap-1 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]"
          : "gap-1.5 px-3 py-1 text-[11px] font-semibold tracking-wide",
        className
      )}
    >
      {dot && (
        <span
          className={clsx("h-1.5 w-1.5 rounded-full", DOT[tone], {
            "animate-pulse-soft": tone === "good" || tone === "accent",
          })}
        />
      )}
      {icon}
      <span>{children}</span>
    </span>
  );
}
