"""
ml/src/models/shrinkage_prior.py
Method D: Prior updated by empirical shrinkage per knot:
F_hat(tau_k) = (n * empirical(tau_k) + k * prior(tau_k)) / (n + k)
Strict monotonicity enforced via Pool Adjacent Violators Algorithm (PAVA).
k chosen by cross-validation over training cycles.
"""

from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from .base import BaseForecaster
from .survey_prior import interpolate_curve

CATEGORIES = ["seed", "fertilizer", "agrochemical", "labour", "machinery", "fuel", "irrigation", "other"]
KNOTS = np.array([0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])


def pava_isotonic(y: np.ndarray, w: Optional[np.ndarray] = None) -> np.ndarray:
    """
    Pool Adjacent Violators Algorithm (PAVA) for isotonic regression.
    Enforces non-decreasing monotonicity: y_hat[i] <= y_hat[i+1].
    """
    n = len(y)
    if w is None:
        w = np.ones(n, dtype=np.float64)
    else:
        w = np.array(w, dtype=np.float64)

    val = list(y.astype(np.float64))
    weights = list(w)
    blocks = [[i] for i in range(n)]

    i = 0
    while i < len(val) - 1:
        if val[i] > val[i + 1]:
            # Merge block i and block i+1
            new_w = weights[i] + weights[i + 1]
            new_v = (val[i] * weights[i] + val[i + 1] * weights[i + 1]) / new_w
            val[i] = new_v
            weights[i] = new_w
            blocks[i].extend(blocks[i + 1])

            val.pop(i + 1)
            weights.pop(i + 1)
            blocks.pop(i + 1)
            if i > 0:
                i -= 1
        else:
            i += 1

    res = np.zeros(n, dtype=np.float64)
    for b, v in zip(blocks, val):
        res[b] = v

    # Boundary conditions
    res[0] = 0.0
    res[-1] = 1.0
    return np.clip(res, 0.0, 1.0)


def extract_empirical_fractions_at_knots(cycles: List[Dict[str, Any]]) -> Dict[str, np.ndarray]:
    """
    Computes cohort empirical mean spend fraction curve across cycles for each knot.
    Returns: dict mapping category -> array of shape (11,)
    """
    if not cycles:
        return {c: np.copy(KNOTS) for c in CATEGORIES}

    n_knots = len(KNOTS)
    fractions_by_cat = {c: [] for c in CATEGORIES}

    for cycle in cycles:
        cycle_len = float(cycle.get("cycle_length_days", 105))
        expenses = cycle.get("expenses", [])
        total_by_cat = {c: 0.0 for c in CATEGORIES}
        for e in expenses:
            total_by_cat[e["category"]] += float(e["amount"])

        cat_knot_spend = {c: np.zeros(n_knots) for c in CATEGORIES}
        for e in expenses:
            d = float(e["day"])
            c = e["category"]
            amt = float(e["amount"])
            # Distribute into knots
            for k_idx, k_t in enumerate(KNOTS):
                knot_day = k_t * cycle_len
                if d <= knot_day:
                    cat_knot_spend[c][k_idx] += amt

        for c in CATEGORIES:
            tot = total_by_cat[c]
            if tot > 0:
                fracs = np.clip(cat_knot_spend[c] / tot, 0.0, 1.0)
            else:
                fracs = np.copy(KNOTS)
            fractions_by_cat[c].append(fracs)

    empirical_means = {}
    for c in CATEGORIES:
        arr = np.array(fractions_by_cat[c])  # shape (N, 11)
        mean_curve = arr.mean(axis=0)
        mean_curve[0] = 0.0
        mean_curve[-1] = 1.0
        empirical_means[c] = pava_isotonic(mean_curve)

    return empirical_means


