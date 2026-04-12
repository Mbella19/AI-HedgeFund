import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  Workflow,
  Cpu,
  Activity,
  Radar,
  ShieldCheck,
  Database,
  BrainCircuit,
  Wrench,
  Hammer,
  CheckCircle2,
  XCircle,
  FileText,
  Clock3,
  BellRing,
  Layers3,
  Server,
  Bot,
  ChevronRight,
  CalendarDays,
  ThumbsUp,
  ThumbsDown,
  ShieldAlert,
} from "lucide-react";
import type { Proposal } from "../lib/types";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { usePolling } from "../lib/hooks";
import { api } from "../lib/api";
import { fmtDate, fmtInt, fmtRel, fmtUsd } from "../lib/format";

import { Card, CardHeader, CardContent } from "../components/ui/Card";
import StatusPill from "../components/ui/StatusPill";
import StatCard from "../components/ui/StatCard";
import { SectionHeading } from "../components/ui/SectionHeading";

// ─── Step definitions for the vertical pipeline ───
const PIPELINE = [
  {
    id: "preflight",
    icon: <Cpu className="h-4 w-4" />,
    label: "Preflight",
    description: "Ensures TradingView CDP + MT5 MCP servers are up and responsive.",
    artifact: "scheduler/start_daily.sh",
  },
  {
    id: "collect",
    icon: <Database className="h-4 w-4" />,
    label: "Collect",
    description:
      "Pulls live trades from TV and MT5 since the baseline end date. Computes DD, PF, consec losses, 30-day return.",
    artifact: "monitor/collect_live.mjs → state.json",
  },
  {
    id: "check",
    icon: <ShieldCheck className="h-4 w-4" />,
    label: "Check breach",
    description:
      "Compares live metrics to each baseline under the four breach rules. Writes a daily archive.",
    artifact: "monitor/check_breach.mjs → history/",
  },
  {
    id: "diagnose",
    icon: <BrainCircuit className="h-4 w-4" />,
    label: "Diagnose",
    description:
      "On breach, Claude pulls OHLCV + indicator context and clusters losing trades into a regime shift hypothesis.",
    artifact: "agents/diagnose.md",
  },
  {
    id: "remediate",
    icon: <Wrench className="h-4 w-4" />,
    label: "Remediate",
    description:
      "Tweak parameters if the edge is present, otherwise rebuild from scratch per the dev guidelines.",
    artifact: "agents/remediate_tweak.md · agents/remediate_rebuild.md",
  },
  {
    id: "report",
    icon: <FileText className="h-4 w-4" />,
    label: "Report",
    description:
      "Writes diagnosis, decision, and verification into an event folder for review.",
    artifact: "monitor/events/<id>/",
  },
];

const RULES = [
  {
    tone: "danger" as const,
    title: "hard_max_dd",
    rule: "Live max drawdown > baseline max DD",
    kind: "Hard",
  },
  {
    tone: "danger" as const,
    title: "hard_max_consec_loss",
    rule: "Longest losing streak > baseline's streak",
    kind: "Hard",
  },
  {
    tone: "warn" as const,
    title: "soft_pf_30t",
    rule: "Profit factor on last 30 trades < 0.80",
    kind: "Soft",
  },
  {
    tone: "warn" as const,
    title: "soft_ret_30d_vs_avg",
    rule: "30-day return < 0.3 × baseline daily avg × 30",
    kind: "Soft",
  },
];

