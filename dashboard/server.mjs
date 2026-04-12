/**
 * Dashboard API server.
 *
 * Exposes the monitor's JSON state files over HTTP for the React UI.
 * Runs on port 3001 in dev; proxied from Vite at /api/*.
 * In production, serves the built Vite bundle from dist/ as well.
 */
import express from "express";
import { readFile, readdir, stat, writeFile, unlink } from "node:fs/promises";
import { existsSync, openSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MONITOR = resolve(ROOT, "monitor");
const HISTORY = resolve(MONITOR, "history");
const EVENTS = resolve(MONITOR, "events");
const CONFIG = resolve(MONITOR, "config");
const LOOP_PID_FILE = resolve(MONITOR, "loop.pid.json");
const LOOP_LOG_FILE = resolve(MONITOR, "loop.log");
const BOTS_DIR = resolve(MONITOR, "bots");
const DATA_DIR =
  process.env.DATA_DIR ||
  "/Users/gervaciusjr/Desktop/strategy dev v3/Data";

// Bot registry — maps bot id → script path + state files.
const BOTS = {
  "regime-switch": {
    id: "regime-switch",
    name: "Regime Switch Reclaim",
    script: resolve(ROOT, "bots/regime-switch-bot.mjs"),
    pidfile: resolve(BOTS_DIR, "regime-switch.pid.json"),
    logfile: resolve(BOTS_DIR, "regime-switch.log"),
  },
  "us30-orb": {
    id: "us30-orb",
    name: "US30 ORB Reversal",
    script: resolve(ROOT, "bots/us30-orb-bot.mjs"),
    pidfile: resolve(BOTS_DIR, "us30-orb.pid.json"),
    logfile: resolve(BOTS_DIR, "us30-orb.log"),
  },
};

const PORT = Number(process.env.DASHBOARD_PORT || 3001);

const app = express();
app.use(express.json());

// ─── Generic process lifecycle (loop + bots) ───
// Long-running children are spawned detached, their PID is persisted to disk,
// and the whole process group is signalled on stop so descendants get killed
// too. State survives dashboard server restarts: on every status call we recheck
// whether the PID is still alive and self-heal stale pidfiles.

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readPidFile(path) {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writePidFile(path, entry) {
  await writeFile(path, JSON.stringify(entry, null, 2));
}

async function clearPidFile(path) {
  try {
    await unlink(path);
  } catch {
    /* ignore */
  }
}

/**
 * Returns a normalised { running, pid, started_at } for any pidfile.
 * Self-heals stale entries by clearing the pidfile if the PID is dead.
 */
async function getProcessStatus(pidfile) {
  const entry = await readPidFile(pidfile);
  if (!entry) return { running: false, pid: null, started_at: null };
  if (!pidAlive(entry.pid)) {
    await clearPidFile(pidfile);
    return { running: false, pid: null, started_at: null };
  }
  return { running: true, pid: entry.pid, started_at: entry.started_at };
}

/**
 * Kill a process group via negative-PID signal, with SIGKILL escalation.
 */
function killProcessGroup(pid) {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already dead */
    }
  }
  setTimeout(() => {
    if (pidAlive(pid)) {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          /* already dead */
        }
      }
    }
  }, 5000);
}

// Back-compat shorthands for the loop — same as the generic helpers but
// pinned to the loop's pidfile.
const getLoopStatus = () => getProcessStatus(LOOP_PID_FILE);

async function readJson(path) {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function readText(path) {
  try {
    return await readFile(path, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// ─── API routes ───

app.get("/api/health", async (_req, res) => {
  const stateExists = existsSync(resolve(MONITOR, "state.json"));
  const baselinesExists = existsSync(resolve(MONITOR, "baselines.json"));
  let lastRun = null;
  if (stateExists) {
    const s = await stat(resolve(MONITOR, "state.json"));
    lastRun = s.mtime.toISOString();
  }

  // Probe MT5 MCP
  let mt5Ok = false;
  try {
    const resp = await fetch("http://127.0.0.1:18080/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "dashboard-probe", version: "1.0" },
        },
      }),
      signal: AbortSignal.timeout(2000),
    });
    mt5Ok = resp.ok;
  } catch {
    mt5Ok = false;
  }

  // Probe TV CDP
  let tvOk = false;
  try {
    const resp = await fetch("http://localhost:9222/json/version", {
      signal: AbortSignal.timeout(2000),
    });
    tvOk = resp.ok;
  } catch {
    tvOk = false;
  }

  const loop = await getLoopStatus();

  res.json({
    state_exists: stateExists,
    baselines_exists: baselinesExists,
    last_run: lastRun,
    mt5_mcp: mt5Ok,
    tv_cdp: tvOk,
    loop,
  });
});

