# Deploy as a phone app (PWA + Cloudflare Tunnel)

Use the dashboard from your Android phone, anywhere, talking to the live backend
on your home computer. No port-forwarding, no static IP, no app store.

## What you get

- Installable home-screen icon ("EOD Monitor")
- Full-screen standalone UI, pinch-zoom disabled, own title bar
- Real-time data from your local backend via a Cloudflare HTTPS tunnel
- Token-gated — nobody who happens on the URL can see your dashboard
- Works offline enough to open to the last-seen state

## One-time setup (your computer)

1. **Install cloudflared**
   ```bash
   brew install cloudflared
   ```

2. **Pick a token.** Any random string works. Keep it secret; anyone with it
   can control the loop.
   ```bash
   openssl rand -hex 32 > ~/.eod-token   # or just type one into the file
   ```

3. **Build the frontend and run the API server in production mode.**
   The server serves `dist/` alongside `/api/*`, so one origin, one tunnel.
   ```bash
   cd /Users/gervaciusjr/Desktop/Tradingview/dashboard
   npm install
   npm run build
   DASHBOARD_TOKEN="$(cat ~/.eod-token)" NODE_ENV=production node server.mjs
   ```

4. **In another terminal, start the tunnel.**
   ```bash
   cd /Users/gervaciusjr/Desktop/Tradingview/dashboard
   bash scripts/tunnel.sh
   ```
   Look for a line like:
   ```
   https://autumn-raccoon-1234.trycloudflare.com
   ```
   That URL points at your local `:3001`. It stays alive as long as the
   `cloudflared` process runs.

## One-time setup (your phone)

1. Open Chrome on Android, go to the `https://*.trycloudflare.com` URL.
2. You'll see the **Unlock dashboard** screen. Paste your token, tap **UNLOCK**.
3. In Chrome's menu → **Install app** (or **Add to Home screen**). Accept.
4. Launch the new **EOD Monitor** icon from the launcher. It opens full-screen
   with no URL bar.

The token is stored in localStorage, so you only type it once.

## Daily use

On your computer, every time you reboot:
```bash
cd /Users/gervaciusjr/Desktop/Tradingview/dashboard

# Terminal A
DASHBOARD_TOKEN="$(cat ~/.eod-token)" NODE_ENV=production node server.mjs

# Terminal B
bash scripts/tunnel.sh
```

The quick-tunnel URL changes every time `cloudflared` restarts. If the URL
changes, open the PWA, pull down → tap URL bar, paste the new URL. Or upgrade
to a named tunnel (see below) for a stable URL.

## Upgrading to a stable URL (optional)

Quick tunnels are disposable. For a permanent URL like
`https://eod.your-domain.com`:

1. Own a domain on Cloudflare (free plan works).
2. `cloudflared tunnel login` — pops a browser auth.
3. `cloudflared tunnel create eod-monitor` — saves credentials JSON.
4. Add a `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: eod-monitor
   credentials-file: /Users/YOU/.cloudflared/<uuid>.json
   ingress:
     - hostname: eod.your-domain.com
       service: http://localhost:3001
     - service: http_status:404
   ```
5. `cloudflared tunnel route dns eod-monitor eod.your-domain.com`
6. Run `cloudflared tunnel run eod-monitor` instead of the quick tunnel.

The phone PWA keeps working as long as you open it from that hostname the
first time (the SW is scoped to the origin).

## Security notes

- The token is the only gate. Pick a long random one, don't commit it.
- Cloudflare terminates TLS for you; the tunnel itself is an outbound
  connection from your computer, so no firewall changes.
- The bearer token travels over HTTPS, never in query strings from the UI.
- Anyone with the token + URL can start/stop the EOD loop and approve
  rebuild proposals. Rotate the token if it leaks — change `~/.eod-token`,
  restart the server, reopen the PWA, paste the new token.

## Troubleshooting

- **"Token rejected"**: the server was started without `DASHBOARD_TOKEN`, or
  you typed a different token than the server has. Restart the server with
  the right env var, reload the PWA.
- **"Network error"**: the tunnel isn't running, or the quick-tunnel URL
  changed since last install. Re-run `scripts/tunnel.sh` and reopen the new
  URL on the phone.
- **PWA doesn't update**: Chrome caches service workers aggressively. In the
  phone app menu → "App info" → Storage → "Clear storage", then reopen.
- **Works on Wi-Fi only**: that means the phone never reached the tunnel.
  Confirm the URL loads in mobile-data Chrome first before installing.
