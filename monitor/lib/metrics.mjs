/**
 * Pure metric computation functions.
 * All operate on arrays of trade objects: { pnl: number, date: string }
 */

export function maxDrawdownPct(trades, initialCapital) {
  let equity = initialCapital;
  let peak = equity;
  let maxDd = 0;
  for (const t of trades) {
    equity += t.pnl;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd * 100;
}

export function maxConsecLosses(trades) {
  let max = 0;
  let cur = 0;
  for (const t of trades) {
    if (t.pnl < 0) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

export function profitFactor(trades) {
  let gross = 0;
  let loss = 0;
  for (const t of trades) {
    if (t.pnl > 0) gross += t.pnl;
    else loss += Math.abs(t.pnl);
  }
  return loss === 0 ? Infinity : gross / loss;
}

export function rollingProfitFactor(trades, window = 30) {
  if (trades.length < window) return null;
  return profitFactor(trades.slice(-window));
}

export function rollingReturn(trades, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recent = trades.filter((t) => t.date >= cutoffStr);
  return recent.reduce((s, t) => s + t.pnl, 0);
}

export function winRate(trades) {
  if (trades.length === 0) return 0;
  const wins = trades.filter((t) => t.pnl > 0).length;
  return (wins / trades.length) * 100;
}

export function netProfit(trades) {
  return trades.reduce((s, t) => s + t.pnl, 0);
}

export function checkBreaches(liveMetrics, baseline) {
  const breaches = [];

  if (liveMetrics.tradeCount < 5) return breaches;

  const baselineMaxDd =
    baseline.max_dd_c2c_pct ?? baseline.max_dd_pct ?? null;
  if (baselineMaxDd !== null && liveMetrics.maxDdPct > baselineMaxDd) {
    breaches.push({
      rule: "hard_max_dd",
      msg: `${liveMetrics.maxDdPct.toFixed(2)}% > ${baselineMaxDd.toFixed(2)}%`,
    });
  }

  if (
    baseline.max_consec_loss !== null &&
    liveMetrics.maxConsecLoss > baseline.max_consec_loss
  ) {
    breaches.push({
      rule: "hard_max_consec_loss",
      msg: `${liveMetrics.maxConsecLoss} > ${baseline.max_consec_loss}`,
    });
  }

  if (liveMetrics.pf30t !== null && liveMetrics.pf30t < 0.8) {
    breaches.push({
      rule: "soft_pf_30t",
      msg: `${liveMetrics.pf30t.toFixed(3)} < 0.80`,
    });
  }

  if (
    baseline.avg_daily_return !== null &&
    liveMetrics.ret30d !== null &&
    liveMetrics.tradeCount >= 10
  ) {
    const threshold = baseline.avg_daily_return * 30 * 0.3;
    if (liveMetrics.ret30d < threshold) {
      breaches.push({
        rule: "soft_ret_30d_vs_avg",
        msg: `${liveMetrics.ret30d.toFixed(2)} < ${threshold.toFixed(2)} (0.3× baseline avg×30)`,
      });
    }
  }

  return breaches;
}
