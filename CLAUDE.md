# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

End-of-day autonomous monitor for a portfolio of intraday index strategies running live across **TradingView Desktop** and **MetaTrader 5**. After each US cash close: pull live trades, compare each strategy against its frozen backtest baseline, and either tweak parameters or propose a rebuild on breach.

The system is driven by Claude running the agent prompts in `agents/`. All remediation is bounded — tweaks only touch `input` defaults, rebuilds must clear 12 validation criteria + DSR + a sealed vault test, and rebuilt strategies are never auto-deployed.

## Commands

The monitor is fronted by npm scripts (see `package.json` for the exact mappings):

| Command | What it does |
|---|---|
| `npm run parse` | `python3 monitor/parse_baselines.py` — xlsx exports → `monitor/baselines.json` |
| `npm run collect` | Pull live trades from TV+MT5 → `monitor/state.json` |
| `npm run collect:dry` | Same, no file writes |
| `npm run check` | Apply breach rules → archive to `monitor/history/`, exit 1 on breach |
| `npm run monitor` | Full EOD pipeline: preflight + collect + check |
| `npm run preflight` | Verify TV CDP + start MT5 MCP if down (sources `.env`) |
| `npm run update-data` | Append fresh M1 bars to `*LIVE.csv` files via MT5 MCP |
| `npm run update-data:bootstrap` | First-run version (20 000 bars per symbol) |
| `npm run dashboard` | Run the dashboard (Vite + React + Express) in dev mode |
| `npm run start` | Persistent EOD loop via `scheduler/loop.sh` |
| `npm run eod` | One-shot EOD via `scheduler/run_eod.sh` |
| `npm run goal:us30` / `goal:nas100` | Run a strategy-rebuild goal under `scheduler/auto_resume.sh` — auto-resumes through 5-hour Claude rate-limit windows. Run inside `tmux` + `caffeinate -i` for unattended overnight runs. Logs to `monitor/history/goal_run_*.log`. |

To register a new strategy: drop the xlsx into `baselines/<venue>/<name>/performance/`, the code into `baselines/<venue>/<name>/code/`, add an entry to `monitor/config/strategies.json`, then `npm run parse`.

## Architecture

**Multi-language stack — split by job:**
- **Node.js (ESM)** in `monitor/` — live trade collection, breach detection, CDP and MT5 JSON-RPC clients
- **Python 3.11+** — `monitor/parse_baselines.py` (xlsx → JSON via `openpyxl`) and `monitor/mt5_mirror/*.py` (offline backtest mirrors for MT5 strategies)
- **Bash** in `scheduler/` — preflight + EOD orchestration + persistent loop
- **Pine Script** (TV strategies) and **MQL5** (MT5 EAs) under `baselines/<venue>/<name>/code/`

**External interfaces** (configured in `.mcp.json`):
- **TradingView Desktop** via Chrome DevTools Protocol on `:9222`. Trade fills are read from the chart's internal `ordersData()` API — see `monitor/lib/cdp.mjs`.
- **MetaTrader 5** via `metatrader-mcp-server` running under Wine, streamable-http on `127.0.0.1:18080`. Deals fetched via `get_deals` and filtered by strategy magic — see `monitor/lib/mt5_rpc.mjs` and `collect_live.mjs`.

**Architectural constraint that shapes everything:** the MT5 MCP exposes no strategy-tester tool. MT5 backtests for tweaks and rebuilds run via Python mirrors in `monitor/mt5_mirror/`, built lazily on the first breach that needs one.

**Daily loop**: `agents/daily_run.md` orchestrates `npm run monitor`; on breach, `agents/diagnose.md` writes `monitor/events/<id>-<date>/diagnosis.md`, then routes to either `agents/remediate_tweak.md` (max 3 attempts, only `input` defaults change) or `agents/remediate_rebuild.md` (full rebuild via `/goal`).

## Strategies (monitored)

