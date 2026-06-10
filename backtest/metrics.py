"""Performance metrics computed from the mark-to-market equity curve."""
from __future__ import annotations

import numpy as np
import pandas as pd


def summarize(eq: pd.Series, trades: pd.DataFrame, label: str = "") -> dict:
    eq = eq.dropna()
    daily = eq.resample("1D").last().dropna()
    r = daily.pct_change().dropna()
    years = (eq.index[-1] - eq.index[0]).days / 365.25
    total = eq.iloc[-1] / eq.iloc[0] - 1
    cagr = (eq.iloc[-1] / eq.iloc[0]) ** (1 / years) - 1 if years > 0 else np.nan

    sharpe = np.sqrt(365.0) * r.mean() / r.std() if r.std() > 0 else np.nan
    downside = r[r < 0].std()
    sortino = np.sqrt(365.0) * r.mean() / downside if downside and downside > 0 else np.nan

    peak = eq.cummax()
    dd = (eq / peak - 1).min()

    m = {
        "label": label,
        "start": str(eq.index[0].date()), "end": str(eq.index[-1].date()),
        "years": round(years, 2),
        "total_return_pct": round(100 * total, 1),
        "cagr_pct": round(100 * cagr, 1),
        "sharpe_daily_ann": round(float(sharpe), 2),
        "sortino_daily_ann": round(float(sortino), 2),
        "max_drawdown_pct": round(100 * float(dd), 1),
        "ann_vol_pct": round(100 * float(r.std() * np.sqrt(365.0)), 1),
    }
    if trades is not None and len(trades):
        wins = trades[trades.pnl > 0]
        m.update({
            "trades": int(len(trades)),
            "trades_per_month": round(len(trades) / (years * 12), 1),
            "win_rate_pct": round(100 * len(wins) / len(trades), 1),
            "profit_factor": round(float(wins.pnl.sum() / max(1e-9, -trades[trades.pnl < 0].pnl.sum())), 2),
            "avg_bars_held": round(float(trades.bars.mean()), 1),
        })
        for eng in ("T", "M"):
            sub = trades[trades.engine == eng]
            if len(sub):
                m[f"{eng}_trades"] = int(len(sub))
                m[f"{eng}_pnl_share_pct"] = round(100 * float(sub.pnl.sum()) / max(1e-9, float(trades.pnl.sum())), 1)
                m[f"{eng}_win_rate_pct"] = round(100 * float((sub.pnl > 0).mean()), 1)
    return m


def yearly_table(eq: pd.Series) -> pd.DataFrame:
    daily = eq.resample("1D").last().dropna()
    r = daily.pct_change().dropna()
    rows = []
    for year, grp in r.groupby(r.index.year):
        ann = grp.std() * np.sqrt(365.0)
        rows.append({
            "year": year,
            "return_pct": round(100 * ((1 + grp).prod() - 1), 1),
            "sharpe": round(float(np.sqrt(365.0) * grp.mean() / grp.std()), 2) if grp.std() > 0 else np.nan,
            "maxdd_pct": round(100 * float((grp.add(1).cumprod() / grp.add(1).cumprod().cummax() - 1).min()), 1),
            "vol_pct": round(100 * float(ann), 1),
        })
    return pd.DataFrame(rows)
