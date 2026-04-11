#!/usr/bin/env bash
# EOD Strategy Monitor — persistent loop
#
# Run once, leave the terminal open. It waits until 21:30 UTC each weekday,
# runs the full pipeline, and if a breach fires, launches Claude Code.
#
# Usage:
#   bash scheduler/loop.sh
#
# Stop: Ctrl+C
set -uo pipefail

cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/Users/gervaciusjr/.local/bin:/Users/gervaciusjr/.pyenv/shims:$PATH"

RUN_HOUR=21   # UTC
RUN_MIN=30

echo "========================================"
echo " EOD Strategy Monitor — LOOP MODE"
echo " Runs daily at ${RUN_HOUR}:${RUN_MIN} UTC (Mon–Fri)"
echo " Ctrl+C to stop"
echo "========================================"

while true; do
    # Calculate seconds until next 21:30 UTC weekday
    now=$(date -u +%s)
    today_target=$(date -u -j -f "%Y-%m-%d %H:%M:%S" "$(date -u +%Y-%m-%d) ${RUN_HOUR}:${RUN_MIN}:00" +%s 2>/dev/null)
    dow=$(date -u +%u)  # 1=Mon, 7=Sun

    if [ "$now" -lt "$today_target" ] && [ "$dow" -le 5 ]; then
        # Today's run hasn't happened yet and it's a weekday
        next_run=$today_target
    else
        # Find next weekday
        days_ahead=1
        while true; do
            future_dow=$(date -u -v+${days_ahead}d +%u)
            if [ "$future_dow" -le 5 ]; then
                next_run=$(date -u -j -f "%Y-%m-%d %H:%M:%S" "$(date -u -v+${days_ahead}d +%Y-%m-%d) ${RUN_HOUR}:${RUN_MIN}:00" +%s 2>/dev/null)
                break
            fi
            days_ahead=$((days_ahead + 1))
        done
    fi

    wait_secs=$((next_run - now))
    next_date=$(date -u -r "$next_run" "+%A %Y-%m-%d %H:%M UTC")

    echo ""
    echo "⏳ Next run: ${next_date} (in ${wait_secs}s / ~$((wait_secs / 3600))h)"
    echo "   Waiting..."

    sleep "$wait_secs"

    echo ""
    echo "========================================"
    echo " RUNNING — $(date '+%Y-%m-%d %H:%M %Z')"
    echo "========================================"

    bash scheduler/run_eod.sh 2>&1 | tee -a /tmp/eod_monitor.log

    echo ""
    echo "Run complete. Looping..."
done
