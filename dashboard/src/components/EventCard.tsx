import { Ic, Pill, type PillTone } from "./primitives";

export type EventKind = "tweak" | "rebuild" | "note";
export type EventStatus = "applied" | "pending" | "review" | "closed";

export interface EventItem {
  id: string;
  strat: string;
  date: string;
  kind: EventKind;
  status: EventStatus;
  summary: string;
}

function kindChip(kind: EventKind) {
  if (kind === "rebuild")
    return { bg: "var(--lavender)", fg: "var(--lavender-ink)", label: "REB" };
  if (kind === "tweak")
    return { bg: "var(--peach)", fg: "var(--peach-ink)", label: "TWK" };
  return { bg: "var(--mint)", fg: "var(--mint-ink)", label: "NOT" };
}

function statusTone(s: EventStatus): PillTone {
  if (s === "applied") return "clear";
  if (s === "pending") return "watch";
  if (s === "review") return "lavender";
  return "ink";
}

export function EventCard({
  e,
  onClick,
}: {
  e: EventItem;
  onClick?: () => void;
}) {
  const chip = kindChip(e.kind);
  return (
    <button
      onClick={onClick}
      className="grid items-start gap-[14px] rounded-[20px] text-left w-full"
      style={{
        gridTemplateColumns: "auto 1fr",
        background: "var(--surface)",
        padding: 18,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        className="rounded-[14px] grid place-items-center font-extrabold text-[11px]"
        style={{
          width: 44,
          height: 44,
          background: chip.bg,
          color: chip.fg,
          letterSpacing: ".06em",
          textTransform: "uppercase",
        }}
      >
        {chip.label}
      </div>
      <div>
        <div className="flex justify-between items-baseline gap-[6px]">
          <div className="font-semibold truncate">{e.strat}</div>
          <div
            className="mono text-[11px] flex-shrink-0"
            style={{ color: "var(--ink-3)" }}
          >
            {e.date}
          </div>
        </div>
        <div
          className="text-[13px] mt-1 leading-[1.45]"
          style={{ color: "var(--ink-2)" }}
        >
          {e.summary}
        </div>
        <div className="mt-[10px] flex gap-[6px] flex-wrap">
          <Pill tone={statusTone(e.status)}>{e.status}</Pill>
          <Pill
            tone="ink"
            style={{ fontFamily: "JetBrains Mono", textTransform: "none" }}
          >
            {e.id}
          </Pill>
        </div>
      </div>
    </button>
  );
}

export interface RunStep {
  t: string;
  label: string;
  sub: string;
  state: "done" | "pending" | "idle";
}

export function Step({ r, last }: { r: RunStep; last: boolean }) {
  const done = r.state === "done";
  const pending = r.state === "pending";
  const color = done
    ? "var(--mint)"
    : pending
    ? "var(--yellow)"
    : "var(--surface-2)";
  const ink = done
    ? "var(--mint-ink)"
    : pending
    ? "var(--yellow-ink)"
    : "var(--ink-3)";
  const glow = done
    ? "rgba(184,232,200,.08)"
    : pending
    ? "rgba(240,211,58,.08)"
    : "rgba(0,0,0,0)";
  return (
    <div
      className="grid gap-[14px]"
      style={{
        gridTemplateColumns: "auto 1fr",
        paddingBottom: last ? 0 : 16,
      }}
    >
      <div className="flex flex-col items-center relative">
        <div
          className="rounded-full grid place-items-center"
          style={{
            width: 22,
            height: 22,
            background: color,
            color: ink,
            boxShadow: `0 0 0 4px ${glow}`,
          }}
        >
          {done ? Ic.check(12) : Ic.dot(6)}
        </div>
        {!last && (
          <div
            style={{
              flex: 1,
              width: 2,
              background: "var(--line)",
              marginTop: 4,
            }}
          />
        )}
      </div>
      <div style={{ paddingTop: 1 }}>
        <div className="flex justify-between">
          <div className="text-[14px] font-semibold">{r.label}</div>
          <div
            className="mono text-[12px]"
            style={{ color: "var(--ink-3)" }}
          >
            {r.t}
          </div>
        </div>
        <div
          className="text-[12px] mt-[2px]"
          style={{ color: "var(--ink-3)" }}
        >
          {r.sub}
        </div>
      </div>
    </div>
  );
}
