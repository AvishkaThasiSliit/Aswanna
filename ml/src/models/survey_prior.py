"""
ml/src/models/survey_prior.py
Method C: Survey prior curves, ratio estimator (actual_to_date / F(t)).
Uses empirical DoA survey prior spend fraction curves from ml/artifacts/phasing_priors_v0.json.
"""

from typing import Dict, Any, Optional
import numpy as np
from .base import BaseForecaster

CATEGORIES = ["seed", "fertilizer", "agrochemical", "labour", "machinery", "fuel", "irrigation", "other"]
KNOTS = np.array([0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])


def interpolate_curve(knots: np.ndarray, values: np.ndarray, t: float) -> float:
    """Piecewise-linear interpolation of curve at progress t in [0, 1]."""
    if t <= 0.0:
        return float(values[0])
    if t >= 1.0:
        return float(values[-1])
    return float(np.interp(t, knots, values))


class SurveyPriorForecaster(BaseForecaster):
    """
    Method C: Ratio estimator anchored to the DoA survey prior curve.
    final_cost = spent_to_date / (Expected_to_date / Baseline).
    """

    def __init__(self, prior_curves: Dict[str, Any], conformal_calibrator=None):
        """
        prior_curves: dict mapping category -> list of 11 knot values (P50).
        """
        self.prior_curves = prior_curves
        self.conformal_calibrator = conformal_calibrator

    def evaluate_expected_frac(self, tau: float, category_shares: Dict[str, float]) -> float:
        """Computes expected cumulative spend fraction across all categories at tau."""
        frac = 0.0
        for cat in CATEGORIES:
            share = category_shares.get(cat, 0.125)
            cat_curve = self.prior_curves.get(cat, KNOTS)
            val = interpolate_curve(KNOTS, np.array(cat_curve), tau)
            frac += share * val
        return max(0.001, min(1.0, frac))

    def forecast(
        self,
        cycle_history: Dict[str, Any],
        day_t: int,
        baseline: float,
        category_baselines: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        cycle_len = float(cycle_history.get("cycle_length_days", 105))
        tau = min(1.0, max(0.01, float(day_t) / cycle_len))

        expenses = cycle_history.get("expenses", [])
        spent_to_date = float(sum(e["amount"] for e in expenses if e["day"] <= day_t))

        if not category_baselines:
            shares = {"seed": 0.08, "fertilizer": 0.22, "agrochemical": 0.12,
                      "labour": 0.32, "machinery": 0.16, "fuel": 0.07, "irrigation": 0.01, "other": 0.02}
        else:
            tot = max(1.0, sum(category_baselines.values()))
            shares = {c: category_baselines[c] / tot for c in CATEGORIES}

        expected_frac = self.evaluate_expected_frac(tau, shares)

        if expected_frac > 0.02:
            point_forecast = round(spent_to_date / expected_frac, 2)
        else:
            point_forecast = round(baseline, 2)

        point_forecast = max(spent_to_date, point_forecast)

        if self.conformal_calibrator:
            interval, p_exceed = self.conformal_calibrator.predict_interval(
                method_name="method_c",
                point_estimate=point_forecast,
                tau=tau,
                baseline=baseline,
                spent_to_date=spent_to_date
            )
        else:
            margin = 0.18 * (1.0 - 0.5 * tau)
            interval = [round(max(spent_to_date, point_forecast * (1 - margin)), 2),
                        round(point_forecast * (1 + margin), 2)]
            p_exceed = 1.0 if point_forecast > 1.10 * baseline else 0.0

        return {
            "method": "method_c_survey_prior",
            "day": day_t,
            "tau": round(tau, 4),
            "spent_to_date": spent_to_date,
            "final_cost": point_forecast,
            "interval": interval,
            "p_exceed": round(p_exceed, 4)
        }
