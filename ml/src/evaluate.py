"""
ml/src/evaluate.py
Rigorous formal evaluation harness for mid-cycle final cost forecasting.
Evaluates across 30 independent seeds addressing all requirements:
1. Simulator disclosure & reproducibility: S1 'prior-aligned' vs S2 'prior-misaligned' with canonical config hashes
2. CV loss matrix with identical held-out validation sets across n (Yala 2023), and per-scenario kappa* tuning
3. Headline learning curves averaged across all knots tau in {0.1,...,0.9} across 30 seeds;
   n=0 keeps only D=C (prior only); empirical-only evaluated for n in {5..300} with equivalence margin +-0.25 pp
4. Per-tau table (tau 0.1..0.9) of MAPE mean +- 95% CI for A, B, C, D(tuned, n=300) on S1, S2, and S3
   evaluated on the EXACT same test cohorts to guarantee exact mathematical reconciliation with headline curves
5. Lump-sum and Gradual-shock variants (cost rate +35% over 20 days) with paired bootstrap 95% CIs on detection delay differences
6. Non-overlapping random seed streams (1000s, 2000s, 3000s, 4000s, 5000s) and disjoint farm identities
"""

import sys
from pathlib import Path

# Ensure repo root is on sys.path
repo_root = Path(__file__).resolve().parents[2]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from typing import Any, Dict, List, Tuple, Optional
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from ml.src.simulator.generator import DailySpendSimulator, CATEGORIES, get_scenario_config_hash
from ml.src.models.alert_logic import AlertLogicForecaster
from ml.src.models.linear_extrap import LinearExtrapolationForecaster
from ml.src.models.survey_prior import SurveyPriorForecaster
from ml.src.models.shrinkage_prior import ShrinkagePriorForecaster
from ml.src.models.conformal import StratifiedConformalCalibrator

EVAL_TAUS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
N_TRAIN_STEPS = [0, 5, 10, 20, 30, 50, 100, 300]
EXTENDED_K_GRID = [0.0, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0]
KNOTS = np.array([0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])
EQUIVALENCE_MARGIN = 0.0025  # +-0.25 percentage points
N_SEEDS = 30


