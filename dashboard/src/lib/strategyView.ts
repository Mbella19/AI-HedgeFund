import type { Baseline, LiveStrategy, StrategyConfig } from "./types";
import { prettyStrategyName } from "./format";
import { synthSpark } from "./spark";

export type Status = "clear" | "watch" | "breach" | "idle";

export interface StrategyView {
  id: string;
  name: string;
  venue: "TV" | "MT5";
  symbol: string;
  tf: string;
  magic: number | null;
  status: Status;
  pf30: number | null;
  pfBase: number;
  dd: number;
  ddBase: number;
  consec: number;
  consecBase: number;
  ret30: number;
  retBase: number;
  trades: number;
  breaches: string[];
  spark: number[];
}

function deriveStatus(live: LiveStrategy | undefined): Status {
  if (!live) return "idle";
  if (live.breaches.some((b) => b.rule.startsWith("hard_"))) return "breach";
  if (live.breaches.length) return "watch";
  if (live.live_trades === 0) return "idle";
  return "clear";
}

function shortVenue(v: string): "TV" | "MT5" {
  return v === "tradingview" ? "TV" : "MT5";
}

export function buildStrategyView(
  id: string,
  cfg: StrategyConfig | undefined,
  live: LiveStrategy | undefined,
  baseline: Baseline | undefined
): StrategyView {
  const ret30 = live?.metrics.ret30d ?? 0;
  const retBase = baseline ? baseline.avg_daily_return * 30 : 0;
  return {
    id,
    name: cfg?.name ?? prettyStrategyName(id),
    venue: shortVenue(cfg?.venue ?? live?.venue ?? "mt5"),
    symbol: cfg?.symbol ?? live?.symbol ?? "—",
    tf: cfg?.timeframe ?? "",
    magic: cfg?.magic ?? null,
    status: deriveStatus(live),
    pf30: live?.metrics.pf30t ?? null,
    pfBase: baseline?.profit_factor ?? 0,
    dd: live?.metrics.maxDdPct ?? 0,
    ddBase: baseline?.max_dd_pct ?? 0,
    consec: live?.metrics.maxConsecLoss ?? 0,
    consecBase: baseline?.max_consec_loss ?? 0,
    ret30,
    retBase,
    trades: live?.live_trades ?? 0,
    breaches: (live?.breaches ?? []).map((b) => b.rule),
    spark: synthSpark(id, ret30 || 1, 20),
  };
}

export function statusToneForStatus(status: Status): "clear" | "watch" | "breach" | "ink" {
  if (status === "breach") return "breach";
  if (status === "watch") return "watch";
  if (status === "clear") return "clear";
  return "ink";
}
