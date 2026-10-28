"""
ml/src/build_phasing_priors.py
Vectorized Monte Carlo knowledge-anchored phasing prior generator.
Simulates:
- Timing uncertainty: Uniform sampling over DoA stage timing windows (2,000 draws)
- Continuous stage progression: Spend fraction accumulates progressively across each stage window
- Sampling variance: Sheet-level cluster bootstrap over raw DoA survey records
- Separate unresolved bucket for ambiguous material costs

Outputs:
- ml/artifacts/phasing_priors_v0.json
- ml/artifacts/placeholder_divergences.csv
- ml/artifacts/sensitivity_shifts.csv
- ml/artifacts/plots/*.png
"""

import os
import sys
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
import re
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

RANDOM_SEED = 42
N_DRAWS = 2000
KNOTS = np.array([0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])

STAGES = [
    "land_preparation",
    "planting",
    "fertilizer_basal",
    "crop_care",
    "harvest"
]
STAGE_TO_IDX = {s: i for i, s in enumerate(STAGES)}

# Canonical 8 SO3 categories + unresolved bucket
CATEGORIES = [
    "seed",
    "fertilizer",
    "agrochemical",
    "labour",
    "machinery",
    "fuel",
    "irrigation",
    "other"
]
ALL_TRACKED_CATEGORIES = CATEGORIES + ["unresolved"]
CAT_TO_IDX = {c: i for i, c in enumerate(ALL_TRACKED_CATEGORIES)}

FOCUS_CROPS = ["Paddy", "Maize", "Tomato", "Green Chilli"]


def evaluate_placeholder(category, t):
    """Evaluates the existing shared/phasing.js placeholder curve at normalized progress t in [0, 1]."""
    if t <= 0.0:
        return 0.0
    if t >= 1.0:
        return 1.0

    front_loaded = category in ["seed", "fertilizer", "agrochemical"]

    if not front_loaded:
        # linear: (0,0) -> (1,1)
        return float(t)
    else:
        # front_loaded breakpoints: (0,0) -> (0.15, 0.70) -> (0.40, 0.90) -> (1.0, 1.0)
        if t <= 0.15:
            return float((t / 0.15) * 0.70)
        elif t <= 0.40:
            return float(0.70 + ((t - 0.15) / 0.25) * 0.20)
        else:
            return float(0.90 + ((t - 0.40) / 0.60) * 0.10)


def classify_operation(op_name, patterns):
    op_clean = str(op_name).lower().strip()
    for item in patterns:
        if re.search(item["pattern"], op_clean):
            return item["stage"], item["material_category"]
    return "crop_care", "UNRESOLVED_MATERIAL_SPLIT"


