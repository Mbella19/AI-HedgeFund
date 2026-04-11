/**
 * MT5 MCP JSON-RPC client (streamable-http transport).
 * Extracted from regime-switch-bot.mjs with enhancements for the monitor.
 */

const MT5_MCP_URL =
  process.env.MT5_MCP_URL || "http://127.0.0.1:18080/mcp";

let sessionId = null;
let reqId = 0;

export async function mt5Request(method, params = {}) {
  const body = { jsonrpc: "2.0", method, params };
  const isNotification = method.startsWith("notifications/");
  if (!isNotification) body.id = ++reqId;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const resp = await fetch(MT5_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const sid = resp.headers.get("mcp-session-id");
  if (sid) sessionId = sid;

  if (isNotification) return null;

  const text = await resp.text();
  for (const line of text.split("\n")) {
    if (line.startsWith("data:")) {
      return JSON.parse(line.slice(5).trim());
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
}

export async function mt5Init() {
  const resp = await mt5Request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "eod-monitor", version: "1.0" },
  });
  if (resp?.result) {
    await mt5Request("notifications/initialized");
    return resp.result;
  }
  throw new Error(`MT5 init failed: ${JSON.stringify(resp)}`);
}

export async function mt5Tool(name, args = {}) {
  const resp = await mt5Request("tools/call", { name, arguments: args });
  if (resp?.error)
    throw new Error(`MT5 ${name}: ${resp.error.message}`);
  const content = resp?.result?.content;
  if (content?.[0]?.text) {
    try {
      return JSON.parse(content[0].text);
    } catch {
      return content[0].text;
    }
  }
  return resp?.result;
}

export async function getDeals(fromDate, toDate, symbol) {
  const args = {};
  if (fromDate) args.from_date = fromDate;
  if (toDate) args.to_date = toDate;
  if (symbol) args.symbol = symbol;
  const csv = await mt5Tool("get_deals", args);
  return parseDealsCsv(typeof csv === "string" ? csv : "");
}

export async function getCandles(symbol, timeframe, count = 500) {
  const csv = await mt5Tool("get_candles_latest", {
    symbol_name: symbol,
    timeframe,
    count,
  });
  return parseCandlesCsv(typeof csv === "string" ? csv : "");
}

export async function getAccountInfo() {
  return mt5Tool("get_account_info");
}

function parseDealsCsv(csv) {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
    const obj = {};
    header.forEach((h, i) => (obj[h] = cols[i]));
    return obj;
  });
}

function parseCandlesCsv(csv) {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
    const obj = {};
    header.forEach((h, i) => {
      const raw = cols[i];
      if (raw === undefined || raw === "") {
        obj[h] = raw;
      } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
        obj[h] = parseFloat(raw);
      } else {
        obj[h] = raw;
      }
    });
    return obj;
  });
}
