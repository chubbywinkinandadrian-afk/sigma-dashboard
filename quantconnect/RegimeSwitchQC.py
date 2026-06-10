# region imports
from AlgorithmImports import *
from collections import deque
import math
# endregion
#
# Regime-Switch (TrendFlow + ChopFade) — QuantConnect port of
# strategy/regime_switch.py from the sigma-dashboard repo.
#
# Logic identical to the validated backtest (BTC/USDT 30m, 2017-2026:
# CAGR 27.7%, Sharpe 1.52, maxDD -13.7%; OOS 2023-2026 Sharpe 1.50):
#   - 30m bars consolidated from minute data
#   - TREND engine: 20d channel breakout, exit on 5d opposite close-channel,
#     2.5x ATR(1d) hard stop (resting stop order -> intrabar, like the
#     reference backtester's pessimistic stop handling)
#   - CHOP engine: >=2.25 sigma fade to the 2d mean, reversal-close confirm,
#     macro-drift side of EMA(20d) only, half risk, 1.5d time stop
#   - sizing: 0.75% equity risk to the stop, vol governor at 25% ann,
#     2x leverage cap
#
# NO VOLUME ANYWHERE: every feature is price-derived (ATR, EMAs, channels,
# z-score). Venue volume disparities (Kraken vs Binance) cannot affect it.
#
# Venue notes:
#   - Data below: Kraken BTCUSD spot minute bars (Binance unavailable in CA).
#     Spot and perp prices track within bps; the validated edge transferred
#     across Binance/Coinbase unchanged, so Kraken data is fine.
#   - FEE_BPS defaults to 5 (Kraken Futures taker) since that is the live
#     execution venue; set 26 to model Kraken spot tier-0 instead.
#   - If your account/brokerage config rejects short sells, set
#     ALLOW_SHORTS = False (long-only validated at Sharpe 1.38).


class PercentFeeModel(FeeModel):
    def __init__(self, pct: float):
        self.pct = pct

    def GetOrderFee(self, parameters: OrderFeeParameters) -> OrderFee:
        value = abs(parameters.Order.Quantity) * parameters.Security.Price * self.pct
        return OrderFee(CashAmount(value, "USD"))


