"""
Fetch BTC/USDT klines from the Binance public API into a parquet file the
backtester understands. Run this on your own machine (the API is free, no
key needed):

    python -m backtest.fetch_binance --symbol BTCUSDT --interval 30m \
        --start 2017-08-01 --out data/btcusdt_30m.parquet
"""
from __future__ import annotations

import argparse
import time

import pandas as pd
import requests

API = "https://api.binance.com/api/v3/klines"
COLS = ["open_time", "open", "high", "low", "close", "volume", "close_time",
        "qav", "trades", "tbb", "tbq", "ignore"]


def fetch(symbol: str, interval: str, start: str) -> pd.DataFrame:
    start_ms = int(pd.Timestamp(start).timestamp() * 1000)
    frames = []
    while True:
        r = requests.get(API, params={"symbol": symbol, "interval": interval,
                                      "startTime": start_ms, "limit": 1000},
                         timeout=20)
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        frames.append(pd.DataFrame(rows, columns=COLS))
        start_ms = rows[-1][0] + 1
        print(f"\r{pd.Timestamp(rows[-1][0], unit='ms')}  "
              f"({sum(len(f) for f in frames):,} bars)", end="")
        if len(rows) < 1000:
            break
        time.sleep(0.15)  # stay well under rate limits
    print()
    df = pd.concat(frames, ignore_index=True)
    df["datetime"] = pd.to_datetime(df["open_time"], unit="ms")
    df = df.set_index("datetime")[["open", "high", "low", "close", "volume"]]
    return df.astype(float).sort_index().drop_duplicates()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--symbol", default="BTCUSDT")
    p.add_argument("--interval", default="30m")
    p.add_argument("--start", default="2017-08-01")
    p.add_argument("--out", default="data/btcusdt_30m.parquet")
    args = p.parse_args()
    df = fetch(args.symbol, args.interval, args.start)
    if args.out.endswith(".csv"):
        df.to_csv(args.out)
    else:
        df.to_parquet(args.out)
    print(f"saved {len(df):,} bars -> {args.out}")


if __name__ == "__main__":
    main()
