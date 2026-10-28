"""
ml/src/models/linear_extrap.py
Method B: Linear extrapolation (spend per day * cycle length).
"""

from typing import Dict, Any, Optional
from .base import BaseForecaster


class LinearExtrapolationForecaster(BaseForecaster):
    """
    Method B: Naive linear extrapolation of cumulative spend to date.
    final_cost = spent_to_date / (t / T) = spend_per_day * cycle_length_days.
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

        expenses = cycle_history.get("expenses", [])
        spent_to_date = float(sum(e["amount"] for e in expenses if e["day"] <= day_t))

        if tau > 0.02:
            point_forecast = round(spent_to_date / tau, 2)
        else:
            point_forecast = round(baseline, 2)

        point_forecast = max(spent_to_date, point_forecast)

        if self.conformal_calibrator:
            interval, p_exceed = self.conformal_calibrator.predict_interval(
                method_name="method_b",
                point_estimate=point_forecast,
                tau=tau,
                baseline=baseline,
                spent_to_date=spent_to_date
            )
        else:
            margin = 0.25 * (1.0 - 0.4 * tau)
            interval = [round(max(spent_to_date, point_forecast * (1 - margin)), 2),
                        round(point_forecast * (1 + margin), 2)]
            p_exceed = 1.0 if point_forecast > 1.10 * baseline else 0.0

        return {
            "method": "method_b_linear_extrap",
            "day": day_t,
            "tau": round(tau, 4),
            "spent_to_date": spent_to_date,
            "final_cost": point_forecast,
            "interval": interval,
            "p_exceed": round(p_exceed, 4)
        }
