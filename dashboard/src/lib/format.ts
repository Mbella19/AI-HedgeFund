export function fmtUsd(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (opts.compact) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtNum(
  n: number | null | undefined,
  digits = 2
): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function fmtRel(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function prettyStrategyName(id: string): string {
  const map: Record<string, string> = {
    us30_orb_tv: "US30 ORB Reversal",
    s2_momentum_burst_mt5: "S2 Momentum Burst",
    regime_switch_mt5: "Regime Switch Reclaim",
    rast_v20_mt5: "RAST V20",
    us30_vwap_mt5: "US30 VWAP",
  };
  return map[id] ?? id;
}

export function venueLabel(v: string): string {
  if (v === "tradingview") return "TradingView";
  if (v === "mt5") return "MetaTrader 5";
  return v;
}
