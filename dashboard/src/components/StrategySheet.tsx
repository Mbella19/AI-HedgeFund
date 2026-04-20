import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button, Ic, Pill, type PillTone } from "./primitives";
import { Sparkline } from "./Sparkline";
import type { StrategyView } from "../lib/strategyView";

function statusTone(status: StrategyView["status"]): PillTone {
  if (status === "breach") return "breach";
  if (status === "watch") return "watch";
  if (status === "clear") return "clear";
  return "ink";
}

function Stat({
  label,
  value,
  sub,
  ok,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  ok: boolean;
}) {
  return (
    <div
      className="rounded-[14px]"
      style={{ background: "var(--surface)", padding: 14 }}
    >
      <div className="flex items-center justify-between">
        <div
          className="text-[10px] font-bold"
          style={{ color: "var(--ink-3)", letterSpacing: ".14em" }}
        >
          {label}
        </div>
        <span
          className="grid place-items-center rounded-full"
          style={{
            width: 14,
            height: 14,
            background: ok
              ? "rgba(184,232,200,.15)"
              : "rgba(232,146,124,.15)",
            color: ok ? "var(--mint)" : "var(--red)",
          }}
        >
          {Ic.dot(6)}
        </span>
      </div>
      <div className="mono text-[24px] font-bold tracking-[-0.02em] mt-2">
        {value}
      </div>
      <div
        className="mono text-[11px] mt-[2px]"
        style={{ color: "var(--ink-3)" }}
      >
        {sub}
      </div>
    </div>
  );
}

export function StrategySheet({
  s,
  onClose,
  onOpenEvent,
  onDrill,
}: {
  s: StrategyView | null;
  onClose: () => void;
  onOpenEvent?: () => void;
  onDrill?: () => void;
}) {
  useEffect(() => {
    if (!s) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, onClose]);

  if (!s) return null;

  const sparkColor =
    s.status === "breach"
      ? "var(--red)"
      : s.status === "watch"
      ? "var(--yellow)"
      : s.status === "idle"
      ? "var(--ink-3)"
      : "var(--mint)";
  const accent = s.status === "breach" ? "var(--red)" : "var(--peach)";

  const pf30 = s.pf30 ?? 0;
  const pfOk = pf30 >= 0.8;
  const ddOk = s.dd <= s.ddBase || s.ddBase === 0;
  const consecOk = s.consec <= s.consecBase || s.consecBase === 0;
  const retOk = s.retBase === 0 || s.ret30 >= s.retBase * 0.3;

  const rules: [string, boolean][] = [
    ["hard_max_dd", ddOk],
    ["hard_max_consec_loss", consecOk],
    ["soft_pf_30t", pfOk],
    ["soft_ret_30d_vs_avg", retOk],
  ];

  const breachCount = s.breaches.length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end justify-center anim-fade"
      style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(8px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full anim-slide-up"
        style={{
          maxWidth: 460,
          background: "var(--bg)",
          borderRadius: "28px 28px 0 0",
          padding: "14px 22px 26px",
          maxHeight: "86vh",
          overflowY: "auto",
        }}
      >
        <div
          className="mx-auto"
          style={{
            height: 5,
            width: 44,
            background: "var(--line)",
            borderRadius: 3,
            margin: "4px auto 18px",
          }}
        />

        <div className="flex items-start justify-between gap-[10px]">
          <div>
            <div
              className="text-[11px] font-bold"
              style={{ color: "var(--ink-3)", letterSpacing: ".14em" }}
            >
              {s.venue} · {s.symbol}
              {s.tf ? ` · ${s.tf}` : ""}
              {s.magic ? ` · M${s.magic}` : ""}
            </div>
            <div className="text-[24px] font-bold tracking-[-0.01em] mt-1">
              {s.name}
            </div>
          </div>
          <Pill tone={statusTone(s.status)}>{s.status}</Pill>
        </div>

        {s.status === "breach" && (
          <div
            className="mt-[14px] rounded-[14px] flex items-start gap-[10px] text-[13px]"
            style={{
              padding: "12px 14px",
              background: "var(--red-soft)",
              color: "var(--red)",
            }}
          >
            <div style={{ marginTop: 1 }}>{Ic.warn(16)}</div>
            <div>
              <div className="font-bold" style={{ color: "#f3c0b0" }}>
                {breachCount} breach rule{breachCount === 1 ? "" : "s"} fired
              </div>
              <div
                className="mono mt-[2px]"
                style={{ fontSize: 12, opacity: 0.85 }}
              >
                {s.breaches.join(" · ") || "—"}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4" style={{ color: accent }}>
          <Sparkline
            data={[...s.spark, ...s.spark.map((v) => v * 1.05)]}
            color={accent}
            height={80}
            width={400}
            dot={28}
          />
        </div>

        <div
          className="grid gap-[10px] mt-4"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          <Stat
            label="PROFIT FACTOR"
            value={pf30.toFixed(2)}
            sub={`base ${s.pfBase.toFixed(2)}`}
            ok={pfOk}
          />
          <Stat
            label="MAX DRAWDOWN"
            value={`${s.dd.toFixed(1)}%`}
            sub={`base ${s.ddBase.toFixed(1)}%`}
            ok={ddOk}
          />
          <Stat
            label="CONSEC LOSS"
            value={String(s.consec)}
            sub={`base ${s.consecBase}`}
            ok={consecOk}
          />
          <Stat
            label="30D RETURN"
            value={`${s.ret30 > 0 ? "+" : ""}${s.ret30.toFixed(1)}%`}
            sub={`base ${s.retBase.toFixed(1)}%`}
            ok={retOk}
          />
        </div>

        <div
          className="mt-[18px] text-[11px] font-bold"
          style={{ color: "var(--ink-3)", letterSpacing: ".14em" }}
        >
          BREACH RULES
        </div>
        <div className="mt-2 grid gap-2">
          {rules.map(([k, ok]) => (
            <div
              key={k}
              className="flex items-center justify-between rounded-[12px]"
              style={{
                padding: "10px 12px",
                background: "var(--surface)",
              }}
            >
              <div className="mono text-[12px]">{k}</div>
              <span style={{ color: ok ? "var(--mint)" : "var(--red)" }}>
                {ok ? Ic.check(16) : Ic.warn(16)}
              </span>
            </div>
          ))}
        </div>

        <div
          className="grid gap-[10px] mt-[18px]"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          <Button
            size="lg"
            kind="outline"
            onClick={onDrill}
            disabled={!onDrill}
          >
            RUN DRILL
          </Button>
          <Button size="lg" kind="yellow" onClick={onOpenEvent}>
            OPEN EVENT
          </Button>
        </div>

        <div
          className="mt-3 mono text-[11px]"
          style={{ color: "var(--ink-3)" }}
        >
          {s.trades} live trades since baseline end
        </div>
      </div>
    </div>
  );
}