app.get("/api/state", async (_req, res) => {
  const state = await readJson(resolve(MONITOR, "state.json"));
  if (!state)
    return res.status(404).json({ error: "state.json not found" });
  res.json(state);
});

app.get("/api/baselines", async (_req, res) => {
  const baselines = await readJson(resolve(MONITOR, "baselines.json"));
  if (!baselines)
    return res.status(404).json({ error: "baselines.json not found" });
  res.json(baselines);
});

app.get("/api/strategies", async (_req, res) => {
  const cfg = await readJson(resolve(CONFIG, "strategies.json"));
  if (!cfg)
    return res.status(404).json({ error: "strategies.json not found" });
  res.json(cfg);
});

app.get("/api/history", async (_req, res) => {
  if (!existsSync(HISTORY)) return res.json({ entries: [] });
  const files = (await readdir(HISTORY)).filter(
    (f) => f.endsWith("-state.json") && /^\d{4}-\d{2}-\d{2}/.test(f)
  );
  const entries = [];
  for (const file of files.sort().reverse()) {
    const date = file.replace("-state.json", "");
    const data = await readJson(join(HISTORY, file));
    if (!data) continue;
    const strategies = data.strategies || {};
    const total = Object.keys(strategies).length;
    let breached = 0;
    let totalTrades = 0;
    let totalPnl = 0;
    for (const s of Object.values(strategies)) {
      if ((s.breaches || []).length > 0) breached++;
      totalTrades += s.live_trades || 0;
      totalPnl += s.metrics?.totalPnl || 0;
    }
    entries.push({
      date,
      timestamp: data.timestamp,
      total,
      breached,
      total_trades: totalTrades,
      total_pnl: totalPnl,
    });
  }
  res.json({ entries });
});

app.get("/api/history/:date", async (req, res) => {
  const path = join(HISTORY, `${req.params.date}-state.json`);
  const data = await readJson(path);
  if (!data) return res.status(404).json({ error: "not found" });
  res.json(data);
});

app.get("/api/daily-log", async (_req, res) => {
  const log = await readText(join(HISTORY, "daily_log.md"));
  res.json({ log: log || "" });
});

app.get("/api/events", async (_req, res) => {
  if (!existsSync(EVENTS)) return res.json({ events: [] });
  const dirs = await readdir(EVENTS);
  const events = [];
  for (const dir of dirs.sort().reverse()) {
    const p = join(EVENTS, dir);
    const s = await stat(p);
    if (!s.isDirectory()) continue;
    const files = await readdir(p);
    const hasDiagnosis = files.includes("diagnosis.md");
    const hasTweak = files.some((f) => f.startsWith("tweak_"));
    const hasRebuild = files.includes("proposed_new");
    events.push({
      id: dir,
      created: s.birthtime.toISOString(),
      diagnosis: hasDiagnosis,
      tweak: hasTweak,
      rebuild: hasRebuild,
      files,
    });
  }
  res.json({ events });
});

app.get("/api/events/:id", async (req, res) => {
  const dir = join(EVENTS, req.params.id);
  if (!existsSync(dir)) return res.status(404).json({ error: "not found" });
  const files = await readdir(dir);
  const content = {};
  for (const f of files) {
    if (f.endsWith(".md") || f.endsWith(".json")) {
      content[f] = await readText(join(dir, f));
    }
  }
  res.json({ id: req.params.id, files, content });
});

app.get("/api/live-csv/status", async (_req, res) => {
  const symbols = ["US30", "NAS100"];
  const status = {};
  for (const sym of symbols) {
    const path = join(DATA_DIR, `${sym} LIVE.csv`);
    if (!existsSync(path)) {
      status[sym] = { exists: false };
      continue;
    }
    const s = await stat(path);
    status[sym] = {
      exists: true,
      size_bytes: s.size,
      modified: s.mtime.toISOString(),
    };
  }
  res.json(status);
});

// ─── Start the loop (npm start → scheduler/loop.sh) ───
app.post("/api/run", async (_req, res) => {
  const current = await getLoopStatus();
  if (current.running) {
    return res.json({ started: false, already_running: true, ...current });
  }

  const out = openSync(LOOP_LOG_FILE, "a");
  const err = openSync(LOOP_LOG_FILE, "a");
  // Wrap the child in a pseudo-TTY via Python's pty.spawn so bash/node inside
  // loop.sh stay line-buffered and each echo flushes to loop.log immediately.
  // Without this, stdio redirected to a file triggers block-buffering and
  // the log panel sits empty until a ~4KB buffer fills.
  const child = spawn(
    "python3",
    ["-c", "import pty, sys; pty.spawn(sys.argv[1:])", "npm", "start"],
    {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", out, err],
    }
  );
  child.unref();

  const entry = { pid: child.pid, started_at: new Date().toISOString() };
  await writePidFile(LOOP_PID_FILE, entry);

  child.on("exit", async () => {
    const cur = await readPidFile(LOOP_PID_FILE);
    if (cur && cur.pid === child.pid) await clearPidFile(LOOP_PID_FILE);
  });

  res.json({ started: true, ...entry });
});

