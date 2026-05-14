# ROLE
You are a quantitative researcher specializing in intraday equity index
strategies. Your task is to design a US30 day-trading strategy that survives
rigorous out-of-sample validation. Your goal is robustness, not maximizing
backtest performance. A strategy that scores 1.5 Sharpe and survives is worth
ten that score 3.0 and overfit.

# DATA
You have exactly two files:

1. /Users/gervaciusjr/Desktop/Tradingview/Data/US30 TRAINING.csv
   You must split this file CHRONOLOGICALLY into two slices BEFORE you write
   any strategy code:
       - TRAINING slice: first 70% of bars (by time, oldest first)
       - VALIDATION slice: last 30% of bars (by time, newest first)
   Do NOT shuffle. Do NOT use random sampling. Time-series data must be split
   in time order or you leak information from the future into the past.
   Save the slice boundaries (start/end timestamps of each slice) to
   data_split.json on the very first step, before any other work.

2. /Users/gervaciusjr/Desktop/Tradingview/Data/us30 tru oos.csv
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

# ITERATION DISCIPLINE — NO CAP, NO EARLY EXIT
There is NO hard cap on iterations and NO early exit. Keep working until a
frozen strategy passes every criterion in this document (12 validation
criteria, DSR > 0.95, vault test). If a strategy — or a whole design family —
hits a ceiling, switch families and keep going. There is no version of "done"
that isn't a passing strategy: no "I tried N families" exit, no "honest
exhaustion" exit, no post-mortem in place of a pass.

Definitions and discipline that still apply:
- One iteration = one full backtest where you change ANYTHING (entry rule,
  exit rule, parameter, filter, indicator, lookback).
- Multi-dimensional grid searches count as their cell count, not as one.
- You may iterate freely on the TRAINING slice.
- Every run that touches the VALIDATION slice must be logged in
  iteration_log.md with the exact change and reason. The final count of
  validation iterations is the N_trials input to the Deflated Sharpe Ratio.

Why no cap, and the trap to avoid: every validation iteration is a free shot
at the held-out data, so with enough shots anything passes by chance. The DSR
is what protects you here — it penalizes Sharpe by the trial count, skew, and
kurtosis. Iterate as long as you need to, but expect the DSR bar (0.95) to
rise with every validation touch. If you've burned 50+ validation iterations
and DSR is still failing, your design family is probably wrong; rebuild on a
different premise rather than grind further.

# WHEN A STRATEGY FAILS — SCRAP IT AND START FRESH, DO NOT QUIT
A failed strategy is INFORMATION, not a stopping condition. If the current
candidate cannot meet the requirements (for example, you have shown that 20%
CAGR is unreachable with 800+ trades and Sharpe > 1.0 in the family you
tried), the correct response is:

1. Document what the family's edge ceiling actually was, in iteration_log.md.
2. SCRAP the strategy entirely — throw away the code, parameters, premise.
3. Pick a fundamentally different premise from the novelty test (a)–(c) below
   — or invent an entirely new one — and design a NEW strategy from scratch.
4. Run the full pipeline on the new candidate.
5. Repeat until the goal is complete.

"Honest fail > p-hacked pass" is ONLY about results integrity for a single
candidate — do not fudge a strategy's numbers to look like a pass. It does
NOT mean "give up after one failure," or after ten, or after fifty. Quitting
the mission before a strategy passes is the OPPOSITE of what that rule asks.

There is exactly ONE acceptable terminal state: a frozen strategy that passes
all 12 criteria + DSR > 0.95 + the vault test. That's it. There is no "honest
exhaustion" exit, no "I attempted N families" exit, no "this asset doesn't
have enough edge" exit, no post-mortem-in-place-of-success exit. If nothing
has passed yet, you are not done — invent another approach and keep going.

If you genuinely run out of obvious design families, invent new ones: novel
feature combinations, regime-conditioned position sizing, ensembles of weak
signals, event/calendar effects, order-flow / microstructure proxies, cross-
asset lead-lag, alternative signal timeframes feeding an intraday execution
layer, nonlinear filters, and so on. The strategy space is not exhausted by
the families you've tried so far.

"Finalize artifacts without opening the vault because nothing has passed yet"
is NOT an acceptable terminal state. If you find yourself there, scrap the
dead candidate and design a new one.

# STRATEGY NOVELTY — MUST BE FUNDAMENTALLY DIFFERENT
Before writing any code, read every strategy already in the live portfolio:

    /Users/gervaciusjr/Desktop/Tradingview/baselines/

Walk both subtrees (`tradingview/` and `mt5/`). For each strategy folder, read
the source under `code/` and skim the performance file under `performance/`
so you understand its actual edge, trigger, exit, and session — not just its
name. Treat that directory as the authoritative list of what already exists;
do not rely on prior knowledge of which strategies are there.

Your strategy must be FUNDAMENTALLY DIFFERENT from every strategy you find in
that directory. "Fundamentally different" means at least two of (a)–(c) must
hold versus each existing baseline, and at least one of (a) or (b) must hold
versus every existing baseline:
  (a) Different core edge family (e.g. mean reversion vs momentum vs
      carry/seasonality vs liquidity-sweep vs volatility-breakout vs
      microstructure vs cross-asset signal — not a reskin of the same edge).
  (b) Different setup trigger (e.g. opening range vs VWAP touch vs prior-day
      level reclaim vs N-bar breakout vs session-anchored stat) — a new
      parameter on the same trigger does NOT count.
  (c) Different exit/management logic (e.g. time stop vs ATR trail vs
      structure stop vs scale-out vs target-at-stat-level).

Trading session is explicitly OUT OF SCOPE for this test. A new strategy may
trade the same session as an existing baseline (NY open, London, cash close,
overnight — whatever) and that is fine. Picking a different session is neither
required for novelty nor sufficient on its own. Choose whatever session your
edge actually needs; it is an operational decision, not a differentiator.

What does NOT count as "fundamentally different":
- Same edge with different parameters, indicator lengths, or thresholds.
- Same trigger with an extra filter bolted on.
- Same strategy on a different timeframe.
- Same strategy on a different session (NY ↔ London etc. is NOT novelty).
- Same strategy on a different symbol from the same complex (US30 ↔ NAS100
  swap is NOT novelty).

Before writing any code, write strategy_novelty.md that names each existing
baseline, states which of (a)–(c) you are differentiating on, and gives a
one-paragraph argument for why your edge is independent. If you cannot make
that argument honestly, pick a different idea before you start.

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
- Commission: $3.50 per round trip per 1.0 lot (Pepperstone-equivalent)
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
2. strategy_novelty.md — novelty argument vs every existing baseline. Written
   BEFORE strategy.py.
3. strategy.py — full backtest code, reproducible from CSV with one command.
4. frozen_strategy.json — every parameter, immutable after lock.
5. validation_report.md — all 12 criteria with values, DSR, vault result,
   equity curve PNG, monthly returns heatmap, drawdown chart.
6. iteration_log.md — total count of validation iterations used (this is
   N_trials for DSR), one-line note per iteration describing what was changed
   and why.
7. mql5_translation_notes.md — for every assumption in your Python backtest
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
- Do not stop, write a final post-mortem, or finalize artifacts until a
  strategy has passed all 12 criteria + DSR + the vault test. "Nothing
  passed yet" is not done — keep inventing and testing new strategies.
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