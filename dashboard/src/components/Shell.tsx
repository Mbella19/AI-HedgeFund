import { useState, useEffect, useMemo, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gauge,
  LineChart as LineChartIcon,
  Workflow,
  Menu,
  X,
  RefreshCw,
  Play,
  Square,
  Activity,
  CircleDot,
  FastForward,
  Terminal,
  Bot as BotIcon,
  AlertTriangle,
  Clock,
} from "lucide-react";
import clsx from "clsx";
import { usePolling } from "../lib/hooks";
import { api } from "../lib/api";
import { fmtRel } from "../lib/format";
import type { BotStatus, LiveCsvStatus } from "../lib/types";

// ─── Helpers ───
// Loop cron: 21:30 UTC, weekdays only. Compute the next firing from a given
// "now" on the client so we can render a countdown without server round-trips.
function computeNextRun(now: Date): Date {
  const next = new Date(now);
  next.setUTCHours(21, 30, 0, 0);
  for (let i = 0; i < 10; i++) {
    const dow = next.getUTCDay();
    if (next.getTime() > now.getTime() && dow >= 1 && dow <= 5) return next;
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(21, 30, 0, 0);
  }
  return next;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "due";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function staleSymbols(csv: LiveCsvStatus | null, thresholdHours = 6): string[] {
  if (!csv) return [];
  const stale: string[] = [];
  for (const [sym, s] of Object.entries(csv)) {
    if (s.exists && hoursSince(s.modified) > thresholdHours) stale.push(sym);
  }
  return stale;
}

const TABS = [
  { to: "/overview", label: "Overview", icon: Gauge },
  { to: "/strategies", label: "Strategies", icon: LineChartIcon },
  { to: "/runbook", label: "Runbook", icon: Workflow },
];

export default function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: health, reload } = usePolling(api.health, 15000);
  const { data: botsData, reload: reloadBots } = usePolling(api.bots, 10000);
  const { data: csvData } = usePolling(api.liveCsvStatus, 60000);
  const [pending, setPending] = useState(false);
  const [runOncePending, setRunOncePending] = useState(false);
  const [botPending, setBotPending] = useState<Record<string, boolean>>({});
  const [logOpen, setLogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a minute so the next-run countdown stays fresh without
  // burning renders.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loopRunning = !!health?.loop?.running;
  const bots: BotStatus[] = botsData?.bots || [];
  const stale = useMemo(() => staleSymbols(csvData ?? null), [csvData]);
  const nextRun = useMemo(() => computeNextRun(new Date(now)), [now]);
  const nextRunMs = nextRun.getTime() - now;

  async function toggleLoop() {
    if (pending) return;
    setPending(true);
    try {
      if (loopRunning) await api.stopLoop();
      else await api.startLoop();
    } catch {
      /* swallow */
    }
    setTimeout(() => {
      reload();
      setPending(false);
    }, 1200);
  }

  async function triggerRunOnce() {
    if (runOncePending) return;
    setRunOncePending(true);
    try {
      await api.runOnce();
    } catch {
      /* swallow */
    }
    setTimeout(() => {
      reload();
      setRunOncePending(false);
    }, 1500);
  }

  async function toggleBot(bot: BotStatus) {
    if (botPending[bot.id]) return;
    setBotPending((p) => ({ ...p, [bot.id]: true }));
    try {
      if (bot.running) await api.botStop(bot.id);
      else await api.botStart(bot.id);
    } catch {
      /* swallow */
    }
    setTimeout(() => {
      reloadBots();
      setBotPending((p) => ({ ...p, [bot.id]: false }));
    }, 1200);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050608] text-white">
      {/* Ambient glow layer */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-sky-500/[0.07] blur-[180px]" />
        <div className="absolute top-1/3 -left-40 h-[32rem] w-[32rem] rounded-full bg-emerald-500/[0.06] blur-[160px]" />
        <div className="absolute bottom-0 right-0 h-[36rem] w-[36rem] translate-x-1/3 translate-y-1/4 rounded-full bg-violet-500/[0.07] blur-[180px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
      </div>

      <div className="relative mx-auto flex max-w-[1480px] flex-col gap-6 px-3 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
        {/* ─── Header ─── */}
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:p-5">
          <div className="pointer-events-none absolute -top-24 left-10 h-60 w-60 rounded-full bg-white/[0.04] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-0 h-48 w-60 rounded-full bg-sky-500/[0.06] blur-3xl" />

          <div className="relative flex items-center justify-between gap-4">
            {/* Brand */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-white/20 via-white/[0.05] to-transparent shadow-inner shadow-black/30">
                <Activity className="h-5 w-5 text-white" strokeWidth={2.25} />
                <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#050608]" />
                </span>
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="eyebrow truncate">Quant Monitor</span>
                <span className="truncate text-sm font-semibold tracking-tight">
                  Control Center
                </span>
              </div>
            </div>

            {/* Tab nav — desktop */}
            <nav className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1 backdrop-blur">
              {TABS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold tracking-wide transition-all",
                      isActive
                        ? "bg-white text-black shadow-lg shadow-black/40"
                        : "text-white/55 hover:bg-white/5 hover:text-white"
                    )
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <HealthDot
                label="MT5"
                ok={!!health?.mt5_mcp}
                loaded={!!health}
              />
              <HealthDot
                label="TV"
                ok={!!health?.tv_cdp}
                loaded={!!health}
              />
              <button
                onClick={reload}
                title="Refresh status"
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 transition hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLogOpen((o) => !o)}
                title="Toggle loop log drawer"
                className={clsx(
                  "hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border text-white/70 transition sm:inline-flex",
                  logOpen
                    ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
                    : "border-white/10 bg-white/[0.05] hover:bg-white/10 hover:text-white"
                )}
              >
                <Terminal className="h-4 w-4" />
              </button>
              <button
                onClick={triggerRunOnce}
                disabled={runOncePending}
                title="Fire a single EOD pass now (ignores schedule)"
                className={clsx(
                  "hidden items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-semibold tracking-wide shadow-lg shadow-black/30 transition sm:inline-flex",
                  runOncePending
                    ? "cursor-wait border-white/10 bg-white/10 text-white/50"
                    : "border-white/10 bg-white/[0.05] text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <FastForward className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">
                  {runOncePending ? "Starting…" : "Run once"}
                </span>
              </button>
              <button
                onClick={toggleLoop}
                disabled={pending}
                title={
                  loopRunning
                    ? "Stop the EOD loop (kills scheduler/loop.sh + children)"
                    : "Start the EOD loop (npm start)"
                }
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold tracking-wide shadow-lg shadow-black/30 transition",
                  pending
                    ? "cursor-wait bg-white/10 text-white/50"
                    : loopRunning
                    ? "border border-rose-400/30 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
                    : "bg-white text-black hover:bg-white/90"
                )}
              >
                {loopRunning ? (
                  <Square className="h-3.5 w-3.5" fill="currentColor" />
                ) : (
                  <Play className="h-3.5 w-3.5" fill="currentColor" />
                )}
                <span className="hidden sm:inline">
                  {pending
                    ? loopRunning
                      ? "Stopping…"
                      : "Starting…"
                    : loopRunning
                    ? "Stop loop"
                    : "Start loop"}
                </span>
              </button>
              <button
                onClick={() => setMobileOpen((o) => !o)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white md:hidden"
                aria-label="Toggle navigation"
              >
                {mobileOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile tab drawer */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="md:hidden overflow-hidden"
              >
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {TABS.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          "flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-semibold tracking-wide transition",
                          isActive
                            ? "border-white/20 bg-white text-black"
                            : "border-white/10 bg-white/[0.03] text-white/70"
                        )
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              </motion.nav>
            )}
          </AnimatePresence>

          {/* Bot chips row — only render if we have any bots registered on the server */}
          {bots.length > 0 && (
            <div className="relative mt-4 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                <BotIcon className="h-3 w-3" />
                Bots
              </span>
              {bots.map((bot) => {
                const pend = !!botPending[bot.id];
                return (
                  <button
                    key={bot.id}
                    onClick={() => toggleBot(bot)}
                    disabled={pend}
                    title={
                      bot.running
                        ? `Stop ${bot.name} (pid ${bot.pid})`
                        : `Start ${bot.name}`
                    }
                    className={clsx(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition",
                      pend
                        ? "cursor-wait border-white/10 bg-white/10 text-white/50"
                        : bot.running
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20"
                          : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span
                      className={clsx(
                        "h-1.5 w-1.5 rounded-full",
                        bot.running
                          ? "animate-pulse-soft bg-emerald-300"
                          : "bg-white/30"
                      )}
                    />
                    {bot.name}
                    {bot.running ? (
                      <Square className="h-2.5 w-2.5" fill="currentColor" />
                    ) : (
                      <Play className="h-2.5 w-2.5" fill="currentColor" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Info strip */}
          <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] text-white/50">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span
                className={clsx(
                  "flex items-center gap-1.5",
                  loopRunning ? "text-emerald-200" : "text-white/50"
                )}
              >
                <CircleDot
                  className={clsx(
                    "h-3 w-3",
                    loopRunning
                      ? "animate-pulse text-emerald-300"
                      : "text-white/40"
                  )}
                />
                {loopRunning ? "Loop running" : "Loop idle"}
              </span>
              {loopRunning && health?.loop?.started_at && (
                <>
                  <span className="text-white/30">·</span>
                  <span>Started {fmtRel(health.loop.started_at)}</span>
                </>
              )}
              <span className="text-white/30">·</span>
              <span>Last run {fmtRel(health?.last_run)}</span>
              {loopRunning && (
                <>
                  <span className="text-white/30">·</span>
                  <span
                    className="flex items-center gap-1 text-sky-200/80"
                    title={`Next EOD fires at ${nextRun.toUTCString()}`}
                  >
                    <Clock className="h-3 w-3" />
                    Next in {fmtCountdown(nextRunMs)}
                  </span>
                </>
              )}
              {stale.length > 0 && (
                <span
                  title={`Live CSV has not updated in >6h: ${stale.join(", ")}`}
                  className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-200"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Stale: {stale.join(", ")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-white/40">
              <span>
                {health?.loop?.running && health?.loop?.pid
                  ? `loop pid ${health.loop.pid}`
                  : "Autonomous EOD loop"}
              </span>
            </div>
          </div>
        </header>

        {/* ─── Main content ─── */}
        <main className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 px-2 text-[11px] text-white/35">
          <span>TradingView + MetaTrader 5 · Autonomous breach remediation</span>
          <span className="font-mono">
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </footer>
      </div>

      {/* Loop log drawer — slides up from the bottom when toggled */}
      <AnimatePresence>
        {logOpen && <LogDrawer onClose={() => setLogOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

function LogDrawer({ onClose }: { onClose: () => void }) {
  // 3s poll while drawer is open so Claude's loop output streams in
  const { data } = usePolling(() => api.loopLog(300), 3000);
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-0 left-0 right-0 z-50 max-h-[55vh] border-t border-white/10 bg-[#05070a]/95 shadow-[0_-40px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-white/80">
          <Terminal className="h-3.5 w-3.5 text-sky-300" />
          loop.log
          {data?.total_lines != null && (
            <span className="text-white/40">· {data.total_lines} lines</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Close log drawer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <pre className="max-h-[calc(55vh-3.25rem)] overflow-auto px-5 py-3 font-mono text-[11px] leading-relaxed text-white/70">
        {data?.log || "No log output yet. Start the loop or wait for the scheduler to fire."}
      </pre>
    </motion.div>
  );
}

function HealthDot({
  label,
  ok,
  loaded,
}: {
  label: string;
  ok: boolean;
  loaded: boolean;
}) {
  return (
    <div
      title={`${label} MCP: ${!loaded ? "checking" : ok ? "online" : "offline"}`}
      className={clsx(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-widest sm:inline-flex",
        !loaded
          ? "border-white/10 bg-white/[0.05] text-white/50"
          : ok
            ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
            : "border-rose-400/25 bg-rose-400/10 text-rose-200"
      )}
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          !loaded
            ? "bg-white/40"
            : ok
              ? "bg-emerald-300 animate-pulse-soft"
              : "bg-rose-300"
        )}
      />
      {label}
    </div>
  );
}
