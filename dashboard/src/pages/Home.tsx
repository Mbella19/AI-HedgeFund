import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { usePolling } from "../lib/hooks";
import { fmtRel } from "../lib/format";
import { SectionTitle } from "../components/primitives";
import { PortfolioRingCard } from "../components/PortfolioRingCard";
import { EquityCard } from "../components/EquityCard";
import { TwinCards } from "../components/TwinCards";
import { StrategyList } from "../components/StrategyList";
import {
  openStrategySheet,
  useStrategyViews,
} from "../components/AppShell";

export default function Home() {
  const nav = useNavigate();
  const views = useStrategyViews();
  const { data: state } = usePolling(api.state, 20000);
  const { data: history } = usePolling(api.history, 30000);
  const { data: eventsResp } = usePolling(api.events, 30000);
  const { data: proposalsResp } = usePolling(api.proposals, 30000);
  const { data: health } = usePolling(api.health, 15000);

  const entries = history?.entries ?? [];
  const events = eventsResp?.events ?? [];
  const proposals = proposalsResp?.proposals ?? [];

  const equity = useMemo(() => {
    if (!entries.length) return { data: [] as number[], pct: 0, total: 0 };
    const last = entries.slice(-30);
    let running = 0;
    const data = last.map((h) => (running += h.total_pnl));
    const total = running;
    const first = data[0] ?? 0;
    const baseCapital = 100_000;
    const pct = ((running - first) / baseCapital) * 100;
    return { data, pct, total };
  }, [entries]);

  const mtdPct = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEntries = entries.filter(
      (h) => new Date(h.date + "T00:00:00") >= startOfMonth
    );
    const sum = monthEntries.reduce((a, h) => a + h.total_pnl, 0);
    return (sum / 100_000) * 100;
  }, [entries]);

  const lastRun = state?.timestamp
    ? new Date(state.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";

  const pendingProposals = proposals.filter(
    (p) => p.status === "pending"
  ).length;
  const openCount = events.length + pendingProposals;

  const totalViews = views.length;
  const clear = views.filter((v) => v.status === "clear").length;
  const stageStates: ("done" | "pending" | "idle")[] = [
    "done",
    "done",
    "done",
    state ? "done" : "idle",
    health?.loop?.running ? "pending" : state ? "done" : "idle",
    pendingProposals > 0 ? "pending" : state ? "done" : "idle",
  ];

  const stageLabel = state
    ? `${clear} of ${totalViews || 5} clear · ${fmtRel(state.timestamp)}`
    : "no runs yet";

  const queueDetail = openCount
    ? `${events.length} event${events.length === 1 ? "" : "s"} · ${pendingProposals} review`
    : "nothing in queue";

  const onOpen = (s: { id: string }) => openStrategySheet(s.id);

  return (
    <div className="px-0 md:px-0">
      <div className="grid gap-[14px] px-[22px] pt-1">
        <PortfolioRingCard views={views} mtdPct={mtdPct || equity.pct || 0} />
        <EquityCard
          pct={equity.pct}
          totalUsd={equity.total || 0}
          data={
            equity.data.length > 2
              ? equity.data
              : [10, 12, 11, 14, 13, 15, 17, 16, 19, 18, 21, 23, 22, 24, 27]
          }
        />
        <TwinCards
          lastRun={lastRun}
          stageStates={stageStates}
          stageLabel={stageLabel}
          pendingCount={openCount}
          queueDetail={queueDetail}
          onOpenEvents={() => nav("/events")}
        />

        <SectionTitle
          action={
            <button
              onClick={() => nav("/strategies")}
              className="text-[11px]"
              style={{ color: "var(--ink-3)", letterSpacing: ".06em" }}
            >
              SEE ALL
            </button>
          }
        >
          STRATEGIES
        </SectionTitle>

        <StrategyList
          views={views}
          action={{ label: "ALL", onClick: () => nav("/strategies") }}
          onOpen={onOpen}
        />

        {/* Bottom-sheet strategy detail is mounted in AppShell */}
        <div style={{ height: 8 }} aria-hidden />
      </div>
    </div>
  );
}
