import type { ReactNode } from "react";

export type ServiceTone = "mint" | "lavender" | "peach" | "yellow";

export function ServiceCard({
  label,
  detail,
  title,
  tone = "mint",
  onClick,
}: {
  label: string;
  detail: ReactNode;
  title: string;
  tone?: ServiceTone;
  onClick?: () => void;
}) {
  const map: Record<ServiceTone, { bg: string; fg: string }> = {
    mint: { bg: "var(--mint)", fg: "var(--mint-ink)" },
    lavender: { bg: "var(--lavender)", fg: "var(--lavender-ink)" },
    peach: { bg: "var(--peach)", fg: "var(--peach-ink)" },
    yellow: { bg: "var(--yellow)", fg: "var(--yellow-ink)" },
  };
  const c = map[tone];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="rounded-[20px] text-left w-full"
      style={{
        background: c.bg,
        color: c.fg,
        padding: 16,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div className="flex justify-between items-center">
        <div
          className="text-[11px] font-bold"
          style={{ letterSpacing: ".14em", opacity: 0.7 }}
        >
          {label}
        </div>
        <span
          className="rounded-full"
          style={{
            width: 8,
            height: 8,
            background: "currentColor",
            opacity: 0.55,
          }}
        />
      </div>
      <div className="text-[22px] font-extrabold mt-[10px] tracking-[-0.01em]">
        {title}
      </div>
      <div
        className="mono text-[11px] mt-1"
        style={{ opacity: 0.75 }}
      >
        {detail}
      </div>
    </Tag>
  );
}
