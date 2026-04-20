import { Ic, Pill } from "./primitives";

export function TwinCards({
  lastRun,
  stageStates,
  stageLabel,
  pendingCount,
  queueDetail,
  onOpenEvents,
}: {
  lastRun: string;
  stageStates: ("done" | "pending" | "idle")[];
  stageLabel: string;
  pendingCount: number;
  queueDetail: string;
  onOpenEvents?: () => void;
}) {
  const runOk = stageStates.every((s) => s === "done");
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
      {/* Last Run */}
      <div
        className="rounded-[24px]"
        style={{
          background: "var(--lavender)",
          color: "var(--lavender-ink)",
          padding: "18px 18px 16px",
        }}
      >
        <div className="flex items-center justify-between">
          <div
            className="w-9 h-9 rounded-full grid place-items-center"
            style={{
              background: "rgba(0,0,0,.12)",
              color: "var(--lavender-ink)",
            }}
          >
            {Ic.shield(16)}
          </div>
          <Pill
            tone="lavender"
            style={{
              background: "rgba(0,0,0,.12)",
              color: "var(--lavender-ink)",
            }}
          >
            {runOk ? "OK" : "RUNNING"}
          </Pill>
        </div>
        <div
          className="text-[11px] font-bold mt-[14px]"
          style={{ letterSpacing: ".14em", opacity: 0.65 }}
        >
          LAST RUN
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="mono text-[36px] font-extrabold tracking-[-0.02em]">
            {lastRun}
          </span>
        </div>
        <div className="flex gap-1 mt-[14px]">
          {stageStates.map((s, i) => (
            <div
              key={i}
              className="rounded-md"
              style={{
                flex: 1,
                height: 24,
                background:
                  s === "done"
                    ? "rgba(0,0,0,.55)"
                    : s === "pending"
                    ? "rgba(0,0,0,.25)"
                    : "rgba(0,0,0,.08)",
              }}
            />
          ))}
        </div>
        <div className="mt-[10px] text-[12px]" style={{ opacity: 0.7 }}>
          {stageLabel}
        </div>
      </div>

      {/* Remediation Queue */}
      <button
        onClick={onOpenEvents}
        className="rounded-[24px] text-left"
        style={{
          background: "var(--mint)",
          color: "var(--mint-ink)",
          padding: "18px 18px 16px",
          cursor: "pointer",
        }}
      >
        <div className="flex items-center justify-between">
          <div
            className="w-9 h-9 rounded-full grid place-items-center"
            style={{ background: "rgba(0,0,0,.18)", color: "var(--mint)" }}
          >
            {Ic.bolt(16)}
          </div>
          <Pill
            tone="mint"
            style={{ background: "rgba(0,0,0,.18)", color: "var(--mint)" }}
          >
            QUEUE
          </Pill>
        </div>
        <div
          className="text-[11px] font-bold mt-[14px]"
          style={{ letterSpacing: ".14em", opacity: 0.65 }}
        >
          REMEDIATION
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="mono text-[36px] font-extrabold tracking-[-0.02em]">
            {pendingCount}
          </span>
          <span className="text-[14px]" style={{ opacity: 0.6 }}>
            open
          </span>
        </div>
        <div className="flex items-center gap-[6px] mt-[14px] text-[12px]">
          <span
            className="rounded-full"
            style={{ width: 8, height: 8, background: "var(--mint-ink)" }}
          />
          <span style={{ opacity: 0.8 }}>{queueDetail}</span>
        </div>
        <div
          className="mt-[10px] text-[12px] font-semibold inline-flex items-center gap-[6px]"
          style={{ opacity: 0.85 }}
        >
          REVIEW {Ic.arrow(12)}
        </div>
      </button>
    </div>
  );
}
