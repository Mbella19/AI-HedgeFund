# AI Hedge Fund — EOD Strategy Monitor

An autonomous end-of-day monitor for a portfolio of intraday quant strategies
running live across **TradingView Desktop** and **MetaTrader 5**. Every trading
day after the US cash close, the system:

1. Pulls live trades from both venues.
2. Compares every strategy against its frozen backtest baseline on four
   breach rules.
3. On breach, diagnoses the root cause from full price, indicator, and trade
   data.
4. Either tweaks strategy parameters (auto-verified against baseline + live
   periods) or proposes a full rebuild via the `/goal`-driven strategy-design
   prompt.
5. Logs every decision, parameter change, and backtest result for review.

The system is driven by Claude running an agent loop over the prompt fragments
in `agents/`. All remediation is bounded by hard rules: tweaks only touch
`input` defaults, rebuilds must clear twelve validation criteria plus a sealed
vault test, and no rebuilt strategy is ever auto-deployed without human
review.

---

## Table of contents

- [Portfolio](#portfolio)
- [How it works](#how-it-works)
- [Breach rules](#breach-rules)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Daily pipeline](#daily-pipeline)
- [Remediation paths](#remediation-paths)
- [Historical data](#historical-data)
- [MCP servers](#mcp-servers)
- [Security & gitignore policy](#security--gitignore-policy)
- [Contributing](#contributing)
- [License](#license)

---

## Portfolio

Seven intraday index strategies are tracked. Strategies that trade identically
on both venues are monitored only on the MT5 side (richer trade data via the
MCP); TV-only or MT5-only strategies stay where the edge replicates cleanly.

| Strategy ID | Name | Venue | Symbol | TF | Magic |
|---|---|---|---|---|---|
| `s2_momentum_burst_mt5` | S2 Momentum Burst (declining risk) | MT5 | NAS100 | M5 | `520001` |
| `regime_switch_mt5` | Regime Switch Reclaim Fast | MT5 | NAS100 | M1 | `60315002` |
| `rast_v20_mt5` | RAST V20 US30 Day Trader | MT5 | US30 | M5 | `20020` |
| `us30_orb_tv` | US30 ORB Reversal v1.0 | TV (via bridge) | US30 | 30m | `30042001` (`mt5_bridge_magic`) |
| `us30_vwap_mt5` | US30 VWAP | MT5 | US30 | M1 | `55160420` |
| `hsdm_mt5` | HSDM (3-leg cash-session) | MT5 | NAS100 | M1 | `314159` |
| `iter75_ensemble_mt5` | iter75 6-leg ensemble | MT5 | NAS100 | H1 | `75000` |

**Bridge magic:** `us30_orb_tv` is a TradingView Pine strategy whose live fills
are mirrored to MT5 by `bots/us30-orb-bot.mjs` and stamped with magic
`30042001`. The monitor reads those MT5 deals rather than TV's `ordersData()`
because MT5 carries P&L, commission, and swap. Other strategies (Regime
Switch, V8 MWP) have similar TV→MT5 bridge bots, but their primary registry
entry tracks the MT5 EA directly.

**Venue notes:** `us30_vwap` trades MT5 only because the strategy does not
replicate cleanly on TradingView's commission/slippage model. `us30_orb_reversal`
trades on TradingView only because the 30-minute bar-close triggers don't map
well to the MT5 Strategy Tester. HSDM and iter75 are MT5-native; both are
registered in baseline-only mode and will start producing live metrics as
soon as their EAs are running on the broker.

The authoritative registry is `monitor/config/strategies.json`.

---

## How it works

```
┌─────────────────────────┐
│  17:30 NY (EOD cron)    │
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  scheduler/start_daily.sh            │
│  - checks TV CDP on :9222            │
│  - starts MT5 MCP if down            │
│  - ensures baselines.json exists     │
│  - refreshes {US30,NAS100} LIVE.csv  │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  monitor/collect_live.mjs            │
│  - TV: CDP → ordersData() → trades   │
│  - MT5: MCP get_deals → trades       │
│  - filters by magic + baseline date  │
│  - writes state.json                 │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  monitor/check_breach.mjs            │
│  - loads baselines.json + state.json │
│  - applies 4 breach rules            │
│  - archives to history/              │
│  - exits 0 if clean, 1 on breach     │
└──────────┬───────────────────────────┘
           │
           ▼ breach
┌──────────────────────────────────────┐
│  Claude agent loop                   │
│  agents/daily_run.md                 │
│  → agents/diagnose.md                │
│  → remediate_tweak.md OR             │
│    remediate_rebuild.md  (uses /goal)│
└──────────────────────────────────────┘
```

---

## Breach rules

Four rules fire any time the live period diverges meaningfully from the
frozen baseline. Minimum trade counts gate each rule so an empty period never
creates a false positive.

| Rule | Threshold | Min trades |
|---|---|---|
| `hard_max_dd` | live max drawdown > baseline max DD | 5 |
| `hard_max_consec_loss` | live longest losing streak > baseline's | 5 |
| `soft_pf_30t` | profit factor on the last 30 trades < 0.80 | 30 |
| `soft_ret_30d_vs_avg` | 30-day cumulative return < 0.3 × (baseline avg daily × 30) | 10 |

Any single rule firing flags the strategy as in breach and triggers the
diagnosis pipeline. All rule implementations live in
[`monitor/lib/metrics.mjs`](monitor/lib/metrics.mjs).

---

## Architecture

### Languages and runtimes

- **Node.js (ES modules)** — live trade collection, breach detection, CDP and
  MT5 JSON-RPC clients
- **Python 3.11+** — baseline xlsx parsing via `openpyxl`, plus the
  per-strategy Python backtest mirrors in `monitor/mt5_mirror/` (built lazily
  on first breach for any MT5 strategy)
- **Bash** — scheduler preflight, EOD entry point, persistent loop, drill
- **Pine Script v6** — TradingView strategies (`baselines/tradingview/*/code/`)
- **MQL5** — MetaTrader 5 EAs (`baselines/mt5/*/code/`)

### External interfaces

- **TradingView Desktop** via Chrome DevTools Protocol on `localhost:9222`.
  The TV process must be launched with `--remote-debugging-port=9222`. Trade
  data is read from the chart's `ordersData()` internal API.
- **MetaTrader 5** via the `metatrader-mcp-server` package running under Wine
  on macOS. The server exposes streamable-HTTP JSON-RPC on `127.0.0.1:18080`,
  providing `get_deals`, `get_candles_latest`, `get_account_info`, and related
  tools.

### Architectural constraint

The MT5 MCP exposes **no strategy-tester tool**. MT5 backtests for tweak
verification and rebuild iterations therefore run through Python mirror
backtesters in `monitor/mt5_mirror/`, faithful translations of the MQL5 EAs
that read the raw M1 CSV data. The first mirror lives in
`monitor/mt5_mirror/s2_momentum_burst.py`; new mirrors are built lazily on
the first breach that needs one.

---

## Repository layout

```
.
├── CLAUDE.md                Project context loaded by Claude sessions
├── README.md                This file
├── AGENTS.md                Stale duplicate of an older CLAUDE.md (planned cleanup)
├── .env.example             Template for MT5 credentials + ports
├── .gitignore               Excludes baselines/, bots/, secrets, generated state
├── .mcp.json                Declares the tradingview + metatrader MCP servers
├── package.json             npm scripts: parse, collect, check, monitor
│
├── agents/                  Claude agent prompts for the daily loop
│   ├── daily_run.md                   Top-level orchestration
│   ├── diagnose.md                    Failure analysis (regime shift, clustering)
│   ├── remediate_tweak.md             Parameter tuning (max 3 attempts)
│   ├── remediate_rebuild.md           Rebuild dispatcher — routes by symbol via /goal
│   ├── strategy-dev-goal-us30.md      Strategy-design goal for US30 rebuilds
│   └── strategy-dev-goal-nas100.md    Strategy-design goal for NAS100 rebuilds
│
├── baselines/   (gitignored, proprietary)
│   ├── tradingview/<strategy>/{code,performance}/
│   └── mt5/<strategy>/{code,performance}/
│
├── bots/        (gitignored, proprietary)
│   ├── regime-switch-bot.mjs          TV→MT5 mirror for Regime Switch Reclaim
│   ├── us30-orb-bot.mjs               TV→MT5 mirror for US30 ORB Reversal
│   └── nas100-v8-mwp-bot.mjs          TV→MT5 mirror for NAS100 V8 MWP
│
├── docs/
│   └── strategy-dev-guidelines.md     Long-form rebuild contract (still referenced by remediate_tweak.md)
│
├── monitor/                 EOD monitor runtime
│   ├── config/
│   │   ├── strategies.json            Strategy registry (the source of truth)
│   │   └── mt5_tools.json             (generated) MT5 MCP tool cache
│   ├── lib/
│   │   ├── cdp.mjs                    TradingView CDP client
│   │   ├── mt5_rpc.mjs                MT5 MCP JSON-RPC client
│   │   └── metrics.mjs                Pure metric + breach functions
│   ├── mt5_mirror/                    Python mirrors of MT5 EAs for offline backtest
│   │   └── s2_momentum_burst.py
│   ├── parse_baselines.py             Parse xlsx → baselines.json
│   ├── collect_live.mjs               Pull live trades → state.json
│   ├── check_breach.mjs               Compare state vs baselines → history
│   ├── update_live_data.mjs           Nightly M1 bar append to *.LIVE.csv
│   ├── baselines.json                 (generated)
│   ├── state.json                     (generated)
│   ├── history/                       (generated) daily archive + log
│   └── events/                        (generated) per-breach event folders
│
└── scheduler/
    ├── start_daily.sh                 Preflight: TV CDP + MT5 MCP + LIVE.csv refresh
    ├── run_eod.sh                     Standalone EOD entry point
    ├── loop.sh                        Persistent loop (waits until 21:30 UTC each weekday)
    └── run_drill.sh                   Synthetic breach drill for end-to-end testing
```

---

## Requirements

- **macOS** (tested on Darwin 25.4, Intel + Apple Silicon)
- **Node.js** 18 or newer
- **Python** 3.11 or newer with `openpyxl` installed
- **TradingView Desktop** (paid tier required for strategy backtests and Pine
  indicator APIs)
- **MetaTrader 5** running under Wine (bundled with the macOS TradingView app)
- **`metatrader-mcp-server`** installed inside the Wine Python environment
- **Claude Code** CLI for the daily agent run

`chrome-remote-interface` is installed via npm.

---

## Installation

```bash
git clone https://github.com/Mbella19/AI-HedgeFund.git
cd AI-HedgeFund

# Node dependencies (monitor)
npm install

# Python dependencies
pip install openpyxl

# Copy the env template and fill in broker credentials
cp .env.example .env
$EDITOR .env

# Enable repo git hooks (currently: pre-commit char-limit check on the /goal
# files). Per-repo setting; safe to re-run.
git config core.hooksPath .githooks
```

### .env fields

```ini
MT5_LOGIN=<your mt5 login>
MT5_PASSWORD=<your mt5 password>
MT5_SERVER=PepperstoneUK-Demo
MT5_TERMINAL_PATH=C:\Program Files\MetaTrader 5\terminal64.exe

MT5_MCP_HOST=127.0.0.1
MT5_MCP_PORT=18080
TV_CDP_PORT=9222
```

`.env` is gitignored. Credentials flow from `.env` into
`scheduler/start_daily.sh`, which launches the MT5 MCP server when the server
is not already running. **Never hardcode credentials in scripts or prompts.**

---

## Configuration

All strategies are declared in `monitor/config/strategies.json`. Each entry
maps a strategy ID to its venue, symbol, timeframe, magic number, baseline
xlsx path, source file path, and (for TV) the on-chart Pine strategy display
name:

```json
{
  "id": "hsdm_mt5",
  "name": "HSDM",
  "venue": "mt5",
  "symbol": "NAS100",
  "timeframe": "M1",
  "magic": 314159,
  "baseline_xlsx": "baselines/mt5/HSDM NAS100/performance/HSDM.xlsx",
  "source_file": "baselines/mt5/HSDM NAS100/code/HSDM.txt",
  "pine_strategy_name": null
}
```

To add a new strategy:

1. Drop the xlsx export into `baselines/<venue>/<strategy>/performance/`.
2. Drop the Pine or MQL5 source into `baselines/<venue>/<strategy>/code/`.
3. Add an entry to `monitor/config/strategies.json` — venue, symbol,
   timeframe, magic (MT5 only), and — for TV — the exact `pine_strategy_name`
   as it appears on the chart.
4. Regenerate baselines: `npm run parse`.

The `baselines/` directory is **gitignored**, so the artefacts in step 1–2
stay local. The registry entry in step 3, however, **is** tracked — commit it
even when the source stays local.

---

## Usage

### One-shot scripts

| Command | What it runs |
|---|---|
| `npm run parse` | `python3 monitor/parse_baselines.py` |
| `npm run collect` | `node monitor/collect_live.mjs` |
| `npm run collect:dry` | Same, no file writes |
| `npm run check` | `node monitor/check_breach.mjs` |
| `npm run monitor` | Full EOD: preflight + collect + check |
| `npm run preflight` | Just the MCP preflight |
| `npm run eod` | `bash scheduler/run_eod.sh` (standalone EOD) |
| `npm run start` | `bash scheduler/loop.sh` (persistent loop) |
| `npm run update-data` | Append fresh M1 bars to `{US30,NAS100} LIVE.csv` |
| `npm run update-data:bootstrap` | Bootstrap version (20 000 bars per symbol) |
| `npm run goal:us30` | Run the US30 rebuild goal under `auto_resume.sh` (handles 5h limits) |
| `npm run goal:nas100` | Run the NAS100 rebuild goal under `auto_resume.sh` |
| `npm run goal <file>` | Same wrapper with an arbitrary goal file or inline text |

### End-of-day autonomous run

The daily loop is triggered by a Claude scheduled job, by `bash
scheduler/run_eod.sh`, or by running the
[`agents/daily_run.md`](agents/daily_run.md) prompt manually. The agent:

1. Runs `scheduler/start_daily.sh` to bring up MCP servers and refresh the
   LIVE CSVs.
2. Runs `npm run collect && npm run check`.
3. On a clean run, logs "all clear" to `monitor/history/daily_log.md` and
   exits.
4. On breach, for each breached strategy:
   - Writes `monitor/events/<strategy_id>-<YYYYMMDD>/diagnosis.md` per
     [`agents/diagnose.md`](agents/diagnose.md).
   - Chooses tweak or rebuild based on the diagnosis.
   - Runs the selected remediation path.
   - Writes a summary to `monitor/history/<YYYY-MM-DD>-summary.md`.

### Persistent loop

`bash scheduler/loop.sh` (or `npm run start`) blocks until 21:30 UTC each
weekday, runs the full pipeline, and launches Claude Code on breach. Leave it
in a screen/tmux session if you don't want to rely on cron.

### Synthetic drill

`bash scheduler/run_drill.sh <strategy_id>` writes a sandbox state with a
forced `hard_max_dd` breach and launches Claude Code in drill mode — useful
for testing diagnose/remediate end-to-end without waiting for a real failure.
Output is routed to `monitor/events/drill-<ts>/`; no production state is
mutated.

### Long-running `/goal` with auto-resume

A `/goal`-driven rebuild can easily run past the Claude Code 5-hour usage
window. `scheduler/auto_resume.sh` wraps the run: it fires `claude -p
"/goal …"` headlessly, watches for the rate-limit signal in the output,
sleeps ~5h5m, and resumes the same session via `claude --continue`. It loops
until the goal completes (clean exit + completion keywords in the tail) or
you Ctrl-C.

```bash
# Convenience npm scripts for the two registered rebuild prompts
npm run goal:us30
npm run goal:nas100

# Arbitrary goal file or inline text
npm run goal -- agents/strategy-dev-goal-nas100.md
npm run goal -- "your custom goal text here"
```

For unattended overnight runs on macOS, launch inside `tmux` with
`caffeinate -i` so the laptop doesn't idle-sleep:

```bash
tmux new -s goal "caffeinate -i npm run goal:nas100"
# detach: Ctrl-B then D
# reattach later: tmux a -t goal
```

Each run logs to `monitor/history/goal_run_<label>_<ts>.log` — you can tail
it from another terminal.

---

## Daily pipeline

### 1. Preflight — `scheduler/start_daily.sh`

Verifies TradingView CDP is alive on `TV_CDP_PORT` and MT5 MCP is responding
on `MT5_MCP_PORT`. If MT5 MCP is down, launches it with credentials from
`.env` via Wine. Refreshes the `{US30,NAS100} LIVE.csv` files via
`monitor/update_live_data.mjs`. Exits once both services are reachable.

### 2. Baseline parsing — `monitor/parse_baselines.py`

Parses each registered baseline xlsx into a unified `baselines.json`:

- **TradingView format**: five sheets (Performance, Trades analysis,
  Risk-adjusted performance, List of trades, Properties). Max consecutive
  losses is derived from the List of trades sheet because TV does not emit
  it directly.
- **MT5 format**: single-sheet layout with a 14-column wide key/value grid.
  The parser walks three column groups (indices 0, 4, 8) to pick up every
  metric including Maximum consecutive losses ($).

### 3. Live collection — `monitor/collect_live.mjs`

- **TradingView**: connects to CDP on port 9222, walks the chart's data
  sources to find the named Pine strategy, reads its `ordersData()` array,
  and pairs orders into trades. Trades beyond the baseline's total count are
  treated as "live" (new activity since the baseline was frozen).
- **MT5**: calls `get_deals` via the MT5 MCP with `from_date` set to the
  baseline's end date. Deals are filtered by the strategy's magic number and
  paired entry/exit into trades. P&L = profit + commission + swap + fee.

For TV strategies with a TV→MT5 bridge bot, `mt5_bridge_magic` overrides the
TV ordersData path and reads MT5 deals instead — richer P&L data, single
source of truth.

Per-strategy live metrics are written to `monitor/state.json`.

### 4. Breach check — `monitor/check_breach.mjs`

Applies the four breach rules from `monitor/lib/metrics.mjs` per strategy.
Writes per-strategy breach arrays back into `state.json`, archives a
timestamped copy under `monitor/history/`, appends a one-line summary to
`monitor/history/daily_log.md`, and exits with code 1 if any strategy
breached.

---

## Remediation paths

### Tweak path — `agents/remediate_tweak.md`

Used when the diagnosis shows 1–3 input parameters would plausibly fix the
issue and the core edge is still visible in recent data.

**Budget:** 3 tweak attempts per strategy per run.

**Hard rule:** only `input` defaults may change. Strategy logic, indicator
calculations, and entry/exit rules must remain untouched.

**Verification:** the tweaked strategy must pass on **both** the original
baseline period **and** the live/failure window before it is committed. For
TradingView strategies this uses `pine_set_source` + `pine_smart_compile` +
`data_get_strategy_results` round trips. For MT5 strategies the matching
Python mirror in `monitor/mt5_mirror/` runs against the raw M1 CSV data in
`/Users/gervaciusjr/Desktop/Tradingview/Data/`.

Successful tweaks are logged to
`monitor/events/<strategy_id>-<date>/tweak_applied.md` with before/after
diffs and verification metrics.

### Rebuild path — `agents/remediate_rebuild.md`

Used when the tweak budget is exhausted, when diagnosis shows the edge is
structurally gone, or when two tweak attempts have failed in the last 30
days.

The dispatcher reads the failed strategy's symbol from
`monitor/config/strategies.json`, loads the matching goal file
(`agents/strategy-dev-goal-us30.md` or
`agents/strategy-dev-goal-nas100.md`), and invokes the rebuild as a **`/goal`
slash-command** so Claude keeps iterating until the pass condition is met —
no early exit. The goal files codify:

- 70/30 chronological train/validation split (no shuffle)
- No iteration cap; every validation touch logged for the DSR trial count
- Twelve validation criteria (MaxDD < 15%, Sharpe > 1.0 / 0.7, PF > 1.3 /
  1.1, etc.)
- Deflated Sharpe Ratio confidence > 0.95
- Sealed vault test (touch once)
- 800–2000 total trades, realistic commission/slippage/spread
- Output to `monitor/events/<strategy_id>-<date>/proposed_new/` with **both**
  `.pine` and `.mq5` versions

**Workspace discipline.** Each rebuild gets its own event dir under
`monitor/events/<strategy_id>-<date>/`. Inside it:

- `workspace/` — all scratch: trial strategies, failed iterations, plots,
  intermediate CSVs. Disposable.
- `proposed_new/` — only the 9 canonical artifacts. The deliverable.

When the goal passes, the rebuild runs
`bash scheduler/finalize_rebuild.sh monitor/events/<id>-<date>`, which
verifies every canonical artifact and then deletes `workspace/` recursively.
If anything is missing, it refuses to clean and tells you what to fix.

**Rebuilds are never auto-deployed.** They land in `proposed_new/` and are
flagged in the daily summary for the user to review and approve.

The long-form rebuild contract in
[`docs/strategy-dev-guidelines.md`](docs/strategy-dev-guidelines.md) is still
referenced by the tweak path's MQL5 translation notes, but the rebuild flow
itself runs off the short goal prompts.

---

## Historical data

Backtesting and rebuilds use M1 OHLCV CSVs in the repo's `Data/` directory
(~300 MB; gitignored so they don't bloat the repo):

```
/Users/gervaciusjr/Desktop/Tradingview/Data/
├── US30 TRAINING.csv       136 MB, M1 bars, frozen reference (2019–2026)
├── US30 LIVE.csv           (auto-grown) appended nightly with fresh bars
├── us30 tru oos.csv         14 MB, sealed vault (touch once)
├── NAS100 TRAINING.csv     134 MB, M1 bars, frozen reference (2019–2026)
├── NAS100 LIVE.csv         (auto-grown) appended nightly with fresh bars
└── NAS100 TRUE OOS.csv      14 MB, sealed vault (touch once)
```

**TRAINING csvs are frozen snapshots** — they never change after export.

**LIVE csvs are append-only**, extended every night by
`monitor/update_live_data.mjs` (run by the preflight). The updater:

1. Reads the last timestamp from `{SYMBOL} LIVE.csv` (or seeds from
   `{SYMBOL} TRAINING.csv` on first run).
2. Pulls the most recent N M1 bars from MT5 MCP `get_candles_latest`
   (default `N=5000`, ~3.5 days of safety margin).
3. Filters to bars strictly after the last known timestamp.
4. Appends them in the same tab-separated MT5 format so the training CSV
   loader works unmodified.

Python backtesters concatenate `TRAINING.csv + LIVE.csv` at load time. The
gap between "last bar in the data" and "now" therefore never exceeds 24
hours.

For timeframes above M1, the Python backtester resamples in-memory (group
every 5 rows for M5, every 30 rows for M30, etc., using standard OHLCV
aggregation: first open, max high, min low, last close, sum volume).

For bars fresher than the last LIVE update (e.g., the current session when
diagnosing an intraday breach), the agent can call MT5 `get_candles_latest`
or TV `data_get_ohlcv` directly and stitch in memory, deduplicating by
timestamp.

### Manual commands

```bash
npm run update-data              # nightly update (~5000 bars per symbol)
npm run update-data:bootstrap    # initial bootstrap (20000 bars per symbol)
```

---

## MCP servers

Both servers are declared in `.mcp.json`:

**tradingview** — stdio transport, ~78 tools for reading and controlling the
live TradingView Desktop chart. Key tools used by the monitor:

- `tv_health_check`, `tv_launch`
- `chart_get_state`, `tab_list`, `tab_switch`
- `data_get_strategy_results`, `data_get_trades`, `data_get_ohlcv`,
  `data_get_study_values`
- `pine_get_source`, `pine_set_source`, `pine_smart_compile`,
  `pine_get_errors`

**metatrader** — streamable-http transport on `127.0.0.1:18080`, ~25 tools
from `metatrader-mcp-server` running under Wine. Key tools:

- `get_account_info`
- `get_deals`, `get_candles_latest`
- position and order management tools (used by the bridge bots in `bots/`,
  not by the monitor itself)

The MT5 MCP has **no strategy tester tool** — see the architectural
constraint above. MT5 backtesting in the tweak and rebuild paths uses the
Python mirrors in `monitor/mt5_mirror/`.

---

## Security & gitignore policy

This repo publicly hosts the monitor framework but **not the strategies**.
The following are excluded by `.gitignore`:

- **Proprietary IP:** `baselines/` (all xlsx exports + Pine/MQL5 source) and
  `bots/` (TV→MT5 bridge bots). Anyone running this monitor brings their own
  strategies.
- **Historical data:** `Data/` (~300 MB of M1 OHLCV CSVs). Required at
  runtime but excluded from git because of size; reproduce it by exporting
  MT5 bars yourself or by running `npm run update-data:bootstrap`.
- **Generated state:** `monitor/baselines.json`, `monitor/state.json`,
  `monitor/history/`, `monitor/events/`, `monitor/config/mt5_tools.json`,
  `monitor/mt5_mirror/__pycache__/`.
- **Credentials:** `.env`, `.env.local`, `*.secret`,
  `.claude/settings.local.json`. Broker credentials are loaded from `.env`
  into `scheduler/start_daily.sh` at runtime — never hardcoded in scripts or
  prompt files.
- **Editor / OS noise:** `.DS_Store`, `.vscode/`, `.idea/`, `*.swp`, `*.log`.

The registry in `monitor/config/strategies.json` **is** tracked, so adding a
strategy always requires a commit even when the artefacts in `baselines/`
stay local.

If a credential has ever been committed to a public repository, rotate it in
the broker portal immediately. Git history is durable.

---

## Contributing

This is a personal trading-infrastructure project. External contributions are
not currently accepted, but the code is published openly as a reference for
anyone building a similar EOD monitor for a multi-venue strategy portfolio.
Patches improving portability, documentation, or language-specific safety are
welcome via issue or PR.

---

## License

[MIT](LICENSE) — © 2026 GervaciusJR.

The MIT license covers the **framework** code in this repository: the EOD
monitor, agent prompts, schedulers, and supporting scripts. It does **not**
grant any rights to the strategies, EAs, or bridge bots — those are
gitignored (`baselines/`, `bots/`) and remain proprietary.
