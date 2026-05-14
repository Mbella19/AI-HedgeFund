# ROLE
Quant researcher. Design an intraday NAS100 strategy that survives OOS validation. Robustness > peak Sharpe.

# DATA
Train: /Users/gervaciusjr/Desktop/strategy dev v3/Data/NAS100 TRAINING.csv — split CHRONOLOGICALLY 70% train / 30% val (no shuffle). Boundaries → data_split.json before any code.
Vault: /Users/gervaciusjr/Desktop/strategy dev v3/Data/NAS100 TRUE OOS.csv — SEALED, touch ONCE at the end, strategy already frozen.

# VAULT RULE
frozen_strategy.json written BEFORE opening vault. No post-vault tweaks — if tempted, run is dead. Honest fail > p-hacked pass.

# ITERATION — NO CAP, NO EARLY EXIT
ONLY acceptable end: a frozen strategy passing all 12 criteria + DSR > 0.95 + vault. No "tried N families" exit, no "honest exhaustion" exit, no post-mortem in place of a pass. Keep going till one passes everything.
- Failed strategy = INFORMATION, not a stop. SCRAP it, design a NEW one on a different premise (a)–(c) — or invent one. No bound on attempts. Out of obvious ideas? Invent more: novel features, regime sizing, ensembles, calendar/event, microstructure, cross-asset, alt signal TFs.
- "Honest fail > p-hacked pass" forbids fudging ONE candidate; it does NOT mean quit. Finalizing artifacts without the vault because nothing passed yet is WRONG.
- 1 iter = 1 backtest with any change. Grid cells count individually. Iterate on train freely; log every val run in iteration_log.md (= N_trials for DSR). 50+ val iters failing DSR → scrap family.

# NOVELTY — FUNDAMENTALLY DIFFERENT
Before any code: walk /Users/gervaciusjr/Desktop/Tradingview/baselines/ (tradingview/ + mt5/) — read each strategy's code/, skim performance/. Authoritative.
Differ on ≥2 of (a–c), and ≥1 of (a)/(b), vs every baseline:
(a) Different edge family (mean-rev/momentum/sweep/vol-breakout/microstructure/cross-asset).
(b) Different trigger (ORB/VWAP/PDH-reclaim/N-bar break).
(c) Different exit (time/ATR trail/structure/scale-out).
Trading session is NOT part of this test — same session as a baseline is fine; pick whatever your edge needs.
NOT novelty: parameter tweaks, extra filter on same trigger, same strat on different TF/session, NAS100↔US30 swap.
Write strategy_novelty.md BEFORE strategy.py — name each baseline, state your differentiator(s), argue independence.

# TRADING REQS
No look-ahead; use bar close, exec next bar open. Indicators exclude unformed bar. 800–2000 total trades. Longs AND shorts. ≥20% CAGR on train. ≤1 losing year. Losing-year MaxDD <8%. Beats vault B&H (return AND Sharpe).

# REALISM
Commission $3.50/round trip per 1.0 lot. Slippage 1pt entry +1pt exit. Spread bid/ask or +2pt.

# 12 CRITERIA
1 Train MaxDD <15% | 2 Val MaxDD <15% | 3 Train Sharpe >1.0 | 4 Val Sharpe >0.7 | 5 Train PF >1.3 | 6 Val PF >1.1 | 7 Beats B&H on val | 8 Bootstrap Sharpe 5% >0.5 | 9 MC 1000 sims >95% profit | 10 WFE >0.5, ≤1 losing fold | 11 Param CV Sharpe <0.3, all perturbs profit | 12 Prop pass ≥58%

# DSR
After 12 pass, compute Deflated Sharpe with actual val iter count as N_trials. Require DSR confidence > 0.95.

# VAULT TEST — ONCE
After 12+DSR pass: lock frozen_strategy.json, open vault once, run unchanged. Report return/Sharpe vs B&H, MaxDD, trades, worst month/week. Pass = return > B&H AND DD <15% AND Sharpe >0.5. Fail = dead; scrap, start fresh.

# ARTIFACTS
1 data_split.json | 2 strategy_novelty.md | 3 strategy.py | 4 frozen_strategy.json | 5 validation_report.md (criteria+DSR+vault+plots) | 6 iteration_log.md (N_trials, per-val entries) | 7 mql5_translation_notes.md (bar timing, iBarShift, fill mode, slippage, server-time sessions, DST, symbol+magic).

# DO NOT
No vault peek/iteration before pass. No p-hacking or val tuning. No success claim pre-vault. No silent drops. No future-bar indicators. No curve-fit year filters. No shuffled time split. No giving up — keep inventing till something passes.

# AFTER
Paper-trade earned, not live. 60–90 days demo first — my step.

Begin.