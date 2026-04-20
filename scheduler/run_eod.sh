#!/usr/bin/env bash
# EOD Strategy Monitor — standalone entry point
#
# Runs the full monitoring pipeline (preflight → update data → collect → check).
# If a breach is detected, launches Claude Code to diagnose and remediate.
#
# Usage:
#   bash scheduler/run_eod.sh          # normal nightly run
#   crontab: 30 21 * * 1-5 cd /Users/gervaciusjr/Desktop/Tradingview && bash scheduler/run_eod.sh >> /tmp/eod_monitor.log 2>&1
#
# No Claude Code needed unless a breach fires.
set -uo pipefail

cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"

echo ""
echo "========================================"
echo " EOD Monitor — $(date '+%Y-%m-%d %H:%M %Z')"
echo "========================================"

# ─── Step 1: Preflight (checks TV CDP, starts MT5 MCP, updates LIVE CSVs) ───
bash scheduler/start_daily.sh
if [ $? -ne 0 ]; then
    echo "ERROR: Preflight failed — aborting"
    exit 1
fi

# ─── Step 2: Collect live trades ───
echo ""
echo "Collecting live trades..."
node monitor/collect_live.mjs
if [ $? -ne 0 ]; then
    echo "ERROR: Live collection failed — aborting"
    exit 1
fi

# ─── Step 3: Check breaches ───
echo ""
echo "Checking breach rules..."
node monitor/check_breach.mjs
BREACH_EXIT=$?

if [ $BREACH_EXIT -eq 0 ]; then
    echo ""
    echo "All clear — no breaches. Done."
    exit 0
fi

# ─── Step 4: Breach detected — launch Claude Code for diagnosis + remediation ───
echo ""
echo "========================================"
echo " BREACH DETECTED — launching Claude Code"
echo "========================================"
echo ""

claude \
    --dangerously-skip-permissions \
    --model claude-opus-4-7 \
    --effort max \
    -p "$(cat <<'PROMPT'
You are running as the EOD strategy monitor. A breach has been detected.

Read and follow the instructions in agents/daily_run.md starting from Step 3 (Diagnose breaches).

The breach data is already in monitor/state.json and baselines are in monitor/baselines.json.
Skip Steps 1 and 2 — preflight and collection are already done.

Diagnose every breached strategy, then remediate (tweak or rebuild) per the agent prompts.
Write the full report to monitor/history/ when done.
PROMPT
)"

echo ""
echo "Claude Code session complete."
exit 0
