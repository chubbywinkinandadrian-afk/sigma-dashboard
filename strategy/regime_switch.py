"""
Regime-Switch strategy (TrendFlow + ChopFade).
Designed for 30m BTC/USDT; timeframe-agnostic via bars_per_day.

Idea
----
One strategy never fits both market modes, so classify the regime first and
route to the engine built for that mode:

REGIME GATE : trend_strength = |EMA_fast - EMA_slow| / ATR, with hysteresis
              (TREND above `regime_on`, back to CHOP below `regime_off`).
              Hysteresis stops the gate flip-flopping at the boundary.

ENGINE T (trend mode) — ride it
    LONG  : close breaks above the prior `t_entry_days`-day high AND
            EMA_fast > EMA_slow. SHORT mirrored.
    Exit  : close crosses the opposite `t_exit_days`-day close-extreme
            (turtle-style channel trail), with a `stop_atr`×ATR hard stop
            as disaster insurance. No fixed take-profit — the right tail
            pays for everything.

ENGINE M (chop mode) — fade it
    LONG  : z-score of close vs `mr_window` SMA <= -`mr_z_entry`, and the
            bar CLOSES UP (first sign the flush is exhausting — without
            this confirmation you are catching knives). SHORT mirrored.
    Exit  : take-profit at the rolling mean (z back to ~0), stop
            `mr_stop_atr`×ATR, time-stop `mr_max_bars` (chop trades must
            not become investments).

SIZING : risk a fixed fraction of equity per trade against the stop
         distance, scaled down by a realized-vol governor when the market
         runs hotter than `vol_target_ann`. Sizing, not signals, is what
         smooths the equity curve.

All features are causal (rolling, shifted where needed); signals are
computed on bar close and intended to be executed on the next bar.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

import numpy as np
import pandas as pd


class Signal(Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    NONE = "NONE"


@dataclass
class TradeSignal:
    signal:       Signal
    symbol:       str
    entry_price:  float
    stop_loss:    float
    take_profit:  float
    reason:       str
    trail_points: float = 0.0   # trailing distance in price units, 0 = none
    trail_offset: float = 0.0
    max_bars:     float = 0     # time-stop, 0 = none (executors may ignore)


@dataclass
class RegimeConfig:
    # timeframe
    bars_per_day:   int = 48        # 30m bars
    # shared
    atr_days:       float = 1.0
    ema_fast_days:  float = 5.0
    ema_slow_days:  float = 20.0
    # regime gate (trend_strength units = ATRs of EMA separation)
    regime_on:      float = 1.0     # CHOP -> TREND above this
    regime_off:     float = 0.75    # TREND -> CHOP below this
    # engine T: turtle-style channel breakout
    t_entry_days:   float = 20.0    # breakout channel length
    t_exit_days:    float = 5.0     # opposite close-extreme trail
    stop_atr:       float = 2.5     # hard stop (disaster insurance)
    # engine M: mean reversion
    mr_window_days: float = 2.0     # z-score window
    mr_z_entry:     float = 2.25
    mr_stop_atr:    float = 2.5
    mr_max_days:    float = 1.5     # time-stop
    mr_with_trend:  bool = True     # fade only back toward the slow EMA side
    mr_risk_frac:   float = 0.5     # MR trades risk this fraction of risk_per_trade
    # risk
    risk_per_trade: float = 0.0075  # fraction of equity risked to the stop
    vol_target_ann: float = 0.25    # de-risk when realized vol exceeds this
    vol_lookback_days: int = 30
    max_leverage:   float = 2.0
    allow_shorts:   bool = True
    symbol:         str = "BTC/USDT"

    # derived (bars)
    atr_period: int = field(init=False)
    ema_fast:   int = field(init=False)
    ema_slow:   int = field(init=False)
    t_entry:    int = field(init=False)
    t_exit:     int = field(init=False)
    mr_window:  int = field(init=False)
    mr_max_bars: int = field(init=False)
    warmup:     int = field(init=False)

    def __post_init__(self):
        bpd = self.bars_per_day
        self.atr_period = max(2, round(self.atr_days * bpd))
        self.ema_fast = max(2, round(self.ema_fast_days * bpd))
        self.ema_slow = max(4, round(self.ema_slow_days * bpd))
        self.t_entry = max(4, round(self.t_entry_days * bpd))
        self.t_exit = max(4, round(self.t_exit_days * bpd))
        self.mr_window = max(4, round(self.mr_window_days * bpd))
        self.mr_max_bars = max(2, round(self.mr_max_days * bpd))
        self.warmup = max(self.ema_slow, self.t_entry, self.mr_window,
                          self.atr_period) + 2


# ---------------------------------------------------------------- indicators
def atr(df: pd.DataFrame, period: int) -> pd.Series:
    pc = df["close"].shift(1)
    tr = pd.concat([df["high"] - df["low"],
                    (df["high"] - pc).abs(),
                    (df["low"] - pc).abs()], axis=1).max(axis=1)
    return tr.ewm(alpha=1.0 / period, adjust=False).mean()


def rsi(close: pd.Series, period: int) -> pd.Series:
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1.0 / period, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1.0 / period, adjust=False).mean()
    rs = up / dn.replace(0.0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(50.0)


# ---------------------------------------------------------------- features
def compute_features(df: pd.DataFrame, cfg: RegimeConfig) -> pd.DataFrame:
    """All columns are causal: the value at bar i uses data up to and incl. i."""
    out = df.copy()
    out["atr"] = atr(df, cfg.atr_period)
    out["ema_f"] = df["close"].ewm(span=cfg.ema_fast, adjust=False).mean()
    out["ema_s"] = df["close"].ewm(span=cfg.ema_slow, adjust=False).mean()
    out["trend_strength"] = (out["ema_f"] - out["ema_s"]).abs() / out["atr"]

    # regime with hysteresis (vectorized two-threshold latch)
    ts = out["trend_strength"]
    state = pd.Series(np.where(ts >= cfg.regime_on, 1.0,
                      np.where(ts < cfg.regime_off, 0.0, np.nan)), index=out.index)
    out["regime_trend"] = state.ffill().fillna(0.0).astype(bool)

    # engine T: entry channel = prior N-day extremes (exclude current bar);
    # exit channel = prior M-day close-extremes
    out["don_hi"] = df["high"].rolling(cfg.t_entry).max().shift(1)
    out["don_lo"] = df["low"].rolling(cfg.t_entry).min().shift(1)
    out["exit_lo"] = df["close"].rolling(cfg.t_exit).min().shift(1)
    out["exit_hi"] = df["close"].rolling(cfg.t_exit).max().shift(1)

    # engine M: z-score and close-direction confirmation
    ma = df["close"].rolling(cfg.mr_window).mean()
    sd = df["close"].rolling(cfg.mr_window).std(ddof=0)
    out["mr_mean"] = ma
    out["zscore"] = (df["close"] - ma) / sd.replace(0.0, np.nan)
    out["close_up"] = df["close"] > df["close"].shift(1)

    # realized vol governor (annualized EWM of bar log-returns)
    lr = np.log(df["close"]).diff()
    ann = np.sqrt(365.0 * cfg.bars_per_day)
    rv = lr.ewm(span=cfg.vol_lookback_days * cfg.bars_per_day, adjust=False).std() * ann
    out["vol_scalar"] = (cfg.vol_target_ann / rv).clip(upper=1.0).fillna(1.0)
    return out


def entry_signal_row(row, cfg: RegimeConfig):
    """Entry decision from one feature row (the just-closed bar).

    Returns (side, engine, stop, target, reason) or None.
    side: +1 long / -1 short. target = 0 when unused (trend trades).
    """
    a = row["atr"]
    c = row["close"]
    if not np.isfinite(a) or a <= 0 or not np.isfinite(row["zscore"]):
        return None

    if row["regime_trend"]:
        up = row["ema_f"] > row["ema_s"]
        if up and c > row["don_hi"]:
            return (+1, "T", c - cfg.stop_atr * a, 0.0,
                    f"trend breakout > {cfg.t_entry_days:g}d high, "
                    f"strength {row['trend_strength']:.2f}")
        if cfg.allow_shorts and not up and c < row["don_lo"]:
            return (-1, "T", c + cfg.stop_atr * a, 0.0,
                    f"trend breakdown < {cfg.t_entry_days:g}d low, "
                    f"strength {row['trend_strength']:.2f}")
    else:
        z = row["zscore"]
        # dips are bought only on the long side of the slow EMA (and rips
        # sold only below it): fading against the macro drift is how chop
        # fades turn into knife-catching at regime transitions
        long_ok = (not cfg.mr_with_trend) or c > row["ema_s"]
        short_ok = (not cfg.mr_with_trend) or c < row["ema_s"]
        if z <= -cfg.mr_z_entry and row["close_up"] and long_ok:
            return (+1, "M", c - cfg.mr_stop_atr * a, row["mr_mean"],
                    f"chop fade long, z={z:.2f}, up-close confirm")
        if cfg.allow_shorts and z >= cfg.mr_z_entry and not row["close_up"] and short_ok:
            return (-1, "M", c + cfg.mr_stop_atr * a, row["mr_mean"],
                    f"chop fade short, z={z:.2f}, down-close confirm")
    return None


def exit_signal_row(row, side: int, engine: str, cfg: RegimeConfig) -> str | None:
    """Close-based exits (checked on bar close, executed next bar).

    Hard stops and MR take-profits are price levels handled intrabar by the
    executor/backtester; this handles the trend channel trail.
    """
    if engine == "T":
        if side > 0 and row["close"] < row["exit_lo"]:
            return f"close < {cfg.t_exit_days:g}d low channel"
        if side < 0 and row["close"] > row["exit_hi"]:
            return f"close > {cfg.t_exit_days:g}d high channel"
    return None


class RegimeSwitchStrategy:
    """Drop-in for the dashboard: analyze(symbol, df) -> TradeSignal."""

    def __init__(self, config: RegimeConfig | None = None):
        self.cfg = config or RegimeConfig()

    @property
    def MIN_ROWS(self) -> int:
        return self.cfg.warmup

    def analyze(self, symbol: str, df: pd.DataFrame) -> TradeSignal:
        cfg = self.cfg
        if len(df) < cfg.warmup:
            return self._no_signal(symbol, 0.0, "insufficient data")

        feats = compute_features(df.iloc[-cfg.warmup - 5:], cfg)
        row = feats.iloc[-1]
        sig = entry_signal_row(row, cfg)
        if sig is None:
            mode = "trend" if row["regime_trend"] else "chop"
            return self._no_signal(symbol, float(row["close"]), f"no setup ({mode} regime)")

        side, engine, stop, target, reason = sig
        entry = float(row["close"])
        if engine == "T":
            # no fixed target on trend trades: park TP far away for executors
            # that require one and trail with the exit channel distance
            target = entry + side * 10 * abs(entry - stop)
            trail = abs(entry - (row["exit_lo"] if side > 0 else row["exit_hi"]))
        else:
            trail = 0.0
        return TradeSignal(
            signal=Signal.LONG if side > 0 else Signal.SHORT,
            symbol=symbol,
            entry_price=entry,
            stop_loss=float(stop),
            take_profit=float(target),
            reason=f"[{engine}] {reason}",
            trail_points=float(trail),
            trail_offset=0.0,
            max_bars=cfg.mr_max_bars if engine == "M" else 0,
        )

    def _no_signal(self, symbol: str, price: float, reason: str) -> TradeSignal:
        return TradeSignal(Signal.NONE, symbol, price, 0.0, 0.0, reason)
