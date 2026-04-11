#!/usr/bin/env bash
# EOD Strategy Monitor — preflight + data collection
# This script checks/starts MCP servers, then runs the collect+check pipeline.
# Called by the daily Claude cron job before handing off to agents/daily_run.md.
set -euo pipefail

cd "$(dirname "$0")/.."
echo "=== EOD Strategy Monitor — $(date '+%Y-%m-%d %H:%M %Z') ==="

# ─── Load secrets from .env ───
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
else
    echo "ERROR: .env not found — copy .env.example to .env and fill in credentials"
    exit 1
fi

: "${MT5_LOGIN:?MT5_LOGIN must be set in .env}"
: "${MT5_PASSWORD:?MT5_PASSWORD must be set in .env}"
: "${MT5_SERVER:?MT5_SERVER must be set in .env}"
: "${MT5_TERMINAL_PATH:?MT5_TERMINAL_PATH must be set in .env}"
: "${MT5_MCP_HOST:=127.0.0.1}"
: "${MT5_MCP_PORT:=18080}"
: "${TV_CDP_PORT:=9222}"

# ─── Check TradingView CDP ───
echo -n "TradingView CDP: "
if curl -s -m 3 "http://localhost:${TV_CDP_PORT}/json/version" >/dev/null 2>&1; then
    echo "OK"
else
    echo "DOWN — will need tv_launch (handled by Claude)"
    TV_NEEDS_LAUNCH=1
fi

# ─── Check MT5 MCP ───
MT5_MCP_URL="http://${MT5_MCP_HOST}:${MT5_MCP_PORT}/mcp"
MT5_PROBE='{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'

echo -n "MT5 MCP (:${MT5_MCP_PORT}): "
if curl -s -m 3 "$MT5_MCP_URL" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "$MT5_PROBE" \
    >/dev/null 2>&1; then
    echo "OK"
else
    echo "DOWN — starting..."
    export WINEPREFIX="$HOME/Library/Application Support/net.metaquotes.wine.metatrader5"
    export WINEDEBUG=-all
    WINE="/Applications/MetaTrader 5.app/Contents/SharedSupport/wine/bin/wine64"
    "$WINE" "C:\\Python312\\Scripts\\metatrader-mcp-server.exe" \
        --login "$MT5_LOGIN" \
        --password "$MT5_PASSWORD" \
        --server "$MT5_SERVER" \
        --path "$MT5_TERMINAL_PATH" \
        --transport streamable-http \
        --host "$MT5_MCP_HOST" \
        --port "$MT5_MCP_PORT" \
        > /tmp/mt5_mcp.log 2>&1 &
    echo "  PID: $!"
    for i in $(seq 1 30); do
        if curl -s -m 1 "$MT5_MCP_URL" \
            -X POST \
            -H "Content-Type: application/json" \
            -H "Accept: application/json, text/event-stream" \
            -d "$MT5_PROBE" \
            >/dev/null 2>&1; then
            echo "  MT5 MCP ready after ${i}s"
            break
        fi
        sleep 1
    done
fi

# ─── Ensure baselines are parsed ───
if [ ! -f monitor/baselines.json ]; then
    echo "Parsing baselines..."
    python3 monitor/parse_baselines.py
fi

# ─── Update LIVE CSVs with fresh M1 bars ───
echo ""
echo "Updating LIVE CSVs..."
node monitor/update_live_data.mjs || echo "  (non-fatal; continuing)"

echo ""
echo "Preflight complete. Ready for collect + check."
