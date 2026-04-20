import { Ic } from "./primitives";

export function RunBar({
  label = "NEXT EOD RUN",
  value,
  sub,
  cta = "RUN NOW",
  onRun,
  disabled,
}: {
  label?: string;
  value: string;
  sub?: string;
  cta?: string;
  onRun?: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-[22px] w-full"
      style={{
        background: "var(--yellow)",
        color: "var(--yellow-ink)",
        padding: "12px 16px",
        boxShadow: "0 16px 40px rgba(240,211,58,.15)",
      }}
    >
      <div>
        <div
          className="text-[11px] font-bold"
          style={{ letterSpacing: ".14em", opacity: 0.7 }}
        >
          {label}
        </div>
        <div className="text-[16px] font-extrabold mt-[2px]">
          {value}
          {sub && <span className="font-medium opacity-75"> · {sub}</span>}
        </div>
      </div>
      <button
        onClick={onRun}
        disabled={disabled}
        className="inline-flex items-center gap-[6px] rounded-[14px] font-bold"
        style={{
          background: "var(--yellow-ink)",
          color: "var(--yellow)",
          padding: "10px 14px",
          fontSize: 12,
          letterSpacing: ".08em",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {cta} {Ic.arrow(12)}
      </button>
    </div>
  );
}
