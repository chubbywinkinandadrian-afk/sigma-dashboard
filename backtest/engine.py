"""
Event-driven backtester for RegimeSwitchStrategy.

Execution model (deliberately pessimistic):
- Signals are computed on bar close t and filled at the OPEN of bar t+1.
- Hard stops and MR take-profits are evaluated intrabar against high/low;
  if both are touched inside one bar, the STOP is assumed to fill first.
  Gaps through a level fill at the open (worse price), not at the level.
- The trend channel trail is evaluated on bar CLOSE and exited at the next
  open — no intrabar peeking at a moving channel.
- Costs are charged per side: (fee_bps + slip_bps) on notional.

Sizing: qty = equity * risk_per_trade * vol_scalar / stop_distance,
capped at max_leverage * equity. Equity compounds.

The loop reuses compute_features / entry_signal_row / exit_signal_row from
the strategy module, so the backtest exercises exactly the logic that the
live `analyze()` ships.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from strategy.regime_switch import (RegimeConfig, compute_features,
                                    entry_signal_row, exit_signal_row)


@dataclass
class CostModel:
    fee_bps:  float = 6.0   # taker fee per side (0.06%)
    slip_bps: float = 2.0   # slippage per side

    @property
    def per_side(self) -> float:
        return (self.fee_bps + self.slip_bps) / 1e4


def run_backtest(df: pd.DataFrame, cfg: RegimeConfig, costs: CostModel | None = None,
                 start_equity: float = 10_000.0):
    """Returns (equity_series, trades_dataframe)."""
    costs = costs or CostModel()
    feats = compute_features(df, cfg)

    o = df["open"].to_numpy(float)
    h = df["high"].to_numpy(float)
    l = df["low"].to_numpy(float)
    c = df["close"].to_numpy(float)
    n = len(df)

    f_atr = feats["atr"].to_numpy(float)
    f_vol = feats["vol_scalar"].to_numpy(float)
    f_mean = feats["mr_mean"].to_numpy(float)
    rows = feats[["atr", "close", "zscore", "regime_trend", "ema_f", "ema_s",
                  "don_hi", "don_lo", "exit_lo", "exit_hi", "mr_mean",
                  "close_up", "trend_strength"]].to_dict("records")

    equity = np.full(n, start_equity)
    cash = start_equity
    pos = 0.0            # signed quantity
    side = 0
    engine = ""
    entry_px = stop = target = 0.0
    bars_held = 0
    entry_time = None
    pending_entry = None  # decided on prior close, fills at this bar's open
    pending_exit = None
    trades = []
    ec = costs.per_side

    def close_pos(px, i, why):
        nonlocal cash, pos, side
        notional = abs(pos) * px
        cash += pos * px - notional * ec
        trades.append({"entry_time": entry_time, "exit_time": df.index[i],
                       "side": side, "engine": engine, "entry": entry_px,
                       "exit": px, "qty": abs(pos),
                       "pnl": pos * (px - entry_px) - notional * ec
                              - abs(pos) * entry_px * ec,
                       "bars": bars_held, "reason_exit": why})
        pos = 0.0
        side = 0

    for i in range(cfg.warmup, n):
        # ---- 1. close-based exit decided on the previous close
        if pos != 0.0 and pending_exit is not None:
            close_pos(o[i], i, pending_exit)
            pending_exit = None

        # ---- 2. fill pending entry at the open
        if pending_entry is not None:
            if pos == 0.0:
                sd, eng, _, _, _ = pending_entry
                px = o[i]   # slippage is charged as a cost, not a price shift
                a = f_atr[i - 1]
                if eng == "T":
                    st, tg = px - sd * cfg.stop_atr * a, 0.0
                else:
                    st, tg = px - sd * cfg.mr_stop_atr * a, f_mean[i - 1]
                # skip fades where the open already gapped through the mean
                if eng == "M" and ((sd > 0 and px >= tg) or (sd < 0 and px <= tg)):
                    pending_entry = None
                    equity[i] = cash
                    continue
                stop_dist = abs(px - st)
                risk_cash = cash * cfg.risk_per_trade * f_vol[i - 1]
                if eng == "M":
                    risk_cash *= cfg.mr_risk_frac
                qty = min(risk_cash / stop_dist, cash * cfg.max_leverage / px)
                if qty * px > 10.0:  # ignore dust
                    pos, side, engine = sd * qty, sd, eng
                    entry_px, stop, target = px, st, tg
                    bars_held = 0
                    entry_time = df.index[i]
                    cash -= pos * px + qty * px * ec
            pending_entry = None

        # ---- 3. manage open position intrabar (hard stop / MR target)
        if pos != 0.0:
            bars_held += 1
            hit_stop = l[i] <= stop if side > 0 else h[i] >= stop
            hit_tgt = (target > 0) and (h[i] >= target if side > 0 else l[i] <= target)
            if hit_stop:  # pessimistic: stop checked before target
                px = min(stop, o[i]) if side > 0 else max(stop, o[i])
                close_pos(px, i, "hard stop")
            elif hit_tgt:
                px = max(target, o[i]) if side > 0 else min(target, o[i])
                close_pos(px, i, "target (mean)")
            elif engine == "M" and cfg.mr_max_bars and bars_held >= cfg.mr_max_bars:
                close_pos(c[i], i, "time stop")

        # ---- 4. close-based decisions on this bar's close
        if pos != 0.0:
            why = exit_signal_row(rows[i], side, engine, cfg)
            if why:
                pending_exit = why
        elif pending_entry is None:
            sig = entry_signal_row(rows[i], cfg)
            if sig is not None:
                pending_entry = sig

        equity[i] = cash + pos * c[i]

    if pos != 0.0:
        close_pos(c[-1], n - 1, "end of data")
        equity[-1] = cash

    eq = pd.Series(equity, index=df.index, name="equity")
    return eq, pd.DataFrame(trades)
