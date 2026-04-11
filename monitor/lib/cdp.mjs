/**
 * TradingView CDP (Chrome DevTools Protocol) helpers.
 * Extracted from regime-switch-bot.mjs.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const CDP = require("chrome-remote-interface");

const CDP_PORT = parseInt(process.env.CDP_PORT || "9222", 10);

let client = null;

export async function connectCDP() {
  try {
    const targets = await CDP.List({ port: CDP_PORT });
    const target = targets.find(
      (t) => t.type === "page" && /tradingview\.com\/chart/i.test(t.url)
    );
    if (!target) throw new Error("No TradingView chart tab found");
    client = await CDP({ port: CDP_PORT, target: target.id });
    await client.Runtime.enable();
    return true;
  } catch (err) {
    client = null;
    throw new Error(`CDP connect failed: ${err.message}`);
  }
}

export async function cdpEval(expr) {
  if (!client) await connectCDP();
  try {
    const result = await client.Runtime.evaluate({
      expression: expr,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text
      );
    }
    return result.result?.value;
  } catch (err) {
    client = null;
    throw err;
  }
}

export async function closeCDP() {
  if (client) {
    try {
      await client.close();
    } catch {}
    client = null;
  }
}

export function isConnected() {
  return client !== null;
}
