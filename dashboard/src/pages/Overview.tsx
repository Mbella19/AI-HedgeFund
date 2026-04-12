import { usePolling } from "../lib/hooks";
import { api } from "../lib/api";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import StatusPill from "../components/ui/StatusPill";
import { MiniSparkline } from "../components/ui/MiniSparkline";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  Gauge,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Target,
  Radar,
  Sparkles,
  Activity,
  Database,
  Monitor,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Zap,
  CircleDot,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import {
  fmtUsd,
  fmtInt,
  fmtPct,
  fmtRel,
  prettyStrategyName,
} from "../lib/format";

export default function Overview() {
  const { data: state } = usePolling(api.state, 20000);
  const { data: baselines } = usePolling(api.baselines, 60000);
  const { data: history } = usePolling(api.history, 30000);
  const { data: events } = usePolling(api.events, 30000);
  const { data: health } = usePolling(api.health, 30000);

  const strategies = state?.strategies || {};
  const baselinesMap = baselines || {};
  const ids = Object.keys(strategies);
  const total = ids.length;
  const breached = ids.filter(
    (id) => strategies[id].breaches.length > 0
  ).length;
  const healthy = total - breached;
  const totalLiveTrades = ids.reduce(
    (a, id) => a + strategies[id].live_trades,
    0
  );
  const healthPct = total === 0 ? 100 : Math.round((healthy / total) * 100);

  // Baseline aggregates
  const baselineVals = Object.values(baselinesMap);
  const totalBaselineNet = baselineVals.reduce(
    (a, b) => a + (b.net_profit || 0),
    0
  );
  const avgPf =
    baselineVals.reduce((a, b) => a + (b.profit_factor || 0), 0) /
    (baselineVals.length || 1);
  const avgDd =
    baselineVals.reduce(
      (a, b) => a + (b.max_dd_pct ?? b.max_dd_c2c_pct ?? 0),
      0
    ) / (baselineVals.length || 1);

  // Venue split
  const tvCount = ids.filter((id) => strategies[id].venue === "tradingview")
    .length;
  const mtCount = ids.filter((id) => strategies[id].venue === "mt5").length;

  // Charts
  const netChart = ids.map((id) => ({
    name: shortName(id),
    fullName: prettyStrategyName(id),
    net: baselinesMap[id]?.net_profit || 0,
    venue: strategies[id].venue,
    id,
  }));

  const scatter = ids.map((id) => {
    const b = baselinesMap[id];
    return {
      name: prettyStrategyName(id),
      dd: b?.max_dd_pct ?? b?.max_dd_c2c_pct ?? 0,
      pf: b?.profit_factor || 0,
      trades: b?.total_trades || 0,
      breaches: strategies[id].breaches.length,
      id,
    };
  });

  const historyChart = (history?.entries || [])
    .slice()
    .reverse()
    .slice(-14)
    .map((e) => ({
      date: e.date.slice(5),
      healthy: e.total - e.breached,
      breached: e.breached,
      trades: e.total_trades,
    }));

  const recentPnl =
    (history?.entries || [])
      .slice(0, 14)
      .map((e) => e.total_pnl)
      .reverse() || [];
  const recentBreaches =
    (history?.entries || [])
      .slice(0, 14)
      .map((e) => e.breached)
      .reverse() || [];

  const recentEvents = (events?.events || []).slice(0, 4);

  return (
    <div className="space-y-5">
      {/* ─── HERO ─── */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="p-0">
          <div className="pointer-events-none absolute -top-32 right-10 h-72 w-72 rounded-full bg-emerald-400/[0.08] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-10 h-72 w-72 rounded-full bg-sky-400/[0.08] blur-3xl" />

          <div className="relative grid gap-8 p-6 md:p-8 xl:grid-cols-[1.45fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={breached === 0 ? "good" : "danger"} dot>
                  {breached === 0
                    ? "Portfolio clean"
                    : `${breached} breach${breached === 1 ? "" : "es"} live`}
                </StatusPill>
                <StatusPill
                  tone={health?.loop?.running ? "good" : "neutral"}
                  dot={!!health?.loop?.running}
                >
                  <CircleDot className="h-3 w-3" />
                  {health?.loop?.running ? "Loop running" : "Loop idle"}
                </StatusPill>
              </div>

              <div className="mt-7 flex items-start gap-4">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] border border-white/15 bg-gradient-to-br from-white/20 via-white/[0.06] to-transparent shadow-inner shadow-black/40">
                  <Gauge className="h-8 w-8 text-white" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <div className="eyebrow">Autonomous end-of-day monitor</div>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Quant Monitor{" "}
                    <span className="bg-gradient-to-r from-white via-white/80 to-white/60 bg-clip-text text-transparent">
                      Control Center
                    </span>
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
                    Five intraday strategies across TradingView Desktop and
                    MetaTrader 5. At each close the loop ingests fresh trades,
                    re-checks four breach rules against frozen baselines, and
                    hands breached strategies to the remediation agent.
                  </p>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3 text-[11px] text-white/50">
                <Pinned icon={<Monitor className="h-3 w-3" />}>
                  TradingView CDP {health?.tv_cdp ? "online" : "offline"}
                </Pinned>
                <Pinned icon={<Database className="h-3 w-3" />}>
                  MT5 MCP {health?.mt5_mcp ? "online" : "offline"}
                </Pinned>
                <Pinned icon={<Activity className="h-3 w-3" />}>
                  Last run {fmtRel(state?.timestamp)}
                </Pinned>
              </div>
            </div>

            {/* KPI Quad */}
            <div className="grid grid-cols-2 gap-3">
              <KpiMini
                label="Health"
                value={`${healthPct}%`}
                tone="success"
                icon={<ShieldCheck className="h-4 w-4" />}
                sub={`${healthy} of ${total} passing`}
              />
              <KpiMini
                label="Strategies"
                value={total.toString()}
                tone="accent"
                icon={<Target className="h-4 w-4" />}
                sub={`${tvCount} TV · ${mtCount} MT5`}
              />
              <KpiMini
                label="Live trades"
                value={fmtInt(totalLiveTrades)}
                tone="neutral"
                icon={<BarChart3 className="h-4 w-4" />}
                sub="post baseline"
              />
              <KpiMini
                label="Breaches"
                value={breached.toString()}
                tone={breached > 0 ? "danger" : "neutral"}
                icon={<AlertTriangle className="h-4 w-4" />}
                sub={breached > 0 ? "action required" : "none live"}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ─── KPI ROW ─── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Portfolio net"
          value={fmtUsd(totalBaselineNet, { compact: true })}
          sublabel="baseline aggregate"
          tone="success"
          icon={<TrendingUp className="h-4 w-4" />}
          delta={<span className="text-emerald-200/80">Frozen reference</span>}
          spark={
            recentPnl.length >= 2 ? (
              <MiniSparkline points={recentPnl} color="rgb(52,211,153)" />
            ) : undefined
          }
        />
        <StatCard
          label="Avg profit factor"
          value={avgPf.toFixed(2)}
          sublabel={`across ${baselineVals.length} baseline${baselineVals.length === 1 ? "" : "s"}`}
          tone="accent"
          icon={<Sparkles className="h-4 w-4" />}
          delta={
            <span className="text-sky-200/80">
              soft breach rule · PF 30t &lt; 0.80
            </span>
          }
        />
        <StatCard
          label="Avg max drawdown"
          value={fmtPct(avgDd, 1)}
          sublabel="hard ceiling monitored"
          tone="warning"
          icon={<Radar className="h-4 w-4" />}
          delta={
            <span className="text-amber-200/80">breach rule #1 · hard</span>
          }
        />
        <StatCard
          label={breached > 0 ? "Breaches live" : "All systems clean"}
          value={`${healthy} / ${total}`}
          sublabel={
            breached > 0
              ? `${breached} strateg${breached === 1 ? "y" : "ies"} flagged`
              : "no action required"
          }
          tone={breached > 0 ? "danger" : "success"}
          icon={<ShieldCheck className="h-4 w-4" />}
          delta={
            <span className="text-white/60">
              {fmtInt(totalLiveTrades)} live trades
            </span>
          }
          spark={
            recentBreaches.length >= 2 ? (
              <MiniSparkline
                points={recentBreaches}
                color={breached > 0 ? "rgb(251,113,133)" : "rgb(52,211,153)"}
              />
            ) : undefined
          }
        />
      </motion.div>

      {/* ─── BASELINE BAR CHART + VENUE HEALTH ─── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="grid gap-4 xl:grid-cols-[1.5fr_1fr]"
      >
        <Card>
          <CardHeader
            eyebrow="Baseline earning power"
            title="Net profit by strategy"
            description="Frozen USD contribution per strategy over the complete backtest window."
            icon={<BarChart3 className="h-4 w-4" />}
            actions={<StatusPill tone="accent">USD</StatusPill>}
          />
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart
                  data={netChart}
                  margin={{ top: 16, right: 12, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="barGradTv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(56,189,248)" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="rgb(14,165,233)" stopOpacity="0.15" />
                    </linearGradient>
                    <linearGradient id="barGradMt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(52,211,153)" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity="0.15" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
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
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      background: "rgba(10,12,16,0.94)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                      fontSize: 11,
                      padding: "10px 14px",
                      backdropFilter: "blur(12px)",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                    formatter={(v: number) => [
                      fmtUsd(v, { compact: true }),
                      "Net P&L",
                    ]}
                    labelFormatter={(_l, p) =>
                      (p?.[0]?.payload as { fullName?: string })?.fullName ??
                      ""
                    }
                  />
                  <Bar dataKey="net" radius={[10, 10, 2, 2]} maxBarSize={48}>
                    {netChart.map((row, i) => (
                      <Cell
                        key={i}
                        fill={
                          row.venue === "tradingview"
                            ? "url(#barGradTv)"
                            : "url(#barGradMt)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center gap-4 text-[11px] text-white/55">
              <LegendSwatch color="rgb(56,189,248)" label="TradingView" />
              <LegendSwatch color="rgb(52,211,153)" label="MetaTrader 5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Pipeline surface"
            title="Venue health"
            icon={<Activity className="h-4 w-4" />}
          />
          <CardContent className="space-y-4">
            <VenueBar
              icon={<Monitor className="h-4 w-4" />}
              label="TradingView Desktop"
              count={tvCount}
              total={total}
              ok={!!health?.tv_cdp}
              note={
                health?.tv_cdp ? "CDP bridge online" : "CDP bridge offline"
              }
            />
            <VenueBar
              icon={<Database className="h-4 w-4" />}
              label="MetaTrader 5 MCP"
              count={mtCount}
              total={total}
              ok={!!health?.mt5_mcp}
              note={health?.mt5_mcp ? "JSON-RPC ready" : "JSON-RPC offline"}
            />

            <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Last 14 days</div>
                  <div className="mt-1 text-xs text-white/55">
                    Healthy strategies over time
                  </div>
                </div>
                <span className="num text-xs font-semibold text-emerald-200">
                  {historyChart.length
                    ? `${historyChart[historyChart.length - 1].healthy}/${total}`
                    : "—"}
                </span>
              </div>
              <div className="mt-3 h-20">
                <ResponsiveContainer>
                  <AreaChart data={historyChart}>
                    <defs>
                      <linearGradient
                        id="healthGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="rgb(52,211,153)"
                          stopOpacity="0.55"
                        />
                        <stop
                          offset="100%"
                          stopColor="rgb(52,211,153)"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="healthy"
                      stroke="rgb(52,211,153)"
                      strokeWidth={1.8}
                      fill="url(#healthGrad)"
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                      contentStyle={{
                        background: "rgba(10,12,16,0.94)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 12,
                        fontSize: 10,
                        padding: "8px 12px",
                        backdropFilter: "blur(12px)",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {historyChart.length === 0 && (
                <div className="mt-3 text-[11px] text-white/40">
                  No history yet — archives populate after the first run.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── SCATTER + COMPOSITION ─── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
        className="grid gap-4 xl:grid-cols-[1.3fr_1fr]"
      >
        <Card>
          <CardHeader
            eyebrow="Risk vs efficiency"
            title="Drawdown × profit factor"
            description="Each strategy plotted by hard-ceiling drawdown against baseline profit factor. Bottom-right corner is cheapest risk per unit of edge."
            icon={<Radar className="h-4 w-4" />}
          />
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    type="number"
                    dataKey="dd"
                    name="Max DD"
                    tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    label={{
                      value: "Max DD (%)",
                      position: "insideBottom",
                      offset: -6,
                      fill: "rgba(255,255,255,0.4)",
                      fontSize: 10,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="pf"
                    name="Profit factor"
                    tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                    domain={[0, "auto"]}
                    label={{
                      value: "Profit factor",
                      angle: -90,
                      position: "insideLeft",
                      fill: "rgba(255,255,255,0.4)",
                      fontSize: 10,
                    }}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                    contentStyle={{
                      background: "rgba(10,12,16,0.94)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                      fontSize: 11,
                      padding: "10px 14px",
                      backdropFilter: "blur(12px)",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                    formatter={(v: number, name: string) => {
                      if (name === "Max DD") return [`${v.toFixed(2)}%`, name];
                      if (name === "Profit factor")
                        return [v.toFixed(3), name];
                      return [v, name];
                    }}
                    labelFormatter={(_l, p) =>
                      (p?.[0]?.payload as { name?: string })?.name ?? ""
                    }
                  />
                  <Scatter data={scatter} fill="rgb(125,211,252)">
                    {scatter.map((row, i) => (
                      <Cell
                        key={i}
                        fill={
                          row.breaches > 0
                            ? "rgb(251,113,133)"
                            : "rgb(125,211,252)"
                        }
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-white/55">
              <LegendSwatch color="rgb(125,211,252)" label="Healthy" />
              <LegendSwatch color="rgb(251,113,133)" label="Breached" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Portfolio composition"
            title="Strategy roster"
            icon={<Target className="h-4 w-4" />}
          />
          <CardContent className="space-y-2">
            {ids.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-xs text-white/40">
                No strategies in state.json yet
              </div>
            )}
            {ids.map((id) => {
              const s = strategies[id];
              const b = baselinesMap[id];
              const brc = s.breaches.length;
              return (
                <Link
                  key={id}
                  to={`/strategies/${id}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 transition hover:border-white/20 hover:bg-black/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={clsx(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[10px] font-bold",
                        s.venue === "tradingview"
                          ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                          : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                      )}
                    >
                      {s.venue === "tradingview" ? "TV" : "MT5"}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {prettyStrategyName(id)}
                      </div>
                      <div className="truncate text-[11px] text-white/45">
                        {s.symbol.replace(/^[A-Z]+:/, "")} ·{" "}
                        {fmtInt(b?.total_trades)} baseline trades
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
                    <ChevronRight className="h-4 w-4 text-white/30 transition group-hover:text-white/60" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── RECENT EVENTS CTA ─── */}
      {recentEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
        >
          <Card>
            <CardHeader
              eyebrow="Recent activity"
              title="Remediation events"
              description="Folders created by the remediation agent whenever a breach fires."
              icon={<Zap className="h-4 w-4" />}
              actions={
                <Link
                  to="/runbook"
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:bg-white/10"
                >
                  Open runbook
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              }
            />
            <CardContent className="grid gap-3 md:grid-cols-2">
              {recentEvents.map((e) => (
                <Link
                  key={e.id}
                  to={`/events/${e.id}`}
                  className="group flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20 hover:bg-black/30"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {e.id}
                    </div>
                    <div className="mt-1 text-[11px] text-white/45">
                      {fmtRel(e.created)} · {e.files.length} artifact
                      {e.files.length !== 1 ? "s" : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {e.diagnosis && (
                        <StatusPill tone="accent" size="xs">
                          diagnosis
                        </StatusPill>
                      )}
                      {e.tweak && (
                        <StatusPill tone="warn" size="xs">
                          tweak
                        </StatusPill>
                      )}
                      {e.rebuild && (
                        <StatusPill tone="violet" size="xs">
                          rebuild
                        </StatusPill>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:text-white/60" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function KpiMini({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "success" | "accent" | "warning" | "danger";
  icon?: React.ReactNode;
}) {
  const GRAD: Record<string, string> = {
    neutral: "from-white/10 via-white/[0.02] to-transparent",
    success: "from-emerald-500/25 via-emerald-500/5 to-transparent",
    accent: "from-sky-500/25 via-sky-500/5 to-transparent",
    warning: "from-amber-400/25 via-amber-400/5 to-transparent",
    danger: "from-rose-500/30 via-rose-500/5 to-transparent",
  };
  const ICON_TONE: Record<string, string> = {
    neutral: "bg-white/10 text-white/80",
    success: "bg-emerald-400/15 text-emerald-200",
    accent: "bg-sky-400/15 text-sky-200",
    warning: "bg-amber-300/15 text-amber-100",
    danger: "bg-rose-400/15 text-rose-200",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          GRAD[tone]
        )}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="eyebrow truncate">{label}</div>
          <div className="num mt-2 text-2xl font-semibold tracking-tight text-white">
            {value}
          </div>
          {sub && (
            <div className="mt-1 truncate text-[10px] text-white/50">
              {sub}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={clsx(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
              ICON_TONE[tone]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function Pinned({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/70">
      {icon}
      {children}
    </span>
  );
}

function VenueBar({
  icon,
  label,
  count,
  total,
  ok,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  total: number;
  ok: boolean;
  note: string;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/80">
            {icon}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{label}</div>
            <div className="text-[11px] text-white/45">{note}</div>
          </div>
        </div>
        <StatusPill tone={ok ? "good" : "danger"} size="xs" dot>
          {ok ? "online" : "offline"}
        </StatusPill>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-white/50">
        <span>
          {count} strateg{count === 1 ? "y" : "ies"}
        </span>
        <span className="num">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-700",
            ok
              ? "bg-gradient-to-r from-emerald-400 to-sky-400"
              : "bg-gradient-to-r from-rose-400 to-amber-400"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LegendSwatch({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
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

function shortName(id: string): string {
  const map: Record<string, string> = {
    us30_orb_tv: "US30 ORB",
    s2_momentum_burst_mt5: "S2 Burst",
    regime_switch_mt5: "Regime Sw",
    rast_v20_mt5: "RAST V20",
    us30_vwap_mt5: "US30 VWAP",
  };
  return map[id] ?? id;
}