def preaggregate_sheet_costs(crop_df, crop_name, op_patterns, fert_splits):
    """
    Pre-aggregates raw survey operation rows into a 3D tensor:
    tensor[sheet_idx, stage_idx, cat_idx] of shape (S, 5, 9) (8 categories + unresolved).
    Properly handles basal vs top-dressing split for general fertilizer application.
    """
    sheets = sorted(list(set((r["source_file"], r["source_sheet"]) for _, r in crop_df.iterrows())))
    sheet_to_idx = {s: i for i, s in enumerate(sheets)}
    n_sheets = len(sheets)

    tensor = np.zeros((n_sheets, len(STAGES), len(ALL_TRACKED_CATEGORIES)), dtype=np.float64)

    crop_fert_split = fert_splits.get(crop_name, {"basal_share": 0.30, "top_dress_share": 0.70})
    basal_share = crop_fert_split["basal_share"]
    top_share = crop_fert_split["top_dress_share"]

    for _, row in crop_df.iterrows():
        s_key = (row["source_file"], row["source_sheet"])
        s_idx = sheet_to_idx[s_key]

        stage_name, mat_cat = classify_operation(row["operation_name"], op_patterns)

        lc = float(row.get("labour_cost", 0.0) or 0.0)
        mc = float(row.get("machinery_cost", 0.0) or 0.0)
        mat = float(row.get("material_cost", 0.0) or 0.0)

        # Handle general fertilizer application: split between basal and crop_care
        if stage_name == "fertilizer":
            # Basal component
            b_idx = STAGE_TO_IDX["fertilizer_basal"]
            if lc > 0:
                tensor[s_idx, b_idx, CAT_TO_IDX["labour"]] += lc * basal_share
            if mat > 0:
                tensor[s_idx, b_idx, CAT_TO_IDX["fertilizer"]] += mat * basal_share

            # Top dressing component
            c_idx = STAGE_TO_IDX["crop_care"]
            if lc > 0:
                tensor[s_idx, c_idx, CAT_TO_IDX["labour"]] += lc * top_share
            if mat > 0:
                tensor[s_idx, c_idx, CAT_TO_IDX["fertilizer"]] += mat * top_share

        else:
            stage_idx = STAGE_TO_IDX.get(stage_name, STAGE_TO_IDX["crop_care"])

            if lc > 0:
                tensor[s_idx, stage_idx, CAT_TO_IDX["labour"]] += lc

            if mc > 0:
                tensor[s_idx, stage_idx, CAT_TO_IDX["machinery"]] += mc * 0.70
                tensor[s_idx, stage_idx, CAT_TO_IDX["fuel"]] += mc * 0.30

            if mat > 0:
                if mat_cat == "UNRESOLVED_MATERIAL_SPLIT":
                    tensor[s_idx, stage_idx, CAT_TO_IDX["unresolved"]] += mat
                elif mat_cat in CAT_TO_IDX:
                    tensor[s_idx, stage_idx, CAT_TO_IDX[mat_cat]] += mat
                else:
                    tensor[s_idx, stage_idx, CAT_TO_IDX["unresolved"]] += mat

    return tensor, n_sheets


def run_vectorized_monte_carlo(tensor, n_sheets, stage_windows_crop, n_draws=N_DRAWS, seed=RANDOM_SEED):
    """
    Runs vectorized Monte Carlo simulation with continuous stage progression:
    Spend accumulates progressively between sampled start and end times for each stage.
    """
    rng = np.random.default_rng(seed)

    w_min = np.array([stage_windows_crop["stages"][s]["window"][0] for s in STAGES])
    w_max = np.array([stage_windows_crop["stages"][s]["window"][1] for s in STAGES])

    n_knots = len(KNOTS)
    n_cats = len(ALL_TRACKED_CATEGORIES)

    draw_curves = np.zeros((n_draws, n_cats, n_knots), dtype=np.float64)

    for m in range(n_draws):
        # Sample start and end timing points within each stage window
        draw_r1 = rng.uniform(w_min, w_max)
        draw_r2 = rng.uniform(w_min, w_max)
        t_start = np.minimum(draw_r1, draw_r2)
        t_end = np.maximum(draw_r1, draw_r2)
        # Avoid zero-duration division
        t_end = np.maximum(t_end, t_start + 0.02)

        # Bootstrap sheet indices with replacement
        boot_idx = rng.integers(0, n_sheets, size=n_sheets)
        boot_stage_cat_costs = tensor[boot_idx].sum(axis=0)  # shape (5, 9)
        total_cat_costs = boot_stage_cat_costs.sum(axis=0)    # shape (9,)

        for k_idx, k_t in enumerate(KNOTS):
            if k_t == 0.0:
                draw_curves[m, :, k_idx] = 0.0
            elif k_t == 1.0:
                draw_curves[m, :, k_idx] = 1.0
            else:
                # Continuous stage progression factor in [0.0, 1.0]
                stage_progress = np.clip((k_t - t_start) / (t_end - t_start), 0.0, 1.0)  # shape (5,)
                spent_to_date = (stage_progress[:, None] * boot_stage_cat_costs).sum(axis=0)  # shape (9,)

                with np.errstate(divide="ignore", invalid="ignore"):
                    frac = np.where(total_cat_costs > 0, spent_to_date / total_cat_costs, k_t)
                draw_curves[m, :, k_idx] = np.clip(frac, 0.0, 1.0)

        # Enforce monotonicity
        for c in range(n_cats):
            draw_curves[m, c, :] = np.maximum.accumulate(draw_curves[m, c, :])
            draw_curves[m, c, -1] = 1.0
            draw_curves[m, c, 0] = 0.0

    results = {}
    for c_idx, cat in enumerate(ALL_TRACKED_CATEGORIES):
        cat_draws = draw_curves[:, c_idx, :]
        p10 = np.percentile(cat_draws, 10, axis=0)
        p50 = np.percentile(cat_draws, 50, axis=0)
        p90 = np.percentile(cat_draws, 90, axis=0)

        p10 = np.maximum.accumulate(np.clip(p10, 0.0, 1.0))
        p50 = np.maximum.accumulate(np.clip(p50, 0.0, 1.0))
        p90 = np.maximum.accumulate(np.clip(p90, 0.0, 1.0))

        p10[0] = 0.0; p50[0] = 0.0; p90[0] = 0.0
        p10[-1] = 1.0; p50[-1] = 1.0; p90[-1] = 1.0

        results[cat] = {
            "knots": KNOTS.tolist(),
            "p10": [round(float(v), 4) for v in p10],
            "p50": [round(float(v), 4) for v in p50],
            "p90": [round(float(v), 4) for v in p90],
        }

    return results


