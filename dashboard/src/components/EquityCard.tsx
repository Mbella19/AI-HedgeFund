import { Card, Ic, Pill } from "./primitives";
import { Sparkline } from "./Sparkline";

export function EquityCard({
  pct,
  totalUsd,
  data,
  ticks = ["MAR 19", "MAR 26", "APR 02", "APR 10", "NOW"],
}: {
  pct: number;
  totalUsd: number;
  data: number[];
  ticks?: string[];
}) {
  const color = pct >= 0 ? "var(--peach)" : "var(--red)";
  const fmtUsd = totalUsd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-[10px]"
          style={{ color: "var(--ink-2)" }}
        >
          <span style={{ color }}>{Ic.spark(14)}</span>
          <span
            className="text-[11px] font-bold"
            style={{ letterSpacing: ".14em" }}
          >
            EQUITY · LIVE
          </span>
        </div>
        <Pill tone="ink">30D</Pill>
      </div>
      <div className="flex items-baseline gap-[10px] mt-2">
        <div
          className="mono text-[38px] font-extrabold tracking-[-0.02em]"
          style={{ color: "var(--ink)" }}
        >
          {pct >= 0 ? "+" : ""}
          {pct.toFixed(1)}%
        </div>
        <div className="text-[13px]" style={{ color: "var(--ink-3)" }}>
          {fmtUsd} · ALL VENUES
        </div>
      </div>
      <div className="mt-1" style={{ color }}>
        <Sparkline
          data={data}
          color={color}
          height={70}
          width={340}
          dot={Math.floor((data.length || 1) * 0.78)}
        />
      </div>
      <div
        className="flex justify-between text-[11px] mt-1"
        style={{ color: "var(--ink-3)", letterSpacing: ".06em" }}
      >
        {ticks.map((t, i) => (
          <span
            key={i}
            style={
              i === ticks.length - 1
                ? { color, fontWeight: 600 }
                : undefined
            }
          >
            {t}
          </span>
        ))}
      </div>
    </Card>
  );
}
