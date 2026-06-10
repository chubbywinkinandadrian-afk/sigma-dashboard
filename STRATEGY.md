# Regime-Switch Strategy (TrendFlow + ChopFade)

Replacement for the VWAP + S/R strategy. BTC/USDT, 30m bars (timeframe-agnostic
via config). Backtested on 153,860 bars of real Binance data, Aug 2017 → Jun 2026,
with 0.08% per-side costs and pessimistic fill assumptions.

| window | years | CAGR | Sharpe (daily, ann.) | max DD | profit factor | trades/mo |
|---|---|---|---|---|---|---|
| **Full 2017-08 → 2026-06** | 8.8 | **27.7%** | **1.52** | **−13.7%** | 2.97 | 2.2 |
| In-sample (design) 2017→2022 | 5.4 | 26.3% | 1.54 | −9.2% | 4.51 | 2.0 |
| **Out-of-sample 2023→2026-06** | 3.4 | 30.1% | **1.50** | −13.7% | 2.63 | 2.5 |
| Long-only (spot) full | 8.8 | 21.7% | 1.38 | −12.4% | 3.72 | 1.3 |
| Double costs (0.16%/side) full | 8.8 | 26.0% | 1.49 | −13.9% | 2.81 | 2.2 |

Reference: BTC buy & hold over the same 8.8y = 35.9% CAGR at Sharpe 0.79 and
−83% max drawdown. The strategy produces ~2× the risk-adjusted return at ~1/6
of the drawdown, and **no losing calendar year** in the test (worst: +0.8% in
2025; 2022, when BTC fell 65%, finished +2.3%; 2018, BTC −73%, finished +13.1%).

Parameters were chosen on 2017–2022 only; 2023–2026 was run once, at the end.
OOS Sharpe (1.50) ≈ IS Sharpe (1.54) — no degradation, which is the main
evidence this isn't curve-fit. A further check on a different venue and era
(Coinbase 2014–2018, 30m) gives Sharpe 1.71 with the same parameters.

## Why the VWAP + S/R strategy struggled

Session-reset VWAP crosses on 30m fire constantly; each cross is a coin-flip
that pays taker fees, and the EMA-200(30m) "trend filter" is only a 4-day
average — it flips a dozen times inside any real consolidation. The structure
guarantees many small whipsaw losses in chop, and the fixed 2:1 take-profit
caps exactly the trades that would have paid for them in trends. Verified here:
a 2-day-horizon variant of breakout trading shows the same failure (559 trades,
PF 1.06); lengthening the horizon to 20 days lifts PF to 4.5 with 4× fewer trades.

## How it works

Two engines behind a regime gate, with volatility-aware sizing. All features
are causal; signals form on bar close and execute next bar.

**Regime gate** — `trend_strength = |EMA(5d) − EMA(20d)| / ATR(1d)`, with
hysteresis (TREND ≥ 1.0, back to CHOP < 0.75). Labels every bar TREND or CHOP.

**Engine T — trend (the profit engine).** In TREND regime, enter long when
close breaks the prior 20-day high with EMA fast > slow (short: mirror,
20-day low). Exit when close crosses the opposite 5-day close-extreme
(channel trail), with a 2.5×ATR hard stop as disaster insurance. No fixed
take-profit — wins of +30…+87% of notional ride for weeks; the ~77% of
trades that lose are cut at a fraction of that. Costs are negligible at this
horizon.

**Engine M — chop fades (deliberately tiny).** In CHOP regime, fade a
≥2.25σ flush back to its 2-day mean, only on a confirming reversal close,
only on the macro-drift side of EMA(20d), at half risk. We tested looser
versions honestly: unfiltered z-score fades lose −9% of equity over 5 years
(95 trades), and range-edge fades have negative expectancy too. **At 30m with
taker costs, counter-trend trading has no reliable edge on BTC.** So the
strategy's real chop behavior is: stand flat, keep the gate watching, and be
first in when the range resolves into a breakout. Not losing money in chop is
what funds the trend trades.

**Sizing (where the Sharpe comes from).** Each trade risks 0.75% of equity
against its stop distance (`qty = equity × 0.0075 / stop_distance`), capped at
2× leverage, scaled down when 30-day realized vol exceeds 25% annualized.
Halving risk halves drawdown (−5.1%) at the same Sharpe; risk appetite is one
number: `risk_per_trade`.

## Files

```
strategy/regime_switch.py    strategy + config (drop-in: analyze(symbol, df) -> TradeSignal)
backtest/engine.py           event-driven backtester (next-open fills, intrabar stops, costs)
backtest/metrics.py          Sharpe/Sortino/DD/PF from the equity curve
backtest/run.py              CLI to reproduce everything
backtest/fetch_binance.py    pull fresh klines on your machine (Binance API)
data/btcusdt_30m.parquet     the validated dataset (Binance, 2017-08 → 2026-06-07)
results/                     metrics.json, yearly.csv, sensitivity_in_sample.csv, charts
```

Reproduce:

```bash
pip install -r requirements.txt
python -m backtest.run --data data/btcusdt_30m.parquet --split 2023-01-01
```

## Wiring into the dashboard

Same interface as `VWAPSRStrategy` — swap the import:

```python
from strategy.regime_switch import RegimeSwitchStrategy, RegimeConfig

strategy = RegimeSwitchStrategy(RegimeConfig(
    bars_per_day=48,          # 30m bars
    risk_per_trade=0.0075,    # dial risk here
    allow_shorts=True,        # False if executing on spot
))
sig = strategy.analyze("BTC/USDT", df_30m)   # df: open/high/low/close/volume
```

`TradeSignal` carries `entry_price`, `stop_loss`, `take_profit`, `trail_points`
(chandelier distance for trend trades), and `max_bars` (time-stop for chop
fades; ignore if your executor can't). For trend trades `take_profit` is parked
at 10R — the channel trail is the real exit; if your executor can re-evaluate
`exit_signal_row()` per bar, prefer that over the static trail.

Feed it ≥ 970 bars of history (`strategy.MIN_ROWS`); signals form on closed
bars only.

## Honest caveats

- **Backtest ≠ live.** Slippage on stop gaps is modeled (fills at the worse of
  level/open) and entries pay 0.08%/side, but exchange outages, funding, and
  thin books at 3am are not fully capturable. Expect live Sharpe below backtest.
- **Shorts assume a perp/margin venue.** Funding rates are not modeled (they
  cut both ways; short funding was mostly positive carry for shorts in bear
  markets). Spot users: `allow_shorts=False` (Sharpe 1.38 standalone).
- **It will feel wrong to trade.** Win rate is ~24%. Months of small stops
  punctuated by a handful of monster winners is the cost of the right tail —
  abandoning it mid-losing-streak is how trend strategies actually fail.
- **2025-style grind is the weak regime** (+0.8%): breakouts kept failing.
  The drawdown control is what keeps that survivable.
- Parameter surface is a plateau (IS Sharpe 1.34–1.64 across every ±50%
  variation tested — see `results/sensitivity_in_sample.csv`), so small
  parameter drift won't break it. Resist re-tuning on recent months.
