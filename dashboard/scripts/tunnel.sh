#!/usr/bin/env bash
# Exposes the local dashboard at https://<random>.trycloudflare.com so the
# installed PWA on an Android phone can reach it from anywhere.
#
# Prereqs:
#   brew install cloudflared
#   DASHBOARD_TOKEN=... NODE_ENV=production node server.mjs (running)
#
# Notes:
#   - Quick tunnels print a fresh URL each run. For a stable URL, run
#     `cloudflared tunnel login` then create a named tunnel — out of scope here.
#   - This script intentionally tails the cloudflared URL line so you can grep
#     it from the terminal and type it into the phone once.

set -euo pipefail

PORT="${DASHBOARD_PORT:-3001}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not installed. Run: brew install cloudflared" >&2
  exit 1
fi

if ! curl -fsS "http://127.0.0.1:${PORT}/api/auth/ping" >/dev/null 2>&1; then
  echo "Dashboard API on :${PORT} is not responding." >&2
  echo "Start it first: DASHBOARD_TOKEN=... NODE_ENV=production node server.mjs" >&2
  exit 1
fi

echo "Starting Cloudflare tunnel → http://localhost:${PORT}"
echo "Watch the output for a https://*.trycloudflare.com URL."
exec cloudflared tunnel --url "http://localhost:${PORT}"