def run_sensitivity_analysis(tensor, n_sheets, stage_windows_crop, baseline_results, crop_name):
    """
    Re-runs Monte Carlo simulation with timing windows shifted by -20% and +20%.
    Returns: maximum knot shift per category.
    """
    shifts = {}
    for factor, shift_name in [(0.80, "shift_minus_20"), (1.20, "shift_plus_20")]:
        shifted_windows = {"stages": {}}
        for s in STAGES:
            w = stage_windows_crop["stages"][s]["window"]
            new_w = [round(max(0.0, min(1.0, w[0] * factor)), 3),
                     round(max(0.0, min(1.0, w[1] * factor)), 3)]
            if new_w[1] <= new_w[0]:
                new_w[1] = min(1.0, new_w[0] + 0.05)
            shifted_windows["stages"][s] = {"window": new_w}

        shifted_res = run_vectorized_monte_carlo(tensor, n_sheets, shifted_windows, n_draws=1000, seed=RANDOM_SEED)

        for cat in CATEGORIES:
            base_p50 = np.array(baseline_results[cat]["p50"])
            shift_p50 = np.array(shifted_res[cat]["p50"])
            max_diff = float(np.max(np.abs(shift_p50 - base_p50)))
            if cat not in shifts or max_diff > shifts[cat]["max_knot_change"]:
                shifts[cat] = {
                    "crop": crop_name,
                    "category": cat,
                    "max_knot_change": round(max_diff, 4),
                    "worst_scenario": shift_name
                }
    return shifts


