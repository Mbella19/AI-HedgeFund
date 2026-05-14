"""S2 Momentum Burst — Python mirror of the MQL5 EA.

Faithful translation of baselines/mt5/S2 MOMENTUM BURST NAS100/code/S2 MOMENTUM.txt
for offline backtesting under different input parameters.

MQL5 → Python notes:
- Signal evaluated on bar 1 (just completed) when a new bar opens.
- Entry fills at bar 0 OPEN (current new bar's open). We treat entry price = bar_0.open.
- ATR from MT5 iATR (Wilder smoothing) shifted by 1 — ATR[bar 2] used against bar 1 move.
- Position sizing: lots = equity * riskPct / (stopDist * pointValue). NAS100 pointValue = $1.
- Max 2 signals / NY-calendar day. Counter increments even if in trade.
- Force exit at NY hour >= 16 or Friday UTC hour >= 18 (fills at next bar open).
- Stop set at signal-bar close ± stopMult * ATR. Hit on bar where H>=stop (short) or L<=stop (long).
- Commission: $2.50 RT per lot (= $1.25/side). Applied to PnL on exit.

Usage:
    python monitor/mt5_mirror/s2_momentum_burst.py --start 2019-01-01 --end 2026-04-11
    python monitor/mt5_mirror/s2_momentum_burst.py --start 2026-04-11 --end 2026-04-25 --live
"""
import argparse
import json
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
import numpy as np
import pandas as pd


TRAINING_CSV = Path("/Users/gervaciusjr/Desktop/strategy dev v3/Data/NAS100 TRAINING.csv")
LIVE_CSV = Path("/Users/gervaciusjr/Desktop/strategy dev v3/Data/NAS100 LIVE.csv")


@dataclass
class S2Params:
    lookback: int = 7
    threshold: float = 4.5
    atr_period: int = 14
    stop_mult: float = 3.0
    stop_mult_2nd: float = 9.0
    max_per_day: int = 2
    risk_pct: float = 0.006
    broker_gmt_winter: int = 2
    broker_dst: bool = True
    commission_rt_per_lot: float = 2.50
    initial_equity: float = 100_000.0
    point_value: float = 1.0  # NAS100 = $1/pt


def is_eu_dst(utc_dt: datetime) -> bool:
    """EU DST: last Sunday of March 01:00 UTC → last Sunday of October 01:00 UTC."""
    y = utc_dt.year
    m = utc_dt.month
    if m < 3 or m > 10:
        return False
    if 3 < m < 10:
        return True
    # Last Sunday of the month
    if m == 3:
        d = datetime(y, 3, 31)
        while d.weekday() != 6:
            d -= timedelta(days=1)
        boundary = d.replace(hour=1)
        return utc_dt >= boundary
    else:  # October
        d = datetime(y, 10, 31)
        while d.weekday() != 6:
            d -= timedelta(days=1)
        boundary = d.replace(hour=1)
        return utc_dt < boundary


def is_us_dst(utc_dt: datetime) -> bool:
    """US DST: 2nd Sunday of March 07:00 UTC → 1st Sunday of November 06:00 UTC."""
    y = utc_dt.year
    m = utc_dt.month
    if m < 3 or m > 11:
        return False
    if 3 < m < 11:
        return True
    if m == 3:
        # 2nd Sunday
        d = datetime(y, 3, 1)
        while d.weekday() != 6:
            d += timedelta(days=1)
        d += timedelta(days=7)
        boundary = d.replace(hour=7)
        return utc_dt >= boundary
    else:  # November
        d = datetime(y, 11, 1)
        while d.weekday() != 6:
            d += timedelta(days=1)
        boundary = d.replace(hour=6)
        return utc_dt < boundary


def server_to_utc(server_dt: datetime, p: S2Params) -> datetime:
    approx_utc = server_dt - timedelta(hours=p.broker_gmt_winter)
    extra = 1 if (p.broker_dst and is_eu_dst(approx_utc)) else 0
    return server_dt - timedelta(hours=p.broker_gmt_winter + extra)


