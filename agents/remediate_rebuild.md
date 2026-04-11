# Strategy Rebuild Remediation

The diagnosis has determined that the strategy's edge is gone or prior tweaks have failed.
Build a completely new strategy following the development guidelines.

## Reference

The full strategy development protocol is at:
`/Users/gervaciusjr/Desktop/Tradingview/docs/strategy-dev-guidelines.md`

You MUST follow that document end-to-end. Key points:
- 70/30 chronological train/validation split (NO shuffle)
- Max 15 iterations against the validation slice
- 12 validation criteria (DD<15%, Sharpe>1.0/0.7, PF>1.3/1.1, etc.)
- Deflated Sharpe Ratio > 0.95
- Vault test (one-shot, frozen strategy)

## Adaptations for the rebuild context

1. **Use the failure data.** Include the live/failure period in the training+validation dataset. The new strategy must work on the data where the old one failed.

2. **Leverage the diagnosis.** The `diagnosis.md` file names the regime shift. Use this insight when designing the new strategy — e.g., if ATR dropped, consider an adaptive threshold; if session dynamics changed, consider different entry windows.

3. **Same instrument, same venue.** The new strategy must trade the same instrument on the same venue (TV or MT5) as the one it replaces.

4. **Data sources — EXACT PATHS:**

   **US30 strategies** (RAST V20, US30 ORB, US30 VWAP):
   - Training + validation: `/Users/gervaciusjr/Desktop/strategy dev v3/Data/US30 TRAINING.csv` (136 MB, M1 bars, 2019–2026)
   - Vault (sealed, touch once): `/Users/gervaciusjr/Desktop/strategy dev v3/Data/us30 tru oos.csv` (14 MB, true out-of-sample)

   **NAS100 strategies** (S2 Momentum Burst, Regime Switch Reclaim):
   - Training + validation: `/Users/gervaciusjr/Desktop/strategy dev v3/Data/NAS100 TRAINING.csv` (134 MB, M1 bars, 2019–2026)
   - Vault (sealed, touch once): `/Users/gervaciusjr/Desktop/strategy dev v3/Data/NAS100 TRUE OOS.csv` (14 MB, true out-of-sample)

   **All CSVs are M1 (1-minute) bars.** If the strategy runs on a higher timeframe (M5, 30m), resample the M1 data in your Python backtester (e.g., group every 5 rows for M5, every 30 rows for 30m using standard OHLCV aggregation: first open, max high, min low, last close, sum volume).

   **Strategy timeframes for resampling:**
   | Strategy | TV timeframe | MT5 timeframe |
   |---|---|---|
   | S2 Momentum Burst (NAS100) | 5 min | M5 |
   | Regime Switch Reclaim (NAS100) | 1 min | M1 |
   | RAST V20 (US30) | 5 min | M5 |
   | US30 ORB Reversal (US30) | 30 min | — |
   | US30 VWAP (US30) | — | M1 |

   **For pulling recent data beyond CSV coverage** (e.g., the live/failure period that happened after the CSV was exported):
   - TradingView: `mcp__tradingview__data_get_ohlcv` with `count=500` per call. Append to the CSV data.
   - MT5: `get_candles_latest` via MCP (symbol, timeframe, count=500). Append to the CSV data.
   - Ensure no overlap or gaps when stitching CSV + live data. Deduplicate by timestamp.

5. **Output location:**
   Write ALL artifacts to `monitor/events/<strategy_id>-<date>/proposed_new/`:
   - `data_split.json`
   - `strategy.py`
   - `frozen_strategy.json`
   - `validation_report.md`
   - `iteration_log.md`
   - `mql5_translation_notes.md` (for MT5 strategies)
   - The Pine Script or MQL5 source file

6. **Do NOT auto-deploy.** The new strategy goes into the proposed folder. The daily summary will flag it for the user's review. Rationale: replacing an entire strategy is a high-stakes decision. The user should see the validation report and decide.

## What a successful rebuild looks like

- All 12 validation criteria pass
- DSR confidence > 0.95
- Vault/holdout test passes (return > B&H, DD < 15%, Sharpe > 0.5)
- Strategy trades both longs and shorts
- 800–2000 total trades across all data combined
- Realistic costs (commission, slippage, spread per the guidelines)

## If the rebuild fails

If you cannot produce a strategy that passes all criteria within 15 validation iterations:
1. Write a candid post-mortem to `monitor/events/<strategy_id>-<date>/proposed_new/postmortem.md`
2. Include: what approaches you tried, why they failed, what the data is telling you
3. Recommend whether to:
   - Try again with a different approach later
   - Retire the strategy entirely (edge may be permanently gone)
   - Paper-trade a partial candidate for further evaluation