def main():
    base_dir = Path("ml")
    data_csv = base_dir / "data/derived/operation_costs.csv"
    op_map_file = base_dir / "config/operation_stage_map.json"
    windows_file = base_dir / "config/stage_windows.json"
    artifacts_dir = base_dir / "artifacts"
    plots_dir = artifacts_dir / "plots"

    plots_dir.mkdir(parents=True, exist_ok=True)

    if not data_csv.exists():
        sys.exit(f"Missing data file: {data_csv}")

    df = pd.read_csv(data_csv)

    with open(op_map_file, "r", encoding="utf-8") as f:
        op_map = json.load(f)

    with open(windows_file, "r", encoding="utf-8") as f:
        windows = json.load(f)

    with open(__file__, "rb") as f:
        script_hash = hashlib.sha256(f.read()).hexdigest()

    timestamp = datetime.now(timezone.utc).isoformat()

    full_priors = {
        "metadata": {
            "version": "v0.2.0",
            "generating_script": "ml/src/build_phasing_priors.py",
            "generating_script_sha256": script_hash,
            "generated_at_utc": timestamp,
            "methodology": "Continuous-stage Monte Carlo timing sampling (Uniform within widened ASSUMPTION windows, 2000 draws) x cluster bootstrap over raw DoA survey sheets",
            "seed": RANDOM_SEED,
            "n_draws": N_DRAWS,
            "knots": KNOTS.tolist(),
            "status": "RESEARCH PRIOR - NOT WIRED INTO PRODUCTION SO3 ENGINE",
            "uncertainty_interpretation": "P10/P90 bands represent timing window uncertainty and survey sampling variance across farms, NOT a prediction interval for an individual farm.",
            "category_metadata_flags": {
                "fuel": "derived_from_machinery",
                "irrigation": "no_data_placeholder",
                "unresolved": "unresolved_material_split"
            }
        },
        "crops": {}
    }

    divergence_table = []
    all_sensitivity_records = []
    unresolved_shares = {}

    print("\n" + "="*70, flush=True)
    print("RUNNING KNOWLEDGE-ANCHORED PHASING PRIOR SIMULATION (VECTORIZED v0.2.0)", flush=True)
    print(f"Iterations: {N_DRAWS} draws per crop | Seed: {RANDOM_SEED}", flush=True)
    print("="*70, flush=True)

    for crop in FOCUS_CROPS:
        crop_df = df[df["crop"] == crop]
        fert_splits = op_map["metadata"]["fertilizer_splits"]
        tensor, n_sheets = preaggregate_sheet_costs(crop_df, crop, op_map["patterns"], fert_splits)

        total_crop_cost = crop_df["total_cost"].sum()
        unresolved_cost = tensor[:, :, CAT_TO_IDX["unresolved"]].sum()
        unresolved_pct = (unresolved_cost / total_crop_cost) * 100 if total_crop_cost > 0 else 0.0
        unresolved_shares[crop] = {
            "total_cost": round(total_crop_cost, 2),
            "unresolved_cost": round(unresolved_cost, 2),
            "unresolved_share_pct": round(unresolved_pct, 2)
        }

        print(f"Processing {crop:<15} ({len(crop_df)} operation rows across {n_sheets} survey sheets | Unresolved material: {unresolved_pct:.2f}% of total cost)...", flush=True)

        crop_results = run_vectorized_monte_carlo(
            tensor=tensor,
            n_sheets=n_sheets,
            stage_windows_crop=windows["crops"][crop],
            n_draws=N_DRAWS,
            seed=RANDOM_SEED,
        )

        # Flag specific categories
        for cat in CATEGORIES:
            crop_results[cat]["derived_from_machinery_not_independently_learned"] = (cat == "fuel")
            crop_results[cat]["independently_learned"] = (cat not in ["fuel", "irrigation"])
            if cat == "fuel":
                crop_results[cat]["status"] = "derived_from_machinery"
            elif cat == "irrigation":
                crop_results[cat]["status"] = "no_data_placeholder"
            else:
                crop_results[cat]["status"] = "survey_weighted_timing_assumed"

        crop_results["unresolved"]["status"] = "unresolved_material_split"
        crop_results["unresolved"]["cost_share_pct"] = round(unresolved_pct, 2)

        # Sensitivity analysis (+-20% timing shift)
        sens_shifts = run_sensitivity_analysis(tensor, n_sheets, windows["crops"][crop], crop_results, crop)
        for cat, s_rec in sens_shifts.items():
            all_sensitivity_records.append(s_rec)

        full_priors["crops"][crop] = {
            "cycle_length_days": windows["crops"][crop]["cycle_length_days"],
            "survey_rows": len(crop_df),
            "survey_sheets": n_sheets,
            "unresolved_cost_share_pct": round(unresolved_pct, 2),
            "categories": {cat: crop_results[cat] for cat in CATEGORIES},
            "unresolved_bucket": crop_results["unresolved"]
        }

        # Check divergence against placeholder curves (> 0.10 at any knot)
        for cat in CATEGORIES:
            p50_vals = crop_results[cat]["p50"]
            for idx, t in enumerate(KNOTS):
                ph_val = evaluate_placeholder(cat, t)
                diff = abs(p50_vals[idx] - ph_val)
                if diff > 0.10:
                    divergence_table.append({
                        "crop": crop,
                        "category": cat,
                        "knot_t": round(float(t), 2),
                        "survey_p50": p50_vals[idx],
                        "placeholder": round(ph_val, 4),
                        "divergence": round(diff, 4),
                        "direction": "SURVEY_EARLIER" if p50_vals[idx] > ph_val else "SURVEY_LATER"
                    })

        # Generate comparison plot for this crop
        fig, axes = plt.subplots(2, 4, figsize=(18, 9), sharex=True, sharey=True)
        fig.suptitle(f"Knowledge-Anchored Phasing Prior vs Placeholder: {crop} (v0.2.0)", fontsize=14, fontweight="bold")

        ax_flat = axes.flatten()
        for idx, cat in enumerate(CATEGORIES):
            ax = ax_flat[idx]
            cat_data = crop_results[cat]
            t_vals = cat_data["knots"]
            p10 = cat_data["p10"]
            p50 = cat_data["p50"]
            p90 = cat_data["p90"]

            placeholder_vals = [evaluate_placeholder(cat, t) for t in t_vals]

            ax.fill_between(t_vals, p10, p90, color="teal", alpha=0.25, label="P10–P90 Band")
            ax.plot(t_vals, p50, color="navy", lw=2.5, marker="o", markersize=4, label="Survey Prior (P50)")
            ax.plot(t_vals, placeholder_vals, color="crimson", lw=2, linestyle="--", label="Placeholder (shared/phasing.js)")

            flag_text = ""
            if cat == "fuel":
                flag_text = "\n[derived from machinery]"
            elif cat == "irrigation":
                flag_text = "\n[no data - placeholder]"

            ax.set_title(f"{cat.capitalize()}{flag_text}", fontsize=10, fontweight="bold")
            ax.set_xlim(-0.02, 1.02)
            ax.set_ylim(-0.02, 1.05)
            ax.grid(True, alpha=0.3, linestyle=":")
            if idx in [0, 4]:
                ax.set_ylabel("Cumulative Spend Fraction $F_c(t)$", fontsize=9)
            if idx >= 4:
                ax.set_xlabel("Cycle Progress Ratio $t$", fontsize=9)

            if idx == 0:
                ax.legend(loc="lower right", fontsize=8, framealpha=0.9)

        plt.tight_layout()
        plot_path = plots_dir / f"phasing_prior_{crop.lower().replace(' ', '_')}.png"
        plt.savefig(plot_path, dpi=200)
        plt.close()
        print(f"  -> Generated plot: {plot_path}", flush=True)

    # Save artifacts JSON
    out_json = artifacts_dir / "phasing_priors_v0.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(full_priors, f, indent=2)
    print(f"\nArtifact written: {out_json}", flush=True)

    # Output divergence table
    div_df = pd.DataFrame(divergence_table)
    div_csv = artifacts_dir / "placeholder_divergences.csv"
    div_df.to_csv(div_csv, index=False)

    # Output sensitivity table
    sens_df = pd.DataFrame(all_sensitivity_records)
    sens_csv = artifacts_dir / "sensitivity_shifts.csv"
    sens_df.to_csv(sens_csv, index=False)

    print("\n" + "="*70, flush=True)
    print("UNRESOLVED MATERIAL SPLIT AUDIT", flush=True)
    print("="*70, flush=True)
    for c, data in unresolved_shares.items():
        print(f"  {c:<15}: Unresolved Rs {data['unresolved_cost']:>12,.2f} / Total Rs {data['total_cost']:>12,.2f} ({data['unresolved_share_pct']:>5.2f}%)", flush=True)

    print("\n" + "="*70, flush=True)
    print("SENSITIVITY ANALYSIS (+-20% TIMING SHIFT): MAX KNOT CHANGE PER CROP/CATEGORY", flush=True)
    print("="*70, flush=True)
    print(sens_df.to_string(index=False), flush=True)


if __name__ == "__main__":
    main()
