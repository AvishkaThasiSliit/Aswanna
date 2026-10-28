"""
ml/src/models/alert_logic.py
Method A: Production SO3 alert logic (re-implemented from shared/phasing.js).
Uses piecewise-linear breakpoints for front-loaded categories and linear for others.
"""

from typing import Dict, Any, Optional
import numpy as np
from .base import BaseForecaster

CATEGORIES = ["seed", "fertilizer", "agrochemical", "labour", "machinery", "fuel", "irrigation", "other"]
FRONT_LOADED = {"seed", "fertilizer", "agrochemical"}


def phasing_breakpoint_js(category: str, t: float) -> float:
    """
    Exact mathematical re-implementation of shared/phasing.js:phasingFor(category, t).
    t is normalized cycle progress in [0, 1].
    """
    if t <= 0.0:
        return 0.0
    if t >= 1.0:
        return 1.0

    if category in FRONT_LOADED:
        if t <= 0.15:
            return float((t / 0.15) * 0.70)
        elif t <= 0.40:
            return float(0.70 + ((t - 0.15) / 0.25) * 0.20)
        else:
            return float(0.90 + ((t - 0.40) / 0.60) * 0.10)
    else:
        return float(t)


class AlertLogicForecaster(BaseForecaster):
    """
    Method A: Forecasts using current SO3 production phasing breakpoints.
    Estimates final cost via ratio of spend to expected-to-date.
    """

    def __init__(self, conformal_calibrator=None):
        self.conformal_calibrator = conformal_calibrator

    def forecast(
        self,
        cycle_history: Dict[str, Any],
        day_t: int,
        baseline: float,
        category_baselines: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        cycle_len = float(cycle_history.get("cycle_length_days", 105))
        tau = min(1.0, max(0.01, float(day_t) / cycle_len))

        # Sum expenses to date
        expenses = cycle_history.get("expenses", [])
        spent_to_date = float(sum(e["amount"] for e in expenses if e["day"] <= day_t))

        # Default category breakdown if not provided (Paddy baseline shares)
        if not category_baselines:
            shares = {"seed": 0.08, "fertilizer": 0.22, "agrochemical": 0.12,
                      "labour": 0.32, "machinery": 0.16, "fuel": 0.07, "irrigation": 0.01, "other": 0.02}
            cat_bases = {c: baseline * shares[c] for c in CATEGORIES}
        else:
            cat_bases = category_baselines

        expected_to_date = sum(cat_bases[c] * phasing_breakpoint_js(c, tau) for c in CATEGORIES)
        expected_frac = expected_to_date / max(1.0, baseline)

        if expected_frac > 0.02:
            point_forecast = round(spent_to_date / expected_frac, 2)
        else:
            point_forecast = round(baseline, 2)

        # Enforce minimum possible final cost is what has already been spent
        point_forecast = max(spent_to_date, point_forecast)

        # Compute interval and p_exceed via conformal calibrator or fallback
        if self.conformal_calibrator:
            interval, p_exceed = self.conformal_calibrator.predict_interval(
                method_name="method_a",
                point_estimate=point_forecast,
                tau=tau,
                baseline=baseline,
                spent_to_date=spent_to_date
            )
        else:
            # Fallback 80% heuristic interval
            margin = 0.20 * (1.0 - 0.5 * tau)
            interval = [round(max(spent_to_date, point_forecast * (1 - margin)), 2),
                        round(point_forecast * (1 + margin), 2)]
            p_exceed = 1.0 if point_forecast > 1.10 * baseline else 0.0

        # Tiered alert rule matching production shared/variance.js
        alert_ratio = spent_to_date / max(1.0, expected_to_date)
        if alert_ratio > 1.20:
            alert_level = "danger"
        elif alert_ratio > 1.10:
            alert_level = "warning"
        else:
            alert_level = "ok"

        return {
            "method": "method_a_alert_logic",
            "day": day_t,
            "tau": round(tau, 4),
            "spent_to_date": spent_to_date,
            "final_cost": point_forecast,
            "interval": interval,
            "p_exceed": round(p_exceed, 4),
            "alert_level": alert_level,
            "expected_to_date": round(expected_to_date, 2)
        }
