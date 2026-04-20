#!/usr/bin/env bash
# Synthetic breach drill — end-to-end test of the diagnose/remediate pipeline
# without needing an actual failure.
#
# Writes a sandbox state.json with a forced hard_max_dd breach for the target
# strategy, then launches Claude Code with a drill prompt that routes all
# output to monitor/events/drill-<ts>/ and forbids any edits to source files
# or production state.
#
# Usage:
#   bash scheduler/run_drill.sh <strategy_id>
#
# Example:
#   bash scheduler/run_drill.sh s2_momentum_burst_mt5
set -uo pipefail

cd "$(dirname "$0")/.."
STRATEGY_ID="${1:-${DRILL_STRATEGY:-}}"

if [ -z "$STRATEGY_ID" ]; then
    echo "ERROR: strategy id required"
    echo "Usage: bash scheduler/run_drill.sh <strategy_id>"
    exit 1
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DRILL_DIR="monitor/events/drill-${STRATEGY_ID}-${TIMESTAMP}"
mkdir -p "$DRILL_DIR"

echo ""
echo "========================================"
echo " DRILL MODE — $(date '+%Y-%m-%d %H:%M %Z')"
echo " Target strategy: $STRATEGY_ID"
echo " Output folder:   $DRILL_DIR"
echo "========================================"

# ─── Build a synthetic sandbox state ───
# Copy the current state.json (if any) into the drill folder, force a
# hard_max_dd breach on the target strategy. We never overwrite production
# state.json — the drill only reads from the sandbox copy.
SANDBOX_STATE="${DRILL_DIR}/state.json"
if [ -f monitor/state.json ]; then
    cp monitor/state.json "$SANDBOX_STATE"
else
    echo '{"timestamp":"drill","strategies":{}}' > "$SANDBOX_STATE"
fi

node - "$SANDBOX_STATE" "$STRATEGY_ID" <<'NODE_SCRIPT'
import { readFileSync, writeFileSync } from "fs";
const [, , statePath, strategyId] = process.argv;
const state = JSON.parse(readFileSync(statePath, "utf-8"));
if (!state.strategies) state.strategies = {};
if (!state.strategies[strategyId]) {
  state.strategies[strategyId] = {
    venue: "mt5",
    symbol: "DRILL",
    live_trades: 0,
    metrics: { maxDdPct: 99.9, maxConsecLoss: 99, pf30t: 0.1, ret30d: -50, totalPnl: -10000, tradeCount: 0 },
    breaches: [],
  };
}
state.strategies[strategyId].breaches = [
  {
    rule: "hard_max_dd",
    msg: "DRILL: synthetic 99.9% > baseline (this is a drill, no real breach)",
  },
];
state._drill = true;
writeFileSync(statePath, JSON.stringify(state, null, 2));
console.log(`[drill] wrote synthetic breach for ${strategyId} to ${statePath}`);
NODE_SCRIPT

# ─── Write the drill prompt ───
cat > "${DRILL_DIR}/drill_prompt.md" <<EOF
# DRILL MODE — Synthetic Breach

This is a drill invocation of the diagnose/remediate pipeline. A synthetic
\`hard_max_dd\` breach has been injected for strategy \`${STRATEGY_ID}\`
into the sandbox state file at \`${SANDBOX_STATE}\`.

**Rules for this drill:**

1. Read the sandbox state from \`${SANDBOX_STATE}\` — NOT from
   \`monitor/state.json\`.
2. Follow \`agents/diagnose.md\` to produce a diagnosis. Write it to
   \`${DRILL_DIR}/diagnosis.md\`.
3. Make a tweak-vs-rebuild decision and write it to
   \`${DRILL_DIR}/decision.md\`.
4. **DO NOT edit any source files** under \`baselines/\`, \`bots/\`, or
   anywhere else. This is a drill. Any proposed changes go into
   \`${DRILL_DIR}/proposed_changes.md\` as a description only.
5. **DO NOT write to \`monitor/state.json\`, \`monitor/baselines.json\`,
   or \`monitor/history/\`.** The entire drill is self-contained in
   \`${DRILL_DIR}\`.
6. When complete, write a summary to \`${DRILL_DIR}/drill_summary.md\`
   noting: time taken, steps executed, any issues that would have
   prevented a real run, and your confidence level in the pipeline.

Your goal: verify the diagnose → decide → remediate-plan chain actually
works end-to-end on this synthetic failure, without touching production.
EOF

echo ""
echo "Launching Claude Code in drill mode..."
echo ""

claude \
    --dangerously-skip-permissions \
    --model claude-opus-4-7 \
    --effort max \
    -p "$(cat "${DRILL_DIR}/drill_prompt.md")"

EXIT=$?

echo ""
echo "========================================"
echo " DRILL COMPLETE — exit $EXIT"
echo " See $DRILL_DIR for artifacts"
echo "========================================"
exit $EXIT
