import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { usePolling } from "../lib/hooks";
import { fmtRel, prettyStrategyName } from "../lib/format";
import { Card, SectionTitle } from "../components/primitives";
import {
  EventCard,
  Step,
  type EventItem,
  type EventKind,
  type EventStatus,
  type RunStep,
} from "../components/EventCard";
import type { MonitorEvent } from "../lib/types";

function extractStrategyId(eventId: string): string {
  const m = eventId.match(/^(.+?)-\d{8}/);
  if (m) return m[1];
  const parts = eventId.split("-");
  return parts.slice(0, -1).join("-") || eventId;
}

function extractDate(eventId: string, fallback: string): string {
  const m = eventId.match(/-(\d{8})/);
  if (m) {
    const d = m[1];
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  return fallback.slice(0, 10);
}

function eventKind(e: MonitorEvent): EventKind {
  if (e.rebuild) return "rebuild";
  if (e.tweak) return "tweak";
  return "note";
}

function eventStatus(e: MonitorEvent): EventStatus {
  if (e.rebuild) return "review";
  if (e.tweak) return "applied";
  if (e.diagnosis) return "pending";
  return "closed";
}

function eventSummary(e: MonitorEvent): string {
  const bits: string[] = [];
  if (e.diagnosis) bits.push("diagnosis");
  if (e.tweak) bits.push("tweak applied");
  if (e.rebuild) bits.push("rebuild proposed");
  if (bits.length === 0) return `${e.files.length} files`;
  return bits.join(" · ") + ` · ${e.files.length} files`;
}

function toItem(e: MonitorEvent): EventItem {
  const stratId = extractStrategyId(e.id);
  return {
    id: e.id.split("-").slice(-1)[0] ?? e.id,
    strat: prettyStrategyName(stratId),
    date: extractDate(e.id, e.created),
    kind: eventKind(e),
    status: eventStatus(e),
    summary: eventSummary(e),
  };
}

export default function Events() {
  const [params] = useSearchParams();
  const filter = params.get("strategy");

  const { data: eventsResp } = usePolling(api.events, 30000);
  const { data: state } = usePolling(api.state, 20000);
  const { data: history } = usePolling(api.history, 30000);
  const { data: health } = usePolling(api.health, 15000);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: eventFiles } = usePolling(
    () => (openId ? api.event(openId) : Promise.resolve({ id: "", files: [], content: {} })),
    openId ? 30000 : 60000,
    [openId]
  );

  const events = eventsResp?.events ?? [];
  const filtered = filter
    ? events.filter((e) => e.id.startsWith(filter))
    : events;

  const items = useMemo(
    () =>
      filtered
        .slice()
        .reverse()
        .slice(0, 20)
        .map((e) => ({ raw: e, item: toItem(e) })),
    [filtered]
  );

  const lastHistory = history?.entries?.[history.entries.length - 1];
  const lastRunTime = state?.timestamp
    ? new Date(state.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";

  const totalTrades = lastHistory?.total_trades ?? 0;
  const breached = lastHistory?.breached ?? 0;

  const pipeline: RunStep[] = [
    {
      t: "—",
      label: "Preflight",
      sub: `TV CDP ${health?.tv_cdp ? "UP" : "DOWN"} · MT5 MCP ${
        health?.mt5_mcp ? "UP" : "DOWN"
      }`,
      state: health?.tv_cdp && health?.mt5_mcp ? "done" : "pending",
    },
    {
      t: "—",
      label: "Update LIVE.csv",
      sub: state ? "live bars refreshed" : "awaiting run",
      state: state ? "done" : "idle",
    },
    {
      t: lastRunTime,
      label: "Collect live trades",
      sub: state
        ? `${Object.keys(state.strategies).length} strategies · ${totalTrades} trades`
        : "awaiting run",
      state: state ? "done" : "idle",
    },
    {
      t: lastRunTime,
      label: "Check breaches",
      sub: state
        ? `${breached} strategies in breach`
        : "awaiting run",
      state: state ? "done" : "idle",
    },
    {
      t: lastRunTime,
      label: "Diagnose",
      sub:
        events.length > 0
          ? `${events.length} event${events.length === 1 ? "" : "s"} on record`
          : "no events",
      state: events.some((e) => e.diagnosis) ? "done" : "idle",
    },
    {
      t: lastRunTime,
      label: "Remediation",
      sub:
        events.some((e) => e.rebuild)
          ? "rebuild proposed"
          : events.some((e) => e.tweak)
          ? "tweak applied"
          : "idle",
      state:
        events.some((e) => e.rebuild)
          ? "pending"
          : events.some((e) => e.tweak)
          ? "done"
          : "idle",
    },
  ];

  const openFiles =
    openId && eventFiles?.id === openId ? eventFiles.files : [];
  const openContent =
    openId && eventFiles?.id === openId ? eventFiles.content : {};

  return (
    <div className="px-[22px] pt-1 pb-[110px] grid gap-[14px]">
      <SectionTitle
        action={
          filter ? (
            <a
              href="/events"
              className="text-[11px] mono"
              style={{ color: "var(--ink-3)", letterSpacing: ".06em" }}
            >
              CLEAR FILTER
            </a>
          ) : null
        }
      >
        {filter ? `EVENTS · ${prettyStrategyName(filter).toUpperCase()}` : "OPEN EVENTS"}
      </SectionTitle>

      {items.length === 0 ? (
        <Card>
          <div className="text-[13px]" style={{ color: "var(--ink-3)" }}>
            No events recorded
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map(({ raw, item }) => (
            <div key={raw.id} className="grid gap-2">
              <EventCard
                e={item}
                onClick={() =>
                  setOpenId((cur) => (cur === raw.id ? null : raw.id))
                }
              />
              {openId === raw.id && (
                <Card>
                  <div
                    className="text-[11px] font-bold mb-2"
                    style={{ color: "var(--ink-3)", letterSpacing: ".14em" }}
                  >
                    FILES
                  </div>
                  {openFiles.length === 0 ? (
                    <div
                      className="text-[12px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      loading…
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {openFiles.map((f) => (
                        <details
                          key={f}
                          className="rounded-[12px]"
                          style={{
                            background: "var(--surface-2)",
                            padding: "10px 12px",
                          }}
                        >
                          <summary className="mono text-[12px] cursor-pointer">
                            {f}
                          </summary>
                          <pre
                            className="mono text-[11px] mt-2 whitespace-pre-wrap"
                            style={{
                              color: "var(--ink-2)",
                              maxHeight: 320,
                              overflow: "auto",
                            }}
                          >
                            {openContent[f] ?? ""}
                          </pre>
                        </details>
                      ))}
                    </div>
                  )}
                  <div
                    className="mt-3 mono text-[11px]"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {fmtRel(raw.created)}
                  </div>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}

      <SectionTitle>TODAY'S RUN PIPELINE</SectionTitle>
      <Card>
        <div className="relative">
          {pipeline.map((r, i) => (
            <Step key={i} r={r} last={i === pipeline.length - 1} />
          ))}
        </div>
      </Card>
    </div>
  );
}
