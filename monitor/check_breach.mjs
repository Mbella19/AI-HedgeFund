#!/usr/bin/env node
/**
 * Compare live metrics (state.json) vs baselines (baselines.json).
 * Applies 4 breach rules per strategy, annotates state.json with results,
 * and archives to history/.
 *
 * Usage:
 *   node monitor/check_breach.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { checkBreaches } from "./lib/metrics.mjs";
import { loadEnv } from "./lib/env.mjs";
import { notifyBreach } from "./lib/discord.mjs";

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, "state.json");
const BASELINES_PATH = resolve(__dirname, "baselines.json");
const HISTORY_DIR = resolve(__dirname, "history");

async function main() {
  if (!existsSync(STATE_PATH)) {
    console.error("No state.json found. Run collect_live.mjs first.");
    process.exit(1);
  }

  const state = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
  const baselines = JSON.parse(readFileSync(BASELINES_PATH, "utf-8"));

  let totalBreaches = 0;

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║            EOD STRATEGY BREACH CHECK                     ║");
  console.log(`║  ${state.timestamp}                         ║`);
  console.log("╠═══════════════════════════════════════════════════════════╣");

  for (const [sid, live] of Object.entries(state.strategies)) {
    const baseline = baselines[sid];
    if (!baseline) {
      console.log(`║  ${sid}: NO BASELINE — skipped`);
      continue;
    }
    if (live.error) {
      console.log(`║  ${sid}: ERROR — ${live.error}`);
      continue;
    }

    const metrics = live.metrics;
    if (!metrics) {
      console.log(`║  ${sid}: no metrics`);
      continue;
    }

    const breaches = checkBreaches(metrics, baseline);
    live.breaches = breaches;

    if (breaches.length === 0) {
      console.log(`║  ✓ ${sid} — OK (${metrics.tradeCount} trades)`);
    } else {
      totalBreaches += breaches.length;
      console.log(`║  ✗ ${sid} — ${breaches.length} BREACH(ES):`);
      for (const b of breaches) {
        console.log(`║      ${b.rule}: ${b.msg}`);
      }
    }
  }

  console.log("╠═══════════════════════════════════════════════════════════╣");
  if (totalBreaches === 0) {
    console.log("║  ALL CLEAR — no breaches detected                       ║");
  } else {
    console.log(
      `║  ${totalBreaches} BREACH(ES) across strategies — action required  ║`
    );
  }
  console.log("╚═══════════════════════════════════════════════════════════╝");

  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

  mkdirSync(HISTORY_DIR, { recursive: true });
  const dateStr = new Date().toISOString().slice(0, 10);
  const archivePath = resolve(HISTORY_DIR, `${dateStr}-state.json`);
  writeFileSync(archivePath, JSON.stringify(state, null, 2));
  console.log(`\nArchived to ${archivePath}`);

  const breachedStrategies = Object.entries(state.strategies)
    .filter(([, s]) => s.breaches?.length > 0)
    .map(([sid]) => sid);

  if (breachedStrategies.length > 0) {
    console.log("\nBreached strategies requiring diagnosis:");
    for (const sid of breachedStrategies) {
      console.log(`  - ${sid}`);
    }
  }

  const summary = {
    date: dateStr,
    total_strategies: Object.keys(state.strategies).length,
    total_breaches: totalBreaches,
    breached: breachedStrategies,
    clean: Object.entries(state.strategies)
      .filter(([, s]) => s.breaches?.length === 0 && !s.error)
      .map(([sid]) => sid),
    errors: Object.entries(state.strategies)
      .filter(([, s]) => s.error)
      .map(([sid]) => sid),
  };

  const logPath = resolve(HISTORY_DIR, "daily_log.md");
  const logEntry = `\n## ${dateStr}\n- Breaches: ${totalBreaches}\n- Breached: ${breachedStrategies.join(", ") || "none"}\n- Clean: ${summary.clean.join(", ") || "none"}\n- Errors: ${summary.errors.join(", ") || "none"}\n`;

  let existing = "";
  if (existsSync(logPath)) {
    existing = readFileSync(logPath, "utf-8");
  } else {
    existing = "# Daily Strategy Monitor Log\n";
  }
  writeFileSync(logPath, existing + logEntry);

  // ─── Discord notification on any breach ───
  if (totalBreaches > 0) {
    const breachedPayload = breachedStrategies.map((sid) => ({
      id: sid,
      breaches: state.strategies[sid].breaches || [],
    }));
    try {
      await notifyBreach({
        dateStr,
        totalStrategies: Object.keys(state.strategies).length,
        totalBreaches,
        breached: breachedPayload,
      });
    } catch (err) {
      console.error(`[discord] notification failed: ${err?.message || err}`);
    }
  }

  process.exit(totalBreaches > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
