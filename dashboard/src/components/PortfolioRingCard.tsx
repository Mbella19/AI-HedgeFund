import { Pill } from "./primitives";
import type { StrategyView } from "../lib/strategyView";

function Arc({ r, frac, stroke }: { r: number; frac: number; stroke: string }) {
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, frac));
  return (
    <circle
      r={r}
      fill="none"
      stroke={stroke}
      strokeWidth="10"
      strokeDasharray={`${c * clamped} ${c}`}
      strokeDashoffset={c * 0.25}
      strokeLinecap="round"
      transform="rotate(-90)"
    />
  );
}

function Row({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-[10px]">
        <span
          className="rounded-full"
          style={{ width: 9, height: 9, background: dot }}
        />
        <span
          className="text-[12px] font-semibold"
          style={{ letterSpacing: ".06em" }}
        >
          {label}
        </span>
      </div>
      <span className="mono font-semibold text-[14px]">{value}</span>
    </div>
  );
}

export function PortfolioRingCard({
  views,
  mtdPct,
}: {
  views: StrategyView[];
  mtdPct: number;
}) {
  const breach = views.filter((v) => v.status === "breach").length;
  const watch = views.filter((v) => v.status === "watch").length;
  const clear = views.filter((v) => v.status === "clear").length;
  const idle = views.filter((v) => v.status === "idle").length;
  const total = views.length || 1;
  const score = Math.round((clear / total) * 100);

  const headline =
    breach > 0
      ? "BREACH"
      : watch > 0
      ? "WATCH"
      : clear === 0
      ? "IDLE"
      : "ALL CLEAR";

  return (
    <div
      className="rounded-[28px] px-[22px] py-5"
      style={{ background: "var(--peach)", color: "var(--peach-ink)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div
            className="text-[11px] font-bold"
            style={{ letterSpacing: ".14em", opacity: 0.65 }}
          >
            PORTFOLIO HEALTH
          </div>
          <div className="text-[30px] font-extrabold tracking-[-0.02em] mt-1">
            {headline}
          </div>
        </div>
        <Pill
          tone="peach"
          style={{ background: "rgba(0,0,0,.85)", color: "var(--peach)" }}
        >
          {mtdPct >= 0 ? "+" : ""}
          {mtdPct.toFixed(1)}% MTD
          <span style={{ marginLeft: 2 }}>{mtdPct >= 0 ? "↑" : "↓"}</span>
        </Pill>
      </div>

      <div
        className="grid items-center mt-[14px]"
        style={{ gridTemplateColumns: "132px 1fr", gap: 18 }}
      >
        <div className="relative" style={{ width: 132, height: 132 }}>
          <svg viewBox="0 0 132 132" width="132" height="132">
            <g transform="translate(66 66)">
              <circle r="56" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="10" />
              <circle r="44" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="10" />
              <circle r="32" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="10" />
              <Arc r={56} frac={clear / total} stroke="var(--peach-ink)" />
              <Arc r={44} frac={(clear + watch) / total} stroke="var(--lavender-ink)" />
              <Arc r={32} frac={1 - breach / total} stroke="#7a3a2a" />
            </g>
          </svg>
          <div className="absolute inset-0 grid place-items-center text-[26px] font-extrabold tracking-[-0.02em]">
            {score}%
          </div>
        </div>

        <div className="grid gap-[10px] text-[14px]">
          <Row dot="var(--peach-ink)" label="CLEAR" value={`${clear}/${total}`} />
          <Row dot="var(--lavender-ink)" label="WATCH" value={`${watch}/${total}`} />
          <Row dot="#7a3a2a" label="BREACH" value={`${breach}/${total}`} />
          {idle > 0 && (
            <Row
              dot="rgba(0,0,0,.35)"
              label="IDLE"
              value={`${idle}/${total}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
