/**
 * Discord webhook notifier for breach alerts.
 *
 * Posts a rich embed to the URL in DISCORD_WEBHOOK_URL. If the env var is
 * not set, the function logs a one-liner and returns silently — breach
 * checking is never blocked by notification failures.
 *
 * To set up:
 *   1. In your Discord server: Server Settings → Integrations → Webhooks
 *      → New Webhook → copy the URL.
 *   2. Add to .env:  DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
 */

const COLOR_RED = 0xef4444; // hard breach
const COLOR_AMBER = 0xf59e0b; // soft breach
const COLOR_GREEN = 0x10b981; // all clear

function prettyStrategyName(id) {
  const map = {
    us30_orb_tv: "US30 ORB Reversal",
    s2_momentum_burst_mt5: "S2 Momentum Burst",
    regime_switch_mt5: "Regime Switch Reclaim",
    rast_v20_mt5: "RAST V20",
    us30_vwap_mt5: "US30 VWAP",
  };
  return map[id] ?? id;
}

function ruleLabel(rule) {
  const map = {
    hard_max_dd: "Hard · Max DD",
    hard_max_consec_loss: "Hard · Max consec loss",
    soft_pf_30t: "Soft · PF (last 30 trades)",
    soft_ret_30d_vs_avg: "Soft · 30-day return vs baseline",
  };
  return map[rule] ?? rule;
}

/**
 * @param {object} params
 * @param {string} params.dateStr   e.g. "2026-04-12"
 * @param {number} params.totalStrategies
 * @param {number} params.totalBreaches
 * @param {Array<{id: string, breaches: Array<{rule: string, msg: string}>}>} params.breached
 */
export async function notifyBreach({
  dateStr,
  totalStrategies,
  totalBreaches,
  breached,
  newSigs = [],
  clearedSigs = [],
}) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    console.log(
      "[discord] DISCORD_WEBHOOK_URL not set — skipping breach notification"
    );
    return { sent: false, reason: "no_webhook" };
  }

  // Classify: any hard_* rule → red, otherwise amber.
  const anyHard = breached.some((b) =>
    (b.breaches || []).some((r) => r.rule?.startsWith("hard_"))
  );
  const color = anyHard ? COLOR_RED : COLOR_AMBER;

  const fields = breached.slice(0, 10).map((b) => ({
    name: prettyStrategyName(b.id),
    value:
      (b.breaches || [])
        .map((r) => `• **${ruleLabel(r.rule)}** — ${r.msg}`)
        .join("\n") || "(no details)",
    inline: false,
  }));

  const deltaParts = [];
  if (newSigs.length > 0) deltaParts.push(`🆕 ${newSigs.length} new`);
  if (clearedSigs.length > 0) deltaParts.push(`✅ ${clearedSigs.length} cleared`);
  const deltaLine = deltaParts.length > 0 ? `\n_${deltaParts.join(" · ")}_` : "";

  const embed = {
    title: `EOD breach · ${dateStr}`,
    description: `**${totalBreaches}** rule${totalBreaches === 1 ? "" : "s"} fired across **${breached.length}/${totalStrategies}** ${breached.length === 1 ? "strategy" : "strategies"}${deltaLine}`,
    color,
    fields,
    footer: { text: "Quant Monitor · Autonomous EOD loop" },
    timestamp: new Date().toISOString(),
  };

  const body = {
    username: "Quant Monitor",
    embeds: [embed],
  };

  try {
    const resp = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error(
        `[discord] webhook returned ${resp.status}: ${text.slice(0, 200)}`
      );
      return { sent: false, reason: `http_${resp.status}` };
    }
    console.log(
      `[discord] breach notification sent (${breached.length} strategies)`
    );
    return { sent: true };
  } catch (err) {
    console.error(`[discord] webhook failed: ${err.message || err}`);
    return { sent: false, reason: "network_error" };
  }
}

/**
 * Optional: notify when a previously-breached day returns to clean.
 */
export async function notifyRecovery({ dateStr, recoveredIds }) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook || recoveredIds.length === 0) return { sent: false };

  const embed = {
    title: `EOD recovery · ${dateStr}`,
    description: `${recoveredIds.length} strategy back to clean: ${recoveredIds.map(prettyStrategyName).join(", ")}`,
    color: COLOR_GREEN,
    footer: { text: "Quant Monitor · Autonomous EOD loop" },
    timestamp: new Date().toISOString(),
  };
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Quant Monitor", embeds: [embed] }),
      signal: AbortSignal.timeout(8000),
    });
    return { sent: true };
  } catch {
    return { sent: false };
  }
}