class RegimeSwitchQC(QCAlgorithm):

    # ---- parameters (defaults = validated config; bars are 30m) ----
    BPD = 48                      # 30m bars per day
    ATR_P = 48                    # ATR 1 day
    EMA_F_P, EMA_S_P = 240, 960   # 5d / 20d
    REGIME_ON, REGIME_OFF = 1.0, 0.75
    T_ENTRY, T_EXIT = 960, 240    # 20d entry channel, 5d exit channel
    STOP_ATR = 2.5
    MR_WIN, MR_Z = 96, 2.25       # 2d z-score window
    MR_STOP_ATR, MR_MAX_BARS = 2.5, 72
    MR_RISK_FRAC = 0.5
    RISK = 0.0075                 # risk per trade (fraction of equity)
    VOL_TARGET, VOL_SPAN = 0.25, 1440   # 25% ann target, 30d lookback
    MAX_LEV = 2.0
    ALLOW_SHORTS = True
    FEE_BPS, SLIP_BPS = 5.0, 2.0

    def Initialize(self):
        self.SetStartDate(2019, 1, 1)    # extend back if your data plan covers it
        self.SetEndDate(2026, 6, 1)
        self.SetCash(100_000)
        self.SetBrokerageModel(BrokerageName.Kraken, AccountType.Margin)

        crypto = self.AddCrypto("BTCUSD", Resolution.Minute, Market.Kraken)
        # Binance alternative:
        #   self.SetBrokerageModel(BrokerageName.Binance, AccountType.Margin)
        #   crypto = self.AddCrypto("BTCUSDT", Resolution.Minute, Market.Binance)
        self.sym = crypto.Symbol
        crypto.SetFeeModel(PercentFeeModel(self.FEE_BPS / 1e4))
        crypto.SetSlippageModel(ConstantSlippageModel(self.SLIP_BPS / 1e4))
        self.lot = crypto.SymbolProperties.LotSize
        self.SetBenchmark(self.sym)
        self.Settings.MinimumOrderMarginPortfolioPercentage = 0

        # indicators updated manually so channel values can exclude the
        # forming bar (shift(1) semantics of the reference implementation)
        self.atr = AverageTrueRange(self.ATR_P, MovingAverageType.Wilders)
        self.ema_f = ExponentialMovingAverage(self.EMA_F_P)
        self.ema_s = ExponentialMovingAverage(self.EMA_S_P)
        self.hi_q = deque(maxlen=self.T_ENTRY)    # prior highs
        self.lo_q = deque(maxlen=self.T_ENTRY)    # prior lows
        self.ex_q = deque(maxlen=self.T_EXIT)     # prior closes
        self.mr_q = deque(maxlen=self.MR_WIN)     # closes incl. current
        self.ew_mean = self.ew_var = None         # EWM vol state
        self.prev_close = None
        self.regime_trend = False

        # position state
        self.engine = ""
        self.side = 0
        self.bars_held = 0
        self.entry_ticket = None
        self.pending = None       # (side, engine, atr, mr_mean) awaiting fill

        self.Consolidate(self.sym, timedelta(minutes=30), self.OnHalfHour)
        self.SetWarmUp(timedelta(days=60))

    # ------------------------------------------------------------- 30m bar
    def OnHalfHour(self, bar: TradeBar):
        close = bar.Close
        close_up = self.prev_close is not None and close > self.prev_close

        # -- features that INCLUDE the current bar (match pandas rolling at t)
        self.atr.Update(bar)
        self.ema_f.Update(bar.EndTime, close)
        self.ema_s.Update(bar.EndTime, close)
        if self.prev_close:
            r = math.log(close / self.prev_close)
            a = 2.0 / (self.VOL_SPAN + 1)
            if self.ew_mean is None:
                self.ew_mean, self.ew_var = r, 0.0
            else:
                d = r - self.ew_mean
                self.ew_mean += a * d
                self.ew_var = (1 - a) * (self.ew_var + a * d * d)
        self.mr_q.append(close)

        ready = (self.atr.IsReady and self.ema_s.IsReady
                 and len(self.hi_q) == self.T_ENTRY and len(self.mr_q) == self.MR_WIN
                 and self.ew_var is not None)

        if ready:
            atr = self.atr.Current.Value
            ema_f, ema_s = self.ema_f.Current.Value, self.ema_s.Current.Value

            # regime gate with hysteresis
            ts = abs(ema_f - ema_s) / atr if atr > 0 else 0.0
            if ts >= self.REGIME_ON:
                self.regime_trend = True
            elif ts < self.REGIME_OFF:
                self.regime_trend = False

            # channels EXCLUDE the current bar (deques not yet updated)
            don_hi, don_lo = max(self.hi_q), min(self.lo_q)
            exit_lo, exit_hi = min(self.ex_q), max(self.ex_q)

            mean = sum(self.mr_q) / self.MR_WIN
            var = sum((x - mean) ** 2 for x in self.mr_q) / self.MR_WIN
            sd = math.sqrt(var)
            z = (close - mean) / sd if sd > 0 else 0.0

            ann_vol = math.sqrt(max(self.ew_var, 1e-12) * 365 * self.BPD)
            vol_scalar = min(1.0, self.VOL_TARGET / ann_vol)

            if not self.IsWarmingUp:
                invested = self.Portfolio[self.sym].Invested
                # ---- manage open position (close-based exits)
                if invested:
                    self.bars_held += 1
                    if self.engine == "M" and self.bars_held >= self.MR_MAX_BARS:
                        self.ExitAll("time stop")
                    elif self.engine == "T" and (
                            (self.side > 0 and close < exit_lo) or
                            (self.side < 0 and close > exit_hi)):
                        self.ExitAll(f"{self.T_EXIT // self.BPD}d channel trail")
                # ---- entries
                elif self.pending is None and atr > 0:
                    self.TryEnter(close, atr, ema_f, ema_s, z, mean, close_up,
                                  don_hi, don_lo, vol_scalar)

        # -- push current bar into the shifted structures, last
        self.hi_q.append(bar.High)
        self.lo_q.append(bar.Low)
        self.ex_q.append(close)
        self.prev_close = close

    # ------------------------------------------------------------- entries
    def TryEnter(self, close, atr, ema_f, ema_s, z, mean, close_up,
                 don_hi, don_lo, vol_scalar):
        side, engine, reason = 0, "", ""
        if self.regime_trend:
            if ema_f > ema_s and close > don_hi:
                side, engine = 1, "T"
                reason = f"breakout > {self.T_ENTRY // self.BPD}d high"
            elif self.ALLOW_SHORTS and ema_f < ema_s and close < don_lo:
                side, engine = -1, "T"
                reason = f"breakdown < {self.T_ENTRY // self.BPD}d low"
        else:
            if z <= -self.MR_Z and close_up and close > ema_s:
                side, engine = 1, "M"
                reason = f"chop fade long z={z:.2f}"
            elif self.ALLOW_SHORTS and z >= self.MR_Z and not close_up and close < ema_s:
                side, engine = -1, "M"
                reason = f"chop fade short z={z:.2f}"
        if side == 0:
            return

        stop_mult = self.STOP_ATR if engine == "T" else self.MR_STOP_ATR
        stop_dist = stop_mult * atr
        equity = self.Portfolio.TotalPortfolioValue
        risk_cash = equity * self.RISK * vol_scalar
        if engine == "M":
            risk_cash *= self.MR_RISK_FRAC
        qty = min(risk_cash / stop_dist, equity * self.MAX_LEV / close)
        qty = math.floor(qty / self.lot) * self.lot
        if qty * close < 10:
            return

        self.pending = (side, engine, atr, mean)
        self.entry_ticket = self.MarketOrder(self.sym, side * qty, tag=f"[{engine}] {reason}")

    # ------------------------------------------------------------- orders
    def OnOrderEvent(self, e: OrderEvent):
        if e.Status != OrderStatus.Filled:
            return
        if (self.pending is not None and self.entry_ticket is not None
                and e.OrderId == self.entry_ticket.OrderId):
            side, engine, atr, mean = self.pending
            self.pending = None
            self.side, self.engine, self.bars_held = side, engine, 0
            fill = e.FillPrice
            qty = self.Portfolio[self.sym].Quantity
            stop_mult = self.STOP_ATR if engine == "T" else self.MR_STOP_ATR
            stop = fill - side * stop_mult * atr
            if engine == "M" and ((side > 0 and fill >= mean) or (side < 0 and fill <= mean)):
                self.ExitAll("gapped through mean")   # nothing left to capture
                return
            self.StopMarketOrder(self.sym, -qty, stop, tag="hard stop")
            if engine == "M":
                self.LimitOrder(self.sym, -qty, mean, tag="target (mean)")
            return
        # any other fill that leaves us flat = stop/target/liquidation done
        if not self.Portfolio[self.sym].Invested:
            self.Transactions.CancelOpenOrders(self.sym)
            self.side, self.engine, self.bars_held = 0, "", 0

    def ExitAll(self, why: str):
        self.Liquidate(self.sym, tag=why)   # also cancels resting orders
        self.side, self.engine, self.bars_held = 0, "", 0

    def OnEndOfAlgorithm(self):
        self.Liquidate()