def to_ny(server_dt: datetime, p: S2Params) -> datetime:
    utc = server_to_utc(server_dt, p)
    offset = -4 if is_us_dst(utc) else -5
    return utc + timedelta(hours=offset)


def load_m5_bars(start: str, end: str) -> pd.DataFrame:
    """Load M1 bars from TRAINING+LIVE CSV files, resample to M5."""
    frames = []
    for path in [TRAINING_CSV, LIVE_CSV]:
        if not path.exists():
            continue
        df = pd.read_csv(path, sep="\t")
        df.columns = [c.strip("<>") for c in df.columns]
        df["dt"] = pd.to_datetime(df["DATE"] + " " + df["TIME"], format="%Y.%m.%d %H:%M:%S")
        df = df[["dt", "OPEN", "HIGH", "LOW", "CLOSE"]]
        frames.append(df)
    all_m1 = pd.concat(frames, ignore_index=True).sort_values("dt").drop_duplicates("dt")
    all_m1 = all_m1.set_index("dt")
    # Resample to M5 labelled by CLOSE time (so bar label == bar-close time)
    m5 = all_m1.resample("5min", label="right", closed="right").agg(
        {"OPEN": "first", "HIGH": "max", "LOW": "min", "CLOSE": "last"}
    ).dropna()
    # Filter by date range — keep some leading history for ATR seed
    start_dt = pd.Timestamp(start) - pd.Timedelta(days=14)
    end_dt = pd.Timestamp(end)
    m5 = m5.loc[start_dt:end_dt]
    return m5


def wilder_atr(df: pd.DataFrame, period: int) -> pd.Series:
    h, l, c = df["HIGH"], df["LOW"], df["CLOSE"]
    pc = c.shift(1)
    tr = pd.concat([h - l, (h - pc).abs(), (l - pc).abs()], axis=1).max(axis=1)
    # Wilder = EMA with alpha=1/period, seeded with SMA(period)
    atr = pd.Series(index=tr.index, dtype=float)
    atr.iloc[:period] = np.nan
    atr.iloc[period - 1] = tr.iloc[:period].mean()
    alpha = 1.0 / period
    for i in range(period, len(tr)):
        atr.iloc[i] = atr.iloc[i - 1] * (1 - alpha) + tr.iloc[i] * alpha
    return atr


@dataclass
class Trade:
    entry_time: datetime
    exit_time: datetime
    direction: str  # 'long' or 'short'
    entry_price: float
    exit_price: float
    stop: float
    lots: float
    atr: float
    signal_num: int  # 1st or 2nd of day
    exit_reason: str  # 'SL', 'force_session', 'force_friday'
    pnl_gross: float
    commission: float
    pnl: float