| ID | Venue | Symbol | TF | Magic |
|---|---|---|---|---|
| `s2_momentum_burst_mt5` | MT5 | NAS100 | M5 | 520001 |
| `regime_switch_mt5` | MT5 | NAS100 | M1 | 60315002 |
| `rast_v20_mt5` | MT5 | US30 | M5 | 20020 |
| `us30_orb_tv` | TV (bridge) | US30 | 30m | 30042001 (`mt5_bridge_magic`) |
| `us30_vwap_mt5` | MT5 | US30 | M1 | 55160420 |
| `hsdm_mt5` | MT5 | NAS100 | M1 | 314159 |
| `iter75_ensemble_mt5` | MT5 | NAS100 | H1 | 75000 |

Source of truth is `monitor/config/strategies.json`. TV strategies with a live TV→MT5 mirror bot use `mt5_bridge_magic` in the registry so the monitor reads MT5-side deals (which are richer than TV's `ordersData()`).

## Breach rules

Implemented in `monitor/lib/metrics.mjs`. Hard rules fire when live > baseline; soft rules when recent activity looks weak.

1. `hard_max_dd` — live MaxDD > baseline MaxDD (min 5 trades)
2. `hard_max_consec_loss` — live longest losing streak > baseline (min 5)
3. `soft_pf_30t` — profit factor over last 30 trades < 0.80 (min 30)
4. `soft_ret_30d_vs_avg` — cumulative 30-day return < 0.3 × (baseline avg daily × 30) (min 10)

## Rebuild remediation

`agents/remediate_rebuild.md` dispatches rebuilds as a **`/goal` invocation** with the symbol-matched goal file:

- US30 → `agents/strategy-dev-goal-us30.md`
- NAS100 → `agents/strategy-dev-goal-nas100.md`

`/goal` keeps Claude iterating until the pass condition (12 criteria + DSR > 0.95 + vault) is met — no early exit. Output goes to `monitor/events/<id>-<date>/proposed_new/` and always includes both `.pine` and `.mq5` versions. Never auto-deployed; flagged in the daily summary for user review.

## Historical data (in-repo, gitignored)

`Data/` at the repo root (~300 MB, gitignored) holds M1 OHLCV CSVs in tab-separated MT5 format for 2019–present:

- `{US30,NAS100} TRAINING.csv` — frozen reference, never modified
- `{US30,NAS100} LIVE.csv` — append-only, extended nightly by `monitor/update_live_data.mjs`
- `us30 tru oos.csv`, `NAS100 TRUE OOS.csv` — sealed vault; touch once at end of a rebuild

Python backtesters concatenate `TRAINING + LIVE` at load time and resample (M5/M30/H1) in-memory. For bars fresher than the last LIVE update, agents may call MT5 `get_candles_latest` or TV `data_get_ohlcv` directly and stitch by timestamp.

## Gitignored, by design

The repo publicly hosts the monitor framework but **not the strategies**. The following stay local:

- `baselines/` — all xlsx exports + Pine/MQL5 source (proprietary IP)
- `bots/` — TV→MT5 mirror bots (proprietary IP; currently three: `regime-switch-bot.mjs`, `us30-orb-bot.mjs`, `nas100-v8-mwp-bot.mjs`)
- `Data/` — M1 OHLCV CSVs (~300 MB; required at runtime, too big for git)
- `monitor/baselines.json`, `monitor/state.json`, `monitor/history/`, `monitor/events/` — generated
- `.env`, `.claude/settings.local.json` — credentials

When adding a strategy: the artefacts in `baselines/` won't be tracked (intentional), but the registry entry in `monitor/config/strategies.json` **is** tracked, so the commit is required even when the source stays local.

## Notes

- `AGENTS.md` is a stale duplicate of an older CLAUDE.md (still references "Codex"). When updating CLAUDE.md, prefer to either delete AGENTS.md or sync the two — do not silently let them drift further.
- The `dashboard/` directory is a standalone Vite + React + Express app for viewing breach history on phone/desktop; installed independently, started via `npm run dashboard` (web on Vite, API on `dashboard/server.mjs`).
- TV→MT5 bridge bots are independent processes the monitor does not manage; the monitor reads their fills indirectly via their MT5 magic (single magic per bot).
- Broker credentials and any MT5 server config must flow from `.env` into `scheduler/start_daily.sh` — never hardcode them in scripts or prompts.
