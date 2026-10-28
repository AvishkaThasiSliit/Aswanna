"""
ml/src/fit_from_export.py

Fits empirical shrinkage phasing models from exported closed cycles.
Only trains learned curves when n >= 5 cycles are present for a given crop;
otherwise flags the crop for survey prior fallback.
Outputs fitted curves to shared/config/learnedPhasing.json.

Usage:
  python ml/src/fit_from_export.py [--input ml/data/derived/exported_cycles.json] [--output shared/config/learnedPhasing.json]
"""

import sys
from pathlib import Path
import json
import argparse
from typing import Dict, Any, List

repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from ml.src.models.shrinkage_prior import ShrinkagePriorForecaster, CATEGORIES, KNOTS
from ml.src.evaluate import load_prior_curves


def fit_phasing_from_export(
    export_path: Path,
    priors_path: Path,
    output_path: Path,
    min_cycles_to_learn: int = 5
) -> Dict[str, Any]:
    """
    Fits isotonic empirical shrinkage curves per crop from exported cycles.
    """
    if not export_path.exists():
        print(f"Export file not found: {export_path}. Creating empty/fallback learnedPhasing.json.")
        cycles_data: List[Dict[str, Any]] = []
    else:
        with open(export_path, "r", encoding="utf-8") as f:
            cycles_data = json.load(f)

    # Group cycles by crop
    cycles_by_crop: Dict[str, List[Dict[str, Any]]] = {}
    for c in cycles_data:
        crop = c.get("crop", "Paddy")
        if crop not in cycles_by_crop:
            cycles_by_crop[crop] = []
        cycles_by_crop[crop].append(c)

    # Load base priors to check supported crops
    with open(priors_path, "r", encoding="utf-8") as f:
        priors_raw = json.load(f)
    supported_crops = list(priors_raw.get("crops", {}).keys())

    learned_config: Dict[str, Any] = {
        "metadata": {
            "version": "1.0.0",
            "generating_script": "ml/src/fit_from_export.py",
            "source_export": str(export_path.name),
            "total_cycles_exported": len(cycles_data),
            "description": "Empirical shrinkage curves fitted on closed farm cycles via 5-fold CV & PAVA isotonic regression."
        },
        "crops": {}
    }

    for crop in supported_crops:
        crop_cycles = cycles_by_crop.get(crop, [])
        n_cyc = len(crop_cycles)
        crop_prior_curves = load_prior_curves(priors_path, crop=crop)

        if n_cyc >= min_cycles_to_learn:
            print(f"Fitting shrinkage curves for crop '{crop}' (n={n_cyc} cycles)...")
            fitted_model, best_k, cv_losses = ShrinkagePriorForecaster.fit_with_cv(
                training_cycles=crop_cycles,
                prior_curves=crop_prior_curves,
                n_folds=min(5, n_cyc)
            )

            cat_curves = {}
            for cat in CATEGORIES:
                arr = fitted_model.fitted_curves[cat]
                cat_curves[cat] = [round(float(x), 4) for x in arr]

            learned_config["crops"][crop] = {
                "n_cycles": n_cyc,
                "k_shrinkage": best_k,
                "cv_loss": cv_losses.get(best_k, 0.0),
                "status": "learned",
                "categories": cat_curves
            }
        else:
            print(f"Insufficient cycles for crop '{crop}' (n={n_cyc} < {min_cycles_to_learn}); flagging for prior fallback.")
            learned_config["crops"][crop] = {
                "n_cycles": n_cyc,
                "status": "insufficient_data",
                "message": f"Requires at least {min_cycles_to_learn} closed cycles for crop (found {n_cyc}). Fall back to survey prior."
            }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(learned_config, f, indent=2)

    print(f"Learned phasing curves written to: {output_path}")
    return learned_config


def main():
    parser = argparse.ArgumentParser(description="Fit empirical shrinkage curves from exported cycles.")
    parser.add_argument("--input", default="ml/data/derived/exported_cycles.json", help="Path to exported cycles JSON")
    parser.add_argument("--priors", default="shared/config/phasingPriors.json", help="Path to phasing priors JSON")
    parser.add_argument("--output", default="shared/config/learnedPhasing.json", help="Output path for learned phasing JSON")
    parser.add_argument("--min-cycles", type=int, default=5, help="Minimum cycles required to fit learned model")
    args = parser.parse_args()

    export_path = Path(args.input)
    priors_path = Path(args.priors)
    output_path = Path(args.output)

    fit_phasing_from_export(
        export_path=export_path,
        priors_path=priors_path,
        output_path=output_path,
        min_cycles_to_learn=args.min_cycles
    )


if __name__ == "__main__":
    main()
