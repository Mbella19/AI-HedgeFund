#!/usr/bin/env bash
# scheduler/auto_resume.sh — run a /goal under Claude Code, auto-resume past rate limits.
#
# Problem this solves:
#   When Claude hits the 5-hour Pro/Max usage cap mid-/goal, the session stops
#   and you have to manually `/goal` again later. This wrapper fires the goal
#   headlessly with `claude -p`, watches for the rate-limit signal, sleeps
#   ~5h5m, and resumes the SAME session via `claude --continue`. Repeats until
#   the goal completes (clean exit with no rate-limit signal in the tail) or
#   you Ctrl-C.
#
# Usage:
#   bash scheduler/auto_resume.sh agents/strategy-dev-goal-nas100.md
#   bash scheduler/auto_resume.sh "your inline goal text"
#
# Recommended unattended invocation (keeps running if you close the terminal):
#   tmux new -s goal "caffeinate -i bash scheduler/auto_resume.sh agents/strategy-dev-goal-nas100.md"
#   # detach with Ctrl-B then D; reattach later with: tmux a -t goal
#
# `caffeinate -i` stops macOS from sleeping idle while the wrapper is alive.
#
# Log:
#   monitor/history/goal_run_<label>_<YYYYMMDD-HHMMSS>.log
#   (tail it from another terminal or your dashboard to watch progress)

set -uo pipefail   # NOT -e — we handle non-zero exits explicitly

cd "$(dirname "$0")/.."

# ─── Args ───────────────────────────────────────────────────────────────────
GOAL_INPUT="${1:-}"
if [ -z "$GOAL_INPUT" ]; then
    echo "Usage: bash scheduler/auto_resume.sh <goal-file-or-inline-text>" >&2
    echo "Examples:" >&2
    echo "  bash scheduler/auto_resume.sh agents/strategy-dev-goal-nas100.md" >&2
    echo "  bash scheduler/auto_resume.sh agents/strategy-dev-goal-us30.md" >&2
    exit 2
fi

if [ -f "$GOAL_INPUT" ]; then
    GOAL_TEXT="$(cat "$GOAL_INPUT")"
    GOAL_LABEL="$(basename "$GOAL_INPUT" .md)"
else
    GOAL_TEXT="$GOAL_INPUT"
    GOAL_LABEL="inline"
fi

# ─── Config ─────────────────────────────────────────────────────────────────
# 5 hours plus a 5-minute buffer so we don't wake exactly on the boundary
COOLDOWN_SECS=$((5 * 3600 + 5 * 60))

# Heartbeat cadence during the cooldown sleep
HEARTBEAT_SECS=1800   # 30 min

# Brief pause between same-window continuations (Claude returned cleanly but
# may have just paused mid-task — give the API a breath before resuming)
SHORT_PAUSE_SECS=30

# Pause before retrying a non-rate-limit error
ERROR_PAUSE_SECS=300  # 5 min

# Phrase posted as a new user message every time the wrapper resumes a session.
# `claude --continue` alone only re-opens the chat; we need to send a message
# to actually kick /goal back into autonomous mode. Override per run via env:
#   RESUME_PROMPT="re-engage /goal" npm run goal:nas100
RESUME_PROMPT="${RESUME_PROMPT:-continue with the goal}"

# Regex patterns (case-insensitive) used to classify the last ~200 log lines
RATE_PATTERNS='rate.?limit|usage.?limit|5.?hour.?limit|too many requests|429|reset.?in|quota.?exceeded'
DONE_PATTERNS='finalize.complete|goal.?(complete|completed|satisfied|achieved|met)|vault.?test.?passed|all.?12.?criteria.?pass'

# ─── Log setup ──────────────────────────────────────────────────────────────
mkdir -p monitor/history
TS="$(date +%Y%m%d-%H%M%S)"
LOG="monitor/history/goal_run_${GOAL_LABEL}_${TS}.log"

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
loge() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2; echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