// ─── Stop the loop ───
app.post("/api/stop", async (_req, res) => {
  const current = await getLoopStatus();
  if (!current.running) {
    return res.json({ stopped: false, not_running: true });
  }
  killProcessGroup(current.pid);
  await clearPidFile(LOOP_PID_FILE);
  res.json({ stopped: true, pid: current.pid });
});

// ─── Fire a single EOD run (old "Run now" behaviour) ───
// Fire-and-forget: we don't track this as a persistent process because
// run_eod.sh is short-lived. The user sees its effect via state.json mtime.
app.post("/api/run-once", async (_req, res) => {
  const out = openSync(LOOP_LOG_FILE, "a");
  const err = openSync(LOOP_LOG_FILE, "a");
  // pty.spawn wrapper for line-buffered output — see /api/run.
  const child = spawn(
    "python3",
    ["-c", "import pty, sys; pty.spawn(sys.argv[1:])", "npm", "run", "eod"],
    {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", out, err],
    }
  );
  child.unref();
  res.json({ started: true, pid: child.pid });
});

// ─── Loop log tail ───
app.get("/api/loop-log", async (req, res) => {
  const lines = Math.max(1, Math.min(2000, Number(req.query.lines) || 200));
  try {
    const raw = await readFile(LOOP_LOG_FILE, "utf-8");
    // PTY output uses \r\n line endings; strip the \r so the panel renders
    // cleanly and `split("\n")` yields whole lines.
    const cleaned = raw.replace(/\r\n/g, "\n").replace(/\r/g, "");
    const all = cleaned.split("\n");
    const tail = all.slice(-lines).join("\n");
    res.json({ log: tail, total_lines: all.length });
  } catch {
    res.json({ log: "", total_lines: 0 });
  }
});

// ─── Bot lifecycle ───
async function ensureBotsDir() {
  await writeFile(resolve(BOTS_DIR, ".keep"), "", { flag: "a" }).catch(() => {
    /* ignore, will create on demand */
  });
}
// Try to ensure the directory at boot (best-effort).
try {
  if (!existsSync(BOTS_DIR)) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(BOTS_DIR, { recursive: true });
  }
  await ensureBotsDir();
} catch {
  /* dashboard still works without the dir */
}

app.get("/api/bots", async (_req, res) => {
  const bots = [];
  for (const bot of Object.values(BOTS)) {
    const status = await getProcessStatus(bot.pidfile);
    bots.push({
      id: bot.id,
      name: bot.name,
      script: bot.script.replace(ROOT + "/", ""),
      ...status,
    });
  }
  res.json({ bots });
});

app.post("/api/bots/:id/start", async (req, res) => {
  const bot = BOTS[req.params.id];
  if (!bot) return res.status(404).json({ error: "unknown bot" });
  const current = await getProcessStatus(bot.pidfile);
  if (current.running) {
    return res.json({ started: false, already_running: true, ...current });
  }
  if (!existsSync(bot.script)) {
    return res.status(500).json({ error: `script missing: ${bot.script}` });
  }
  const out = openSync(bot.logfile, "a");
  const err = openSync(bot.logfile, "a");
  const child = spawn("node", [bot.script], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", out, err],
  });
  child.unref();
  const entry = { pid: child.pid, started_at: new Date().toISOString() };
  await writePidFile(bot.pidfile, entry);
  child.on("exit", async () => {
    const cur = await readPidFile(bot.pidfile);
    if (cur && cur.pid === child.pid) await clearPidFile(bot.pidfile);
  });
  res.json({ started: true, id: bot.id, ...entry });
});

app.post("/api/bots/:id/stop", async (req, res) => {
  const bot = BOTS[req.params.id];
  if (!bot) return res.status(404).json({ error: "unknown bot" });
  const current = await getProcessStatus(bot.pidfile);
  if (!current.running) {
    return res.json({ stopped: false, not_running: true });
  }
  killProcessGroup(current.pid);
  await clearPidFile(bot.pidfile);
  res.json({ stopped: true, id: bot.id, pid: current.pid });
});

