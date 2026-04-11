# ROLE
You are a quantitative researcher specializing in intraday equity index
strategies. Your task is to design a US30 day-trading strategy that survives
rigorous out-of-sample validation. Your goal is robustness, not maximizing
backtest performance. A strategy that scores 1.5 Sharpe and survives is worth
ten that score 3.0 and overfit.

# DATA
You have exactly two files:

1. /Users/gervaciusjr/Desktop/strategy dev v3/Data/US30 TRAINING.csv
   You must split this file CHRONOLOGICALLY into two slices BEFORE you write
   any strategy code:
       - TRAINING slice: first 70% of bars (by time, oldest first)
       - VALIDATION slice: last 30% of bars (by time, newest first)
   Do NOT shuffle. Do NOT use random sampling. Time-series data must be split
   in time order or you leak information from the future into the past.
   Save the slice boundaries (start/end timestamps of each slice) to
   data_split.json on the very first step, before any other work.

2. /Users/gervaciusjr/Desktop/strategy dev v3/Data/us30 tru oos.csv
   This is the VAULT. SEALED. Touch exactly once, at the very end, after the
   strategy is frozen.

# THE VAULT RULE — READ TWICE
The VAULT (us30 tru oos.csv) is a sealed envelope. Before opening it:
- The strategy must be FROZEN. No parameters, rules, filters, or thresholds
  may change after the vault is opened.
- Every parameter must be written to frozen_strategy.json BEFORE opening.
- If you find yourself wanting to "just tweak X based on what the vault showed"
  → STOP. That tweak invalidates the entire run. Declare the run dead.
- A failed vault test is more valuable than a passed iterated one. Report it
  honestly. Do not p-hack the result.

# ITERATION BUDGET — HARD CAP
You have a maximum of 15 iterations against the VALIDATION slice.
- One iteration = one full backtest where you change ANYTHING (entry rule,
  exit rule, parameter, filter, indicator, lookback).
- Multi-dimensional grid searches count as their cell count, not as one.
- After 15 iterations, present your best strategy and STOP.
- If your best still fails criteria, present it with a candid post-mortem
  rather than burning more iterations.

You may iterate freely on the TRAINING slice. The 15-iteration cap applies
ONLY to runs that touch the VALIDATION slice.

This budget exists because every validation iteration is a free shot at the
held-out data. With unlimited shots, anything passes by chance.

# TRADING REQUIREMENTS
1. NO look-ahead bias of any kind. Strategy can only use information
   available at bar close (open of next bar at the earliest for execution).
2. Indicators must use rolling windows that exclude the current bar where
   the close hasn't formed yet.
3. Active strategy: 800–2000 total trades across all data combined
   (training + validation + vault).
4. Trades BOTH longs and shorts.
5. Compound annual return ≥ 20% on the training slice.
6. At most one losing year across the full training+validation period.
7. Max drawdown on losing years < 8%.
8. Beats buy-and-hold on the VAULT data on BOTH total return AND Sharpe.

# REALISM REQUIREMENTS — backtest must include
- Commission: $3.50 per round trip per 0.1 lot (Pepperstone-equivalent)
- Slippage: 1 point on entry, 1 point on exit, on every trade
- Spread: use bid/ask if available, otherwise add 2 points to every trade

# 12 VALIDATION CRITERIA — applied to TRAINING and VALIDATION slices
| #  | Criterion                          | Threshold                          |
|----|------------------------------------|------------------------------------|
| 1  | Training Max Drawdown              | < 15%                              |
| 2  | Validation Max Drawdown            | < 15%                              |
| 3  | Training Sharpe                    | > 1.0                              |
| 4  | Validation Sharpe                  | > 0.7                              |
| 5  | Training Profit Factor             | > 1.3                              |
| 6  | Validation Profit Factor           | > 1.1                              |
| 7  | Beats Buy & Hold on Validation     | Strategy return > B&H              |
| 8  | Bootstrap Sharpe CI (5th pct)      | > 0.5                              |
| 9  | Monte Carlo (1000 sims, shuffled)  | > 95% profitable                   |
| 10 | Walk-Forward Efficiency            | > 0.5, at most 1 fold unprofitable |
| 11 | Parameter Sensitivity (CV Sharpe)  | < 0.3, all perturbations profitable|
| 12 | Prop Challenge Pass Rate           | ≥ 58%                              |

# DEFLATED SHARPE RATIO — REQUIRED
After all 12 criteria pass, compute the Deflated Sharpe Ratio (Bailey &
López de Prado, 2014, "The Deflated Sharpe Ratio") using the actual number
of validation iterations you ran as N_trials. The DSR penalizes Sharpe for
the number of trials, skew, and kurtosis. The strategy must achieve DSR
confidence > 0.95.

# VAULT TEST — RUN ONCE
After all 12 criteria pass and DSR > 0.95:
1. Lock the strategy. Write every parameter to frozen_strategy.json.
2. Open us30 tru oos.csv. ONE TIME.
3. Run the frozen strategy against vault data with no modifications.
4. Report:
   - Total return vs buy-and-hold
   - Sharpe vs buy-and-hold
   - Max drawdown
   - Trade count
   - Worst month, worst week
5. Pass = vault return > B&H return AND vault DD < 15% AND vault Sharpe > 0.5.
6. If the vault fails, the strategy is dead. Do NOT iterate against vault data.

# OUTPUT ARTIFACTS
Produce all of these:
1. data_split.json — start/end timestamps of training and validation slices.
   Written on step one, before any strategy code.
2. strategy.py — full backtest code, reproducible from CSV with one command.
3. frozen_strategy.json — every parameter, immutable after lock.
4. validation_report.md — all 12 criteria with values, DSR, vault result,
   equity curve PNG, monthly returns heatmap, drawdown chart.
5. iteration_log.md — count of validation iterations used, one-line note per
   iteration describing what was changed and why.
6. mql5_translation_notes.md — for every assumption in your Python backtest
   that could differ in MT5 live execution. At minimum cover:
   - Bar close timing (Python: end of bar; MT5: OnTick fires intra-bar)
   - Indicator handles vs vectorized rolling windows
   - POSITION_TIME granularity (MT5 includes seconds, your backtest may not)
   - iBarShift behavior at bar transitions
   - Fill mode (FOK vs IOC) and which the symbol supports
   - Slippage and partial fills
   - Session boundary handling at the broker's server time (not local time)
   - Daylight savings: US/EU DST mismatch periods
   - Position selection by symbol AND magic (not just symbol — multiple EAs
     may run on the same symbol and steal each other's positions)
   This file is critical. Every EA we've debugged in MT5 had a bug that lived
   in this layer, not in the strategy logic.

# DO NOT
- Do not look at vault data until all criteria pass.
- Do not iterate against vault even once.
- Do not p-hack: don't try 50 entry rules and pick the prettiest equity curve.
- Do not optimize hyperparameters on the validation slice.
- Do not declare success before running the vault test.
- Do not silently drop trades, gaps, weekends, news days, or losing months
  without documenting why.
- Do not use indicators or transformations that include future bars (this
  includes centered moving averages, future-shifted features, and any data
  smoothing that peeks ahead).
- Do not curve-fit a year-by-year filter (e.g. "skip 2022") to make returns
  look smooth.
- Do not shuffle or randomly sample time-series data when splitting. Time
  order must be preserved.

# AFTER YOU FINISH
The strategy has earned only the right to be paper-traded, not the right to
be live. The next step is 60–90 days of paper trading on a demo account
before any real capital. That step is not your responsibility — it is mine.

Begin.