log "════════════════════════════════════════════════════"
log "  AUTO-RESUME GOAL RUNNER"
log "════════════════════════════════════════════════════"
log "Goal:           $GOAL_LABEL"
log "Goal file:      ${GOAL_INPUT}"
log "Resume prompt:  \"${RESUME_PROMPT}\""
log "Log:            $LOG"
log "Cooldown:       ${COOLDOWN_SECS}s (~5h5m)"
log "PID:            $$"
log ""

# Verify claude CLI is on PATH
if ! command -v claude >/dev/null 2>&1; then
    loge "FATAL: \`claude\` CLI not on PATH. Install Claude Code or activate the right shell."
    exit 1
fi

# ─── Graceful shutdown ──────────────────────────────────────────────────────
trap 'log ""; log "Ctrl-C received — exiting."; exit 130' INT TERM

# ─── Helpers ────────────────────────────────────────────────────────────────
sleep_with_heartbeat() {
    local total="$1"
    local label="${2:-sleeping}"
    local elapsed=0
    while [ "$elapsed" -lt "$total" ]; do
        local left=$((total - elapsed))
        local step="$HEARTBEAT_SECS"
        [ "$step" -gt "$left" ] && step="$left"
        sleep "$step"
        elapsed=$((elapsed + step))
        log "  [$label] ${elapsed}s / ${total}s elapsed (~$(( (total - elapsed) / 60 ))m left)"
    done
}

# Examine the last 200 lines of the log to classify the most recent run.
# Echoes one of: done | rate_limit | other
classify_last_run() {
    local tail_text
    tail_text="$(tail -200 "$LOG" 2>/dev/null || true)"
    if echo "$tail_text" | grep -iqE "$DONE_PATTERNS"; then
        echo done
    elif echo "$tail_text" | grep -iqE "$RATE_PATTERNS"; then
        echo rate_limit
    else
        echo other
    fi
}

# ─── Main loop ──────────────────────────────────────────────────────────────
attempt=1
while true; do
    log ""
    log "───── Attempt $attempt — $(date '+%H:%M:%S') ─────"

    if [ "$attempt" -eq 1 ]; then
        # First attempt: fire /goal with the prompt content
        log "Launching: claude -p \"/goal <goal content>\""
        claude -p "/goal $GOAL_TEXT" 2>&1 | tee -a "$LOG"
        EXIT="${PIPESTATUS[0]}"
    else
        # Subsequent attempts: resume the same session and post the resume
        # phrase as a new user message — bare `claude --continue` would just
        # reopen the chat without kicking /goal back into autonomous mode.
        log "Resuming:  claude --continue -p \"${RESUME_PROMPT}\""
        claude --continue -p "$RESUME_PROMPT" 2>&1 | tee -a "$LOG"
        EXIT="${PIPESTATUS[0]}"
    fi

    log ""
    log "[claude exited with code $EXIT]"

    verdict="$(classify_last_run)"
    log "Verdict from log tail: $verdict"

    case "$verdict" in
        done)
            log ""
            log "════════════════════════════════════════════════════"
            log "  GOAL COMPLETE — stopping wrapper."
            log "════════════════════════════════════════════════════"
            exit 0
            ;;
        rate_limit)
            log "Rate limit detected — sleeping ${COOLDOWN_SECS}s (~5h5m) until reset..."
            sleep_with_heartbeat "$COOLDOWN_SECS" "cooldown"
            log "Cooldown done — resuming."
            ;;
        other)
            if [ "$EXIT" -eq 0 ]; then
                log "Clean exit, no rate-limit signal — Claude probably paused mid-goal."
                log "Brief pause (${SHORT_PAUSE_SECS}s) then continuing."
                sleep "$SHORT_PAUSE_SECS"
            else
                log "Non-zero exit and no rate-limit signal. Retrying in ${ERROR_PAUSE_SECS}s."
                sleep "$ERROR_PAUSE_SECS"
            fi
            ;;
    esac

    attempt=$((attempt + 1))
done
