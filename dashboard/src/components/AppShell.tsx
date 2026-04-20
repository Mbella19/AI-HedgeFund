import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SideNav, Tabbar } from "./Nav";
import { Header } from "./Header";
import { StrategySheet } from "./StrategySheet";
import { RunBar } from "./RunBar";
import { api } from "../lib/api";
import { usePolling } from "../lib/hooks";
import { buildStrategyView, type StrategyView } from "../lib/strategyView";
import { fmtRel } from "../lib/format";
import type { Baseline } from "../lib/types";

/* ─── Strategy sheet context (via custom events) ───────────────────────── */

const STRATEGY_ORDER = [
  "s2_momentum_burst_mt5",
  "regime_switch_mt5",
  "rast_v20_mt5",
  "us30_orb_tv",
  "us30_vwap_mt5",
];

type OpenDetail = { id: string };
const OPEN_EVENT = "eod.openStrategy";

export function openStrategySheet(id: string) {
  window.dispatchEvent(
    new CustomEvent<OpenDetail>(OPEN_EVENT, { detail: { id } })
  );
}

export function useStrategyViews(): StrategyView[] {
  const { data: state } = usePolling(api.state, 20000);
  const { data: baselines } = usePolling(api.baselines, 60000);
  const { data: stratResp } = usePolling(api.strategies, 60000);

  return useMemo(() => {
    const strategies = stratResp?.strategies ?? [];
    const live = state?.strategies ?? {};
    const ordered = STRATEGY_ORDER.filter((id) =>
      strategies.find((s) => s.id === id)
    );
    const others = strategies
      .map((s) => s.id)
      .filter((id) => !STRATEGY_ORDER.includes(id));
    return [...ordered, ...others].map((id) =>
      buildStrategyView(
        id,
        strategies.find((s) => s.id === id),
        live[id],
        baselines?.[id] as Baseline | undefined
      )
    );
  }, [state, baselines, stratResp]);
}

/* ─── Shell ────────────────────────────────────────────────────────────── */

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const nav = useNavigate();

  const views = useStrategyViews();
  const { data: state } = usePolling(api.state, 20000);
  const { data: health } = usePolling(api.health, 15000);
  const { data: eventsResp } = usePolling(api.events, 30000);

  const [openId, setOpenId] = useState<string | null>(null);
  const activeView = useMemo(
    () => views.find((v) => v.id === openId) ?? null,
    [views, openId]
  );

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<OpenDetail>).detail;
      if (detail?.id) setOpenId(detail.id);
    }
    window.addEventListener(OPEN_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_EVENT, handler as EventListener);
  }, []);

  const closeSheet = useCallback(() => setOpenId(null), []);

  const breachCount = views.filter((v) => v.status === "breach").length;
  const watchCount = views.filter((v) => v.status === "watch").length;
  const lastRun = state?.timestamp ? fmtRel(state.timestamp) : "no data";
  const headerStatus = (() => {
    if (breachCount > 0)
      return {
        tone: "bad" as const,
        label: `${breachCount} BREACH · LAST RUN ${lastRun.toUpperCase()}`,
      };
    if (watchCount > 0)
      return {
        tone: "warn" as const,
        label: `${watchCount} WATCH · LAST RUN ${lastRun.toUpperCase()}`,
      };
    return {
      tone: "ok" as const,
      label: `LAST RUN ${lastRun.toUpperCase()}`,
    };
  })();

  const onOpenEventForStrategy = useCallback(() => {
    if (activeView) nav(`/events?strategy=${activeView.id}`);
    closeSheet();
  }, [activeView, nav, closeSheet]);

  const onDrill = useCallback(() => {
    if (activeView) api.drill(activeView.id).catch(() => {});
  }, [activeView]);

  const hasHealth = !!health;

  const lastRunClock = state?.timestamp
    ? new Date(state.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";
  const pendingEvents = (eventsResp?.events ?? []).filter(
    (e) => !e.tweak && !e.rebuild
  ).length;
  const loopRunning = !!health?.loop?.running;
  const runBar =
    pathname === "/" ? (
      <RunBar
        value={loopRunning ? "LOOP RUNNING" : "17:30 NY"}
        sub={
          pendingEvents > 0
            ? `${pendingEvents} pending`
            : lastRunClock === "—"
            ? "awaiting first run"
            : `last ${lastRunClock}`
        }
        cta={loopRunning ? "RUNNING" : "RUN NOW"}
        onRun={() => api.runOnce().catch(() => {})}
        disabled={loopRunning}
      />
    ) : undefined;

  return (
    <div className="stage-dots min-h-screen md:flex md:items-stretch md:justify-center">
      <div
        className="device-wrap md:flex md:flex-col w-full md:max-w-[1240px] md:my-6 md:rounded-[28px] md:overflow-hidden"
        style={{
          background: "var(--bg)",
          boxShadow: hasHealth
            ? "0 40px 100px rgba(0,0,0,.6), 0 0 0 1px #1a1a1d"
            : "none",
        }}
      >
        <div className="flex flex-1 min-h-0">
          <SideNav
            pathname={pathname}
            onRunNow={() => api.runOnce().catch(() => {})}
            nextRunLabel="17:30 NY"
          />
          <main className="flex-1 min-w-0 flex flex-col">
            <Header
              status={headerStatus}
              alert={breachCount > 0 || watchCount > 0}
              onBell={() => nav("/events")}
              onSettings={() => nav("/profile")}
            />
            <div className="flex-1 min-h-0">{children}</div>
            <Tabbar pathname={pathname} above={runBar} />
          </main>
        </div>
      </div>
      <StrategySheet
        s={activeView}
        onClose={closeSheet}
        onOpenEvent={onOpenEventForStrategy}
        onDrill={onDrill}
      />
    </div>
  );
}
