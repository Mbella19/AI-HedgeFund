import { Check, X, Minus } from "lucide-react";
import clsx from "clsx";
import type { Baseline, LiveStrategy } from "../lib/types";
import { fmtPct, fmtUsd } from "../lib/format";

interface Props {
  live: LiveStrategy;
  baseline: Baseline;
}

interface Rule {
  name: string;
  rule: string;
  baselineLabel: string;
  liveLabel: string;
  status: "pass" | "fail" | "skip";
  description: string;
}

export default function BreachMatrix({ live, baseline }: Props) {
  const baselineDd = baseline.max_dd_pct ?? baseline.max_dd_c2c_pct ?? 0;
  const baselineConsec = baseline.max_consec_loss ?? 0;
  const baselineAvgReturn = baseline.avg_daily_return ?? 0;
  const softRetThreshold = baselineAvgReturn * 30 * 0.3;

  const breachRules = new Set(live.breaches.map((b) => b.rule));

  const rules: Rule[] = [
    {
      name: "Max drawdown",
      rule: "hard_max_dd",
      baselineLabel: fmtPct(baselineDd, 2),
      liveLabel: fmtPct(live.metrics.maxDdPct, 2),
      status:
        live.live_trades < 5
          ? "skip"
          : breachRules.has("hard_max_dd")
            ? "fail"
            : "pass",
      description: "Live drawdown must remain within baseline",
    },
    {
      name: "Consecutive losses",
      rule: "hard_max_consec_loss",
      baselineLabel: String(baselineConsec),
      liveLabel: String(live.metrics.maxConsecLoss),
      status:
        live.live_trades < 5
          ? "skip"
          : breachRules.has("hard_max_consec_loss")
            ? "fail"
            : "pass",
      description: "Longest losing streak must not exceed baseline",
    },
    {
      name: "Profit factor (30t)",
      rule: "soft_pf_30t",
      baselineLabel: "≥ 0.80",
      liveLabel:
        live.metrics.pf30t !== null ? live.metrics.pf30t.toFixed(3) : "—",
      status:
        live.live_trades < 30
          ? "skip"
          : breachRules.has("soft_pf_30t")
            ? "fail"
            : "pass",
      description: "Rolling 30-trade profit factor stays above 0.80",
    },
    {
      name: "30-day return",
      rule: "soft_ret_30d_vs_avg",
      baselineLabel: `≥ ${fmtUsd(softRetThreshold)}`,
      liveLabel: fmtUsd(live.metrics.ret30d),
      status:
        live.live_trades < 10
          ? "skip"
          : breachRules.has("soft_ret_30d_vs_avg")
            ? "fail"
            : "pass",
      description: "Cumulative 30-day return ≥ 30% of baseline average",
    },
  ];

  return (
    <div className="divide-y divide-white/10">
      {rules.map((r) => (
        <div
          key={r.rule}
          className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
        >
          <StatusIcon status={r.status} />
          <div className="flex flex-1 min-w-0 items-baseline justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">{r.name}</div>
              <div className="mt-0.5 text-[11px] text-white/45">
                {r.description}
              </div>
            </div>
            <div className="flex items-baseline gap-4 shrink-0">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Baseline
                </div>
                <div className="num text-xs text-white/75">
                  {r.baselineLabel}
                </div>
              </div>
              <div className="min-w-[72px] text-right">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Live
                </div>
                <div
                  className={clsx(
                    "num text-xs font-semibold",
                    r.status === "fail"
                      ? "text-rose-200"
                      : r.status === "pass"
                        ? "text-emerald-200"
                        : "text-white/50"
                  )}
                >
                  {r.liveLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: "pass" | "fail" | "skip" }) {
  if (status === "pass")
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
        <Check className="h-4 w-4 text-emerald-200" strokeWidth={2.5} />
      </div>
    );
  if (status === "fail")
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-400/10">
        <X className="h-4 w-4 text-rose-200" strokeWidth={2.5} />
      </div>
    );
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
      <Minus className="h-4 w-4 text-white/50" />
    </div>
  );
}
