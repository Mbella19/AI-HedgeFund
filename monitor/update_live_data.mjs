#!/usr/bin/env node
/**
 * Nightly M1 OHLCV data update.
 *
 * Pulls recent bars from MT5 MCP and appends them to `{SYMBOL} LIVE.csv`
 * next to the frozen training CSVs, so the gap between the training data
 * and "now" stays under 24 hours. Python backtesters concatenate TRAINING
 * + LIVE at load time.
 *
 * Usage:
 *   node monitor/update_live_data.mjs
 *   node monitor/update_live_data.mjs --count=20000   # initial bootstrap
 *
 * Environment:
 *   DATA_DIR  — directory holding the training + live CSVs
 *               default: <repo-root>/Data
 */

import {
  existsSync,
  appendFileSync,
  writeFileSync,
} from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mt5Init, getCandles } from "./lib/mt5_rpc.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || resolve(REPO_ROOT, "Data");

const SYMBOLS = [
  { symbol: "US30", training: "US30 TRAINING.csv", live: "US30 LIVE.csv" },
  {
    symbol: "NAS100",
    training: "NAS100 TRAINING.csv",
    live: "NAS100 LIVE.csv",
  },
];

const TIMEFRAME = "M1";
const HEADER =
  "<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>";

const countArg = process.argv.find((a) => a.startsWith("--count="));
const INITIAL_COUNT = countArg ? parseInt(countArg.split("=")[1], 10) : 5000;
const MAX_COUNT = 80000; // ~55 trading days of M1, upper cap for a single run
const MAX_RETRIES = 5;

async function main() {
  console.log(`=== Live data update — ${new Date().toISOString()} ===`);
  console.log(`Data dir: ${DATA_DIR}`);
  console.log(`Initial count per symbol: ${INITIAL_COUNT} (auto-doubles up to ${MAX_COUNT} to cover gaps)`);

  try {
    await mt5Init();
    console.log("MT5 MCP connected");
  } catch (err) {
    console.error(`MT5 MCP not reachable: ${err.message}`);
    console.error("Skipping live data update — monitor will proceed.");
    process.exit(0);
  }

  for (const cfg of SYMBOLS) {
    try {
      await updateSymbol(cfg);
    } catch (err) {
      console.error(`ERROR ${cfg.symbol}: ${err.message}`);
    }
  }
}

async function updateSymbol({ symbol, training, live }) {
  const livePath = resolve(DATA_DIR, live);
  const trainPath = resolve(DATA_DIR, training);

  let lastTs = null;
  if (existsSync(livePath)) {
    lastTs = lastTimestamp(livePath);
    if (!lastTs && existsSync(trainPath)) {
      lastTs = lastTimestamp(trainPath);
      console.log(`${symbol}: LIVE empty — seeding from TRAINING end = ${lastTs}`);
    } else {
      console.log(`${symbol}: LIVE last = ${lastTs ?? "(empty)"}`);
    }
  } else if (existsSync(trainPath)) {
    lastTs = lastTimestamp(trainPath);
    console.log(`${symbol}: LIVE missing — seeding from TRAINING end = ${lastTs}`);
    writeFileSync(livePath, HEADER + "\n");
  } else {
    console.log(`${symbol}: no TRAINING or LIVE csv in ${DATA_DIR}, skipping`);
    return;
  }

  // Iterative pull — double the count until the oldest returned bar
  // overlaps with lastTs (i.e., the gap is fully covered), or we hit MAX_COUNT.
  let pullCount = INITIAL_COUNT;
  let raw = [];
  let oldestReturned = null;
  let covered = false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`${symbol}: pull attempt ${attempt} — requesting ${pullCount} M1 bars`);
    raw = await getCandles(symbol, TIMEFRAME, pullCount);
    if (!Array.isArray(raw) || raw.length === 0) {
      console.log(`${symbol}: MT5 returned no candles`);
      return;
    }
    console.log(`${symbol}: received ${raw.length} candles`);

    oldestReturned = null;
    for (const c of raw) {
      const ts = candleTimestamp(c);
      if (!ts) continue;
      if (!oldestReturned || ts < oldestReturned) oldestReturned = ts;
    }

    if (!lastTs || !oldestReturned || oldestReturned <= lastTs) {
      covered = true;
      break;
    }

    // Gap not covered. If we got fewer bars than requested, the broker is
    // capped — no point retrying with a bigger number.
    if (raw.length < pullCount * 0.9) {
      console.warn(
        `${symbol}: broker capped at ${raw.length} bars (asked for ${pullCount}); stopping`
      );
      break;
    }

    if (pullCount >= MAX_COUNT) {
      console.warn(`${symbol}: reached MAX_COUNT=${MAX_COUNT}, stopping`);
      break;
    }

    pullCount = Math.min(pullCount * 2, MAX_COUNT);
    console.log(
      `${symbol}: gap not covered (oldest=${oldestReturned} > last=${lastTs}), retrying with ${pullCount} bars`
    );
  }

  if (lastTs && oldestReturned && oldestReturned > lastTs && !covered) {
    console.warn(
      `${symbol}: WARNING — unfilled gap from ${lastTs} to ${oldestReturned}. ` +
        `Run 'npm run update-data:bootstrap' or re-export the training CSV.`
    );
  }

  const newRows = [];
  for (const c of raw) {
    const ts = candleTimestamp(c);
    if (!ts) continue;
    if (lastTs && ts <= lastTs) continue;
    newRows.push([ts, formatRow(c, ts)]);
  }

  if (newRows.length === 0) {
    console.log(`${symbol}: nothing new — already up to date`);
    return;
  }

  newRows.sort((a, b) => a[0].localeCompare(b[0]));
  const payload = newRows.map((r) => r[1]).join("\n") + "\n";
  appendFileSync(livePath, payload);
  console.log(
    `${symbol}: appended ${newRows.length} bars to ${live} (new last = ${newRows[newRows.length - 1][0]})`
  );
}

function lastTimestamp(path) {
  try {
    const line = execSync(`tail -n 1 "${path}"`, {
      encoding: "utf-8",
    }).trim();
    if (!line || line.startsWith("<")) return null;
    const parts = line.split(/[\t,]/);
    if (parts.length < 2) return null;
    return `${parts[0]} ${parts[1]}`;
  } catch {
    return null;
  }
}

function candleTimestamp(c) {
  const raw =
    c.time ?? c.Time ?? c.datetime ?? c.Datetime ?? c.date ?? c.Date;
  if (raw === undefined || raw === null) return null;

  if (typeof raw === "number") {
    const d = new Date(raw > 1e12 ? raw : raw * 1000);
    if (isNaN(d)) return null;
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(
      d.getUTCDate()
    )} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
  }

  const s = String(raw).trim();
  if (/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
  const m = s.match(
    /^(\d{4})[-.](\d{2})[-.](\d{2})[T ](\d{2}):(\d{2}):(\d{2})/
  );
  if (m) return `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
  return null;
}

function formatRow(c, ts) {
  const [date, time] = ts.split(" ");
  const get = (...keys) => {
    for (const k of keys) if (c[k] !== undefined && c[k] !== null) return c[k];
    return "";
  };
  const open = get("open", "Open", "O");
  const high = get("high", "High", "H");
  const low = get("low", "Low", "L");
  const close = get("close", "Close", "C");
  const tickvol = get("tick_volume", "tickvol", "TickVolume") || 0;
  const vol = get("real_volume", "volume", "Volume") || 0;
  const spread = get("spread", "Spread") || 0;
  return `${date}\t${time}\t${open}\t${high}\t${low}\t${close}\t${tickvol}\t${vol}\t${spread}`;
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
