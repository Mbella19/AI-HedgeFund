import { useId } from "react";

export function Sparkline({
  data,
  color = "currentColor",
  height = 60,
  width = 280,
  dot,
  strokeWidth = 2,
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  dot?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const gradId = useId();
  if (!data || data.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        className={className}
      >
        <line
          x1="0"
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="var(--line)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
      </svg>
    );
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map(
    (v, i) =>
      [i * stepX, height - ((v - min) / range) * (height - 4) - 2] as const
  );
  const path = pts
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  const dotIdx = dot ?? Math.floor(data.length * 0.78);
  const showDot = dot != null;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={path}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <>
          <circle
            cx={pts[dotIdx][0]}
            cy={pts[dotIdx][1]}
            r="6"
            fill={color}
            opacity="0.25"
          />
          <circle
            cx={pts[dotIdx][0]}
            cy={pts[dotIdx][1]}
            r="3"
            fill={color}
          />
        </>
      )}
    </svg>
  );
}

export function MiniSpark({
  data,
  color,
  status,
}: {
  data: number[];
  color?: string;
  status?: "breach" | "watch" | "clear" | "idle";
}) {
  const c =
    color ??
    (status === "breach"
      ? "var(--red)"
      : status === "watch"
      ? "var(--yellow)"
      : status === "idle"
      ? "var(--ink-3)"
      : "var(--mint)");
  return <Sparkline data={data} color={c} height={28} width={80} />;
}

/** Keeps backwards-compatible export so pages that still reference it compile. */
export function EquityCurve({
  data,
  height = 80,
  stroke = "currentColor",
  className,
}: {
  data: number[];
  height?: number;
  stroke?: string;
  className?: string;
}) {
  return (
    <Sparkline
      data={data}
      color={stroke}
      height={height}
      width={400}
      dot={Math.floor((data.length || 1) * 0.78)}
      className={className}
    />
  );
}
