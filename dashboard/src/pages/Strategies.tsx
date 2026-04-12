import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  Activity,
  Target,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Radar,
  LineChart as LineChartIcon,
  Info,
  Gauge,
  ChevronRight,
  Clock3,
  Cpu,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

import { usePolling } from "../lib/hooks";
import { api } from "../lib/api";
import {
  fmtPct,
  fmtUsd,
  fmtInt,
  fmtNum,
  prettyStrategyName,
  venueLabel,
} from "../lib/format";

import { Card, CardHeader, CardContent } from "../components/ui/Card";
import StatusPill from "../components/ui/StatusPill";
import BreachMatrix from "../components/BreachMatrix";
import type { Baseline, LiveStrategy } from "../lib/types";

export default function Strategies() {
  const { data: state } = usePolling(api.state, 20000);
  const { data: baselines } = usePolling(api.baselines, 60000);
  const { id: routeId } = useParams();
  const navigate = useNavigate();

  const ids = useMemo(
    () => Object.keys(state?.strategies || {}),
    [state]
  );
  const selectedId = routeId && ids.includes(routeId) ? routeId : ids[0];

  const live = selectedId ? state?.strategies[selectedId] : undefined;
  const base = selectedId ? baselines?.[selectedId] : undefined;

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
      {/* ── Left: selector ── */}
      <Card tone="default" className="h-fit xl:sticky xl:top-6">
        <CardHeader
          eyebrow="Portfolio"
          title="Strategies"
          description="Click any strategy to see its baseline, live metrics, and breach matrix."
          icon={<Target className="h-4 w-4" />}
        />
        <CardContent className="space-y-2">
          {ids.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-xs text-white/45">
              No strategies in state.json yet — run the EOD pipeline first.
            </div>
          )}
          {ids.map((id) => {
            const s = state!.strategies[id];
            const b = baselines?.[id];
            const isActive = id === selectedId;
            const brc = s.breaches.length;
            return (
              <button
                key={id}
                onClick={() => navigate(`/strategies/${id}`)}
                className={clsx(
                  "group w-full rounded-2xl border p-4 text-left transition",
                  isActive
                    ? "border-white/25 bg-white/[0.08] shadow-lg shadow-black/30"
                    : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={clsx(
                      "flex h-8 min-w-[2.5rem] items-center justify-center rounded-lg border px-2 text-[10px] font-bold",
                      s.venue === "tradingview"
                        ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    )}
                  >
                    {s.venue === "tradingview" ? "TV" : "MT5"}
                  </div>
                  {brc > 0 ? (
                    <StatusPill tone="danger" size="xs">
                      {brc} breach
                    </StatusPill>
                  ) : s.live_trades === 0 ? (
                    <StatusPill tone="neutral" size="xs">
                      idle
                    </StatusPill>
                  ) : (
                    <StatusPill tone="good" size="xs" dot>
                      clean
                    </StatusPill>
                  )}
                </div>
                <div className="mt-3 text-sm font-semibold text-white">
                  {prettyStrategyName(id)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-white/45">
                  <span>{s.symbol.replace(/^[A-Z]+:/, "")}</span>
                  <span className="num">
                    {fmtInt(s.live_trades)} trades
                  </span>
                </div>
                {b && (
                  <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-white/35">
                    <span>Baseline PF</span>
                    <span className="num text-white/75">
                      {fmtNum(b.profit_factor, 2)}
                    </span>
                  </div>
                )}
                {isActive && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-white/70">
                    <ChevronRight className="h-3 w-3" />
                    Viewing details
                  </div>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Right: detail ── */}
      <div className="space-y-5">
        {!live || !base ? (
          <Card className="p-12 text-center text-sm text-white/50">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Info className="h-6 w-6 text-white/50" />
            </div>
            <div className="mt-4 text-base font-semibold text-white">
              Select a strategy
            </div>
            <div className="mt-1 text-xs text-white/45">
              Click one on the left to drill into its baseline vs live view.
            </div>
          </Card>
        ) : (
          <DetailView id={selectedId!} live={live} base={base} />
        )}
      </div>
    </div>
  );
}

function DetailView({
  id,
  live,
  base,
}: {
  id: string;
  live: LiveStrategy;
  base: Baseline;
}) {
  const breached = live.breaches.length > 0;
  const idle = live.live_trades === 0 && !breached;
  const baselineDd = base.max_dd_pct ?? base.max_dd_c2c_pct ?? 0;

  // Comparison data for mini bar-compare chart
  const compareData = [
    {
      name: "Max DD",
      baseline: baselineDd,
      live: live.metrics.maxDdPct,
      unit: "%",
    },
    {
      name: "Consec L",
      baseline: base.max_consec_loss,
      live: live.metrics.maxConsecLoss,
      unit: "",
    },
    {
      name: "PF",
      baseline: base.profit_factor,
      live: live.metrics.pf30t || 0,
      unit: "",
    },
  ];

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Hero card */}
      <Card>
        <div className="pointer-events-none absolute -top-28 -right-16 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative p-6 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              tone={breached ? "danger" : idle ? "neutral" : "good"}
              dot={!idle}
            >
              {breached
                ? `${live.breaches.length} breach${live.breaches.length === 1 ? "" : "es"}`
                : idle
                  ? "idle"
                  : "clean"}
            </StatusPill>
            <StatusPill tone="accent">
              {venueLabel(live.venue)} · {live.symbol.replace(/^[A-Z]+:/, "")}
            </StatusPill>
            <StatusPill tone="neutral">
              <Clock3 className="h-3 w-3" />
              {base.backtest_range.start} → {base.backtest_range.end}
            </StatusPill>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Strategy</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {prettyStrategyName(id)}
              </h1>
            </div>
            <div className="flex flex-wrap gap-4">
              <HeroStat
                label="Baseline net"
                value={fmtUsd(base.net_profit, { compact: true })}
                tone="success"
              />
              <HeroStat
                label="Baseline PF"
                value={fmtNum(base.profit_factor, 2)}
                tone="accent"
              />
              <HeroStat
                label="Trades"
                value={fmtInt(base.total_trades)}
                tone="neutral"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Baseline vs live compare grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CompareTile
          label="Max drawdown"
          baseline={fmtPct(baselineDd, 2)}
          live={fmtPct(live.metrics.maxDdPct, 2)}
          tone="warning"
          icon={<Radar className="h-4 w-4" />}
          warn={live.metrics.maxDdPct > baselineDd && live.live_trades >= 5}
        />
        <CompareTile
          label="Consec losses"
          baseline={fmtInt(base.max_consec_loss)}
          live={fmtInt(live.metrics.maxConsecLoss)}
          tone="accent"
          icon={<Activity className="h-4 w-4" />}
          warn={
            live.metrics.maxConsecLoss > base.max_consec_loss &&
            live.live_trades >= 5
          }
        />
        <CompareTile
          label="Profit factor"
          baseline={fmtNum(base.profit_factor, 3)}
          live={
            live.metrics.pf30t !== null
              ? `${live.metrics.pf30t.toFixed(3)} (30t)`
              : "—"
          }
          tone="success"
          icon={<Sparkles className="h-4 w-4" />}
          warn={
            live.metrics.pf30t !== null &&
            live.metrics.pf30t < 0.8 &&
            live.live_trades >= 30
          }
        />
        <CompareTile
          label="Avg daily return"
          baseline={fmtUsd(base.avg_daily_return)}
          live={fmtUsd(live.metrics.ret30d / 30)}
          tone="neutral"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        {/* Breach matrix */}
        <Card>
          <CardHeader
            eyebrow="Breach rules"
            title="Guard matrix"
            description="Live performance checked against every rule. Fail ⇒ remediation fires."
            icon={<ShieldCheck className="h-4 w-4" />}
            actions={
              <StatusPill tone={breached ? "danger" : "good"} dot={!breached}>
                {breached
                  ? `${live.breaches.length} failing`
                  : "all passing"}
              </StatusPill>
            }
          />
          <CardContent className="p-0">
            <BreachMatrix live={live} baseline={base} />
          </CardContent>
        </Card>

        {/* Mini comparison chart */}
        <Card>
          <CardHeader
            eyebrow="Baseline vs live"
            title="Side-by-side"
            icon={<Gauge className="h-4 w-4" />}
          />
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart
                  data={compareData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="cmpBase" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(148,163,184)" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="rgb(148,163,184)" stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id="cmpLive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(125,211,252)" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="rgb(125,211,252)" stopOpacity="0.15" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "rgba(10,12,16,0.94)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 14,
                      fontSize: 11,
                      backdropFilter: "blur(12px)",
                    }}
                  />
                  <Bar
                    dataKey="baseline"
                    fill="url(#cmpBase)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={22}
                  />
                  <Bar
                    dataKey="live"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={22}
                  >
                    {compareData.map((row, i) => (
                      <Cell
                        key={i}
                        fill={
                          // warn colour if live exceeds baseline on DD / consec
                          (row.name === "Max DD" && row.live > row.baseline) ||
                          (row.name === "Consec L" && row.live > row.baseline)
                            ? "rgb(251,113,133)"
                            : "url(#cmpLive)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-white/55">
              <Legend color="rgb(148,163,184)" label="Baseline" />
              <Legend color="rgb(125,211,252)" label="Live" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Baseline stats */}
      <Card>
        <CardHeader
          eyebrow="Reference metrics"
          title="Baseline statistics"
          description="Frozen values from the backtest export. These are the ground truth the live pipeline checks against."
          icon={<LineChartIcon className="h-4 w-4" />}
        />
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatLine label="Win rate" value={fmtPct(base.win_pct, 1)} />
            <StatLine
              label="Profit factor"
              value={fmtNum(base.profit_factor, 3)}
            />
            {base.sharpe !== undefined && (
              <StatLine label="Sharpe" value={fmtNum(base.sharpe, 2)} />
            )}
            {base.sortino !== undefined && (
              <StatLine label="Sortino" value={fmtNum(base.sortino, 2)} />
            )}
            <StatLine
              label="Total trades"
              value={fmtInt(base.total_trades)}
            />
            {base.winning_trades !== undefined && (
              <StatLine label="Wins" value={fmtInt(base.winning_trades)} />
            )}
            {base.losing_trades !== undefined && (
              <StatLine label="Losses" value={fmtInt(base.losing_trades)} />
            )}
            {base.cagr_pct !== undefined && (
              <StatLine label="CAGR" value={fmtPct(base.cagr_pct, 2)} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Params */}
      {Object.keys(base.params || {}).length > 0 && (
        <Card>
          <CardHeader
            eyebrow="Configuration"
            title="Input parameters"
            description="Frozen values emitted by the baseline export."
            icon={<Cpu className="h-4 w-4" />}
          />
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {Object.entries(base.params).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-2.5"
              >
                <span className="text-[11px] text-white/55">{k}</span>
                <span className="num text-xs font-semibold text-white">
                  {String(v)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "accent" | "neutral";
}) {
  const TONE: Record<string, string> = {
    success: "text-emerald-200",
    accent: "text-sky-200",
    neutral: "text-white",
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5">
      <div className="eyebrow">{label}</div>
      <div className={clsx("num mt-1 text-xl font-semibold", TONE[tone])}>
        {value}
      </div>
    </div>
  );
}

function CompareTile({
  label,
  baseline,
  live,
  tone,
  icon,
  warn,
}: {
  label: string;
  baseline: string;
  live: string;
  tone: "success" | "accent" | "warning" | "neutral";
  icon: React.ReactNode;
  warn?: boolean;
}) {
  const GRAD: Record<string, string> = {
    neutral: "from-white/10 via-white/[0.02] to-transparent",
    success: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    accent: "from-sky-500/20 via-sky-500/5 to-transparent",
    warning: "from-amber-400/20 via-amber-400/5 to-transparent",
  };
  const ICON: Record<string, string> = {
    neutral: "bg-white/10 text-white/80 ring-white/15",
    success: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25",
    accent: "bg-sky-400/15 text-sky-200 ring-sky-400/25",
    warning: "bg-amber-300/15 text-amber-100 ring-amber-300/25",
  };
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl">
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
          GRAD[tone]
        )}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="eyebrow">{label}</div>
        <div
          className={clsx(
            "flex h-9 w-9 items-center justify-center rounded-2xl ring-1",
            ICON[tone]
          )}
        >
          {icon}
        </div>
      </div>
      <div className="relative mt-6 flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
            Baseline
          </div>
          <div className="num mt-1 text-lg font-semibold text-white/75">
            {baseline}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
            Live
          </div>
          <div
            className={clsx(
              "num mt-1 text-lg font-semibold",
              warn ? "text-rose-200" : "text-white"
            )}
          >
            {live}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="eyebrow">{label}</div>
      <div className="num mt-2 text-lg font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}