def backtest(m5: pd.DataFrame, p: S2Params, start: str, end: str) -> tuple[list[Trade], pd.Series]:
    """Event-driven backtest on M5 bars."""
    start_dt = pd.Timestamp(start)
    end_dt = pd.Timestamp(end)

    atr_series = wilder_atr(m5, p.atr_period)
    m5 = m5.assign(ATR=atr_series)
    closes = m5["CLOSE"].values
    opens = m5["OPEN"].values
    highs = m5["HIGH"].values
    lows = m5["LOW"].values
    atrs = m5["ATR"].values
    times = m5.index.to_pydatetime()

    n = len(m5)
    equity = p.initial_equity
    equity_curve = []
    trades: list[Trade] = []

    in_position = False
    pos_direction = None
    pos_entry_price = 0.0
    pos_stop = 0.0
    pos_lots = 0.0
    pos_entry_idx = 0
    pos_signal_num = 0
    pos_atr = 0.0

    prev_ny_day = -1
    prev_ny_month = -1
    daily_count = 0

    for i in range(p.atr_period + p.lookback + 2, n):
        bar_time = times[i]  # bar 0 open time = this bar's label is i in CLOSE-labeled scheme
        # MT5's bar 0 at this iteration opens at `bar_time` (one bar AFTER the bar we just closed)
        # My m5 is label=right (label = close time). So the bar CLOSING at bar_time is MT5's bar 1.
        # The bar OPENING at bar_time is the NEW bar (MT5's bar 0) — in my index, that's bar i+1.
        # I'll operate at each iteration representing the MT5 OnTick at bar i+1 (new bar opens).
        # Signal bar = bar i (just closed). ATR at bar i-1 (data up to i-1 = MT5 bar 2).
        # Entry at bar i+1 open.
        if i + 1 >= n:
            break
        signal_idx = i
        bar0_idx = i + 1
        bar0_open = opens[bar0_idx]
        bar0_high = highs[bar0_idx]
        bar0_low = lows[bar0_idx]
        bar0_time = times[bar0_idx]

        # Compute bar0 time in UTC and NY
        bar0_dt = pd.Timestamp(bar0_time).to_pydatetime()
        utc_0 = server_to_utc(bar0_dt, p)
        ny_0 = to_ny(bar0_dt, p)
        ny_h0 = ny_0.hour
        utc_h0 = utc_0.hour
        utc_dow0 = utc_0.weekday()  # 0=Mon ... 4=Fri

        is_session_close = ny_h0 >= 16
        is_friday_early_close = (utc_dow0 == 4 and utc_h0 >= 18)  # Python Mon=0, Fri=4
        force_exit = is_session_close or is_friday_early_close

        # --- Force close existing position ---
        if in_position and force_exit:
            exit_px = bar0_open
            if pos_direction == "long":
                pnl_g = (exit_px - pos_entry_price) * pos_lots * p.point_value
            else:
                pnl_g = (pos_entry_price - exit_px) * pos_lots * p.point_value
            comm = pos_lots * p.commission_rt_per_lot
            pnl = pnl_g - comm
            equity += pnl
            trades.append(
                Trade(
                    entry_time=times[pos_entry_idx],
                    exit_time=bar0_time,
                    direction=pos_direction,
                    entry_price=pos_entry_price,
                    exit_price=exit_px,
                    stop=pos_stop,
                    lots=pos_lots,
                    atr=pos_atr,
                    signal_num=pos_signal_num,
                    exit_reason="force_friday" if is_friday_early_close else "force_session",
                    pnl_gross=pnl_g,
                    commission=comm,
                    pnl=pnl,
                )
            )
            in_position = False

        # --- Check stop loss on this bar ---
        # Note: if we just opened last iteration, the stop could be hit on this bar
        if in_position:
            if pos_direction == "long":
                if bar0_low <= pos_stop:
                    exit_px = pos_stop if bar0_open >= pos_stop else bar0_open  # gap-through
                    pnl_g = (exit_px - pos_entry_price) * pos_lots * p.point_value
                    comm = pos_lots * p.commission_rt_per_lot
                    pnl = pnl_g - comm
                    equity += pnl
                    trades.append(
                        Trade(
                            entry_time=times[pos_entry_idx],
                            exit_time=bar0_time,
                            direction="long",
                            entry_price=pos_entry_price,
                            exit_price=exit_px,
                            stop=pos_stop,
                            lots=pos_lots,
                            atr=pos_atr,
                            signal_num=pos_signal_num,
                            exit_reason="SL",
                            pnl_gross=pnl_g,
                            commission=comm,
                            pnl=pnl,
                        )
                    )
                    in_position = False
            else:  # short
                if bar0_high >= pos_stop:
                    exit_px = pos_stop if bar0_open <= pos_stop else bar0_open
                    pnl_g = (pos_entry_price - exit_px) * pos_lots * p.point_value
                    comm = pos_lots * p.commission_rt_per_lot
                    pnl = pnl_g - comm
                    equity += pnl
                    trades.append(
                        Trade(
                            entry_time=times[pos_entry_idx],
                            exit_time=bar0_time,
                            direction="short",
                            entry_price=pos_entry_price,
                            exit_price=exit_px,
                            stop=pos_stop,
                            lots=pos_lots,
                            atr=pos_atr,
                            signal_num=pos_signal_num,
                            exit_reason="SL",
                            pnl_gross=pnl_g,
                            commission=comm,
                            pnl=pnl,
                        )
                    )
                    in_position = False

        equity_curve.append((bar0_time, equity))

        # --- Evaluate new signal ---
        # Signal bar = bar i (just completed). ATR at bar i-1. Time of signal bar:
        signal_time = times[signal_idx]
        signal_dt = pd.Timestamp(signal_time).to_pydatetime()
        utc_1 = server_to_utc(signal_dt, p)
        ny_1 = to_ny(signal_dt, p)
        ny_h1 = ny_1.hour
        utc_h1 = utc_1.hour
        utc_dow1 = utc_1.weekday()

        # Reset daily count on new NY day (keyed on signal bar)
        if ny_1.day != prev_ny_day or ny_1.month != prev_ny_month:
            daily_count = 0
            prev_ny_day = ny_1.day
            prev_ny_month = ny_1.month

        if signal_dt < start_dt or signal_dt > end_dt:
            continue

        atr_val = atrs[signal_idx - 1]
        if np.isnan(atr_val) or atr_val <= 1.0 or atr_val >= 100.0:
            continue

        is_us_session = 9 <= ny_h1 < 16
        is_force_exit_1 = (ny_h1 >= 16) or (utc_dow1 == 4 and utc_h1 >= 18)
        valid = is_us_session and not is_force_exit_1

        move = closes[signal_idx] - closes[signal_idx - p.lookback]
        long_cond = valid and (move > p.threshold * atr_val)
        short_cond = valid and (move < -p.threshold * atr_val)

        is_signal = (long_cond or short_cond) and daily_count < p.max_per_day
        current_sm = p.stop_mult if daily_count == 0 else p.stop_mult_2nd

        if is_signal:
            daily_count += 1

            if not in_position:
                stop_dist = current_sm * atr_val
                lots = equity * p.risk_pct / (stop_dist * p.point_value)
                lots = max(0.01, round(lots, 2))
                signal_close = closes[signal_idx]
                if long_cond:
                    stop = signal_close - stop_dist
                    pos_direction = "long"
                else:
                    stop = signal_close + stop_dist
                    pos_direction = "short"
                pos_entry_price = bar0_open
                pos_stop = stop
                pos_lots = lots
                pos_atr = atr_val
                pos_entry_idx = bar0_idx
                pos_signal_num = daily_count
                in_position = True

                # Check if entry bar's range hits the stop (same-bar SL)
                if pos_direction == "long" and bar0_low <= pos_stop:
                    exit_px = pos_stop
                    pnl_g = (exit_px - pos_entry_price) * pos_lots * p.point_value
                    comm = pos_lots * p.commission_rt_per_lot
                    pnl = pnl_g - comm
                    equity += pnl
                    trades.append(Trade(
                        entry_time=bar0_time, exit_time=bar0_time, direction="long",
                        entry_price=pos_entry_price, exit_price=exit_px, stop=pos_stop,
                        lots=pos_lots, atr=pos_atr, signal_num=pos_signal_num,
                        exit_reason="SL", pnl_gross=pnl_g, commission=comm, pnl=pnl,
                    ))
                    in_position = False
                elif pos_direction == "short" and bar0_high >= pos_stop:
                    exit_px = pos_stop
                    pnl_g = (pos_entry_price - exit_px) * pos_lots * p.point_value
                    comm = pos_lots * p.commission_rt_per_lot
                    pnl = pnl_g - comm
                    equity += pnl
                    trades.append(Trade(
                        entry_time=bar0_time, exit_time=bar0_time, direction="short",
                        entry_price=pos_entry_price, exit_price=exit_px, stop=pos_stop,
                        lots=pos_lots, atr=pos_atr, signal_num=pos_signal_num,
                        exit_reason="SL", pnl_gross=pnl_g, commission=comm, pnl=pnl,
                    ))
                    in_position = False

    # Close any dangling position at end
    if in_position:
        exit_px = opens[-1]
        if pos_direction == "long":
            pnl_g = (exit_px - pos_entry_price) * pos_lots * p.point_value
        else:
            pnl_g = (pos_entry_price - exit_px) * pos_lots * p.point_value
        comm = pos_lots * p.commission_rt_per_lot
        pnl = pnl_g - comm
        equity += pnl
        trades.append(
            Trade(
                entry_time=times[pos_entry_idx],
                exit_time=times[-1],
                direction=pos_direction,
                entry_price=pos_entry_price,
                exit_price=exit_px,
                stop=pos_stop,
                lots=pos_lots,
                atr=pos_atr,
                signal_num=pos_signal_num,
                exit_reason="end_of_data",
                pnl_gross=pnl_g,
                commission=comm,
                pnl=pnl,
            )
        )

    eq_curve = pd.DataFrame(equity_curve, columns=["dt", "equity"]).set_index("dt")["equity"]
    return trades, eq_curve


