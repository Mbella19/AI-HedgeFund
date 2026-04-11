# Parameter Tweak Remediation

You are adjusting input parameters of a strategy that has breached its baseline.
The diagnosis has identified 1–3 parameters to change. The core edge is still present.

## Rules

1. **Only change `input` parameter defaults.** Never modify strategy logic, indicator calculations, or entry/exit rules.
2. **Budget: 3 tweak attempts per strategy per run.** If none pass, escalate to the rebuild path.
3. **Both periods must pass.** The tweaked strategy must perform acceptably on BOTH the original baseline period AND the live/failure period.

## TradingView tweak procedure

1. Read the current Pine source: `mcp__tradingview__pine_get_source`
2. Edit the relevant `input.*` default values using `mcp__tradingview__pine_set_source`
3. Compile: `mcp__tradingview__pine_smart_compile`
4. Check for errors: `mcp__tradingview__pine_get_errors`
5. Wait for the strategy to recalculate (2–3 seconds)
6. Read results: `mcp__tradingview__data_get_strategy_results`
7. Check the performance summary for:
   - Max drawdown < baseline threshold (the original baseline max DD)
   - Profit factor > 1.1
   - Total trades within reasonable range of baseline (±30%)
   - No negative Sharpe
8. Also check that the LIVE PERIOD metrics now satisfy all 4 breach rules with margin.

### Verification

The tweaked strategy passes if:
- Baseline-period DD does not exceed 120% of the original baseline DD
- Baseline-period PF stays above 1.1
- Live-period metrics clear all 4 breach rules
- Total trade count is within ±30% of baseline

If it fails, revert to the original source and try a different parameter combination (up to 3 attempts total).

## MT5 tweak procedure

Since the MT5 MCP does not expose a strategy tester tool:

1. Read the current MQL5 source from the baseline Code/ folder
2. Identify the `input` lines to change
3. If a Python mirror exists at `monitor/mt5_mirror/<strategy>.py`, update the matching parameters and run it against historical data
4. If no Python mirror exists, build one (follow the pattern in `docs/strategy-dev-guidelines.md` section on mql5_translation_notes)
5. Verify using the same criteria as TradingView

**Historical data for the Python mirror backtester:**
- US30 strategies: `/Users/gervaciusjr/Desktop/strategy dev v3/Data/US30 TRAINING.csv` (M1, 2019–2026)
- NAS100 strategies: `/Users/gervaciusjr/Desktop/strategy dev v3/Data/NAS100 TRAINING.csv` (M1, 2019–2026)
- Both are M1 bars. Resample to M5 (group 5 bars) or other timeframe as needed:
  - S2 Momentum Burst NAS100 → resample to M5
  - Regime Switch Reclaim NAS100 → use M1 directly
  - RAST V20 US30 → resample to M5
  - US30 VWAP → use M1 directly
- For recent data past CSV coverage, pull via MT5 MCP `get_candles_latest` and append

## After successful tweak

1. Save the original source as `monitor/events/<strategy_id>-<date>/before.txt`
2. Save the tweaked source as `monitor/events/<strategy_id>-<date>/after.txt`
3. Write verification results to `monitor/events/<strategy_id>-<date>/verify.json`
4. For TradingView: the new source is already applied on the chart (from pine_set_source + compile)
5. For MT5: write the updated .mq5 to the EA's source location. The user will need to recompile in MetaEditor.
6. Log the change to `monitor/events/<strategy_id>-<date>/tweak_applied.md`:
   ```
   # Tweak Applied: <strategy>
   Date: <date>
   Parameters changed:
   - <param>: <old> → <new>
   Baseline verification: PASS (DD=X%, PF=X, trades=N)
   Live verification: PASS (DD=X%, PF=X, consec_loss=N)
   ```

## If all 3 attempts fail

Write `monitor/events/<strategy_id>-<date>/tweak_failed.md` and return control to the daily run loop, which will escalate to the rebuild path.
