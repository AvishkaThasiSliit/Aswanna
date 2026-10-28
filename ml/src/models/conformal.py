"""
ml/src/models/conformal.py
Split Conformal Predictor for calibrated 80% prediction intervals.
Calibrates per-tau knot using normalized relative non-conformity scores:
    s_i(tau) = |y_i - y_hat_i(tau)| / y_hat_i(tau)
guaranteeing finite-sample coverage 1 - alpha on exchangeable calibration/test cohorts.
"""

from typing import Dict, Any, List, Tuple, Optional
import numpy as np


class StratifiedConformalCalibrator:
    """
    Split Conformal Calibrator calibrated per tau knot with normalized non-conformity scores.
    """

    def __init__(self, target_coverage: float = 0.80):
        self.target_coverage = target_coverage
        self.alpha = 1.0 - target_coverage
        # quantiles[method_name][tau_str] -> float
        self.quantiles: Dict[str, Dict[str, float]] = {}
        # residual_distributions[method_name][tau_str] -> np.ndarray
        self.residual_distributions: Dict[str, Dict[str, np.ndarray]] = {}
        self.eval_taus: List[float] = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

    def calibrate(
        self,
        calibration_cycles: List[Dict[str, Any]],
        forecasters: Dict[str, Any],
        eval_taus: List[float] = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    ):
        """
        Calibrates non-conformity quantiles per tau knot on the held-out calibration split.
        """
        self.eval_taus = list(eval_taus)

        for m_name, model in forecasters.items():
            residuals_by_tau = {f"{t:.2f}": [] for t in eval_taus}
            signed_errors_by_tau = {f"{t:.2f}": [] for t in eval_taus}

            for cycle in calibration_cycles:
                cycle_len = float(cycle.get("cycle_length_days", 105))
                true_cost = float(cycle["true_final_cost"])
                baseline = float(cycle["so1_baseline_predicted"])

                for tau in eval_taus:
                    day_t = max(1, int(round(tau * cycle_len)))
                    pred = model.forecast(cycle, day_t, baseline)
                    y_hat = max(1.0, float(pred["final_cost"]))

                    # Relative non-conformity score
                    rel_err = abs(true_cost - y_hat) / y_hat
                    signed_err = (true_cost - y_hat) / y_hat

                    t_key = f"{tau:.2f}"
                    residuals_by_tau[t_key].append(rel_err)
                    signed_errors_by_tau[t_key].append(signed_err)

            if m_name not in self.quantiles:
                self.quantiles[m_name] = {}
                self.residual_distributions[m_name] = {}

            for tau in eval_taus:
                t_key = f"{tau:.2f}"
                res_list = residuals_by_tau[t_key]
                n_b = len(res_list)
                if n_b > 0:
                    arr = np.sort(np.array(res_list))
                    # Finite-sample conformal quantile: ceil((n+1)*(1-alpha)) / n
                    level = min(1.0, float(np.ceil((n_b + 1) * self.target_coverage) / n_b))
                    q_val = float(np.quantile(arr, level))
                    self.quantiles[m_name][t_key] = max(0.02, q_val)
                    self.residual_distributions[m_name][t_key] = np.array(signed_errors_by_tau[t_key])
                else:
                    self.quantiles[m_name][t_key] = 0.20
                    self.residual_distributions[m_name][t_key] = np.array([0.0])

        return self

    def _find_closest_tau_key(self, tau: float) -> str:
        diffs = [abs(tau - t) for t in self.eval_taus]
        best_t = self.eval_taus[int(np.argmin(diffs))]
        return f"{best_t:.2f}"

    def predict_interval(
        self,
        method_name: str,
        point_estimate: float,
        tau: float,
        baseline: float,
        spent_to_date: float
    ) -> Tuple[List[float], float]:
        """
        Returns:
            interval: [lower, upper] clipped to >= spent_to_date
            p_exceed: calibrated empirical probability of exceeding 1.10 * baseline
        """
        t_key = self._find_closest_tau_key(tau)

        m_quantiles = self.quantiles.get(method_name)
        if not m_quantiles:
            for k, q_dict in self.quantiles.items():
                if k in method_name or method_name in k:
                    m_quantiles = q_dict
                    break
        if not m_quantiles and self.quantiles:
            m_quantiles = list(self.quantiles.values())[0]

        q = (m_quantiles or {}).get(t_key, 0.20)

        lower = max(spent_to_date, round(point_estimate * (1.0 - q), 2))
        upper = max(lower, round(point_estimate * (1.0 + q), 2))

        # Calibrate p_exceed from signed residual distribution at this knot
        m_dist = self.residual_distributions.get(method_name, {}).get(t_key, None)
        if m_dist is None:
            for k, d_dict in self.residual_distributions.items():
                if k in method_name or method_name in k:
                    m_dist = d_dict.get(t_key, None)
                    break

        threshold = 1.10 * baseline
        if m_dist is not None and len(m_dist) > 0:
            simulated_outcomes = point_estimate * (1.0 + m_dist)
            p_exceed = float(np.mean(simulated_outcomes > threshold))
        else:
            p_exceed = 1.0 if point_estimate > threshold else 0.0

        return [lower, upper], p_exceed
