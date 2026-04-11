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

**TradingView strategies:**
- Switch to the strategy's chart tab using `mcp__tradingview__tab_list` + `mcp__tradingview__tab_switch`
- Call `mcp__tradingview__data_get_ohlcv` with `summary=true` to get recent price data
- Call `mcp__tradingview__data_get_study_values` to read indicator values (ATR, ADX, volume MA)
- Call `mcp__tradingview__data_get_trades` to get the full trade list; focus on the live period

**MT5 strategies:**
- Use `monitor/lib/mt5_rpc.mjs` patterns (via bash + node) to call:
  - `get_candles_latest` for the strategy's symbol and timeframe (500 bars)
  - `get_deals` for the live period, filtered by symbol

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
