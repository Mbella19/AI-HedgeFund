#!/usr/bin/env node
/**
 * Collect live performance metrics from TradingView (CDP) and MetaTrader 5 (MCP).
 * Reads strategies.json + baselines.json, computes live-period metrics,
 * writes state.json.
 *
 * Usage:
 *   node monitor/collect_live.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  maxDrawdownPct,
  maxConsecLosses,
  profitFactor,
  rollingProfitFactor,
  rollingReturn,
} from "./lib/metrics.mjs";
import { mt5Init, getDeals } from "./lib/mt5_rpc.mjs";
import { connectCDP, cdpEval, closeCDP } from "./lib/cdp.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const STRATEGIES = JSON.parse(
  readFileSync(resolve(__dirname, "config", "strategies.json"), "utf-8")
).strategies;
const BASELINES = JSON.parse(
  readFileSync(resolve(__dirname, "baselines.json"), "utf-8")
);

const DRY_RUN = process.argv.includes("--dry-run");
const STATE_PATH = resolve(__dirname, "state.json");

async function main() {
  const state = {
    timestamp: new Date().toISOString(),
    strategies: {},
  };

  let mt5Ready = false;
  let cdpReady = false;

  for (const strat of STRATEGIES) {
    const baseline = BASELINES[strat.id];
    if (!baseline) {
      console.log(`SKIP ${strat.id}: no baseline`);
      continue;
    }

    try {
      let trades;
      const useBridge = strat.venue === "tradingview" && strat.mt5_bridge_magic;
      if (strat.venue === "mt5" || useBridge) {
        if (!mt5Ready) {
          await mt5Init();
          mt5Ready = true;
          console.log("MT5 MCP connected");
        }
        trades = await collectMT5Trades(
          useBridge
            ? {
                ...strat,
                symbol: strat.mt5_symbol || strat.symbol,
                magic: strat.mt5_bridge_magic,
              }
            : strat,
          baseline
        );
      } else {
        if (!cdpReady) {
          await connectCDP();
          cdpReady = true;
          console.log("TradingView CDP connected");
        }
        trades = await collectTVTrades(strat, baseline);
      }

      const initial = baseline.initial_capital || 100000;
      const metrics = computeMetrics(trades, initial);
      state.strategies[strat.id] = {
        venue: strat.venue,
        symbol: strat.symbol,
        live_trades: trades.length,
        metrics,
      };

      console.log(
        `${strat.id}: ${trades.length} live trades | DD=${metrics.maxDdPct.toFixed(2)}% | ConsecL=${metrics.maxConsecLoss} | PF30t=${metrics.pf30t?.toFixed(3) ?? "N/A"} | Ret30d=${metrics.ret30d?.toFixed(2) ?? "N/A"}`
      );
    } catch (err) {
      console.error(`ERROR ${strat.id}: ${err.message}`);
      state.strategies[strat.id] = {
        venue: strat.venue,
        symbol: strat.symbol,
        error: err.message,
      };
    }
  }

  if (!DRY_RUN) {
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    console.log(`\nState written to ${STATE_PATH}`);
  } else {
    console.log("\n[DRY RUN] No state file written.");
  }

  await closeCDP();
}

async function collectMT5Trades(strat, baseline) {
  const fromDate = baseline.backtest_range?.end;
  if (!fromDate) throw new Error("No baseline end date");
  const today = new Date().toISOString().slice(0, 10);
  const raw = await getDeals(fromDate, today, strat.symbol);

  const magic = strat.magic;
  const filtered = raw.filter((d) => {
    if (magic !== null) {
      const dealMagic = parseInt(d.magic || d.Magic || d.MAGIC || "0", 10);
      if (dealMagic !== magic) return false;
    }
    const type = String(d.type ?? d.Type ?? "").toLowerCase();
    return type === "0" || type === "1" || type === "buy" || type === "sell";
  });

  return pairDealsToTrades(filtered);
}

function pairDealsToTrades(deals) {
  const trades = [];
  for (const d of deals) {
    const entryFlag = String(d.entry || d.Entry || "");
    const profit = parseFloat(d.profit || d.Profit || 0);
    const commission = parseFloat(d.commission || d.Commission || 0);
    const swap = parseFloat(d.swap || d.Swap || 0);
    const fee = parseFloat(d.fee || d.Fee || 0);
    const time = d.time || d.Time || "";

    // MT5 entry field: "0" = entry (in), "1" = exit (out)
    if (entryFlag === "1" || entryFlag === "out" || entryFlag === "exit") {
      const pnl = profit + commission + swap + fee;
      const date = time.slice(0, 10);
      trades.push({ pnl, date, time });
    }
  }
  return trades;
}

async function collectTVTrades(strat, baseline) {
  const fromDate = baseline.backtest_range?.end;
  if (!fromDate) throw new Error("No baseline end date");

  const tradeData = await cdpEval(`
    (function() {
      try {
        var chart = window.TradingViewApi._activeChartWidgetWV.value()._chartWidget;
        var sources = chart.model().model().dataSources();
        for (var si = 0; si < sources.length; si++) {
          var s = sources[si];
          if (!s.metaInfo) continue;
          var meta = s.metaInfo();
          var name = meta.description || meta.shortDescription || '';
          if (name.indexOf('${strat.pine_strategy_name?.replace(/'/g, "\\'")}') === -1) continue;
          if (typeof s.ordersData !== 'function') continue;
          var orders = s.ordersData();
          if (!orders || !Array.isArray(orders)) return [];
          return orders.map(function(o) {
            return { b: o.b, c: o.c || '', id: o.id || '', p: o.p, q: o.q, tm: o.tm };
          });
        }
      } catch(e) { return {error: e.message}; }
      return null;
    })()
  `);

  if (!tradeData || tradeData.error) {
    throw new Error(
      `Could not read TV strategy "${strat.pine_strategy_name}": ${tradeData?.error || "strategy not found on chart"}`
    );
  }

  const trades = [];
  for (let i = 0; i < tradeData.length; i += 2) {
    if (i + 1 >= tradeData.length) break;
    const entry = tradeData[i];
    const exit = tradeData[i + 1];
    const isLong = entry.b;
    const pnl = isLong
      ? (exit.p - entry.p) * entry.q
      : (entry.p - exit.p) * entry.q;
    trades.push({ pnl, date: "", time: "" });
  }

  const baselineTradeCount = baseline.total_trades || 0;
  if (baselineTradeCount > 0 && trades.length > baselineTradeCount) {
    return trades.slice(baselineTradeCount);
  }
  return [];
}

function computeMetrics(trades, initialCapital) {
  return {
    maxDdPct: trades.length > 0 ? maxDrawdownPct(trades, initialCapital) : 0,
    maxConsecLoss: maxConsecLosses(trades),
    pf30t: rollingProfitFactor(trades, 30),
    ret30d: rollingReturn(trades, 30),
    totalPnl:
      trades.length > 0 ? trades.reduce((s, t) => s + t.pnl, 0) : 0,
    tradeCount: trades.length,
  };
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
