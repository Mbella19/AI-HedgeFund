import { useState } from "react";
import { api } from "../lib/api";
import { usePolling } from "../lib/hooks";
import { fmtRel } from "../lib/format";
import {
  Button,
  Card,
  KV,
  Pill,
  SectionTitle,
  Toggle,
} from "../components/primitives";
import { ServiceCard } from "../components/ServiceCard";
import type { Proposal } from "../lib/types";

function bytesToSize(n: number): string {
  if (n > 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n > 1000) return `${(n / 1000).toFixed(1)} KB`;
  return `${n} B`;
}

export default function Settings() {
  const { data: health, reload: reloadHealth } = usePolling(api.health, 15000);
  const { data: liveCsv } = usePolling(api.liveCsvStatus, 30000);
  const { data: loopLog } = usePolling(() => api.loopLog(400), 5000);
  const { data: proposalsResp } = usePolling(api.proposals, 30000);
  const [busy, setBusy] = useState<string | null>(null);

  const proposals = proposalsResp?.proposals ?? [];

  async function startLoop() {
    setBusy("start");
    try {
      await api.startLoop();
    } finally {
      setBusy(null);
      reloadHealth();
    }
  }
  async function stopLoop() {
    setBusy("stop");
    try {
      await api.stopLoop();
    } finally {
      setBusy(null);
      reloadHealth();
    }
  }
  async function runOnce() {
    setBusy("once");
    try {
      await api.runOnce();
    } finally {
      setBusy(null);
      reloadHealth();
    }
  }
  async function reviewProposal(p: Proposal, decision: "approve" | "reject") {
    setBusy(`p:${p.id}`);
    try {
      if (decision === "approve") await api.approveProposal(p.id);
      else await api.rejectProposal(p.id);
    } finally {
      setBusy(null);
    }
  }

  const loopRunning = !!health?.loop?.running;
  const liveEntries = liveCsv ? Object.entries(liveCsv) : [];
  const liveFresh = liveEntries.some(
    ([, v]) => v && (v as { exists?: boolean }).exists
  );

  return (
    <div className="px-[22px] pt-1 pb-[110px] grid gap-[14px]">
      <SectionTitle>SYSTEM HEALTH</SectionTitle>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        <ServiceCard
          label="TV CDP"
          title={health?.tv_cdp ? "ALIVE" : "DOWN"}
          detail=":9222"
          tone={health?.tv_cdp ? "mint" : "peach"}
        />
        <ServiceCard
          label="MT5 MCP"
          title={health?.mt5_mcp ? "ALIVE" : "DOWN"}
          detail=":18080"
          tone={health?.mt5_mcp ? "mint" : "peach"}
        />
        <ServiceCard
          label="LIVE.csv"
          title={liveFresh ? "FRESH" : "STALE"}
          detail={
            liveEntries.length > 0
              ? `${liveEntries.length} symbol${liveEntries.length === 1 ? "" : "s"}`
              : "unknown"
          }
          tone={liveFresh ? "lavender" : "peach"}
        />
        <ServiceCard
          label="LOOP"
          title={loopRunning ? "RUNNING" : "STOPPED"}
          detail={
            health?.loop?.pid ? `pid ${health.loop.pid}` : "cron 30 21 * * 1-5"
          }
          tone={loopRunning ? "yellow" : "peach"}
        />
      </div>

      <SectionTitle>LOOP CONTROLS</SectionTitle>
      <Card>
        <KV
          k="Status"
          v={
            <Pill tone={loopRunning ? "watch" : "ink"}>
              {loopRunning ? "RUNNING" : "STOPPED"}
            </Pill>
          }
        />
        {health?.loop?.started_at && (
          <KV k="Started" v={fmtRel(health.loop.started_at)} />
        )}
        {health?.loop?.pid && <KV k="PID" v={String(health.loop.pid)} />}
        <KV k="Last run" v={health?.last_run ? fmtRel(health.last_run) : "never"} last />
        <div className="flex gap-2 mt-3">
          {!loopRunning ? (
            <Button
              kind="mint"
              size="md"
              disabled={busy !== null}
              onClick={startLoop}
            >
              START LOOP
            </Button>
          ) : (
            <Button
              kind="peach"
              size="md"
              disabled={busy !== null}
              onClick={stopLoop}
            >
              STOP LOOP
            </Button>
          )}
          <Button
            kind="yellow"
            size="md"
            disabled={busy !== null}
            onClick={runOnce}
          >
            RUN ONCE
          </Button>
        </div>
      </Card>

      <SectionTitle>LIVE LOG</SectionTitle>
      <Card>
        <pre
          className="mono text-[10.5px] whitespace-pre-wrap m-0"
          style={{
            color: "var(--ink-2)",
            maxHeight: 280,
            overflow: "auto",
            wordBreak: "break-word",
            lineHeight: 1.55,
          }}
        >
          {loopLog?.log?.trim() || "no log output yet"}
        </pre>
        {loopLog?.total_lines ? (
          <div
            className="mt-2 mono text-[10px]"
            style={{ color: "var(--ink-3)" }}
          >
            tail {Math.min(400, loopLog.total_lines)} / {loopLog.total_lines}
          </div>
        ) : null}
      </Card>

      <SectionTitle>DATA</SectionTitle>
      <Card>
        {liveEntries.length === 0 ? (
          <div
            className="text-[12px] py-3"
            style={{ color: "var(--ink-3)" }}
          >
            LIVE.csv status unavailable
          </div>
        ) : (
          liveEntries.map(([symbol, v], i) => {
            const detail =
              v && (v as { exists?: boolean }).exists
                ? `${bytesToSize(
                    (v as { size_bytes: number }).size_bytes
                  )} · ${fmtRel((v as { modified: string }).modified)}`
                : "not found";
            return (
              <KV
                key={symbol}
                k={`${symbol.toUpperCase()} LIVE`}
                v={detail}
                last={i === liveEntries.length - 1}
              />
            );
          })
        )}
      </Card>

      <SectionTitle
        action={
          <span
            className="mono text-[11px]"
            style={{ color: "var(--ink-3)" }}
          >
            {proposals.length} total
          </span>
        }
      >
        REBUILD PROPOSALS
      </SectionTitle>
      {proposals.length === 0 ? (
        <Card>
          <div className="text-[13px]" style={{ color: "var(--ink-3)" }}>
            No rebuild proposals
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {proposals.map((p) => (
            <Card key={p.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="mono text-[12px] truncate">{p.id}</div>
                <Pill
                  tone={
                    p.status === "approved"
                      ? "clear"
                      : p.status === "rejected"
                      ? "breach"
                      : "watch"
                  }
                >
                  {p.status}
                </Pill>
              </div>
              <KV k="Created" v={fmtRel(p.created)} />
              <KV
                k="Files"
                v={`${p.files.length} (proposed: ${p.proposed_files.length})`}
              />
              {p.validation_report && (
                <KV
                  k="Report"
                  v={
                    <span className="text-[10px] truncate">
                      {p.validation_report.split("/").slice(-1)[0]}
                    </span>
                  }
                  last
                />
              )}
              {p.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <Button
                    kind="mint"
                    disabled={busy === `p:${p.id}`}
                    onClick={() => reviewProposal(p, "approve")}
                  >
                    APPROVE
                  </Button>
                  <Button
                    kind="peach"
                    disabled={busy === `p:${p.id}`}
                    onClick={() => reviewProposal(p, "reject")}
                  >
                    REJECT
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <SectionTitle>NOTIFICATIONS</SectionTitle>
      <Card>
        <Toggle label="Push on breach" defaultOn />
        <Toggle label="Push on remediation complete" defaultOn />
        <Toggle label="Daily summary digest" defaultOn />
        <Toggle label="Auto-apply tweaks" last />
      </Card>

      <SectionTitle>PROJECT</SectionTitle>
      <Card>
        <KV k="Name" v="EOD Strategy Monitor" />
        <KV k="Strategies" v="5 (NAS100 / US30)" />
        <KV k="Venues" v="TradingView · MT5" />
        <KV k="Schedule" v="cron 30 21 * * 1-5 (UTC)" last />
      </Card>
    </div>
  );
}