class ShrinkagePriorForecaster(BaseForecaster):
    """
    Method D: Shrinkage forecaster blending empirical cohort data with survey priors.
    Formula per knot: F_hat = (n * empirical + k * prior) / (n + k).
    Monotonicity enforced by PAVA isotonic regression.
    """

    def __init__(
        self,
        prior_curves: Dict[str, Any],
        k_shrinkage: float = 10.0,
        conformal_calibrator=None,
        empirical_only: bool = False
    ):
        self.prior_curves = prior_curves
        self.k_shrinkage = k_shrinkage
        self.conformal_calibrator = conformal_calibrator
        self.empirical_only = empirical_only
        self.fitted_curves: Dict[str, np.ndarray] = {c: np.array(prior_curves[c]) for c in CATEGORIES}
        self.n_training_cycles = 0

    def fit(self, training_cycles: List[Dict[str, Any]], k_shrinkage: Optional[float] = None):
        """Fits empirical curves from training cohort and updates shrinkage curves."""
        self.n_training_cycles = len(training_cycles)
        if k_shrinkage is not None:
            self.k_shrinkage = k_shrinkage

        n = self.n_training_cycles
        k = 0.0 if self.empirical_only else self.k_shrinkage

        if n == 0:
            # When n=0, strictly equal to prior curves
            self.fitted_curves = {c: np.array(self.prior_curves[c]) for c in CATEGORIES}
            return self

        empirical_curves = extract_empirical_fractions_at_knots(training_cycles)

        for c in CATEGORIES:
            emp = empirical_curves[c]
            prior = np.array(self.prior_curves[c])

            if self.empirical_only or k == 0.0:
                blended = emp
            else:
                blended = (n * emp + k * prior) / (n + k)

            # Enforce non-decreasing monotonicity via PAVA
            fitted = pava_isotonic(blended)
            fitted[0] = 0.0
            fitted[-1] = 1.0
            self.fitted_curves[c] = fitted

        return self

    @classmethod
    def fit_with_cv(
        cls,
        training_cycles: List[Dict[str, Any]],
        prior_curves: Dict[str, Any],
        k_grid: List[float] = [0.0, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0],
        n_folds: int = 5,
        eval_taus: List[float] = [0.2, 0.4, 0.6, 0.8],
        conformal_calibrator=None
    ) -> Tuple["ShrinkagePriorForecaster", float, Dict[float, float]]:
        """
        Chooses optimal k_shrinkage via cross-validation over training cycles.
        Objective: Mean Absolute Percentage Error (MAPE) averaged across eval_taus.
        Returns: (fitted_model, best_k, cv_losses_dict)
        """
        n = len(training_cycles)
        if n == 0:
            model = cls(prior_curves, k_shrinkage=10.0, conformal_calibrator=conformal_calibrator)
            model.fit([])
            return model, float("inf"), {k: 0.0 for k in k_grid}

        actual_folds = max(2, min(n_folds, n))
        rng = np.random.default_rng(42)
        indices = np.arange(n)
        rng.shuffle(indices)
        folds = np.array_split(indices, actual_folds)

        best_k = k_grid[0]
        lowest_mape = float("inf")
        cv_losses = {}

        for k in k_grid:
            fold_mapes = []
            for f_idx in range(actual_folds):
                val_idx = folds[f_idx]
                train_idx = np.setdiff1d(indices, val_idx)

                train_subset = [training_cycles[i] for i in train_idx]
                val_subset = [training_cycles[i] for i in val_idx]

                candidate = cls(prior_curves, k_shrinkage=k, empirical_only=(k == 0.0))
                candidate.fit(train_subset)

                # Evaluate MAPE across representative knots in eval_taus
                errors = []
                for v in val_subset:
                    cycle_len = float(v.get("cycle_length_days", 105))
                    actual = float(v["true_final_cost"])
                    base = float(v["so1_baseline_predicted"])
                    for tau in eval_taus:
                        d = max(1, int(round(tau * cycle_len)))
                        pred = candidate.forecast(v, d, base)
                        errors.append(abs(pred["final_cost"] - actual) / actual)
                if errors:
                    fold_mapes.append(float(np.mean(errors)))

            avg_mape = float(np.mean(fold_mapes)) if fold_mapes else float("inf")
            cv_losses[k] = round(avg_mape, 5)
            if avg_mape < lowest_mape:
                lowest_mape = avg_mape
                best_k = k

        final_model = cls(
            prior_curves,
            k_shrinkage=best_k,
            empirical_only=(best_k == 0.0),
            conformal_calibrator=conformal_calibrator
        )
        final_model.fit(training_cycles)
        return final_model, best_k, cv_losses

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

        # Expected fraction using fitted curves
        expected_frac = 0.0
        for cat in CATEGORIES:
            share = shares.get(cat, 0.125)
            fitted = self.fitted_curves.get(cat, KNOTS)
            val = interpolate_curve(KNOTS, fitted, tau)
            expected_frac += share * val
        expected_frac = max(0.001, min(1.0, expected_frac))

        if expected_frac > 0.02:
            point_forecast = round(spent_to_date / expected_frac, 2)
        else:
            point_forecast = round(baseline, 2)

        point_forecast = max(spent_to_date, point_forecast)

        method_tag = "method_d_empirical_ablation" if self.empirical_only else "method_d_shrinkage"
        if self.conformal_calibrator:
            interval, p_exceed = self.conformal_calibrator.predict_interval(
                method_name=method_tag,
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
            "method": method_tag,
            "day": day_t,
            "tau": round(tau, 4),
            "k_shrinkage": self.k_shrinkage,
            "n_trained": self.n_training_cycles,
            "spent_to_date": spent_to_date,
            "final_cost": point_forecast,
            "interval": interval,
            "p_exceed": round(p_exceed, 4)
        }
