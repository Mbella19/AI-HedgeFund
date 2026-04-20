import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Ic } from "./primitives";

export type TabId = "home" | "trends" | "events" | "profile";

export const TABS: { id: TabId; to: string; label: string; icon: (s?: number) => JSX.Element }[] = [
  { id: "home", to: "/", label: "HOME", icon: Ic.home },
  { id: "trends", to: "/strategies", label: "TRENDS", icon: Ic.chart },
  { id: "events", to: "/events", label: "EVENTS", icon: Ic.events },
  { id: "profile", to: "/profile", label: "PROFILE", icon: Ic.user },
];

function activeFor(pathname: string): TabId {
  if (pathname.startsWith("/strategies")) return "trends";
  if (pathname.startsWith("/events")) return "events";
  if (pathname.startsWith("/profile") || pathname.startsWith("/settings"))
    return "profile";
  return "home";
}

/* ─── Bottom pill nav (mobile) ─────────────────────────────────────────── */
/**
 * Optional `above` slot renders inline above the pill inside the same sticky
 * stack — used on Home to pin the yellow RUN NOW bar directly above the tabs
 * so the dock's total height is measured as one unit and the RUN bar can't
 * land mid-content or overlap the tabs on phones with a tall gesture bar.
 */
export function Tabbar({
  pathname,
  above,
}: {
  pathname: string;
  above?: ReactNode;
}) {
  const nav = useNavigate();
  const active = activeFor(pathname);
  return (
    <div
      className="md:hidden sticky z-30 px-[14px]"
      style={{
        bottom: 0,
        paddingTop: above ? 14 : 24,
        paddingBottom: "max(env(safe-area-inset-bottom), 14px)",
        background: "linear-gradient(to top, var(--bg) 72%, transparent)",
      }}
    >
      {above && <div style={{ marginBottom: 10 }}>{above}</div>}
      <div
        className="grid gap-1 p-[6px] rounded-[28px]"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          background: "var(--surface)",
          boxShadow: "0 20px 60px rgba(0,0,0,.4)",
        }}
      >
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => nav(t.to)}
              className={clsx(
                "rounded-[22px] font-bold inline-flex items-center justify-center transition-all"
              )}
              style={{
                padding: "10px 6px",
                background: isActive ? "var(--peach)" : "transparent",
                color: isActive ? "var(--peach-ink)" : "var(--ink-3)",
                flexDirection: isActive ? "row" : "column",
                gap: isActive ? 8 : 4,
                letterSpacing: ".06em",
              }}
            >
              {t.icon(isActive ? 16 : 18)}
              <span style={{ fontSize: isActive ? 12 : 10 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Desktop side rail ────────────────────────────────────────────────── */
export function SideNav({
  pathname,
  onRunNow,
  nextRunLabel,
}: {
  pathname: string;
  onRunNow?: () => void;
  nextRunLabel?: string;
}) {
  const active = activeFor(pathname);
  return (
    <aside
      className="hidden md:flex flex-col shrink-0 sticky top-0 h-screen"
      style={{
        width: 240,
        padding: 22,
        borderRight: "1px solid var(--line)",
        gap: 22,
      }}
    >
      <div className="flex items-center gap-[10px]">
        <div
          className="rounded-full grid place-items-center mono font-extrabold"
          style={{
            width: 36,
            height: 36,
            background: "var(--peach)",
            color: "var(--peach-ink)",
          }}
        >
          EM
        </div>
        <div>
          <div
            className="text-[10px] font-bold"
            style={{ color: "var(--ink-3)", letterSpacing: ".14em" }}
          >
            EOD MONITOR
          </div>
          <div className="font-bold">Quant Desk</div>
        </div>
      </div>

      <nav className="grid gap-1">
        {TABS.map((t) => {
          const label =
            t.id === "trends"
              ? "Strategies"
              : t.id === "profile"
              ? "System"
              : t.label.charAt(0) + t.label.slice(1).toLowerCase();
          return (
            <NavLink
              key={t.id}
              to={t.to}
              className="flex items-center gap-3 px-3 py-[10px] rounded-[12px] text-[14px] font-semibold no-underline"
              style={{
                background:
                  active === t.id ? "var(--surface)" : "transparent",
                color: active === t.id ? "var(--ink)" : "var(--ink-3)",
              }}
            >
              {t.icon(16)} {label}
            </NavLink>
          );
        })}
      </nav>

      <div
        className="mt-auto rounded-[18px]"
        style={{ background: "var(--surface)", padding: 14 }}
      >
        <div
          className="text-[11px] font-bold"
          style={{ color: "var(--ink-3)", letterSpacing: ".12em" }}
        >
          NEXT RUN
        </div>
        <div className="mono text-[22px] font-bold mt-[6px]">
          {nextRunLabel ?? "17:30 NY"}
        </div>
        <button
          onClick={onRunNow}
          className="mt-[10px] w-full font-bold"
          style={{
            background: "var(--yellow)",
            color: "var(--yellow-ink)",
            borderRadius: 12,
            padding: 10,
            letterSpacing: ".06em",
          }}
        >
          RUN NOW
        </button>
      </div>
    </aside>
  );
}
