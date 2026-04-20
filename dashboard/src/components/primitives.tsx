import { forwardRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

/* ─── Pill ────────────────────────────────────────────────────────────── */
export type PillTone =
  | "ink"
  | "clear"
  | "breach"
  | "watch"
  | "peach"
  | "lavender"
  | "mint";

const PILL_TONES: Record<PillTone, { bg: string; fg: string }> = {
  ink: { bg: "#222226", fg: "var(--ink-2)" },
  clear: { bg: "#1c2a22", fg: "var(--mint)" },
  breach: { bg: "#3a1e18", fg: "var(--red)" },
  watch: { bg: "#33290f", fg: "var(--yellow)" },
  peach: { bg: "rgba(0,0,0,.18)", fg: "var(--peach-ink)" },
  lavender: { bg: "rgba(0,0,0,.12)", fg: "var(--lavender-ink)" },
  mint: { bg: "rgba(0,0,0,.18)", fg: "var(--mint-ink)" },
};

export function Pill({
  children,
  tone = "ink",
  style,
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  style?: CSSProperties;
  className?: string;
}) {
  const c = PILL_TONES[tone];
  return (
    <span
      className={clsx("inline-flex items-center gap-[6px]", className)}
      style={{
        background: c.bg,
        color: c.fg,
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ─── Section title ───────────────────────────────────────────────────── */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-baseline justify-between mt-1 px-[2px]",
        className
      )}
    >
      <div className="eyebrow">{children}</div>
      {action}
    </div>
  );
}

/* ─── Card ────────────────────────────────────────────────────────────── */
export function Card({
  className,
  children,
  bg,
  fg,
  padded = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  bg?: string;
  fg?: string;
  padded?: boolean;
}) {
  return (
    <div
      {...rest}
      className={clsx("rounded-[24px]", padded && "px-5 py-[18px]", className)}
      style={{
        background: bg ?? "var(--surface)",
        color: fg ?? "inherit",
        ...(rest.style ?? {}),
      }}
    >
      {children}
    </div>
  );
}

/* ─── KV row ──────────────────────────────────────────────────────────── */
export function KV({
  k,
  v,
  last,
}: {
  k: ReactNode;
  v: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-3"
      style={{
        borderBottom: last ? "none" : "1px solid var(--line)",
      }}
    >
      <div className="text-[13px]">{k}</div>
      <div className="mono text-[12px] text-ink-3 truncate max-w-[65%] text-right">
        {v}
      </div>
    </div>
  );
}

/* ─── Button ──────────────────────────────────────────────────────────── */
type ButtonKind = "yellow" | "outline" | "surface" | "mint" | "peach";
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    kind?: ButtonKind;
    size?: "sm" | "md" | "lg";
  }
>(({ kind = "outline", size = "md", className, children, ...rest }, ref) => {
  const map: Record<
    ButtonKind,
    { bg: string; fg: string; border?: string }
  > = {
    yellow: { bg: "var(--yellow)", fg: "var(--yellow-ink)" },
    surface: { bg: "var(--surface)", fg: "var(--ink)" },
    mint: { bg: "var(--mint)", fg: "var(--mint-ink)" },
    peach: { bg: "var(--peach)", fg: "var(--peach-ink)" },
    outline: {
      bg: "transparent",
      fg: "var(--ink)",
      border: "1px solid var(--line)",
    },
  };
  const c = map[kind];
  const sizeCls =
    size === "lg"
      ? "h-12 px-4 rounded-[14px] text-[13px]"
      : size === "sm"
      ? "h-9 px-3 rounded-[10px] text-[12px]"
      : "h-10 px-[14px] rounded-[12px] text-[13px]";
  return (
    <button
      ref={ref}
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center gap-[6px] font-bold tracking-[0.06em]",
        "disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.98]",
        sizeCls,
        className
      )}
      style={{
        background: c.bg,
        color: c.fg,
        border: c.border ?? "none",
        ...(rest.style ?? {}),
      }}
    >
      {children}
    </button>
  );
});
Button.displayName = "Button";

/* ─── Icon button (round) ─────────────────────────────────────────────── */
export function IconButton({
  className,
  children,
  tone = "surface",
  size = 40,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "surface" | "yellow";
  size?: number;
}) {
  const bg = tone === "yellow" ? "var(--yellow)" : "var(--surface)";
  const fg = tone === "yellow" ? "var(--yellow-ink)" : "var(--ink)";
  return (
    <button
      {...rest}
      className={clsx(
        "grid place-items-center relative flex-shrink-0",
        className
      )}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: bg,
        color: fg,
      }}
    >
      {children}
    </button>
  );
}

/* ─── Toggle switch ───────────────────────────────────────────────────── */
export function Toggle({
  label,
  defaultOn,
  onChange,
  last,
}: {
  label: ReactNode;
  defaultOn?: boolean;
  onChange?: (on: boolean) => void;
  last?: boolean;
}) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div
      className="flex items-center justify-between py-[14px]"
      style={{ borderBottom: last ? "none" : "1px solid var(--line)" }}
    >
      <div className="text-[14px]">{label}</div>
      <button
        onClick={() => {
          const next = !on;
          setOn(next);
          onChange?.(next);
        }}
        className="relative transition-[background] duration-200"
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          background: on ? "var(--mint)" : "var(--surface-2)",
        }}
        aria-pressed={on}
      >
        <span
          className="absolute transition-[left] duration-200"
          style={{
            top: 3,
            left: on ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: 10,
            background: on ? "var(--mint-ink)" : "var(--ink-3)",
          }}
        />
      </button>
    </div>
  );
}

/* ─── Ic icons ────────────────────────────────────────────────────────── */
export const Ic = {
  bell: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  gear: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  home: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 12 3l9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  chart: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </svg>
  ),
  events: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  ),
  user: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  bolt: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  ),
  shield: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z" />
    </svg>
  ),
  arrow: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  ),
  back: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  ),
  dot: (s = 8) => (
    <svg width={s} height={s} viewBox="0 0 8 8">
      <circle cx="4" cy="4" r="4" fill="currentColor" />
    </svg>
  ),
  check: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 5 5L20 7" />
    </svg>
  ),
  warn: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" />
      <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  ),
  spark: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2v6m0 8v6M4.2 4.2l4.3 4.3m6.9 6.9 4.3 4.3M2 12h6m8 0h6M4.2 19.8 8.5 15.5m6.9-6.9 4.3-4.3" />
    </svg>
  ),
  play: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  pause: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ),
};
