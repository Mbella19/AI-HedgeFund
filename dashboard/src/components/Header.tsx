import { Ic, IconButton } from "./primitives";

export function Header({
  title = "Good evening, Gervacius",
  eyebrow = "EOD MONITOR",
  status,
  alert = false,
  onBell,
  onSettings,
}: {
  title?: string;
  eyebrow?: string;
  status?: { tone: "ok" | "warn" | "bad"; label: string };
  alert?: boolean;
  onBell?: () => void;
  onSettings?: () => void;
}) {
  const now = new Date();
  const day = now
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  const date = now
    .toLocaleDateString("en-US", { day: "numeric", month: "short" })
    .toUpperCase();

  const dotColor =
    status?.tone === "bad"
      ? "var(--red)"
      : status?.tone === "warn"
      ? "var(--yellow)"
      : "var(--mint)";
  const dotGlow =
    status?.tone === "bad"
      ? "rgba(232,146,124,.18)"
      : status?.tone === "warn"
      ? "rgba(240,211,58,.18)"
      : "rgba(184,232,200,.15)";

  return (
    <div className="px-[22px] pt-5 pb-3">
      <div className="flex items-center gap-[14px]">
        <div
          className="w-11 h-11 rounded-full grid place-items-center font-extrabold text-base mono"
          style={{
            background: "linear-gradient(135deg, var(--peach), var(--lavender))",
            color: "var(--peach-ink)",
          }}
        >
          GJ
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[11px] font-semibold"
            style={{ color: "var(--ink-3)", letterSpacing: ".12em" }}
          >
            {eyebrow}
          </div>
          <div className="text-[19px] font-bold tracking-[-0.01em] text-ink truncate">
            {title}
          </div>
        </div>
        <IconButton onClick={onBell} aria-label="Alerts">
          {Ic.bell(18)}
          {alert && (
            <span
              className="absolute w-2 h-2 rounded-full"
              style={{ top: 10, right: 11, background: "var(--red)" }}
            />
          )}
        </IconButton>
        <IconButton onClick={onSettings} tone="yellow" aria-label="Settings">
          {Ic.gear(18)}
        </IconButton>
      </div>
      <div
        className="mt-4 inline-flex items-center gap-2 px-3 py-[6px] rounded-full text-[12px] font-semibold"
        style={{
          background: "var(--surface)",
          letterSpacing: ".08em",
        }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: dotColor, boxShadow: `0 0 0 4px ${dotGlow}` }}
        />
        {day} · {date}
        {status && <> · {status.label}</>}
      </div>
    </div>
  );
}
