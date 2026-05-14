# Tradingview — Quant Strategy Monitor

End-of-day autonomous monitor for a portfolio of 5 intraday index strategies
running across TradingView Desktop and MetaTrader 5.

## Repository layout

```
Tradingview/
├── agents/               Prompt fragments loaded by the EOD Codex run
│   ├── daily_run.md          Top-level orchestration
│   ├── diagnose.md           Failure analysis
│   ├── remediate_tweak.md    Parameter-tuning remediation path
│   └── remediate_rebuild.md  Full rebuild remediation path
│
├── baselines/            Frozen backtest exports (the source of truth)
│   ├── tradingview/<strategy>/code/<name>.txt
│   ├── tradingview/<strategy>/performance/<name>.xlsx
│   ├── mt5/<strategy>/code/<name>.txt
│   └── mt5/<strategy>/performance/<name>.xlsx
│
├── bots/                 Live trading bots
│   └── regime-switch-bot.mjs   TV→MT5 mirror for Regime Switch Reclaim
│
├── docs/                 Specs and contracts
│   └── strategy-dev-guidelines.md   Rebuild contract (70/30 split, DSR, vault)
│
├── monitor/              EOD monitor runtime
│   ├── config/
│   │   ├── strategies.json       Strategy registry (venue, symbol, magic)
│   │   └── mt5_tools.json        Cached MT5 MCP tool list (generated)
│   ├── lib/
│   │   ├── cdp.mjs               TradingView CDP helpers
│   │   ├── mt5_rpc.mjs           MT5 MCP JSON-RPC client
│   │   └── metrics.mjs           Pure metric + breach functions
│   ├── parse_baselines.py        xlsx → baselines.json
│   ├── collect_live.mjs          Pulls live trades → state.json
│   ├── check_breach.mjs          Compares state vs baselines, writes history
│   ├── baselines.json            (generated)
│   ├── state.json                (generated)
│   ├── history/                  (generated) daily archive + log
│   └── events/                   (generated) per-breach folders
│
├── scheduler/
│   └── start_daily.sh            Preflight: checks TV CDP + starts MT5 MCP
│
└── shortcuts/            OS shortcut files (.lnk)
```

## Strategies (monitored)

| ID | Name | Venue | Symbol | Timeframe |
|---|---|---|---|---|
| `s2_momentum_burst_mt5` | S2 Momentum Burst | MT5 | NAS100 | M5 |
| `regime_switch_mt5` | Regime Switch Reclaim Fast | MT5 | NAS100 | M1 |
| `rast_v20_mt5` | RAST V20 | MT5 | US30 | M5 |
| `us30_orb_tv` | US30 ORB Reversal | TV | US30 | 30m |
| `us30_vwap_mt5` | US30 VWAP | MT5 | US30 | M1 |

Duplicate strategies (S2, Regime Switch, RAST V20) trade identically on both venues;
monitoring only the MT5 side avoids redundancy. US30 ORB is TV-only (poor on MT5).
US30 VWAP is MT5-only (poor on TV).

## Daily run

```bash
bash scheduler/start_daily.sh   # preflight: CDP + MT5 MCP
node monitor/collect_live.mjs   # pull live trades → state.json
node monitor/check_breach.mjs   # compare vs baselines
```

On a breach, Codex follows `agents/daily_run.md` → diagnose → tweak or rebuild.

## Breach rules

1. **hard_max_dd** — live max drawdown > baseline max DD
2. **hard_max_consec_loss** — live longest losing streak > baseline's
3. **soft_pf_30t** — profit factor on the last 30 trades < 0.80
4. **soft_ret_30d_vs_avg** — cumulative 30-day return < 0.3 × (baseline avg daily × 30)

All rules require minimum trade counts (5 for hard rules, 10 for soft ret, 30 for pf30t).

## Historical data for backtesting

- US30 training: `/Users/gervaciusjr/Desktop/Tradingview/Data/US30 TRAINING.csv`
- US30 vault: `/Users/gervaciusjr/Desktop/Tradingview/Data/us30 tru oos.csv`
- NAS100 training: `/Users/gervaciusjr/Desktop/Tradingview/Data/NAS100 TRAINING.csv`
- NAS100 vault: `/Users/gervaciusjr/Desktop/Tradingview/Data/NAS100 TRUE OOS.csv`

All CSVs are M1 bars (2019–2026). Resample to the strategy's timeframe in the Python backtester.

## MCP servers

- **tradingview** — stdio, 78 tools for live TV Desktop control. CDP on :9222.
- **metatrader** — streamable-http on 127.0.0.1:18080. Launched by `scheduler/start_daily.sh` if down.
  - Broker credentials live in `.env` (see `.env.example`) — never commit them.
  - No strategy tester tool exposed; MT5 backtests use Python mirrors in `monitor/mt5_mirror/`

## EA magic numbers

| EA | Magic |
|---|---|
| S2 Momentum Burst | 520001 |
| Regime Switch Reclaim | 60315002 |
| RAST V20 | 20020 |
| US30 VWAP | 55160420 |

## Rebuild remediation

If a strategy's edge is gone, the rebuild path in `agents/remediate_rebuild.md`
runs the full protocol from `docs/strategy-dev-guidelines.md`. Rebuilt strategies
land in `monitor/events/<id>/proposed_new/` and are NEVER auto-deployed — the user
reviews the validation report before replacing the running strategy.
