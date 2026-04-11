# AI Hedge Fund — EOD Strategy Monitor

An autonomous end-of-day monitor for a portfolio of intraday quant strategies
running live across **TradingView Desktop** and **MetaTrader 5**. Every trading
day after the US cash close, the system:

1. Pulls live trades from both venues.
2. Compares every strategy against its frozen backtest baseline on four
   breach rules.
3. On breach, diagnoses the root cause from full price, indicator, and trade
   data.
4. Either tweaks strategy parameters (and auto-verifies against baseline + live
   periods) or proposes a full rebuild following the strategy development
   contract.
5. Logs every decision, parameter change, and backtest result for review.

The system is driven by Claude running an agent loop over prompt fragments in
`agents/`. All remediation is bounded by hard rules: tweaks only touch `input`
defaults, rebuilds must clear twelve validation criteria plus a sealed vault
test, and no rebuilt strategy is ever auto-deployed without human review.

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
- [Security](#security)
- [Contributing](#contributing)

---

## Portfolio

Five intraday index strategies are monitored across eight venue-specific
configurations. Some strategies run on both venues, others are venue-exclusive
because of execution quality.

| Strategy ID | Name | Venue | Symbol | Timeframe | Magic |
|---|---|---|---|---|---|
| `s2_momentum_burst_tv` | S2 Momentum Burst (declining risk) | TradingView | PEPPERSTONE:NAS100 | 5m | — |
| `s2_momentum_burst_mt5` | S2 Momentum Burst (declining risk) | MT5 | NAS100 | M5 | 520001 |
| `regime_switch_tv` | Regime Switch Reclaim Fast | TradingView | PEPPERSTONE:NAS100 | 1m | — |
| `regime_switch_mt5` | Regime Switch Reclaim Fast | MT5 | NAS100 | M1 | 60315002 |
| `rast_v20_tv` | RAST V20 US30 Day Trader | TradingView | FPMARKETS:US30 | 5m | — |
| `rast_v20_mt5` | RAST V20 US30 Day Trader | MT5 | US30 | M5 | 20020 |
| `us30_orb_tv` | US30 ORB Reversal v1.0 | TradingView | FPMARKETS:US30 | 30m | — |
| `us30_vwap_mt5` | US30 VWAP | MT5 | US30 | M1 | 55160420 |

**Venue notes:** `us30_vwap` trades MT5 only because the strategy does not
replicate cleanly on TradingView's commission/slippage model. `us30_orb_reversal`
trades TradingView only because the 30-minute bar close triggers don't map
well to MT5 Strategy Tester spreads.

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
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  monitor/collect_live.mjs            │
│  - TV: CDP → ordersData() → trades   │
│  - MT5: MCP get_deals → trades       │
│  - filters by baseline end date      │
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
│    remediate_rebuild.md              │
└──────────────────────────────────────┘
```

---

## Breach rules

Four rules fire any time the live period diverges meaningfully from the
frozen baseline. Minimum trade counts gate each rule so that an empty period
never creates a false positive.

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
- **Python 3.11+** — baseline xlsx parsing via `openpyxl`, and Python-mirror
  backtesters for MT5 strategies (built lazily on first breach)
- **Bash** — scheduler preflight
- **Pine Script v6** — TradingView strategies (source in `baselines/tradingview/*/code/`)
- **MQL5** — MetaTrader 5 EAs (source in `baselines/mt5/*/code/`)

### External interfaces

- **TradingView Desktop** via Chrome DevTools Protocol on `localhost:9222`.
  The TV process must be launched with `--remote-debugging-port=9222`. Trade
  data is read from the chart's `ordersData()` internal API.
- **MetaTrader 5** via the `metatrader-mcp-server` package running under Wine
  on macOS. The server exposes streamable-HTTP JSON-RPC on `127.0.0.1:18080`,
  providing `get_deals`, `get_candles_latest`, `get_account_info`, and related
  tools. It has no strategy tester tool, so MT5 backtesting uses Python
  mirrors instead.

---

## Repository layout

```
.
├── CLAUDE.md               Project context loaded by Claude sessions
├── README.md               This file
├── .env.example            Template for MT5 credentials + ports
├── .gitignore
├── package.json            npm scripts: parse, collect, check, monitor
│
├── agents/                 Claude agent prompts for the daily loop
│   ├── daily_run.md        Top-level orchestration
│   ├── diagnose.md         Failure analysis (regime shift, trade clustering)
│   ├── remediate_tweak.md  Parameter tuning (max 3 attempts)
│   └── remediate_rebuild.md Full rebuild (follows dev guidelines end-to-end)
│
├── baselines/              Frozen backtest exports, source of truth
│   ├── tradingview/
│   │   ├── S2 MOMENTUM BURST NAS100/{code,performance}/
│   │   ├── REGIME SWITCH RECLAIM NAS100/{code,performance}/
│   │   ├── RAST V20 US30/{code,performance}/
│   │   └── US30 ORB REVERSAL/{code,performance}/
│   └── mt5/
│       ├── S2 MOMENTUM BURST NAS100/{code,performance}/
│       ├── REGIME SWITCH RECLAIM NAS100/{code,performance}/
│       ├── RAST V20 US30/{code,performance}/
│       └── US30 VWAP/{code,performance}/
│
├── bots/
│   └── regime-switch-bot.mjs   TV→MT5 live mirror for Regime Switch Reclaim
│
├── docs/
│   └── strategy-dev-guidelines.md   Rebuild contract (70/30 split, DSR, vault)
│
├── monitor/                EOD monitor runtime
│   ├── config/
│   │   ├── strategies.json        Strategy registry
│   │   └── mt5_tools.json         (generated) MT5 MCP tool cache
│   ├── lib/
│   │   ├── cdp.mjs                TradingView CDP client
│   │   ├── mt5_rpc.mjs            MT5 MCP JSON-RPC client
│   │   └── metrics.mjs            Pure metric + breach functions
│   ├── parse_baselines.py         Parse xlsx → baselines.json
│   ├── collect_live.mjs           Pull live trades → state.json
│   ├── check_breach.mjs           Compare state vs baselines → history
│   ├── baselines.json             (generated)
│   ├── state.json                 (generated)
│   ├── history/                   (generated) daily archive + log
│   └── events/                    (generated) per-breach event folders
│
└── scheduler/
    └── start_daily.sh             Preflight script for the daily cron
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

A working `chrome-remote-interface` dependency is installed via npm.

---

## Installation

```bash
git clone https://github.com/Mbella19/AI-HedgeFund.git
cd AI-HedgeFund

# Node dependencies
npm install

# Python dependencies
pip install openpyxl

# Copy the env template and fill in your broker credentials
cp .env.example .env
$EDITOR .env
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

`.env` is gitignored. Never commit it. Credentials flow from `.env` into
`scheduler/start_daily.sh`, which launches the MT5 MCP server with them when
the server is not already running.

---

## Configuration

All strategies are declared in `monitor/config/strategies.json`. Each entry
maps a strategy ID to its venue, symbol, timeframe, magic number, baseline
xlsx path, source file path, and Pine strategy display name:

```json
{
  "id": "s2_momentum_burst_tv",
  "name": "S2 Momentum Burst",
  "venue": "tradingview",
  "symbol": "PEPPERSTONE:NAS100",
  "timeframe": "5",
  "magic": null,
  "baseline_xlsx": "baselines/tradingview/S2 MOMENTUM BURST NAS100/performance/...xlsx",
  "source_file": "baselines/tradingview/S2 MOMENTUM BURST NAS100/code/S2 MOMENTUM BURST.txt",
  "pine_strategy_name": "S2: 5b Momentum Burst - Declining Risk"
}
```

To add a new strategy:

1. Drop the xlsx export into
   `baselines/<venue>/<strategy>/performance/`.
2. Drop the Pine or MQL5 source into `baselines/<venue>/<strategy>/code/`.
3. Add an entry to `monitor/config/strategies.json` with the venue, symbol,
   timeframe, magic (MT5 only), and — for TV — the exact `pine_strategy_name`
   as it appears on the chart.
4. Regenerate baselines: `npm run parse`.

---

## Usage

### One-shot scripts

```bash
npm run parse        # parse xlsx → monitor/baselines.json
npm run collect      # pull live trades → monitor/state.json
npm run collect:dry  # same, no file writes
npm run check        # compare state vs baselines, archive to history
npm run monitor      # full EOD pipeline: preflight + collect + check
npm run preflight    # just the MCP preflight
```

### End-of-day autonomous run

The daily loop is triggered by a Claude scheduled job or by running the
[`agents/daily_run.md`](agents/daily_run.md) prompt manually. The agent:

1. Runs `scheduler/start_daily.sh` to bring up MCP servers.
2. Runs `npm run collect && npm run check`.
3. On a clean run, logs "all clear" to `monitor/history/daily_log.md` and
   exits.
4. On breach, for each breached strategy:
   - Writes `monitor/events/<strategy_id>-<YYYYMMDD>/diagnosis.md` per
     [`agents/diagnose.md`](agents/diagnose.md).
   - Chooses tweak or rebuild based on the diagnosis.
   - Runs the selected remediation path.
   - Writes a summary to `monitor/history/<YYYY-MM-DD>-summary.md`.

---

## Daily pipeline

### 1. Preflight — `scheduler/start_daily.sh`

Verifies TradingView CDP is alive on `TV_CDP_PORT` and MT5 MCP is responding
on `MT5_MCP_PORT`. If MT5 MCP is down, launches it with credentials from
`.env` via Wine. Exits once both services are reachable.

### 2. Baseline parsing — `monitor/parse_baselines.py`

Parses all eight baseline xlsx files into a unified `baselines.json`:

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
  and pairs orders into trades. Trades with indices beyond the baseline's
  total trade count are treated as "live" trades (i.e., new activity since
  the baseline was frozen).
- **MT5**: calls `get_deals` via the MT5 MCP with `from_date` set to the
  baseline's end date. Deals are filtered by the strategy's magic number and
  paired entry/exit into trades. P&L includes profit + commission + swap +
  fee.

Per-strategy live metrics are written to `monitor/state.json`.

### 4. Breach check — `monitor/check_breach.mjs`

Applies the four breach rules from `monitor/lib/metrics.mjs` per strategy.
Writes the per-strategy breach array back into `state.json`, archives a
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
`data_get_strategy_results` round trips. For MT5 strategies the Python
mirror backtester runs against the raw M1 CSV data in
`/Users/gervaciusjr/Desktop/strategy dev v3/Data/`.

Successful tweaks are logged to
`monitor/events/<strategy_id>-<date>/tweak_applied.md` with before/after
diffs and verification metrics.

### Rebuild path — `agents/remediate_rebuild.md`

Used when the tweak budget is exhausted, when diagnosis shows the edge is
structurally gone, or when two tweak attempts have failed in the last 30
days.

The rebuild follows [`docs/strategy-dev-guidelines.md`](docs/strategy-dev-guidelines.md)
end-to-end:

- 70/30 chronological train/validation split (no shuffle)
- Max 15 iterations against the validation slice
- Twelve validation criteria (max DD < 15%, Sharpe > 1.0 / 0.7, PF > 1.3 /
  1.1, DSR > 0.95, etc.)
- Sealed vault test (touch once)
- 800–2000 total trades, realistic commission/slippage/spread
- Output lands in `monitor/events/<strategy_id>-<date>/proposed_new/`

**Rebuilds are never auto-deployed.** They are written to the proposed folder
and flagged in the daily summary for the user to review and approve.

---

## Historical data

Backtesting and rebuilds use M1 OHLCV CSVs versioned outside this repo:

```
/Users/gervaciusjr/Desktop/strategy dev v3/Data/
├── US30 TRAINING.csv       136 MB, M1 bars, frozen reference (2019–2025)
├── US30 LIVE.csv           (auto-grown) appended nightly with fresh bars
├── us30 tru oos.csv         14 MB, sealed vault (touch once)
├── NAS100 TRAINING.csv     134 MB, M1 bars, frozen reference (2019–2025)
├── NAS100 LIVE.csv         (auto-grown) appended nightly with fresh bars
└── NAS100 TRUE OOS.csv      14 MB, sealed vault (touch once)
```

**TRAINING csvs are frozen snapshots.** They never change after export.

**LIVE csvs are append-only** and extended every night by
`monitor/update_live_data.mjs`, which runs as part of the preflight step in
`scheduler/start_daily.sh`. The updater:

1. Reads the last timestamp from `{SYMBOL} LIVE.csv` (or seeds from
   `{SYMBOL} TRAINING.csv` on first run).
2. Pulls the most recent N M1 bars from MT5 MCP `get_candles_latest`
   (default `N=5000`, ~3.5 days of safety margin).
3. Filters to bars strictly after the last known timestamp.
4. Appends them in the same tab-separated MT5 format so the training CSV
   loader works unmodified.

Python backtesters concatenate `TRAINING.csv` + `LIVE.csv` at load time. The
gap between "last bar in the data" and "now" therefore never exceeds 24
hours — the duration of one day's scheduler run.

For timeframes above M1, the Python backtester resamples in-memory (group
every 5 rows for M5, every 30 rows for 30m, using standard OHLCV
aggregation: first open, max high, min low, last close, sum volume).

For bars even fresher than the last LIVE update (e.g., the current session
when diagnosing an intraday breach), the agent can call MT5
`get_candles_latest` or TradingView `data_get_ohlcv` directly and stitch in
memory, deduplicating by timestamp.

### Manual commands

```bash
npm run update-data              # nightly update (≈5000 bars per symbol)
npm run update-data:bootstrap    # initial bootstrap (20000 bars per symbol)
```

---

## MCP servers

The project connects to two MCP servers, declared in `.mcp.json`:

**tradingview** — stdio transport, 78 tools for reading and controlling the
live TradingView Desktop chart. Key tools used:

- `tv_health_check`, `tv_launch`
- `chart_get_state`, `tab_list`, `tab_switch`
- `data_get_strategy_results`, `data_get_trades`, `data_get_ohlcv`,
  `data_get_study_values`
- `pine_get_source`, `pine_set_source`, `pine_smart_compile`,
  `pine_get_errors`

**metatrader** — streamable-http transport on `127.0.0.1:18080`, 25 tools
exposed by `metatrader-mcp-server` running under Wine. Key tools used:

- `get_account_info`
- `get_deals`, `get_candles_latest`
- position and order management tools (used by `bots/regime-switch-bot.mjs`
  but not by the monitor itself)

The MT5 MCP has **no strategy tester tool**. This is the primary architectural
constraint: MT5 backtesting in the tweak and rebuild paths uses Python
mirrors, built lazily on the first breach that needs one.

---

## Security

- All broker credentials live in `.env`, which is gitignored.
- `.env.example` is a template with no real values.
- `.claude/settings.local.json` is gitignored because it may contain
  credentials in bash command history.
- Generated state files (`monitor/baselines.json`, `monitor/state.json`,
  `monitor/history/`, `monitor/events/`) are gitignored — nothing with live
  trade data or broker state is committed.
- If a credential has ever been committed to a public repository, rotate it
  in the broker portal immediately. Git history is durable.

---

## Contributing

This is a personal trading infrastructure project. External contributions
are not currently accepted, but the code is published openly as a reference
for anyone building a similar EOD monitor for a multi-venue strategy
portfolio. Patches that improve portability, documentation, or
language-specific safety are welcome via issue or PR.

---

## License

No license specified. All rights reserved by the author until a license is
added.
