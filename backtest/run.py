"""
Reproduce the Regime-Switch backtest.

    python -m backtest.run --data data/btcusdt_30m.parquet
    python -m backtest.run --data data/btcusdt_30m.parquet --split 2023-01-01
    python -m backtest.run --data mydata.csv --bars-per-day 48 --long-only

CSV input needs columns: datetime/timestamp, open, high, low, close, volume.
"""
from __future__ import annotations

import argparse
import json

import pandas as pd

from backtest.engine import CostModel, run_backtest
from backtest.metrics import summarize, yearly_table
from strategy.regime_switch import RegimeConfig


def load(path: str) -> pd.DataFrame:
    if path.endswith((".parquet", ".pq")):
        df = pd.read_parquet(path)
    else:
        df = pd.read_csv(path)
    if not isinstance(df.index, pd.DatetimeIndex):
        tcol = next(c for c in df.columns if c.lower() in
                    ("datetime", "timestamp", "date", "time", "open_time"))
        df[tcol] = pd.to_datetime(df[tcol])
        df = df.set_index(tcol)
    df = df[["open", "high", "low", "close", "volume"]].astype(float)
    return df.sort_index()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True)
    p.add_argument("--bars-per-day", type=int, default=48)
    p.add_argument("--split", help="report this date onward separately (OOS)")
    p.add_argument("--long-only", action="store_true")
    p.add_argument("--risk", type=float, default=0.0075)
    p.add_argument("--fee-bps", type=float, default=6.0)
    p.add_argument("--slip-bps", type=float, default=2.0)
    args = p.parse_args()

    df = load(args.data)
    cfg = RegimeConfig(bars_per_day=args.bars_per_day, risk_per_trade=args.risk,
                       allow_shorts=not args.long_only)
    costs = CostModel(fee_bps=args.fee_bps, slip_bps=args.slip_bps)

    eq, tr = run_backtest(df, cfg, costs)
    print(json.dumps(summarize(eq, tr, "full period"), indent=2))
    print(yearly_table(eq).to_string(index=False))

    if args.split:
        eq_o = eq.loc[args.split:]
        tr_o = tr[tr.exit_time >= args.split] if len(tr) else tr
        print(json.dumps(summarize(eq_o, tr_o, f"from {args.split}"), indent=2))


if __name__ == "__main__":
    main()