export default function Runbook() {
  const { data: history } = usePolling(api.history, 30000);
  const { data: events } = usePolling(api.events, 30000);
  const { data: health } = usePolling(api.health, 15000);
  const loopRunning = !!health?.loop?.running;
  // While the loop is running we want tight tailing; while idle we slow down
  // so the browser isn't hammering the API for a static file.
  const { data: loopLog } = usePolling(
    () => api.loopLog(500),
    loopRunning ? 3000 : 15000,
    [loopRunning]
  );
  const { data: proposalsData, reload: reloadProposals } = usePolling(
    api.proposals,
    30000
  );
  const [proposalPending, setProposalPending] = useState<
    Record<string, boolean>
  >({});

  const entries = history?.entries || [];
  const evs = events?.events || [];
  const proposals = proposalsData?.proposals || [];
  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const totalDays = entries.length;
  const cleanDays = entries.filter((e) => e.breached === 0).length;
  const breachDays = totalDays - cleanDays;
  const cleanPct =
    totalDays === 0 ? 100 : Math.round((cleanDays / totalDays) * 100);

  async function handleProposal(id: string, action: "approve" | "reject") {
    if (proposalPending[id]) return;
    setProposalPending((p) => ({ ...p, [id]: true }));
    try {
      if (action === "approve") await api.approveProposal(id);
      else await api.rejectProposal(id);
    } catch {
      /* swallow */
    }
    setTimeout(() => {
      reloadProposals();
      setProposalPending((p) => ({ ...p, [id]: false }));
    }, 1200);
  }

  const chartData = [...entries].reverse().map((e) => ({
    date: e.date.slice(5),
    breached: e.breached,
    healthy: e.total - e.breached,
    trades: e.total_trades,
  }));

  return (
    <div className="space-y-5">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card>
          <div className="pointer-events-none absolute -top-28 left-10 h-64 w-64 rounded-full bg-violet-500/[0.08] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-10 h-64 w-64 rounded-full bg-sky-500/[0.08] blur-3xl" />
          <div className="relative p-6 md:p-8">
            <SectionHeading
              eyebrow="Operations"
              title="Autonomous daily runbook"
              description="The complete operational loop — from preflight to breach remediation. Every step is logged; every event lands in its own folder for review."
              icon={<Workflow className="h-5 w-5" />}
              actions={
                <StatusPill
                  tone={health?.loop?.running ? "good" : "neutral"}
                  dot={!!health?.loop?.running}
                >
                  {health?.loop?.running ? "Loop running" : "Loop idle"}
                </StatusPill>
              }
            />
          </div>
        </Card>
      </motion.div>

      {/* KPI cards */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Days tracked"
          value={fmtInt(totalDays)}
          sublabel={totalDays === 0 ? "archive is empty" : "history archive"}
          tone="accent"
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <StatCard
          label="Clean days"
          value={fmtInt(cleanDays)}
          sublabel={`${cleanPct}% of total`}
          tone="success"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Breach days"
          value={fmtInt(breachDays)}
          sublabel={breachDays > 0 ? "remediation fired" : "none fired"}
          tone={breachDays > 0 ? "danger" : "neutral"}
          icon={<BellRing className="h-4 w-4" />}
        />
        <StatCard
          label="Event folders"
          value={fmtInt(evs.length)}
          sublabel={evs.length === 0 ? "nothing flagged" : "artifacts ready"}
          tone="violet"
          icon={<FileText className="h-4 w-4" />}
        />
      </motion.div>

      {/* Pipeline timeline + Governance */}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <Card>
            <CardHeader
              eyebrow="Pipeline"
              title="Daily execution flow"
              description="Every step the EOD loop runs in order, from market close to sealed event folder."
              icon={<Layers3 className="h-4 w-4" />}
            />
            <CardContent>
              <ol className="relative space-y-3">
                {PIPELINE.map((step, i) => (
                  <li
                    key={step.id}
                    className="group relative flex items-start gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20 hover:bg-black/30"
                  >
                    {i < PIPELINE.length - 1 && (
                      <span className="pointer-events-none absolute left-[1.85rem] top-[3.35rem] h-full w-px bg-gradient-to-b from-white/20 to-transparent" />
                    )}
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-white/15 to-white/[0.03] text-white/85 shadow-inner shadow-black/40">
                      {step.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                          Step {i + 1}
                        </span>
                        <div className="text-sm font-semibold text-white">
                          {step.label}
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                        {step.description}
                      </p>
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[10px] text-white/55">
                        <FileText className="h-3 w-3" />
                        {step.artifact}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader
              eyebrow="Governance"
              title="Breach rules"
              description="Any single rule firing ⇒ the strategy enters the remediation pipeline."
              icon={<Radar className="h-4 w-4" />}
            />
            <CardContent className="space-y-2">
              {RULES.map((r) => (
                <div
                  key={r.title}
                  className="rounded-2xl border border-white/10 bg-black/20 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-white">
                      {r.title}
                    </span>
                    <StatusPill tone={r.tone} size="xs">
                      {r.kind}
                    </StatusPill>
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/55">{r.rule}</p>
                </div>
              ))}
              <div className="mt-3 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-violet-200" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-200">
                    Remediation path
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                  Claude decides: <strong className="text-white">tweak</strong>{" "}
                  (1–3 params) if edge is intact, or{" "}
                  <strong className="text-white">rebuild</strong> per the dev
                  guidelines. Rebuilds always emit both Pine Script and MQL5
                  and land in a proposed folder for manual review.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* History chart + archive */}
      {entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="grid gap-4 xl:grid-cols-[1.3fr_1fr]"
        >
          <Card>
            <CardHeader
              eyebrow="Timeline"
              title="Breach history"
              description="Breach counts per day against the monitored portfolio."
              icon={<Activity className="h-4 w-4" />}
            />
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart
                    data={chartData}
                    margin={{ top: 16, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                      contentStyle={{
                        background: "rgba(10,12,16,0.94)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 14,
                        fontSize: 11,
                        backdropFilter: "blur(12px)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="breached"
                      stroke="rgb(251,113,133)"
                      strokeWidth={2}
                      dot={{ fill: "rgb(251,113,133)", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="healthy"
                      stroke="rgb(52,211,153)"
                      strokeWidth={2}
                      dot={{ fill: "rgb(52,211,153)", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Archive"
              title="Daily rundown"
              description="Last runs, newest first."
              icon={<Clock3 className="h-4 w-4" />}
            />
            <CardContent className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              {entries.slice(0, 10).map((e) => (
                <div
                  key={e.date}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"
                >
                  {e.breached > 0 ? (
                    <XCircle className="h-5 w-5 shrink-0 text-rose-300" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="num text-xs font-semibold text-white">
                      {fmtDate(e.timestamp)}
                    </div>
                    <div className="text-[10px] text-white/45">
                      {fmtInt(e.total)} strategies · {fmtInt(e.total_trades)}{" "}
                      trades
                    </div>
                  </div>
                  <div className="text-right">
                    {e.breached > 0 ? (
                      <StatusPill tone="danger" size="xs">
                        {e.breached} breach
                      </StatusPill>
                    ) : (
                      <StatusPill tone="good" size="xs">
                        clean
                      </StatusPill>
                    )}
                    <div className="mt-1 num text-[10px] text-white/45">
                      {e.total_trades > 0
                        ? fmtUsd(e.total_pnl, { compact: true })
                        : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Events grid */}
      {evs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.14 }}
        >
          <Card>
            <CardHeader
              eyebrow="Event log"
              title="Remediation events"
              description="Every breach that triggered the auto-remediation pipeline. Click to open the diagnosis + decision artifacts."
              icon={<BellRing className="h-4 w-4" />}
            />
            <CardContent className="grid gap-3 md:grid-cols-2">
              {evs.map((e) => (
                <Link
                  key={e.id}
                  to={`/events/${e.id}`}
                  className="group flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20 hover:bg-black/30"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {e.id}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/45">
                      {fmtRel(e.created)} · {e.files.length} artifact
                      {e.files.length !== 1 ? "s" : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {e.diagnosis && (
                        <StatusPill tone="accent" size="xs">
                          <FileText className="h-2.5 w-2.5" />
                          diagnosis
                        </StatusPill>
                      )}
                      {e.tweak && (
                        <StatusPill tone="warn" size="xs">
                          <Wrench className="h-2.5 w-2.5" />
                          tweak
                        </StatusPill>
                      )}
                      {e.rebuild && (
                        <StatusPill tone="violet" size="xs">
                          <Hammer className="h-2.5 w-2.5" />
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

      {/* Rebuild proposals — human gate before auto-replace */}
      {proposals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
        >
          <Card>
            <CardHeader
              eyebrow="Human gate"
              title="Rebuild proposals"
              description="Rebuilt strategies wait here until you approve them. Approving marks the proposal accepted; rejecting seals it in the event folder. Nothing auto-replaces a running strategy."
              icon={<ShieldAlert className="h-4 w-4" />}
              actions={
                pendingProposals.length > 0 ? (
                  <StatusPill tone="warn" dot>
                    {pendingProposals.length} pending
                  </StatusPill>
                ) : (
                  <StatusPill tone="neutral">all reviewed</StatusPill>
                )
              }
            />
            <CardContent className="space-y-3">
              {proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  pending={!!proposalPending[p.id]}
                  onApprove={() => handleProposal(p.id, "approve")}
                  onReject={() => handleProposal(p.id, "reject")}
                />
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Meta grid */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.16 }}
        className="grid gap-4 md:grid-cols-2"
      >
        <MetaCard
          eyebrow="Data sources"
          title="Where metrics come from"
          icon={<Database className="h-4 w-4" />}
          items={[
            "TradingView Desktop via CDP :9222",
            "MetaTrader 5 MCP on 127.0.0.1:18080",
            "Frozen backtest xlsx → baselines.json",
            "Live M1 CSVs refreshed nightly by update_live_data.mjs",
          ]}
        />
        <MetaCard
          eyebrow="Design principles"
          title="How the loop is built"
          icon={<BrainCircuit className="h-4 w-4" />}
          items={[
            "Deterministic preflight before any Claude work",
            "Pure functions for every breach computation",
            "Event folders never auto-delete",
            "Rebuilds emit both Pine and MQL5, never auto-deploy",
          ]}
        />
      </motion.div>

      {/* CTA banner */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.18 }}
      >
        <Card>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/15 via-transparent to-violet-500/10" />
          <div className="relative grid gap-6 p-6 md:grid-cols-[1.5fr_auto] md:items-center md:p-8">
            <div>
              <div className="eyebrow">Agent</div>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Claude handles the remediation loop autonomously
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                On breach, the agent launches with{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-white/80">
                  --model claude-opus-4-6 --effort max
                </code>
                , follows{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-white/80">
                  agents/daily_run.md
                </code>
                , and writes every artifact into a dated event folder for
                later review.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
              <StatusPill tone="accent">
                <Bot className="h-3 w-3" />
                claude-opus-4-6
              </StatusPill>
              <StatusPill tone="violet">
                <Server className="h-3 w-3" />
                --effort max
              </StatusPill>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Loop log — live tail of scheduler/loop.sh output */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2 }}
      >
        <Card>
          <CardHeader
            eyebrow="Transcript"
            title="Loop log"
            description={
              loopRunning
                ? "Live output from scheduler/loop.sh — tailing every 3 seconds while the loop is running."
                : "Output from the last loop run. Click Start loop to begin streaming."
            }
            icon={<FileText className="h-4 w-4" />}
            actions={
              <StatusPill
                tone={loopRunning ? "good" : "neutral"}
                dot={loopRunning}
              >
                {loopRunning
                  ? "streaming"
                  : loopLog?.log
                    ? "idle · last run"
                    : "no log"}
              </StatusPill>
            }
          />
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-white/70">
              {loopLog?.log ||
                "No loop output yet. Click “Start loop” in the header to launch scheduler/loop.sh — its stdout and stderr stream here."}
            </pre>
            {loopLog?.total_lines !== undefined && loopLog.total_lines > 0 && (
              <div className="mt-2 flex items-center justify-between text-[10px] text-white/40">
                <span>
                  Tailing last {Math.min(500, loopLog.total_lines)} of{" "}
                  {loopLog.total_lines} lines from{" "}
                  <code className="font-mono text-white/55">monitor/loop.log</code>
                </span>
                <span>
                  {loopRunning ? "polling · 3s" : "polling · 15s"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function MetaCard({
  eyebrow,
  title,
  icon,
  items,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  items: string[];
}) {
  return (
    <Card className="h-full">
      <CardHeader eyebrow={eyebrow} title={title} icon={icon} />
      <CardContent>
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it}
              className="flex items-start gap-2 text-[11px] leading-relaxed text-white/60"
            >
              <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-white/35" />
              {it}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ProposalCard({
  proposal,
  pending,
  onApprove,
  onReject,
}: {
  proposal: Proposal;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isPending = proposal.status === "pending";
  return (
    <div
      className={clsx(
        "rounded-2xl border p-4 transition",
        isPending
          ? "border-amber-400/30 bg-amber-400/[0.04] hover:border-amber-400/50"
          : proposal.status === "approved"
            ? "border-emerald-400/25 bg-emerald-400/[0.05]"
            : "border-white/10 bg-black/20"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Hammer className="h-4 w-4 text-violet-200" />
            <Link
              to={`/events/${proposal.id}`}
              className="truncate text-sm font-semibold text-white hover:underline"
            >
              {proposal.id}
            </Link>
            <StatusPill
              tone={
                proposal.status === "pending"
                  ? "warn"
                  : proposal.status === "approved"
                    ? "good"
                    : "neutral"
              }
              size="xs"
            >
              {proposal.status}
            </StatusPill>
          </div>
          <div className="mt-1 text-[11px] text-white/50">
            Created {fmtRel(proposal.created)} ·{" "}
            {proposal.proposed_files.length} proposed file
            {proposal.proposed_files.length !== 1 ? "s" : ""}
            {proposal.validation_report && " · validation_report.md"}
          </div>
          {proposal.proposed_files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {proposal.proposed_files.slice(0, 5).map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[10px] text-white/55"
                >
                  <FileText className="h-2.5 w-2.5" />
                  {f}
                </span>
              ))}
              {proposal.proposed_files.length > 5 && (
                <span className="text-[10px] text-white/40">
                  +{proposal.proposed_files.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>
        {isPending ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onReject}
              disabled={pending}
              className={clsx(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                pending
                  ? "cursor-wait border-white/10 bg-white/5 text-white/40"
                  : "border-rose-400/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20"
              )}
            >
              <ThumbsDown className="h-3 w-3" />
              Reject
            </button>
            <button
              onClick={onApprove}
              disabled={pending}
              className={clsx(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                pending
                  ? "cursor-wait border-white/10 bg-white/5 text-white/40"
                  : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20"
              )}
            >
              <ThumbsUp className="h-3 w-3" />
              Approve
            </button>
          </div>
        ) : (
          <div className="shrink-0 text-right text-[10px] text-white/40">
            {proposal.approved_at && (
              <span>Approved {fmtRel(proposal.approved_at)}</span>
            )}
            {proposal.rejected_at && (
              <span>Rejected {fmtRel(proposal.rejected_at)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
