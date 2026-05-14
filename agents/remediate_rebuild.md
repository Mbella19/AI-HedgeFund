# Strategy Rebuild Remediation

The diagnosis has determined that the strategy's edge is gone or prior tweaks
have failed. Build a completely new strategy by **invoking the `/goal` slash
command** with the symbol-matched goal prompt.

## How to dispatch the rebuild

1. **Look up the failed strategy's symbol** from `monitor/config/strategies.json`
   (the `symbol` field — e.g. `"US30"` or `"NAS100"`).

2. **Pick the matching goal file:**

   | Symbol | Goal file |
   |---|---|
   | `US30` | `agents/strategy-dev-goal-us30.md` |
   | `NAS100` | `agents/strategy-dev-goal-nas100.md` |

3. **Read the goal file's contents** with the Read tool.

4. **Invoke the rebuild as a goal.** Type `/goal` first, then paste the goal
   file content immediately followed by the **rebuild context block** below.
   The `/goal` skill makes Claude keep iterating until the goal's pass
   condition is met — exactly what a rebuild requires (vault + DSR + 12
   criteria, no early exit).

   The literal invocation looks like:

   ```
   /goal
   <pasted contents of strategy-dev-goal-<symbol>.md>

   # REBUILD CONTEXT (appended to the goal above)
   <the rebuild context block below>
   ```

## Rebuild context block (append after the goal file content)

```
# REBUILD CONTEXT
Strategy being replaced: <strategy_id> (failed on <breach_rules>, see
monitor/events/<strategy_id>-<YYYYMMDD>/diagnosis.md).

# FAILURE DATA INCLUDED
Concatenate the matching LIVE.csv (US30 LIVE.csv or NAS100 LIVE.csv) with the
TRAINING csv before splitting. Same tab-separated OHLCV format. Refresh stale
LIVE data first via `npm run update-data`. The new strategy must work on the
period where the old one broke.

# LEVERAGE THE DIAGNOSIS
Read monitor/events/<strategy_id>-<YYYYMMDD>/diagnosis.md. The regime shift
identified there is a starting point, not a constraint — the goal's novelty
rules still apply.

# DUAL TRANSLATION REQUIRED
Always produce BOTH a Pine Script (.pine) and an MQL5 (.mq5) version of the
final frozen strategy, regardless of which venue triggered the breach. Both
trade the same instrument as the strategy being replaced.

# WORKSPACE VS FINAL OUTPUT (HARD RULE)
Use TWO subdirectories under monitor/events/<strategy_id>-<YYYYMMDD>/:

  workspace/      — ALL scratch work goes here: trial strategies, failed
                    iterations, intermediate CSVs, plot PNGs, debug scripts,
                    notebooks, anything you might delete tomorrow. The
                    finalize step will wipe this directory entirely.

  proposed_new/   — ONLY the canonical artifacts listed below. Nothing else
                    survives long-term outside this folder. Treat
                    proposed_new/ as the deliverable.

Canonical artifacts (MUST exist in proposed_new/ before finalize will run):
- data_split.json
- strategy_novelty.md
- strategy.py
- frozen_strategy.json
- validation_report.md
- iteration_log.md
- mql5_translation_notes.md
- strategy.pine
- strategy.mq5

# FINALIZE STEP (RUN BEFORE DECLARING THE GOAL DONE)
Once all 12 criteria + DSR + vault pass AND all 9 canonical artifacts are
written, run:

  bash scheduler/finalize_rebuild.sh monitor/events/<strategy_id>-<YYYYMMDD>

The script verifies the 9 canonical files exist in proposed_new/ and then
deletes workspace/ recursively. If anything is missing, it refuses to clean
and tells you what to fix. Goal completion is not real until finalize
returns success — re-paste its "FINALIZE COMPLETE" output verbatim in your
final message so the auto-resume wrapper sees the completion signal.

# NO AUTO-DEPLOY
The rebuilt strategy goes to proposed_new/ only. Flag it in the EOD summary
for user review — replacing a running strategy is the user's decision, never
the monitor's.

# IF NOTHING PASSES
The goal forbids early exit. Keep inventing new families. Only after a
genuinely exhausted search across distinct edge families (≥10 scrapped
candidates, each on a different premise) may you write a postmortem to
proposed_new/postmortem.md explaining what was tried and why nothing held —
and even then, the goal stays open, not closed. Do NOT run finalize in this
state; workspace/ stays so you (or a later session) can resume.
```

## Why `/goal` (not a plain prompt)

The goal files explicitly forbid early exit: "ONLY acceptable end: a frozen
strategy passing all 12 criteria + DSR > 0.95 + vault." The `/goal` skill
enforces that behaviour at the harness level — Claude keeps working across
context resets until the pass condition is met. A plain prompt would let
Claude stop after one "honest fail," which violates the rebuild contract.