def load_prior_curves(priors_json_path: Path, crop: str = "Paddy") -> Dict[str, List[float]]:
    with open(priors_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    crop_data = data["crops"][crop]["categories"]
    return {c: crop_data[c]["p50"] for c in CATEGORIES}


def paired_bootstrap_ci(
    diffs: np.ndarray,
    n_boot: int = 2000,
    ci: float = 0.95,
    margin: float = EQUIVALENCE_MARGIN
) -> Tuple[float, float, float, str]:
    """
    Computes paired bootstrap confidence interval with an equivalence margin (+-0.25 percentage points).
    If the entire 95% CI is contained within [-margin, +margin], outcome is 'practically equivalent'.
    """
    mean_diff = float(np.mean(diffs))
    rng = np.random.default_rng(12345)
    boot_means = [float(np.mean(rng.choice(diffs, size=len(diffs), replace=True))) for _ in range(n_boot)]

    alpha = 1.0 - ci
    lower = float(np.percentile(boot_means, 100 * (alpha / 2)))
    upper = float(np.percentile(boot_means, 100 * (1 - alpha / 2)))

    if lower >= -margin and upper <= margin:
        outcome = "practically equivalent"
    elif upper < -margin:
        outcome = "Method D wins"
    elif lower > margin:
        outcome = "Method D loses"
    else:
        outcome = "no significant difference"

    return mean_diff, lower, upper, outcome


def paired_bootstrap_delay_diff(
    delays_d: List[float],
    delays_a: List[float],
    n_boot: int = 2000,
    ci: float = 0.95
) -> Tuple[float, float, float, str]:
    """
    Computes paired bootstrap 95% CI on detection delay differences: delay(D) - delay(A).
    Labels 'equivalent' if the 95% CI includes 0.0.
    """
    diffs = np.array(delays_d) - np.array(delays_a)
    mean_diff = float(np.mean(diffs))
    rng = np.random.default_rng(12345)
    boot_means = [float(np.mean(rng.choice(diffs, size=len(diffs), replace=True))) for _ in range(n_boot)]

    alpha = 1.0 - ci
    lower = float(np.percentile(boot_means, 100 * (alpha / 2)))
    upper = float(np.percentile(boot_means, 100 * (1 - alpha / 2)))

    if lower <= 0.0 <= upper:
        label = "equivalent"
    elif upper < 0.0:
        label = "Method D detects significantly faster"
    else:
        label = "Method A detects significantly faster"

    return mean_diff, lower, upper, label


def tune_alert_threshold_on_calibration(
    calib_cycles: List[Dict[str, Any]],
    forecaster: Any,
    eval_tau: float = 0.40
) -> float:
    threshold_grid = np.linspace(0.95, 1.25, 31)
    best_lambda = 1.10
    best_f1 = -1.0

    actuals_exceeded = []
    y_hat_ratios = []

    for cyc in calib_cycles:
        actual = float(cyc["true_final_cost"])
        base = float(cyc["so1_baseline_predicted"])
        c_len = float(cyc["cycle_length_days"])
        d = max(1, int(round(eval_tau * c_len)))

        pred = forecaster.forecast(cyc, d, base)
        y_hat = float(pred["final_cost"])

        actuals_exceeded.append(actual > 1.10 * base)
        y_hat_ratios.append(y_hat / base)

    actuals_exceeded = np.array(actuals_exceeded)
    y_hat_ratios = np.array(y_hat_ratios)

    for lam in threshold_grid:
        preds = y_hat_ratios > lam
        tp = int(np.sum(preds & actuals_exceeded))
        fp = int(np.sum(preds & ~actuals_exceeded))
        fn = int(np.sum(~preds & actuals_exceeded))

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

        if f1 > best_f1:
            best_f1 = f1
            best_lambda = float(lam)

    return best_lambda


def compute_lead_time_days(cycle: Dict[str, Any], forecaster: Any, alert_threshold_lambda: float) -> Optional[int]:
    c_len = int(cycle["cycle_length_days"])
    base = float(cycle["so1_baseline_predicted"])
    for d in range(1, c_len + 1):
        pred = forecaster.forecast(cycle, d, base)
        if pred["final_cost"] > alert_threshold_lambda * base:
            return d
    return None


def compute_lead_time_original_method_a(cycle: Dict[str, Any], forecaster: Any) -> Optional[int]:
    c_len = int(cycle["cycle_length_days"])
    base = float(cycle["so1_baseline_predicted"])
    for d in range(1, c_len + 1):
        pred = forecaster.forecast(cycle, d, base)
        if pred["alert_level"] in ["warning", "danger"]:
            return d
    return None


def compute_rmse_per_category(sim_cycles: List[Dict[str, Any]], prior_curves: Dict[str, List[float]]) -> Dict[str, float]:
    knots_days_idx = (KNOTS * 105).astype(int)
    cat_rmses = {}
    for cat in CATEGORIES:
        prior_knots = np.array(prior_curves[cat])
        sim_knots = np.mean([np.array(c["true_curves"][cat])[knots_days_idx] for c in sim_cycles], axis=0)
        rmse = float(np.sqrt(np.mean((prior_knots - sim_knots) ** 2)))
        cat_rmses[cat] = round(rmse, 4)
    return cat_rmses


def evaluate_val_loss_on_fixed_cohort(
    model: Any,
    val_cohort: List[Dict[str, Any]],
    eval_taus: List[float] = EVAL_TAUS
) -> float:
    """Evaluates average MAPE across all eval_taus on a fixed identical validation cohort."""
    all_apes = []
    for cyc in val_cohort:
        c_len = float(cyc["cycle_length_days"])
        base = float(cyc["so1_baseline_predicted"])
        actual = float(cyc["true_final_cost"])
        for tau in eval_taus:
            d = max(1, int(round(tau * c_len)))
            pred = model.forecast(cyc, d, base)
            all_apes.append(abs(actual - pred["final_cost"]) / actual)
    return float(np.mean(all_apes))


def main():
    print("=" * 90, flush=True)
    print("RIGOROUS 30-SEED FORECAST EVALUATION & DUAL-SIMULATOR AUDIT", flush=True)
    print("=" * 90, flush=True)

    base_dir = Path("ml")
    prior_path = base_dir / "artifacts/phasing_priors_v0.json"
    plots_dir = base_dir / "artifacts/plots"
    plots_dir.mkdir(parents=True, exist_ok=True)

    prior_curves = load_prior_curves(prior_path, crop="Paddy")
    misspecified_prior = {c: list(KNOTS) for c in CATEGORIES}

    # -------------------------------------------------------------------------
    # 1. Simulator Disclosure & Canonical Config Hashes
    # -------------------------------------------------------------------------
    print("\n[1/7] Quantifying Divergence & Verifying Reproducibility Hashes...", flush=True)
    hash_s1 = get_scenario_config_hash("S1")
    hash_s2 = get_scenario_config_hash("S2")
    print(f"  Simulator Scenario S1 Canonical Config SHA256: {hash_s1}")
    print(f"  Simulator Scenario S2 Canonical Config SHA256: {hash_s2}")

    sim_audit = DailySpendSimulator(seed=101)
    cohort_s1 = sim_audit.generate_cohort(100, season="Maha", year=2024, prefix="audit_s1", scenario="S1")
    cohort_s2 = sim_audit.generate_cohort(100, season="Maha", year=2024, prefix="audit_s2", scenario="S2")

    rmse_s1 = compute_rmse_per_category(cohort_s1, prior_curves)
    rmse_s2 = compute_rmse_per_category(cohort_s2, prior_curves)

    print(f"\n{'Category':15s} | {'S1 (Prior-Aligned)':20s} | {'S2 (Prior-Misaligned)':20s}")
    print("-" * 62)
    for cat in CATEGORIES:
        print(f"{cat:15s} | {rmse_s1[cat]:20.4f} | {rmse_s2[cat]:20.4f}")
    mean_s1 = float(np.mean(list(rmse_s1.values())))
    mean_s2 = float(np.mean(list(rmse_s2.values())))
    print("-" * 62)
    print(f"{'Mean RMSE':15s} | {mean_s1:20.4f} | {mean_s2:20.4f}")

    # -------------------------------------------------------------------------
    # 2. Detailed CV Loss Matrix with IDENTICAL Validation Sets across n (Yala 2023)
    # -------------------------------------------------------------------------
    print("\n[2/7] Evaluating CV Loss on an IDENTICAL Fixed Validation Cohort (Yala 2023) across n...", flush=True)
    sim_cv = DailySpendSimulator(seed=2000)
    val_s1 = sim_cv.generate_cohort(100, season="Yala", year=2023, prefix="cv_val_yala_2023", scenario="S1")
    val_s2 = sim_cv.generate_cohort(100, season="Yala", year=2023, prefix="cv_val_yala_2023", scenario="S2")

    sim_tr_pool = DailySpendSimulator(seed=1000)
    train_pool_s1 = sim_tr_pool.generate_cohort(300, season="Maha", year=2022, prefix="tr_maha_2022", scenario="S1")
    train_pool_s2 = sim_tr_pool.generate_cohort(300, season="Maha", year=2022, prefix="tr_maha_2022", scenario="S2")

    # Confirm disjointness between CV validation set and training set
    tr_ids = {c["cycle_id"] for c in train_pool_s2}
    val_ids = {c["cycle_id"] for c in val_s2}
    assert len(tr_ids & val_ids) == 0, "Train and CV Validation sets must be strictly disjoint!"
    print(f"  Verified: CV Validation Set (Yala 2023, N={len(val_ids)}) is strictly disjoint from Train Set.")

    scenarios = ["S1_prior_aligned", "S2_prior_misaligned", "S3_misspecified_prior"]
    best_kappas = {sc: {} for sc in scenarios}
    cv_loss_matrices = {sc: [] for sc in scenarios}

    for sc in scenarios:
        if sc == "S1_prior_aligned":
            tr_pool, val_set, active_prior = train_pool_s1, val_s1, prior_curves
        elif sc == "S2_prior_misaligned":
            tr_pool, val_set, active_prior = train_pool_s2, val_s2, prior_curves
        else:  # S3
            tr_pool, val_set, active_prior = train_pool_s2, val_s2, misspecified_prior

        for n in N_TRAIN_STEPS:
            if n == 0:
                best_kappas[sc][0] = float("inf")
                m_prior = SurveyPriorForecaster(prior_curves=active_prior)
                loss_prior = evaluate_val_loss_on_fixed_cohort(m_prior, val_set)
                row = {"n": 0, "best_kappa": "inf", "val_set": "Yala 2023 (100 cycles)"}
                for k in EXTENDED_K_GRID:
                    row[f"k={k}"] = round(loss_prior, 4)
                cv_loss_matrices[sc].append(row)
            else:
                sub_tr = tr_pool[:n]
                k_losses = {}
                for k in EXTENDED_K_GRID:
                    if k == 0.0:
                        m_k = ShrinkagePriorForecaster(prior_curves=active_prior, empirical_only=True).fit(sub_tr)
                    else:
                        m_k = ShrinkagePriorForecaster(prior_curves=active_prior, k_shrinkage=k).fit(sub_tr)
                    k_losses[k] = evaluate_val_loss_on_fixed_cohort(m_k, val_set)

                best_k = min(k_losses, key=k_losses.get)
                best_kappas[sc][n] = best_k
                row = {"n": n, "best_kappa": best_k, "val_set": "Yala 2023 (100 cycles)"}
                for k in EXTENDED_K_GRID:
                    row[f"k={k}"] = round(k_losses[k], 4)
                cv_loss_matrices[sc].append(row)

    print("\nCV Loss Matrix for Scenario S2 (Prior-Misaligned) on IDENTICAL Validation Set (Yala 2023):")
    df_cv_s2 = pd.DataFrame(cv_loss_matrices["S2_prior_misaligned"])
    print(df_cv_s2.to_string(index=False))

    print("\nTuned kappa* per scenario:")
    for sc in scenarios:
        k_str = ", ".join([f"n={n}: {best_kappas[sc][n]}" for n in N_TRAIN_STEPS if n > 0])
        print(f"  {sc:25s} -> {k_str}")

    # -------------------------------------------------------------------------
    # 3. Unified 30-Seed Evaluation: Headline Curves & Exact Per-Tau Tables
    # -------------------------------------------------------------------------
    print("\n[3/7] Running Unified 30-Seed Evaluation for Learning Curves & Exact Per-Tau Breakdowns...", flush=True)

    methods_learn = ["Method C (Prior Only)", "Method D (Shrinkage)", "Ablation D (Empirical Only)"]
    learn_results = {sc: {m: {n: [] for n in N_TRAIN_STEPS} for m in methods_learn} for sc in scenarios}
    appendix_per_tau = {sc: {n: {t: [] for t in EVAL_TAUS} for n in N_TRAIN_STEPS} for sc in scenarios}

    tau_models = ["Method A (Alert Logic)", "Method B (Linear Extrap)", "Method C (Survey Prior)", "Method D (Shrinkage Prior)"]
    per_tau_mapes = {sc: {m: {t: [] for t in EVAL_TAUS} for m in tau_models} for sc in ["S1", "S2", "S3"]}

    for seed_idx in range(1, N_SEEDS + 1):
        # Distinct, independent seed streams for training and testing
        sim_tr = DailySpendSimulator(seed=1000 + seed_idx)
        sim_te = DailySpendSimulator(seed=4000 + seed_idx)

        tr_s1 = sim_tr.generate_cohort(300, season="Maha", year=2022, prefix=f"tr_s1_{seed_idx}", scenario="S1")
        te_s1 = sim_te.generate_cohort(100, season="Maha", year=2024, prefix=f"te_s1_{seed_idx}", scenario="S1")

        tr_s2 = sim_tr.generate_cohort(300, season="Maha", year=2022, prefix=f"tr_s2_{seed_idx}", scenario="S2")
        te_s2 = sim_te.generate_cohort(100, season="Maha", year=2024, prefix=f"te_s2_{seed_idx}", scenario="S2")

        for sc_name in scenarios:
            sc_short = sc_name.split("_")[0]
            if sc_name == "S1_prior_aligned":
                train_cohort, test_cohort, active_prior = tr_s1, te_s1, prior_curves
            elif sc_name == "S2_prior_misaligned":
                train_cohort, test_cohort, active_prior = tr_s2, te_s2, prior_curves
            else:  # S3
                train_cohort, test_cohort, active_prior = tr_s2, te_s2, misspecified_prior

            # Models A, B, C for per-tau comparisons
            m_a = AlertLogicForecaster()
            m_b = LinearExtrapolationForecaster()
            m_c = SurveyPriorForecaster(prior_curves=active_prior)

            # Record errors for Method A and Method B per tau
            for t in EVAL_TAUS:
                apes_a = []
                apes_b = []
                for cyc in test_cohort:
                    d = max(1, int(round(t * cyc["cycle_length_days"])))
                    p_a = m_a.forecast(cyc, d, cyc["so1_baseline_predicted"])
                    p_b = m_b.forecast(cyc, d, cyc["so1_baseline_predicted"])
                    actual = float(cyc["true_final_cost"])
                    apes_a.append(abs(actual - p_a["final_cost"]) / actual)
                    apes_b.append(abs(actual - p_b["final_cost"]) / actual)
                per_tau_mapes[sc_short]["Method A (Alert Logic)"][t].append(float(np.mean(apes_a)))
                per_tau_mapes[sc_short]["Method B (Linear Extrap)"][t].append(float(np.mean(apes_b)))

            # Evaluate Method C
            cyc_errs_c = []
            for cyc in test_cohort:
                base = cyc["so1_baseline_predicted"]
                actual = cyc["true_final_cost"]
                c_len = cyc["cycle_length_days"]
                tau_errs = []
                for tau in EVAL_TAUS:
                    d = max(1, int(round(tau * c_len)))
                    pred = m_c.forecast(cyc, d, base)
                    tau_errs.append(abs(actual - pred["final_cost"]) / actual)
                cyc_errs_c.append(np.mean(tau_errs))
            seed_mape_c = float(np.mean(cyc_errs_c))

            # Record Method C per tau
            for t in EVAL_TAUS:
                apes_c = []
                for cyc in test_cohort:
                    d = max(1, int(round(t * cyc["cycle_length_days"])))
                    pred = m_c.forecast(cyc, d, cyc["so1_baseline_predicted"])
                    actual = float(cyc["true_final_cost"])
                    apes_c.append(abs(actual - pred["final_cost"]) / actual)
                per_tau_mapes[sc_short]["Method C (Survey Prior)"][t].append(float(np.mean(apes_c)))

            # Evaluate Learning Curves across n
            for n in N_TRAIN_STEPS:
                sub_train = train_cohort[:n]
                k_val = best_kappas[sc_name][n]

                learn_results[sc_name]["Method C (Prior Only)"][n].append(seed_mape_c)

                # Method D (Shrinkage with scenario-tuned kappa*)
                if n == 0:
                    m_d = SurveyPriorForecaster(prior_curves=active_prior)
                else:
                    m_d = ShrinkagePriorForecaster(
                        prior_curves=active_prior,
                        k_shrinkage=10.0 if np.isinf(k_val) else k_val
                    ).fit(sub_train)

                # Empirical-only ablation (only valid for n >= 5)
                m_emp = None
                if n >= 5:
                    m_emp = ShrinkagePriorForecaster(prior_curves=active_prior, empirical_only=True).fit(sub_train)

                cyc_errs_d = []
                cyc_errs_emp = []
                knot_apes_d_for_seed = {t: [] for t in EVAL_TAUS}

                for cyc in test_cohort:
                    base = cyc["so1_baseline_predicted"]
                    actual = cyc["true_final_cost"]
                    c_len = cyc["cycle_length_days"]

                    d_tau_errs = []
                    emp_tau_errs = []
                    for tau in EVAL_TAUS:
                        d = max(1, int(round(tau * c_len)))
                        pred_d = m_d.forecast(cyc, d, base)
                        e_d = abs(actual - pred_d["final_cost"]) / actual
                        d_tau_errs.append(e_d)
                        knot_apes_d_for_seed[tau].append(e_d)

                        if m_emp is not None:
                            pred_emp = m_emp.forecast(cyc, d, base)
                            e_emp = abs(actual - pred_emp["final_cost"]) / actual
                            emp_tau_errs.append(e_emp)

                    cyc_errs_d.append(np.mean(d_tau_errs))
                    if m_emp is not None:
                        cyc_errs_emp.append(np.mean(emp_tau_errs))

                for tau in EVAL_TAUS:
                    appendix_per_tau[sc_name][n][tau].append(float(np.mean(knot_apes_d_for_seed[tau])))

                learn_results[sc_name]["Method D (Shrinkage)"][n].append(float(np.mean(cyc_errs_d)))
                if m_emp is not None:
                    learn_results[sc_name]["Ablation D (Empirical Only)"][n].append(float(np.mean(cyc_errs_emp)))

                # For n=300, record exact per-tau MAPEs for Method D
                if n == 300:
                    for t in EVAL_TAUS:
                        per_tau_mapes[sc_short]["Method D (Shrinkage Prior)"][t].append(float(np.mean(knot_apes_d_for_seed[t])))

    # Compute Summary and Paired Bootstrap with Equivalence Margin at each n
    learn_summary_tables = {}
    for sc in scenarios:
        rows = []
        for n in N_TRAIN_STEPS:
            c_arr = np.array(learn_results[sc]["Method C (Prior Only)"][n])
            d_arr = np.array(learn_results[sc]["Method D (Shrinkage)"][n])

            d_mean = float(np.mean(d_arr))
            d_ci = 1.96 * float(np.std(d_arr, ddof=1) / np.sqrt(N_SEEDS))
            c_mean = float(np.mean(c_arr))
            c_ci = 1.96 * float(np.std(c_arr, ddof=1) / np.sqrt(N_SEEDS))

            diff_d_c = d_arr - c_arr
            m_dc, l_dc, u_dc, out_dc = paired_bootstrap_ci(diff_d_c)

            if n == 0:
                rows.append({
                    "n": 0,
                    "Method_D": f"{d_mean*100:.2f}% +- {d_ci*100:.2f}%",
                    "Empirical_Only": "N/A",
                    "Method_C": f"{c_mean*100:.2f}% +- {c_ci*100:.2f}%",
                    "D_vs_Emp_Diff": "N/A", "D_vs_Emp_Outcome": "N/A (No data)",
                    "D_vs_C_Diff": "+0.00%", "D_vs_C_Outcome": "D = C (Prior Only)"
                })
            else:
                emp_arr = np.array(learn_results[sc]["Ablation D (Empirical Only)"][n])
                diff_d_emp = d_arr - emp_arr
                m_de, l_de, u_de, out_de = paired_bootstrap_ci(diff_d_emp)

                emp_mean = float(np.mean(emp_arr))
                emp_ci = 1.96 * float(np.std(emp_arr, ddof=1) / np.sqrt(N_SEEDS))

                rows.append({
                    "n": n,
                    "Method_D": f"{d_mean*100:.2f}% +- {d_ci*100:.2f}%",
                    "Empirical_Only": f"{emp_mean*100:.2f}% +- {emp_ci*100:.2f}%",
                    "Method_C": f"{c_mean*100:.2f}% +- {c_ci*100:.2f}%",
                    "D_vs_Emp_Diff": f"{m_de*100:+.2f}%", "D_vs_Emp_Outcome": out_de,
                    "D_vs_C_Diff": f"{m_dc*100:+.2f}%", "D_vs_C_Outcome": out_dc
                })
        learn_summary_tables[sc] = pd.DataFrame(rows)

    print("\nHEADLINE LEARNING CURVE: S1 ('prior-aligned') averaged across all tau in {0.1,...,0.9}:")
    print(learn_summary_tables["S1_prior_aligned"].to_string(index=False))

    print("\nHEADLINE LEARNING CURVE: S2 ('prior-misaligned') averaged across all tau in {0.1,...,0.9}:")
    print(learn_summary_tables["S2_prior_misaligned"].to_string(index=False))

    print("\nHEADLINE LEARNING CURVE: S3 (Misspecified Flat Prior) averaged across all tau in {0.1,...,0.9}:")
    print(learn_summary_tables["S3_misspecified_prior"].to_string(index=False))

    # -------------------------------------------------------------------------
    # 4. Per-Tau Table (0.1..0.9) Reconciled Exactly with Headline (n=300)
    # -------------------------------------------------------------------------
    print("\n[4/7] Generating Per-Tau Table Reconciled with Headline at n=300...", flush=True)

    derived_selection_rules = {}
    for sc_code in ["S1", "S2", "S3"]:
        print(f"\nPER-TAU COMPARISON TABLE FOR {sc_code} (n=300, Mean +- 95% CI across 30 seeds):")
        print(f"{'tau':>5s} | {'Method A (Alert)':>20s} | {'Method B (Linear)':>20s} | {'Method C (Survey)':>20s} | {'Method D (Shrinkage)':>20s} | {'Selected Rule / Recommendation'}")
        print("-" * 125)

        sc_rules = {}
        for t in EVAL_TAUS:
            means = {}
            cis = {}
            for m in tau_models:
                arr = np.array(per_tau_mapes[sc_code][m][t])
                m_val = float(np.mean(arr))
                ci_val = 1.96 * float(np.std(arr, ddof=1) / np.sqrt(N_SEEDS))
                means[m] = m_val
                cis[m] = ci_val

            str_a = f"{means['Method A (Alert Logic)']*100:.2f}% +- {cis['Method A (Alert Logic)']*100:.2f}%"
            str_b = f"{means['Method B (Linear Extrap)']*100:.2f}% +- {cis['Method B (Linear Extrap)']*100:.2f}%"
            str_c = f"{means['Method C (Survey Prior)']*100:.2f}% +- {cis['Method C (Survey Prior)']*100:.2f}%"
            str_d = f"{means['Method D (Shrinkage Prior)']*100:.2f}% +- {cis['Method D (Shrinkage Prior)']*100:.2f}%"

            # Determine best model and check equivalence margin (+-0.25 pp)
            best_m = min(means, key=means.get)
            best_mean = means[best_m]

            equiv_models = []
            for m in tau_models:
                diff_arr = np.array(per_tau_mapes[sc_code][m][t]) - np.array(per_tau_mapes[sc_code][best_m][t])
                diff_mean, l_ci, u_ci, _ = paired_bootstrap_ci(diff_arr)
                if abs(diff_mean) <= EQUIVALENCE_MARGIN or (l_ci <= EQUIVALENCE_MARGIN and u_ci >= -EQUIVALENCE_MARGIN):
                    equiv_models.append(m.split()[1])

            short_best = best_m.split()[1]
            if len(equiv_models) == 1:
                rule_str = f"Use Method {short_best}"
            else:
                rule_str = f"Equivalent ({'/'.join(sorted(set(equiv_models)))})"

            sc_rules[f"{t:.1f}"] = {
                "Method_A": str_a, "Method_B": str_b, "Method_C": str_c, "Method_D": str_d,
                "rule": rule_str
            }

            print(f"{t:5.2f} | {str_a:>20s} | {str_b:>20s} | {str_c:>20s} | {str_d:>20s} | {rule_str}")

        mean_d_all_taus = np.mean([np.mean(per_tau_mapes[sc_code]["Method D (Shrinkage Prior)"][t]) for t in EVAL_TAUS])
        print(f"  -> Mean across all 9 knots for Method D ({sc_code}): {mean_d_all_taus*100:.2f}% (Matches headline exactly)")
        derived_selection_rules[sc_code] = sc_rules

    print("\n" + "=" * 90)
    print("EXPLICIT RECONCILIATION AUDIT (n=300, 30 SEEDS, SAME TEST STREAM)")
    print("=" * 90)
    reconciliation_data = {}
    for sc_name, sc_code in [("S1_prior_aligned", "S1"), ("S2_prior_misaligned", "S2"), ("S3_misspecified_prior", "S3")]:
        d_knot_means = [float(np.mean(per_tau_mapes[sc_code]["Method D (Shrinkage Prior)"][t])) for t in EVAL_TAUS]
        d_arith_mean = float(np.mean(d_knot_means))
        headline_val = float(np.mean(learn_results[sc_name]["Method D (Shrinkage)"][300]))
        gap_pp = abs(d_arith_mean - headline_val) * 100
        print(f"Scenario {sc_code}:")
        print(f"  Nine per-tau D values: {[round(v*100, 4) for v in d_knot_means]}")
        print(f"  Arithmetic mean in code: {d_arith_mean*100:.4f}%")
        print(f"  Headline learning curve at n=300: {headline_val*100:.4f}%")
        print(f"  Absolute gap: {gap_pp:.6f} pp (Required: <= 0.05 pp) -> {'PASS' if gap_pp <= 0.05 else 'FAIL'}")
        assert gap_pp <= 0.05, f"Reconciliation failed on {sc_code}: gap = {gap_pp} pp"
        reconciliation_data[sc_code] = {
            "per_tau_values": d_knot_means,
            "arithmetic_mean": d_arith_mean,
            "headline_val": headline_val,
            "gap_pp": gap_pp
        }

    # Derive Minimum-Progress Gate by n: n in {5, 10, 30, 100, 300}
    print("\n" + "=" * 90)
    print("MINIMUM-PROGRESS GATE DERIVATION BY n (30 SEEDS, S1 & S2)")
    print("=" * 90)
    target_ns = [5, 10, 30, 100, 300]
    min_tau_table_rows = []
    min_tau_by_n = {}

    for n in target_ns:
        min_tau = None
        print(f"\n--- Sample size n = {n} ---")
        print(f"{'tau':>5s} | {'S1 MAPE':>12s} | {'S2 MAPE':>12s} | {'Status (<=15% under both)':>28s}")
        print("-" * 55)
        for t in EVAL_TAUS:
            m_s1 = float(np.mean(appendix_per_tau["S1_prior_aligned"][n][t]))
            m_s2 = float(np.mean(appendix_per_tau["S2_prior_misaligned"][n][t]))
            passed = (m_s1 <= 0.15) and (m_s2 <= 0.15)
            status_str = "PASS (<= 15%)" if passed else "FAIL (> 15%)"
            if passed and min_tau is None:
                min_tau = t
            min_tau_table_rows.append({
                "n": n,
                "tau": t,
                "s1_mape": m_s1,
                "s2_mape": m_s2,
                "passed": passed
            })
            print(f"{t:5.2f} | {m_s1*100:11.2f}% | {m_s2*100:11.2f}% | {status_str:>28s}")

        min_tau_by_n[n] = min_tau
        print(f"  -> Derived minTau(n={n}) = {min_tau}")

    print("\nSummary of minTau by n:")
    for n in target_ns:
        print(f"  n = {n:3d} -> minTau = {min_tau_by_n[n]:.2f}")


    # -------------------------------------------------------------------------
    # 5. Multi-Seed Benchmark for S1 and S2 (Per-Knot Conformal & Alert Comparisons)
    # -------------------------------------------------------------------------
    print("\n[5/7] Running 30-Seed Benchmark for S1 and S2 (Per-Knot Conformal & Alert Comparisons)...", flush=True)

    benchmark_data = {"S1": {}, "S2": {}}

    for sc_code, sc_name in [("S1", "S1"), ("S2", "S2")]:
        models_list = [
            "Method A (Alert Logic)",
            "Method B (Linear Extrap)",
            "Method C (Survey Prior)",
            "Method D (Shrinkage Prior)",
            "Ablation D (Empirical Only)"
        ]

        seed_knot_mapes = {m: {t: [] for t in EVAL_TAUS} for m in models_list}
        seed_knot_cov_std = {m: {t: [] for t in EVAL_TAUS} for m in models_list}
        seed_knot_cov_shift = {m: {t: [] for t in EVAL_TAUS} for m in models_list}

        alert_taus = [0.2, 0.4, 0.6]
        terminal_alert_metrics = {
            t: {
                "Method A (Original Tiered)": {"prec": [], "rec": [], "f1": []},
                "Method A (Tuned Lambda)": {"prec": [], "rec": [], "f1": []},
                "Method B (Linear Extrap)": {"prec": [], "rec": [], "f1": []},
                "Method C (Survey Prior)": {"prec": [], "rec": [], "f1": []},
                "Method D (Shrinkage Prior)": {"prec": [], "rec": [], "f1": []},
                "Ablation D (Empirical Only)": {"prec": [], "rec": [], "f1": []}
            }
            for t in alert_taus
        }

        current_exceed_metrics = {
            t: {
                "Method A (Alert Logic)": {"prec": [], "rec": [], "f1": []},
                "Method D (Shrinkage Prior)": {"prec": [], "rec": [], "f1": []}
            }
            for t in alert_taus
        }

        lead_times_d = []
        lead_times_a_orig = []
        lead_times_a_tuned = []

        for seed_idx in range(1, N_SEEDS + 1):
            sim_bench_tr = DailySpendSimulator(seed=1000 + seed_idx)
            sim_bench_cal = DailySpendSimulator(seed=3000 + seed_idx)
            sim_bench_te = DailySpendSimulator(seed=4000 + seed_idx)
            sim_bench_sh = DailySpendSimulator(seed=5000 + seed_idx)

            train_cycs = sim_bench_tr.generate_cohort(300, season="Maha", year=2022, prefix=f"bench_tr_{sc_name}_{seed_idx}", scenario=sc_name)
            calib_cycs = sim_bench_cal.generate_cohort(100, season="Maha", year=2023, prefix=f"calib_maha_2023_{seed_idx}", scenario=sc_name)
            test_std_cycs = sim_bench_te.generate_cohort(100, season="Maha", year=2024, prefix=f"test_std_maha_2024_{seed_idx}", scenario=sc_name, regime_shift=False)
            test_shift_cycs = sim_bench_sh.generate_cohort(100, season="Maha", year=2024, prefix=f"test_shift_maha_2024_{seed_idx}", scenario=sc_name, regime_shift=True)

            k_star_300 = best_kappas[f"{sc_name}_prior_aligned" if sc_name == "S1" else f"{sc_name}_prior_misaligned"][300]
            m_a_raw = AlertLogicForecaster()
            m_b_raw = LinearExtrapolationForecaster()
            m_c_raw = SurveyPriorForecaster(prior_curves=prior_curves)
            m_d_raw = ShrinkagePriorForecaster(prior_curves=prior_curves, k_shrinkage=k_star_300).fit(train_cycs)
            m_d_emp_raw = ShrinkagePriorForecaster(prior_curves=prior_curves, empirical_only=True).fit(train_cycs)

            calibrator = StratifiedConformalCalibrator(target_coverage=0.80)
            calibrator.calibrate(
                calibration_cycles=calib_cycs,
                forecasters={
                    "method_a": m_a_raw,
                    "method_b": m_b_raw,
                    "method_c": m_c_raw,
                    "method_d_shrinkage": m_d_raw,
                    "method_d_empirical_ablation": m_d_emp_raw
                },
                eval_taus=EVAL_TAUS
            )

            models = {
                "Method A (Alert Logic)": AlertLogicForecaster(conformal_calibrator=calibrator),
                "Method B (Linear Extrap)": LinearExtrapolationForecaster(conformal_calibrator=calibrator),
                "Method C (Survey Prior)": SurveyPriorForecaster(prior_curves=prior_curves, conformal_calibrator=calibrator),
                "Method D (Shrinkage Prior)": ShrinkagePriorForecaster(
                    prior_curves=prior_curves, k_shrinkage=k_star_300, conformal_calibrator=calibrator
                ).fit(train_cycs),
                "Ablation D (Empirical Only)": ShrinkagePriorForecaster(
                    prior_curves=prior_curves, empirical_only=True, conformal_calibrator=calibrator
                ).fit(train_cycs)
            }

            # MAPE on Standard Test
            for tau in EVAL_TAUS:
                for m_name, model in models.items():
                    apes = []
                    hits = 0
                    for cyc in test_std_cycs:
                        d = max(1, int(round(tau * cyc["cycle_length_days"])))
                        pred = model.forecast(cyc, d, cyc["so1_baseline_predicted"])
                        actual = float(cyc["true_final_cost"])
                        apes.append(abs(actual - pred["final_cost"]) / actual)
                        if pred["interval"][0] <= actual <= pred["interval"][1]:
                            hits += 1
                    seed_knot_mapes[m_name][tau].append(float(np.mean(apes)))
                    seed_knot_cov_std[m_name][tau].append(hits / len(test_std_cycs))

            # Regime-Shift Test
            for tau in EVAL_TAUS:
                for m_name, model in models.items():
                    hits = 0
                    for cyc in test_shift_cycs:
                        d = max(1, int(round(tau * cyc["cycle_length_days"])))
                        pred = model.forecast(cyc, d, cyc["so1_baseline_predicted"])
                        actual = float(cyc["true_final_cost"])
                        if pred["interval"][0] <= actual <= pred["interval"][1]:
                            hits += 1
                    seed_knot_cov_shift[m_name][tau].append(hits / len(test_shift_cycs))

            # Alert evaluation at tau in {0.2, 0.4, 0.6}
            for a_tau in alert_taus:
                tuned_lams = {
                    m_name: tune_alert_threshold_on_calibration(calib_cycs, model, eval_tau=a_tau)
                    for m_name, model in models.items()
                }

                # Method A original tiered rule
                tp_orig = fp_orig = fn_orig = 0
                for cyc in test_std_cycs:
                    d = max(1, int(round(a_tau * cyc["cycle_length_days"])))
                    pred = models["Method A (Alert Logic)"].forecast(cyc, d, cyc["so1_baseline_predicted"])
                    alert = pred["alert_level"] in ["warning", "danger"]
                    actual_overspend = cyc["true_final_cost"] > 1.10 * cyc["so1_baseline_predicted"]
                    if alert and actual_overspend:
                        tp_orig += 1
                    elif alert and not actual_overspend:
                        fp_orig += 1
                    elif not alert and actual_overspend:
                        fn_orig += 1
                p_orig = tp_orig / (tp_orig + fp_orig) if (tp_orig + fp_orig) > 0 else 1.0
                r_orig = tp_orig / (tp_orig + fn_orig) if (tp_orig + fn_orig) > 0 else 0.0
                f_orig = 2 * p_orig * r_orig / (p_orig + r_orig) if (p_orig + r_orig) > 0 else 0.0
                terminal_alert_metrics[a_tau]["Method A (Original Tiered)"]["prec"].append(p_orig)
                terminal_alert_metrics[a_tau]["Method A (Original Tiered)"]["rec"].append(r_orig)
                terminal_alert_metrics[a_tau]["Method A (Original Tiered)"]["f1"].append(f_orig)

                # Lambda-tuned models
                name_map = {
                    "Method A (Alert Logic)": "Method A (Tuned Lambda)",
                    "Method B (Linear Extrap)": "Method B (Linear Extrap)",
                    "Method C (Survey Prior)": "Method C (Survey Prior)",
                    "Method D (Shrinkage Prior)": "Method D (Shrinkage Prior)",
                    "Ablation D (Empirical Only)": "Ablation D (Empirical Only)"
                }
                for m_name, model in models.items():
                    rep_name = name_map[m_name]
                    lam = tuned_lams[m_name]
                    tp = fp = fn = 0
                    for cyc in test_std_cycs:
                        d = max(1, int(round(a_tau * cyc["cycle_length_days"])))
                        pred = model.forecast(cyc, d, cyc["so1_baseline_predicted"])
                        alert = pred["final_cost"] > lam * cyc["so1_baseline_predicted"]
                        actual_overspend = cyc["true_final_cost"] > 1.10 * cyc["so1_baseline_predicted"]
                        if alert and actual_overspend:
                            tp += 1
                        elif alert and not actual_overspend:
                            fp += 1
                        elif not alert and actual_overspend:
                            fn += 1
                    p = tp / (tp + fp) if (tp + fp) > 0 else 1.0
                    r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
                    f = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
                    terminal_alert_metrics[a_tau][rep_name]["prec"].append(p)
                    terminal_alert_metrics[a_tau][rep_name]["rec"].append(r)
                    terminal_alert_metrics[a_tau][rep_name]["f1"].append(f)

                # Comparison 2: Same-Task Current Spend Exceedance
                for target_m in ["Method A (Alert Logic)", "Method D (Shrinkage Prior)"]:
                    tp_curr = fp_curr = fn_curr = 0
                    for cyc in test_std_cycs:
                        d = max(1, int(round(a_tau * cyc["cycle_length_days"])))
                        spend_to_date = sum(e["amount"] for e in cyc.get("expenses", []) if e["day"] <= d)
                        tau_idx = int(round(a_tau * 10))
                        prior_frac = np.mean([prior_curves[c][tau_idx] for c in CATEGORIES])
                        exp_to_date = cyc["so1_baseline_predicted"] * prior_frac
                        actual_curr_exceed = spend_to_date > 1.10 * exp_to_date

                        pred = models[target_m].forecast(cyc, d, cyc["so1_baseline_predicted"])
                        if target_m == "Method A (Alert Logic)":
                            model_flag = pred["alert_level"] in ["warning", "danger"]
                        else:
                            model_flag = pred["final_cost"] > 1.10 * cyc["so1_baseline_predicted"]

                        if model_flag and actual_curr_exceed:
                            tp_curr += 1
                        elif model_flag and not actual_curr_exceed:
                            fp_curr += 1
                        elif not model_flag and actual_curr_exceed:
                            fn_curr += 1

                    pc = tp_curr / (tp_curr + fp_curr) if (tp_curr + fp_curr) > 0 else 1.0
                    rc = tp_curr / (tp_curr + fn_curr) if (tp_curr + fn_curr) > 0 else 0.0
                    fc = 2 * pc * rc / (pc + rc) if (pc + rc) > 0 else 0.0
                    current_exceed_metrics[a_tau][target_m]["prec"].append(pc)
                    current_exceed_metrics[a_tau][target_m]["rec"].append(rc)
                    current_exceed_metrics[a_tau][target_m]["f1"].append(fc)

            # Lead time calculation
            lam_d = tune_alert_threshold_on_calibration(calib_cycs, models["Method D (Shrinkage Prior)"], eval_tau=0.40)
            lam_a = tune_alert_threshold_on_calibration(calib_cycs, models["Method A (Alert Logic)"], eval_tau=0.40)
            for cyc in test_std_cycs:
                if cyc["true_final_cost"] > 1.10 * cyc["so1_baseline_predicted"]:
                    c_len = int(cyc["cycle_length_days"])
                    t_d = compute_lead_time_days(cyc, models["Method D (Shrinkage Prior)"], lam_d) or c_len
                    t_a_orig = compute_lead_time_original_method_a(cyc, models["Method A (Alert Logic)"]) or c_len
                    t_a_tuned = compute_lead_time_days(cyc, models["Method A (Alert Logic)"], lam_a) or c_len

                    lead_times_d.append(t_d)
                    lead_times_a_orig.append(t_a_orig)
                    lead_times_a_tuned.append(t_a_tuned)

        benchmark_data[sc_code] = {
            "mape": seed_knot_mapes,
            "cov_std": seed_knot_cov_std,
            "cov_shift": seed_knot_cov_shift,
            "terminal_alerts": terminal_alert_metrics,
            "current_exceed_alerts": current_exceed_metrics,
            "lead_times": {
                "day_d": (float(np.mean(lead_times_d)), 1.96 * float(np.std(lead_times_d, ddof=1) / np.sqrt(len(lead_times_d)))),
                "day_a_orig": (float(np.mean(lead_times_a_orig)), 1.96 * float(np.std(lead_times_a_orig, ddof=1) / np.sqrt(len(lead_times_a_orig)))),
                "day_a_tuned": (float(np.mean(lead_times_a_tuned)), 1.96 * float(np.std(lead_times_a_tuned, ddof=1) / np.sqrt(len(lead_times_a_tuned)))),
                "lead_gain_over_orig": float(np.mean(np.array(lead_times_a_orig) - np.array(lead_times_d))),
                "lead_gain_over_tuned": float(np.mean(np.array(lead_times_a_tuned) - np.array(lead_times_d)))
            }
        }

    # -------------------------------------------------------------------------
    # 6. Shock Variants: Lump-Sum vs Gradual (+35% over 20 days) with Paired CIs
    # -------------------------------------------------------------------------
    print("\n[6/7] Evaluating Shock Variants: Lump-Sum vs Gradual Shock (Days 40-80)...", flush=True)
    sim_shock_tr = DailySpendSimulator(seed=1555)
    sim_shock_cal = DailySpendSimulator(seed=3555)
    sim_shock_eval = DailySpendSimulator(seed=4555)

    train_shock = sim_shock_tr.generate_cohort(300, season="Maha", year=2022, prefix="tr_shock", scenario="S2")
    calib_shock = sim_shock_cal.generate_cohort(100, season="Maha", year=2023, prefix="calib_shock", scenario="S2")

    m_d_shock = ShrinkagePriorForecaster(prior_curves=prior_curves, k_shrinkage=best_kappas["S2_prior_misaligned"][300]).fit(train_shock)
    m_a_shock = AlertLogicForecaster()

    lam_d_sh = tune_alert_threshold_on_calibration(calib_shock, m_d_shock, eval_tau=0.40)
    lam_a_sh = tune_alert_threshold_on_calibration(calib_shock, m_a_shock, eval_tau=0.40)

    # 6a. Lump-Sum Shock Variant
    lump_shock_cycles = [sim_shock_eval.generate_cycle(f"lump_{i}", mid_cycle_shock=True, scenario="S2") for i in range(100)]
    lump_shock_days = []
    lump_det_d = []
    lump_det_a_orig = []
    lump_det_a_tuned = []

    for c in lump_shock_cycles:
        c_len = c["cycle_length_days"]
        sh_day = c["latent_parameters"]["mid_cycle_shock_day"]
        lump_shock_days.append(sh_day)

        t_d = compute_lead_time_days(c, m_d_shock, lam_d_sh) or c_len
        t_ao = compute_lead_time_original_method_a(c, m_a_shock) or c_len
        t_at = compute_lead_time_days(c, m_a_shock, lam_a_sh) or c_len

        lump_det_d.append(t_d)
        lump_det_a_orig.append(t_ao)
        lump_det_a_tuned.append(t_at)

    # 6b. Gradual Shock Variant (+35% over 20 days)
    sim_shock_grad = DailySpendSimulator(seed=4556)
    gradual_shock_cycles = [sim_shock_grad.generate_cycle(f"gradual_{i}", gradual_shock=True, scenario="S2") for i in range(100)]
    gradual_shock_days = []
    gradual_det_d = []
    gradual_det_a_orig = []
    gradual_det_a_tuned = []

    for c in gradual_shock_cycles:
        c_len = c["cycle_length_days"]
        sh_day = c["latent_parameters"]["mid_cycle_shock_day"]
        gradual_shock_days.append(sh_day)

        t_d = compute_lead_time_days(c, m_d_shock, lam_d_sh) or c_len
        t_ao = compute_lead_time_original_method_a(c, m_a_shock) or c_len
        t_at = compute_lead_time_days(c, m_a_shock, lam_a_sh) or c_len

        gradual_det_d.append(t_d)
        gradual_det_a_orig.append(t_ao)
        gradual_det_a_tuned.append(t_at)

    mean_lump_sh = float(np.mean(lump_shock_days))
    mean_grad_sh = float(np.mean(gradual_shock_days))

    # Post-shock detection delay: max(0, t - d*)
    lump_delays_d = [max(0, t - s) for t, s in zip(lump_det_d, lump_shock_days)]
    lump_delays_ao = [max(0, t - s) for t, s in zip(lump_det_a_orig, lump_shock_days)]
    lump_delays_at = [max(0, t - s) for t, s in zip(lump_det_a_tuned, lump_shock_days)]

    grad_delays_d = [max(0, t - s) for t, s in zip(gradual_det_d, gradual_shock_days)]
    grad_delays_ao = [max(0, t - s) for t, s in zip(gradual_det_a_orig, gradual_shock_days)]
    grad_delays_at = [max(0, t - s) for t, s in zip(gradual_det_a_tuned, gradual_shock_days)]

    # Paired Bootstrap 95% CIs on delay differences: delay(D) - delay(A)
    diff_d_at_lump, l_ci_lat, u_ci_lat, lbl_lat = paired_bootstrap_delay_diff(lump_delays_d, lump_delays_at)
    diff_d_ao_lump, l_ci_lao, u_ci_lao, lbl_lao = paired_bootstrap_delay_diff(lump_delays_d, lump_delays_ao)

    diff_d_at_grad, l_ci_gat, u_ci_gat, lbl_gat = paired_bootstrap_delay_diff(grad_delays_d, grad_delays_at)
    diff_d_ao_grad, l_ci_gao, u_ci_gao, lbl_gao = paired_bootstrap_delay_diff(grad_delays_d, grad_delays_ao)

    print(f"\nLUMP-SUM SHOCK VARIANT (Instantaneous +35% baseline on Day d* in [40, 80]):")
    print(f"  Mean Shock Day: {mean_lump_sh:.1f}")
    print(f"  Method D Detection Delay (t - d*):          {np.mean(lump_delays_d):.1f} days")
    print(f"  Method A (Tuned Lambda) Detection Delay:    {np.mean(lump_delays_at):.1f} days")
    print(f"  Method A (Original Tiered) Detection Delay: {np.mean(lump_delays_ao):.1f} days")
    print(f"  D vs A (Tuned) Delay Diff:    {diff_d_at_lump:+.2f} days [{l_ci_lat:+.2f}, {u_ci_lat:+.2f}] -> {lbl_lat}")
    print(f"  D vs A (Original) Delay Diff: {diff_d_ao_lump:+.2f} days [{l_ci_lao:+.2f}, {u_ci_lao:+.2f}] -> {lbl_lao}")

    print(f"\nGRADUAL SHOCK VARIANT (+35% baseline spread over 20 days starting on Day d*):")
    print(f"  Mean Shock Day: {mean_grad_sh:.1f}")
    print(f"  Method D Detection Delay (t - d*):          {np.mean(grad_delays_d):.1f} days")
    print(f"  Method A (Tuned Lambda) Detection Delay:    {np.mean(grad_delays_at):.1f} days")
    print(f"  Method A (Original Tiered) Detection Delay: {np.mean(grad_delays_ao):.1f} days")
    print(f"  D vs A (Tuned) Delay Diff:    {diff_d_at_grad:+.2f} days [{l_ci_gat:+.2f}, {u_ci_gat:+.2f}] -> {lbl_gat}")
    print(f"  D vs A (Original) Delay Diff: {diff_d_ao_grad:+.2f} days [{l_ci_gao:+.2f}, {u_ci_gao:+.2f}] -> {lbl_gao}")

    shock_results = {
        "lump_sum_variant": {
            "mean_shock_day": mean_lump_sh,
            "mean_detection_d": float(np.mean(lump_det_d)),
            "mean_detection_a_orig": float(np.mean(lump_det_a_orig)),
            "mean_detection_a_tuned": float(np.mean(lump_det_a_tuned)),
            "detection_delay_d": float(np.mean(lump_delays_d)),
            "detection_delay_a_orig": float(np.mean(lump_delays_ao)),
            "detection_delay_a_tuned": float(np.mean(lump_delays_at)),
            "paired_bootstrap": {
                "d_vs_a_tuned": {"diff": diff_d_at_lump, "ci_95": [l_ci_lat, u_ci_lat], "label": lbl_lat},
                "d_vs_a_orig": {"diff": diff_d_ao_lump, "ci_95": [l_ci_lao, u_ci_lao], "label": lbl_lao}
            }
        },
        "gradual_variant": {
            "mean_shock_day": mean_grad_sh,
            "duration_days": 20,
            "mean_detection_d": float(np.mean(gradual_det_d)),
            "mean_detection_a_orig": float(np.mean(gradual_det_a_orig)),
            "mean_detection_a_tuned": float(np.mean(gradual_det_a_tuned)),
            "detection_delay_d": float(np.mean(grad_delays_d)),
            "detection_delay_a_orig": float(np.mean(grad_delays_ao)),
            "detection_delay_a_tuned": float(np.mean(grad_delays_at)),
            "paired_bootstrap": {
                "d_vs_a_tuned": {"diff": diff_d_at_grad, "ci_95": [l_ci_gat, u_ci_gat], "label": lbl_gat},
                "d_vs_a_orig": {"diff": diff_d_ao_grad, "ci_95": [l_ci_gao, u_ci_gao], "label": lbl_gao}
            }
        }
    }

    # -------------------------------------------------------------------------
    # 7. Save Plots & Export JSON Artifacts
    # -------------------------------------------------------------------------
    print("\n[7/7] Generating Plots and Exporting Artifacts...", flush=True)

    plt.figure(figsize=(14, 5))
    ns_emp = [n for n in N_TRAIN_STEPS if n >= 5]
    ns_all = N_TRAIN_STEPS

    plt.subplot(1, 3, 1)
    plt.plot(ns_all, [np.mean(learn_results["S1_prior_aligned"]["Method D (Shrinkage)"][n])*100 for n in ns_all], "o-", label="Method D (Shrinkage)", color="teal", lw=2)
    plt.plot(ns_emp, [np.mean(learn_results["S1_prior_aligned"]["Ablation D (Empirical Only)"][n])*100 for n in ns_emp], "s--", label="Empirical Only", color="orange", lw=1.8)
    plt.plot(ns_all, [np.mean(learn_results["S1_prior_aligned"]["Method C (Prior Only)"][n])*100 for n in ns_all], "^:", label="Method C (Prior)", color="grey", lw=1.8)
    plt.title("S1 (Prior-Aligned)", fontsize=11, fontweight="bold")
    plt.xlabel("Training Cycles (n)", fontsize=10)
    plt.ylabel("Mean Test MAPE % (All Knots)", fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.legend(fontsize=8)

    plt.subplot(1, 3, 2)
    plt.plot(ns_all, [np.mean(learn_results["S2_prior_misaligned"]["Method D (Shrinkage)"][n])*100 for n in ns_all], "o-", label="Method D (Shrinkage)", color="teal", lw=2)
    plt.plot(ns_emp, [np.mean(learn_results["S2_prior_misaligned"]["Ablation D (Empirical Only)"][n])*100 for n in ns_emp], "s--", label="Empirical Only", color="orange", lw=1.8)
    plt.plot(ns_all, [np.mean(learn_results["S2_prior_misaligned"]["Method C (Prior Only)"][n])*100 for n in ns_all], "^:", label="Method C (Prior)", color="grey", lw=1.8)
    plt.title("S2 (Prior-Misaligned)", fontsize=11, fontweight="bold")
    plt.xlabel("Training Cycles (n)", fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.legend(fontsize=8)

    plt.subplot(1, 3, 3)
    plt.plot(ns_all, [np.mean(learn_results["S3_misspecified_prior"]["Method D (Shrinkage)"][n])*100 for n in ns_all], "o-", label="Method D (Shrinkage)", color="teal", lw=2)
    plt.plot(ns_emp, [np.mean(learn_results["S3_misspecified_prior"]["Ablation D (Empirical Only)"][n])*100 for n in ns_emp], "s--", label="Empirical Only", color="orange", lw=1.8)
    plt.plot(ns_all, [np.mean(learn_results["S3_misspecified_prior"]["Method C (Prior Only)"][n])*100 for n in ns_all], "^:", label="Method C (Flat Prior)", color="crimson", lw=1.8)
    plt.title("S3 (Misspecified Flat Prior)", fontsize=11, fontweight="bold")
    plt.xlabel("Training Cycles (n)", fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.legend(fontsize=8)

    plt.tight_layout()
    plt.savefig(plots_dir / "learning_curve_rmse_mape.png", dpi=200)
    plt.close()

    results_json = {
        "synthetic": True,
        "n_seeds": N_SEEDS,
        "simulator_hashes": {"S1": hash_s1, "S2": hash_s2},
        "rmse_divergence": {"S1": rmse_s1, "S2": rmse_s2},
        "cv_grid": EXTENDED_K_GRID,
        "cv_validation_cohort": "Yala 2023 (100 cycles, strictly disjoint from train/calib/test)",
        "cv_loss_matrices": cv_loss_matrices,
        "best_kappas": best_kappas,
        "headline_learning_curves": {sc: learn_summary_tables[sc].to_dict(orient="records") for sc in scenarios},
        "derived_selection_rules": derived_selection_rules,
        "appendix_per_tau": {sc: {str(n): {str(t): float(np.mean(appendix_per_tau[sc][n][t])) for t in EVAL_TAUS} for n in N_TRAIN_STEPS} for sc in scenarios},
        "benchmark_s1": {
            "mape": {m: {str(t): float(np.mean(benchmark_data["S1"]["mape"][m][t])) for t in EVAL_TAUS} for m in benchmark_data["S1"]["mape"]},
            "cov_std": {m: {str(t): float(np.mean(benchmark_data["S1"]["cov_std"][m][t])) for t in EVAL_TAUS} for m in benchmark_data["S1"]["cov_std"]},
            "cov_shift": {m: {str(t): float(np.mean(benchmark_data["S1"]["cov_shift"][m][t])) for t in EVAL_TAUS} for m in benchmark_data["S1"]["cov_shift"]},
            "terminal_alerts": benchmark_data["S1"]["terminal_alerts"],
            "current_exceed_alerts": benchmark_data["S1"]["current_exceed_alerts"],
            "lead_times": benchmark_data["S1"]["lead_times"]
        },
        "benchmark_s2": {
            "mape": {m: {str(t): float(np.mean(benchmark_data["S2"]["mape"][m][t])) for t in EVAL_TAUS} for m in benchmark_data["S2"]["mape"]},
            "cov_std": {m: {str(t): float(np.mean(benchmark_data["S2"]["cov_std"][m][t])) for t in EVAL_TAUS} for m in benchmark_data["S2"]["cov_std"]},
            "cov_shift": {m: {str(t): float(np.mean(benchmark_data["S2"]["cov_shift"][m][t])) for t in EVAL_TAUS} for m in benchmark_data["S2"]["cov_shift"]},
            "terminal_alerts": benchmark_data["S2"]["terminal_alerts"],
            "current_exceed_alerts": benchmark_data["S2"]["current_exceed_alerts"],
            "lead_times": benchmark_data["S2"]["lead_times"]
        },
        "shock_variants": shock_results,
        "reconciliation": reconciliation_data,
        "min_tau_derivation": {
            "by_n": {str(n): min_tau_by_n[n] for n in target_ns},
            "table_rows": min_tau_table_rows
        }
    }

    out_file = base_dir / "artifacts/forecast_evaluation_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results_json, f, indent=2)

    print(f"\nExecution complete. Full results written to {out_file}")


if __name__ == "__main__":
    main()
