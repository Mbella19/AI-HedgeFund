# Failure Diagnosis Prompt

You are diagnosing why a trading strategy has breached its backtest baseline.

## Inputs

- `strategy_id`: the strategy being diagnosed
- `venue`: "tradingview" or "mt5"
- `breaches`: array of fired breach rules from state.json
- `baseline`: the strategy's baseline metrics from baselines.json
- `live_metrics`: the strategy's live-period metrics from state.json

## Analysis steps

### 1. Gather price data around the failure

**Primary source — the CSV files** (for both TV and MT5 strategies, since the
underlying instrument is the same index):

- `/Users/gervaciusjr/Desktop/strategy dev v3/Data/{SYMBOL} TRAINING.csv` — frozen M1 bars for the baseline era
- `/Users/gervaciusjr/Desktop/strategy dev v3/Data/{SYMBOL} LIVE.csv` — M1 bars appended nightly, covering the live/failure period
- `{SYMBOL}` is `US30` for US30 strategies and `NAS100` for NAS100 strategies
- Both files are tab-separated with columns `<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>`
- Load them together in Python (pandas `read_csv` with `sep='\t'`). Resample to the strategy's timeframe if it's above M1 (group every 5 rows for M5, every 30 rows for 30m).
- If `LIVE.csv` is missing or stale (last timestamp more than 2 days old), run `npm run update-data` before starting analysis.

**Secondary — live MCP pulls** (only for bars newer than the last LIVE.csv update, i.e., the current session):

- TradingView: `mcp__tradingview__data_get_ohlcv` with `summary=true`
- MT5: `get_candles_latest` via `monitor/lib/mt5_rpc.mjs` with `count=500`

**Live trades and indicator values** (always via MCP — these are not in the CSVs):

- TradingView strategies:
  - Switch to the chart tab via `mcp__tradingview__tab_list` + `mcp__tradingview__tab_switch`
  - `mcp__tradingview__data_get_trades` for the full trade list (filter to live period)
  - `mcp__tradingview__data_get_study_values` for ATR, ADX, volume MA, etc.
- MT5 strategies:
  - `get_deals` via `monitor/lib/mt5_rpc.mjs` for the live period, filtered by symbol and magic
  - Compute indicators in Python against the CSV bars (ATR, ADX, session VWAP, etc.)

### 2. Compute regime comparison

Compare the baseline era vs the live period on these dimensions:
- **Volatility**: average ATR (or daily range) baseline vs live. A >30% drop suggests the momentum/breakout edge has weakened. A >30% spike suggests stops are being hit more often.
- **Trend quality**: if possible, compute ADX or directional movement. Low ADX + high ATR = choppy whipsaws.
- **Session behavior**: are entries clustering at specific times? Has the session profile changed?
- **Spread/slippage**: for MT5, check if spreads have widened (compare expected vs actual fill prices in deals).
- **Gap frequency**: count overnight gaps >1 ATR in baseline vs live. More gaps = more stop-outs.

### 3. Cluster losing trades

Group the losing trades in the live period by failure mode:
- **Stop hit in chop** — entry was correct direction but stop was too tight for current volatility
- **TP missed** — price came within X% of target then reversed
- **Wrong direction** — signal fired but market moved opposite
- **Slippage/gap** — loss much larger than expected stop loss
- **Session edge** — trade opened near session boundary and got force-closed at a loss

### 4. Identify root cause

Name the specific regime shift. Examples:
- "NAS100 ATR dropped 42% since Feb 2026; the 4.5× threshold rarely triggers, and when it does the move is exhausted"
- "US30 VWAP band has compressed; mean-reversion entries are happening inside noise"
- "Session open dynamics changed after recent Fed schedule adjustment"

### 5. Recommend path

- **TWEAK** if: the root cause maps to 1–3 parameters (e.g., threshold, stop multiplier, session window), AND the strategy's core edge (momentum, mean-reversion, breakout) still appears in recent data at different parameter values.
- **REBUILD** if: the edge itself is gone in recent data, OR prior tweaks for this strategy failed within the last 30 days.

### 6. Output

Write `monitor/events/<strategy_id>-<date>/diagnosis.md` with:
```markdown
# Diagnosis: <strategy_name> (<venue>)
Date: <YYYY-MM-DD>

## Breaches fired
<list of breach rules and values>

## Regime comparison
<baseline era vs live period metrics table>

## Losing trade clusters
<failure mode breakdown with counts>

## Root cause
<specific regime shift description>

## Recommendation
Path: TWEAK | REBUILD
Rationale: <why this path>
<if TWEAK: which parameters to change and proposed values>
```
