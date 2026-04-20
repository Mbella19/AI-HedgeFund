import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, Pill, SectionTitle } from "../components/primitives";
import { StrategyList } from "../components/StrategyList";
import {
  openStrategySheet,
  useStrategyViews,
} from "../components/AppShell";
import type { StrategyView } from "../lib/strategyView";

const RULE_DESC: Record<string, string> = {
  hard_max_dd: "Live DD > baseline DD",
  hard_max_consec_loss: "Streak > baseline streak",
  soft_pf_30t: "PF on last 30 trades < 0.80",
  soft_ret_30d_vs_avg: "30d ret < 0.3× baseline avg",
};

function countFired(views: StrategyView[], rule: string): number {
  return views.filter((v) => v.breaches.includes(rule)).length;
}

export default function Strategies() {
  const views = useStrategyViews();
  const { id } = useParams();

  useEffect(() => {
    if (id) openStrategySheet(id);
  }, [id]);

  const total = views.length;

  return (
    <div className="px-[22px] pt-1 pb-[110px] grid gap-[14px]">
      <SectionTitle>STRATEGIES</SectionTitle>
      <StrategyList
        views={views}
        onOpen={(s) => openStrategySheet(s.id)}
      />

      <SectionTitle>BREACH RULE SUMMARY</SectionTitle>
      <Card>
        {Object.entries(RULE_DESC).map(([k, desc], i) => {
          const fired = countFired(views, k);
          return (
            <div
              key={k}
              className="grid items-center"
              style={{
                gridTemplateColumns: "1fr auto",
                padding: "12px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
              }}
            >
              <div>
                <div className="mono text-[12px]">{k}</div>
                <div
                  className="text-[12px] mt-[2px]"
                  style={{ color: "var(--ink-3)" }}
                >
                  {desc}
                </div>
              </div>
              <Pill tone={fired ? "breach" : "clear"}>
                {fired}/{total} fired
              </Pill>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