def metrics_summary(trades: list[Trade], eq: pd.Series, initial: float) -> dict:
    if len(trades) == 0:
        return {"n_trades": 0, "note": "no trades"}
    pnls = np.array([t.pnl for t in trades])
    wins = pnls[pnls > 0]
    losses = pnls[pnls < 0]
    gross_profit = wins.sum() if len(wins) else 0.0
    gross_loss = losses.sum() if len(losses) else 0.0
    net = pnls.sum()
    running = initial + np.cumsum(pnls)
    peak = np.maximum.accumulate(running)
    dd = (peak - running) / peak
    max_dd_pct = float(dd.max() * 100.0)
    # Max consec loss
    streak = 0
    max_streak = 0
    for p_ in pnls:
        if p_ < 0:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0
    # Profit factor
    pf = (gross_profit / -gross_loss) if gross_loss != 0 else float("inf")
    return {
        "n_trades": int(len(pnls)),
        "net_pnl": float(net),
        "gross_profit": float(gross_profit),
        "gross_loss": float(gross_loss),
        "profit_factor": float(pf),
        "win_pct": float(100.0 * (pnls > 0).mean()),
        "max_dd_pct": max_dd_pct,
        "max_consec_loss": int(max_streak),
        "avg_daily_return": float(net / max(1, (trades[-1].exit_time - trades[0].entry_time).days)),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--lookback", type=int, default=7)
    ap.add_argument("--threshold", type=float, default=4.5)
    ap.add_argument("--stop-mult", type=float, default=3.0)
    ap.add_argument("--stop-mult-2nd", type=float, default=9.0)
    ap.add_argument("--max-per-day", type=int, default=2)
    ap.add_argument("--risk-pct", type=float, default=0.006)
    ap.add_argument("--initial", type=float, default=100_000.0)
    ap.add_argument("--out", type=str, default=None)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    p = S2Params(
        lookback=args.lookback,
        threshold=args.threshold,
        stop_mult=args.stop_mult,
        stop_mult_2nd=args.stop_mult_2nd,
        max_per_day=args.max_per_day,
        risk_pct=args.risk_pct,
        initial_equity=args.initial,
    )
    print(f"Loading M5 bars {args.start} → {args.end}…")
    m5 = load_m5_bars(args.start, args.end)
    print(f"  {len(m5):,} M5 bars loaded  ({m5.index.min()} → {m5.index.max()})")
    print(f"Params: {p}")
    trades, eq = backtest(m5, p, args.start, args.end)
    summary = metrics_summary(trades, eq, p.initial_equity)
    print("\nRESULT:")
    print(json.dumps(summary, indent=2, default=str))

    if args.verbose and len(trades):
        print("\nAll trades:")
        for t in trades:
            print(
                f"  {t.entry_time}  {t.direction:5}  in={t.entry_price:.2f}  out={t.exit_price:.2f}  "
                f"lots={t.lots:.2f}  atr={t.atr:.2f}  sig#{t.signal_num}  "
                f"reason={t.exit_reason:<14}  pnl={t.pnl:+.2f}"
            )

    if args.out:
        rows = [asdict(t) for t in trades]
        Path(args.out).write_text(json.dumps({"params": asdict(p), "summary": summary, "trades": rows}, indent=2, default=str))
        print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
