#!/usr/bin/env bash
# scheduler/finalize_rebuild.sh — verify + clean up a completed /goal rebuild
#
# A rebuild run produces two subdirectories under monitor/events/<id>-<date>/:
#
#   workspace/      — all scratch: failed iterations, trial scripts, plots,
#                     intermediate metric dumps. Disposable.
#   proposed_new/   — exactly the canonical artifacts the user reviews.
#
# This script enforces that split at the end of a goal run:
#
#   1. Verify proposed_new/ contains every canonical artifact.
#   2. If anything is missing, fail loud — do NOT delete workspace/ (the user
#      may need it to debug the gap).
#   3. If everything is present, delete workspace/ recursively.
#
# Usage:
#   bash scheduler/finalize_rebuild.sh monitor/events/regime_switch_mt5-20260514
#   bash scheduler/finalize_rebuild.sh monitor/events/regime_switch_mt5-20260514 --dry-run

set -uo pipefail

cd "$(dirname "$0")/.."

EVENT_DIR="${1:-}"
MODE="${2:-}"

if [ -z "$EVENT_DIR" ]; then
    echo "Usage: bash scheduler/finalize_rebuild.sh <event-dir> [--dry-run]" >&2
    echo "Example: bash scheduler/finalize_rebuild.sh monitor/events/regime_switch_mt5-20260514" >&2
    exit 2
fi

if [ ! -d "$EVENT_DIR" ]; then
    echo "ERROR: $EVENT_DIR not found." >&2
    exit 1
fi

PROPOSED="$EVENT_DIR/proposed_new"
WORKSPACE="$EVENT_DIR/workspace"

# Canonical artifacts that MUST exist in proposed_new/ for finalize to proceed.
# Match the artifact list in the strategy-dev-goal-{us30,nas100}.md prompts.
CANONICAL=(
    "data_split.json"
    "strategy_novelty.md"
    "strategy.py"
    "frozen_strategy.json"
    "validation_report.md"
    "iteration_log.md"
    "mql5_translation_notes.md"
    "strategy.pine"
    "strategy.mq5"
)

echo "═══════════════════════════════════════════════════════════════"
echo "  FINALIZE REBUILD"
echo "═══════════════════════════════════════════════════════════════"
echo "Event dir:    $EVENT_DIR"
echo "proposed_new: $PROPOSED"
echo "workspace:    $WORKSPACE"
echo "Mode:         ${MODE:-finalize}"
echo ""

# ── Step 1: verify proposed_new/ ────────────────────────────────────────────
if [ ! -d "$PROPOSED" ]; then
    echo "ERROR: $PROPOSED does not exist. Did the rebuild complete?" >&2
    exit 1
fi

missing=()
for f in "${CANONICAL[@]}"; do
    if [ ! -s "$PROPOSED/$f" ]; then
        missing+=("$f")
    fi
done

if [ "${#missing[@]}" -gt 0 ]; then
    echo "REFUSING TO CLEAN — proposed_new/ is missing canonical artifacts:"
    for f in "${missing[@]}"; do
        echo "  - $f"
    done
    echo ""
    echo "Fix the gaps before re-running finalize. workspace/ left untouched"
    echo "so you can investigate."
    exit 1
fi

echo "✓ proposed_new/ contains all ${#CANONICAL[@]} canonical artifacts:"
for f in "${CANONICAL[@]}"; do
    size=$(wc -c < "$PROPOSED/$f" | tr -d ' ')
    echo "    $f ($size bytes)"
done

# Surface any extras in proposed_new/ — kept, not deleted, but flagged
extras=()
while IFS= read -r -d '' entry; do
    name="$(basename "$entry")"
    keep=0
    for c in "${CANONICAL[@]}"; do
        [ "$name" = "$c" ] && keep=1 && break
    done
    [ $keep -eq 0 ] && extras+=("$name")
done < <(find "$PROPOSED" -mindepth 1 -maxdepth 1 -print0)

if [ "${#extras[@]}" -gt 0 ]; then
    echo ""
    echo "Note: proposed_new/ also contains ${#extras[@]} non-canonical entry/entries (kept as-is):"
    for e in "${extras[@]}"; do
        echo "    $e"
    done
fi

# ── Step 2: report workspace contents ───────────────────────────────────────
echo ""
if [ -d "$WORKSPACE" ]; then
    ws_count=$(find "$WORKSPACE" -mindepth 1 | wc -l | tr -d ' ')
    ws_size=$(du -sh "$WORKSPACE" 2>/dev/null | awk '{print $1}')
    echo "workspace/ contents: $ws_count items, $ws_size"
else
    echo "workspace/ does not exist — nothing to clean."
    echo ""
    echo "✓ Finalize complete."
    exit 0
fi

# ── Step 3: delete workspace/ (or preview in dry-run) ───────────────────────
if [ "$MODE" = "--dry-run" ]; then
    echo ""
    echo "DRY RUN — would delete:"
    echo "    $WORKSPACE  (recursive, $ws_size)"
    echo ""
    echo "Re-run without --dry-run to actually clean up."
    exit 0
fi

echo ""
echo "Deleting workspace/ ..."
rm -rf "$WORKSPACE"
echo "✓ workspace/ removed."

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  FINALIZE COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
echo "Kept under $EVENT_DIR:"
echo "  - diagnosis.md (if present)"
echo "  - proposed_new/  (${#CANONICAL[@]} canonical artifacts$([ ${#extras[@]} -gt 0 ] && echo " + ${#extras[@]} extras"))"
echo ""
echo "User review next — replace the running strategy only after reading"
echo "$PROPOSED/validation_report.md."
