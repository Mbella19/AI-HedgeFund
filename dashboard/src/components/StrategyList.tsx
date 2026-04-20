import { Card, Ic, Pill, type PillTone } from "./primitives";
import { MiniSpark } from "./Sparkline";
import type { StrategyView } from "../lib/strategyView";

function statusTone(status: StrategyView["status"]): PillTone {
  if (status === "breach") return "breach";
  if (status === "watch") return "watch";
  if (status === "clear") return "clear";
  return "ink";
}

function sparkColor(status: StrategyView["status"]): string {
  if (status === "breach") return "var(--red)";
  if (status === "watch") return "var(--yellow)";
  if (status === "idle") return "var(--ink-3)";
  return "var(--mint)";
}

export function StrategyRow({
  s,
  onClick,
  first,
}: {
  s: StrategyView;
  onClick?: () => void;
  first?: boolean;
}) {
  const venueColor = s.venue === "TV" ? "var(--lavender)" : "var(--peach)";
  const sc = sparkColor(s.status);
  const pf = s.pf30 != null ? s.pf30.toFixed(2) : "—";
  return (
    <button
      onClick={onClick}
      className="grid items-center text-left w-full rounded-[14px]"
      style={{
        gridTemplateColumns: "auto 1fr auto auto",
        gap: 12,
        padding: "12px 6px",
        background: "transparent",
        borderTop: first ? "none" : "1px solid var(--line)",
        cursor: "pointer",
      }}
    >
      <div
        className="rounded-[12px] grid place-items-center mono font-semibold"
        style={{
          width: 38,
          height: 38,
          background: "var(--surface-2)",
          color: venueColor,
          fontSize: 11,
        }}
      >
        {s.venue}
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold truncate">{s.name}</div>
        <div
          className="mono text-[11px] mt-[2px]"
          style={{ color: "var(--ink-3)", letterSpacing: ".04em" }}
        >
          {s.symbol}
          {s.tf ? ` · ${s.tf}` : ""} · PF {pf}
        </div>
      </div>
      <div style={{ color: sc, opacity: 0.9 }}>
        <MiniSpark data={s.spark} color={sc} />
      </div>
      <Pill tone={statusTone(s.status)}>{s.status}</Pill>
    </button>
  );
}

export function StrategyList({
  views,
  title = "STRATEGIES",
  action,
  onOpen,
}: {
  views: StrategyView[];
  title?: string;
  action?: { label: string; onClick?: () => void };
  onOpen?: (s: StrategyView) => void;
}) {
  const count = views.length;
  return (
    <Card>
      <div className="flex items-center justify-between mb-[14px]">
        <div
          className="text-[11px] font-bold"
          style={{ color: "var(--ink-2)", letterSpacing: ".14em" }}
        >
          {title} · {count} LIVE
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-1 text-[12px]"
            style={{ color: "var(--ink-3)" }}
          >
            {action.label} {Ic.arrow(12)}
          </button>
        )}
      </div>
      <div className="grid gap-[6px]">
        {views.map((s, i) => (
          <StrategyRow
            key={s.id}
            s={s}
            first={i === 0}
            onClick={() => onOpen?.(s)}
          />
        ))}
      </div>
    </Card>
  );
}