app.get("/api/bots/:id/log", async (req, res) => {
  const bot = BOTS[req.params.id];
  if (!bot) return res.status(404).json({ error: "unknown bot" });
  const lines = Math.max(1, Math.min(2000, Number(req.query.lines) || 200));
  try {
    const raw = await readFile(bot.logfile, "utf-8");
    const all = raw.split("\n");
    res.json({ log: all.slice(-lines).join("\n"), total_lines: all.length });
  } catch {
    res.json({ log: "", total_lines: 0 });
  }
});

// ─── Proposal review (rebuild path output) ───
// A proposal is any event folder containing a `proposed_new/` subfolder.
// The user approves or rejects via marker files; the dashboard does not
// actually deploy — deployment is a deliberate manual step.
app.get("/api/proposals", async (_req, res) => {
  if (!existsSync(EVENTS)) return res.json({ proposals: [] });
  const dirs = await readdir(EVENTS);
  const proposals = [];
  for (const dir of dirs.sort().reverse()) {
    const p = join(EVENTS, dir);
    const s = await stat(p).catch(() => null);
    if (!s || !s.isDirectory()) continue;
    const files = await readdir(p);
    if (!files.includes("proposed_new")) continue;

    const proposed = join(p, "proposed_new");
    const proposedFiles = await readdir(proposed).catch(() => []);
    const validationReport = proposedFiles.includes("validation_report.md")
      ? await readText(join(proposed, "validation_report.md"))
      : null;
    const approvedAt = files.includes("APPROVED.json")
      ? (await readJson(join(p, "APPROVED.json")))?.at
      : null;
    const rejectedAt = files.includes("REJECTED.json")
      ? (await readJson(join(p, "REJECTED.json")))?.at
      : null;
    proposals.push({
      id: dir,
      created: s.birthtime.toISOString(),
      files,
      proposed_files: proposedFiles,
      validation_report: validationReport,
      approved_at: approvedAt,
      rejected_at: rejectedAt,
      status: approvedAt ? "approved" : rejectedAt ? "rejected" : "pending",
    });
  }
  res.json({ proposals });
});

app.post("/api/proposals/:id/approve", async (req, res) => {
  const dir = join(EVENTS, req.params.id);
  if (!existsSync(dir)) return res.status(404).json({ error: "not found" });
  await writeFile(
    join(dir, "APPROVED.json"),
    JSON.stringify({ at: new Date().toISOString() }, null, 2)
  );
  // Remove any stale REJECTED marker.
  await unlink(join(dir, "REJECTED.json")).catch(() => {});
  res.json({ approved: true, id: req.params.id });
});

app.post("/api/proposals/:id/reject", async (req, res) => {
  const dir = join(EVENTS, req.params.id);
  if (!existsSync(dir)) return res.status(404).json({ error: "not found" });
  await writeFile(
    join(dir, "REJECTED.json"),
    JSON.stringify({ at: new Date().toISOString() }, null, 2)
  );
  await unlink(join(dir, "APPROVED.json")).catch(() => {});
  res.json({ rejected: true, id: req.params.id });
});

// ─── Synthetic breach drill ───
// Kicks off scheduler/run_drill.sh with a target strategy id. The drill
// script writes a sandbox state + calls Claude with a drill prompt that
// routes output to events/drill-<ts>/ and never touches source files.
app.post("/api/drill/:id", async (req, res) => {
  const strategyId = req.params.id;
  const configPath = resolve(CONFIG, "strategies.json");
  const cfg = await readJson(configPath);
  const strategies = cfg?.strategies || [];
  const known = new Set(strategies.map((s) => s.id));
  if (!known.has(strategyId)) {
    return res.status(404).json({ error: `unknown strategy: ${strategyId}` });
  }
  const script = resolve(ROOT, "scheduler/run_drill.sh");
  if (!existsSync(script)) {
    return res
      .status(500)
      .json({ error: "scheduler/run_drill.sh not found" });
  }
  const out = openSync(LOOP_LOG_FILE, "a");
  const err = openSync(LOOP_LOG_FILE, "a");
  // pty.spawn wrapper for line-buffered output — see /api/run.
  const child = spawn(
    "python3",
    ["-c", "import pty, sys; pty.spawn(sys.argv[1:])", "bash", script, strategyId],
    {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", out, err],
      env: { ...process.env, DRILL_STRATEGY: strategyId },
    }
  );
  child.unref();
  res.json({ started: true, strategy: strategyId, pid: child.pid });
});

// ─── Serve built frontend in production ───
if (process.env.NODE_ENV === "production") {
  const dist = resolve(__dirname, "dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(join(dist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Dashboard API listening on http://localhost:${PORT}`);
});
