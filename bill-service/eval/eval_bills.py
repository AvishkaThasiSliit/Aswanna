#!/usr/bin/env python3
"""
Evaluation Harness for Aswanna Bill Scanner (TASK BILL-3).
Evaluates OCR + parser against ground truth for a given dataset split.
Primary metric: Silent total errors (wrong total presented without a review flag).
Computes Wilson 95% confidence intervals for all proportions.
Enforces test split locking rule via logs/bill-eval-test.lock.
"""

import os
import sys
import json
import math
import argparse
import time
from pathlib import Path
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple

# Ensure bill-service root is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
BILL_SERVICE_DIR = SCRIPT_DIR.parent
ROOT_DIR = BILL_SERVICE_DIR.parent
LOGS_DIR = ROOT_DIR / "logs"

if str(BILL_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(BILL_SERVICE_DIR))

import shutil

def check_tesseract_engine() -> str:
    """
    Checks that Tesseract is discoverable via TESSERACT_CMD or shutil.which('tesseract'),
    otherwise raises a clear RuntimeError.
    """
    cmd = os.getenv("TESSERACT_CMD")
    if cmd:
        if os.path.isabs(cmd) and os.path.isfile(cmd):
            return cmd
        if shutil.which(cmd):
            return cmd
        raise RuntimeError(
            f"TESSERACT_CMD is set to '{cmd}', but executable was not found."
        )
    which_cmd = shutil.which("tesseract")
    if which_cmd:
        return which_cmd
    raise RuntimeError(
        "Tesseract executable not found. Searched TESSERACT_CMD environment variable and "
        "system PATH via shutil.which('tesseract'). Please install Tesseract or set TESSERACT_CMD."
    )

from ocr import run_ocr
from parse_bill import parse_bill_text


def wilson_score_interval(x: int, n: int, confidence: float = 0.95) -> Tuple[float, float]:
    """
    Computes Wilson score confidence interval for a proportion.
    Default: 95% confidence (z = 1.95996).
    Returns (lower_bound, upper_bound) as floats in [0.0, 1.0].
    """
    if n <= 0:
        return 0.0, 0.0
    z = 1.959963984540054  # Normal critical value for 95% two-sided
    p = x / n
    denominator = 1.0 + (z ** 2) / n
    centre = (p + (z ** 2) / (2.0 * n)) / denominator
    half_width = (z / denominator) * math.sqrt((p * (1.0 - p) / n) + (z ** 2) / (4.0 * (n ** 2)))
    lower = max(0.0, centre - half_width)
    upper = min(1.0, centre + half_width)
    return round(lower, 4), round(upper, 4)


def normalise_vendor_string(name: Optional[str]) -> str:
    """Normalises vendor string by removing punctuation, lowercasing, and collapsing whitespace."""
    if not name:
        return ""
    import re
    cleaned = re.sub(r"[^\w\s]", " ", name.lower())
    return " ".join(cleaned.split())


def calculate_token_overlap(pred_vendor: Optional[str], true_vendor: Optional[str]) -> float:
    """Calculates Jaccard token overlap between predicted and true vendor strings."""
    norm_pred = normalise_vendor_string(pred_vendor)
    norm_true = normalise_vendor_string(true_vendor)
    tokens_pred = set(norm_pred.split())
    tokens_true = set(norm_true.split())
    if not tokens_true:
        return 1.0 if not tokens_pred else 0.0
    if not tokens_pred:
        return 0.0
    intersection = tokens_pred.intersection(tokens_true)
    union = tokens_pred.union(tokens_true)
    return round(len(intersection) / len(union), 4)


def evaluate_total(pred_total: Optional[float], true_total: Optional[float], status: str, reasons: List[str]) -> str:
    """
    Outcomes for total:
    - 'correct': predicted total matches ground truth
    - 'silent_error': wrong value shown WITHOUT review flag (PRIMARY FAILURE)
    - 'wrong_flagged': wrong value with review flag
    - 'no_value': predicted total is None
    """
    is_flagged = (status == "needs_review") or len(reasons) > 0
    if pred_total is None:
        return "no_value"
    if true_total is None:
        return "wrong_flagged" if is_flagged else "silent_error"

    # Compare down to cents (0.01 tolerance)
    diff = abs(pred_total - true_total)
    if diff < 0.01:
        return "correct"
    else:
        return "wrong_flagged" if is_flagged else "silent_error"


def evaluate_date(pred_date: Optional[str], true_date: Optional[str], status: str, reasons: List[str]) -> str:
    """
    Outcomes for date:
    - 'correct': predicted date == ground truth date (ISO YYYY-MM-DD)
    - 'silent_error': wrong value shown WITHOUT review flag
    - 'wrong_flagged': wrong value with review flag
    - 'no_value': predicted date is None
    """
    is_flagged = (status == "needs_review") or ("ambiguous_date" in reasons) or len(reasons) > 0
    if not pred_date:
        return "no_value"
    if not true_date:
        return "wrong_flagged" if is_flagged else "silent_error"
    if pred_date == true_date:
        return "correct"
    else:
        return "wrong_flagged" if is_flagged else "silent_error"


def evaluate_vendor(pred_vendor: Optional[str], true_vendor: Optional[str]) -> Tuple[bool, float]:
    """Returns (exact_match_after_normalisation, token_overlap)."""
    norm_pred = normalise_vendor_string(pred_vendor)
    norm_true = normalise_vendor_string(true_vendor)
    exact_match = (norm_pred == norm_true) if (norm_pred or norm_true) else False
    overlap = calculate_token_overlap(pred_vendor, true_vendor)
    return exact_match, overlap


def enforce_test_split_lock(target_logs_dir: Path, force_new_run: bool = False) -> Path:
    """
    Enforces test split locking:
    - Raises RuntimeError if lockfile exists and force_new_run is False.
    - Creates lockfile on first run.
    - Allows rerun if force_new_run is True.
    """
    target_logs_dir.mkdir(parents=True, exist_ok=True)
    test_lock_file = target_logs_dir / "bill-eval-test.lock"
    if test_lock_file.exists() and not force_new_run:
        raise RuntimeError(
            f"TEST SPLIT LOCKED: Lockfile '{test_lock_file}' already exists. "
            f"Rerunning on test split is prohibited to prevent test set contamination. "
            f"Use --force-new-run to override explicitly if intentional."
        )
    if not test_lock_file.exists():
        test_lock_file.write_text(f"Locked at {time.strftime('%Y-%m-%dT%H:%M:%SZ')}\n", encoding="utf-8")
        print(f"[LOCK] Created test split lockfile: {test_lock_file}")
    return test_lock_file


def run_evaluation(split: str, data_dir: Optional[str] = None, force_new_run: bool = False, logs_dir: Optional[Path] = None) -> Dict[str, Any]:
    """
    Runs evaluation for a split and returns evaluation records and summary tables.
    """
    active_logs_dir = logs_dir or LOGS_DIR
    active_logs_dir.mkdir(parents=True, exist_ok=True)

    # TEST SPLIT LOCK ENFORCEMENT (Item 4)
    if split == "test":
        enforce_test_split_lock(active_logs_dir, force_new_run=force_new_run)

    # Locate dataset
    candidate_dirs = []
    if data_dir:
        candidate_dirs.append(Path(data_dir))
    candidate_dirs.extend([
        ROOT_DIR / "bill-scan-data" / "synthetic" / split,
        ROOT_DIR / "bill-scan-data" / split,
        BILL_SERVICE_DIR / "data" / split,
        ROOT_DIR / "data" / "bills" / split,
        BILL_SERVICE_DIR / "eval" / "data" / split,
    ])

    split_dir = None
    for cand in candidate_dirs:
        if cand.exists() and cand.is_dir():
            split_dir = cand
            break

    items = []
    if split_dir:
        # Check for manifest file
        manifest_path = split_dir / "manifest.json"
        if manifest_path.exists():
            with open(manifest_path, "r", encoding="utf-8") as f:
                raw_manifest = json.load(f)
            for entry in raw_manifest:
                if "image_path" in entry:
                    items.append(entry)
                else:
                    fn = entry.get("filename")
                    img_p = split_dir / fn if fn else None
                    items.append({
                        "id": entry.get("id", fn),
                        "image_path": str(img_p),
                        "ground_truth": entry
                    })
        else:
            # Scan for paired images and json annotations
            for img_path in sorted(list(split_dir.glob("*.png")) + list(split_dir.glob("*.jpg")) + list(split_dir.glob("*.jpeg"))):
                json_path = img_path.with_suffix(".json")
                gt = {}
                if json_path.exists():
                    with open(json_path, "r", encoding="utf-8") as f:
                        gt = json.load(f)
                items.append({
                    "id": img_path.stem,
                    "image_path": str(img_path),
                    "ground_truth": gt
                })

    if not items:
        # If no files found, raise a clear error identifying candidate search paths
        searched_paths = "\n  - ".join(str(p) for p in candidate_dirs)
        raise FileNotFoundError(
            f"No bills found for split '{split}'. Searched candidate directories:\n  - {searched_paths}\n"
            f"Please ensure bill images and ground-truth JSON files/manifest are placed in the split directory."
        )

    records = []
    degradation_buckets: Dict[int, List[Dict[str, Any]]] = {}

    for item in items:
        item_id = item.get("id", Path(item.get("image_path", "unknown")).stem)
        img_path = Path(item["image_path"])
        gt = item.get("ground_truth", {})
        deg_level = gt.get("degradation_level", 0)

        true_total = gt.get("total")
        if true_total is not None:
            true_total = float(true_total)
        true_date = gt.get("date")
        true_vendor = gt.get("vendor")

        # Read image and run OCR
        with open(img_path, "rb") as f:
            img_bytes = f.read()

        t0 = time.time()
        ocr_res = run_ocr(img_bytes)
        ocr_time = time.time() - t0

        raw_text = ocr_res.get("raw_text") or ocr_res.get("text", "")
        ocr_words = ocr_res.get("words", [])

        # Parse OCR text
        t1 = time.time()
        parsed = parse_bill_text(raw_text, ocr_words)
        parse_time = time.time() - t1
        total_latency_ms = round((ocr_time + parse_time) * 1000, 2)

        pred_total = parsed.get("total")
        pred_date = parsed.get("date")
        pred_vendor = parsed.get("vendor")
        status = parsed.get("status", "ok")
        reasons = parsed.get("reasons", [])

        # Evaluate fields
        total_outcome = evaluate_total(pred_total, true_total, status, reasons)
        date_outcome = evaluate_date(pred_date, true_date, status, reasons)
        vendor_match, vendor_overlap = evaluate_vendor(pred_vendor, true_vendor)

        rec = {
            "id": item_id,
            "degradation_level": deg_level,
            "latency_ms": total_latency_ms,
            "status": status,
            "reasons": reasons,
            "total": {
                "predicted": pred_total,
                "ground_truth": true_total,
                "outcome": total_outcome
            },
            "date": {
                "predicted": pred_date,
                "ground_truth": true_date,
                "outcome": date_outcome
            },
            "vendor": {
                "predicted": pred_vendor,
                "ground_truth": true_vendor,
                "exact_match": vendor_match,
                "token_overlap": vendor_overlap
            },
            "raw_text": raw_text
        }
        records.append(rec)
        degradation_buckets.setdefault(deg_level, []).append(rec)

    # Compute Summary Statistics
    def compute_bucket_summary(bucket_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        n = len(bucket_records)
        if n == 0:
            return {}

        silent_total_errors = sum(1 for r in bucket_records if r["total"]["outcome"] == "silent_error")
        correct_totals = sum(1 for r in bucket_records if r["total"]["outcome"] == "correct")
        flagged_wrong_totals = sum(1 for r in bucket_records if r["total"]["outcome"] == "wrong_flagged")
        no_value_totals = sum(1 for r in bucket_records if r["total"]["outcome"] == "no_value")

        silent_date_errors = sum(1 for r in bucket_records if r["date"]["outcome"] == "silent_error")
        correct_dates = sum(1 for r in bucket_records if r["date"]["outcome"] == "correct")

        vendor_exact_matches = sum(1 for r in bucket_records if r["vendor"]["exact_match"])
        mean_vendor_overlap = round(sum(r["vendor"]["token_overlap"] for r in bucket_records) / n, 4)

        return {
            "count": n,
            "silent_total_errors": {
                "count": silent_total_errors,
                "rate": round(silent_total_errors / n, 4),
                "ci_95": wilson_score_interval(silent_total_errors, n)
            },
            "correct_total": {
                "count": correct_totals,
                "rate": round(correct_totals / n, 4),
                "ci_95": wilson_score_interval(correct_totals, n)
            },
            "wrong_flagged_total": {
                "count": flagged_wrong_totals,
                "rate": round(flagged_wrong_totals / n, 4),
                "ci_95": wilson_score_interval(flagged_wrong_totals, n)
            },
            "no_value_total": {
                "count": no_value_totals,
                "rate": round(no_value_totals / n, 4),
                "ci_95": wilson_score_interval(no_value_totals, n)
            },
            "silent_date_errors": {
                "count": silent_date_errors,
                "rate": round(silent_date_errors / n, 4),
                "ci_95": wilson_score_interval(silent_date_errors, n)
            },
            "correct_date": {
                "count": correct_dates,
                "rate": round(correct_dates / n, 4),
                "ci_95": wilson_score_interval(correct_dates, n)
            },
            "vendor_exact_match": {
                "count": vendor_exact_matches,
                "rate": round(vendor_exact_matches / n, 4),
                "ci_95": wilson_score_interval(vendor_exact_matches, n)
            },
            "vendor_mean_token_overlap": mean_vendor_overlap
        }

    overall_summary = compute_bucket_summary(records)
    degradation_summaries = {
        lvl: compute_bucket_summary(degradation_buckets[lvl])
        for lvl in sorted(degradation_buckets.keys())
    }

    eval_output = {
        "split": split,
        "evaluated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_records": len(records),
        "overall": overall_summary,
        "by_degradation_level": degradation_summaries,
        "records": records
    }

    # Write per-item JSON to logs/bill-eval-<split>.json
    out_json_path = active_logs_dir / f"bill-eval-{split}.json"
    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(eval_output, f, indent=2)
    print(f"[OUTPUT] Written detailed evaluation JSON to: {out_json_path}")

    # Print Summary Table (Primary measure: Silent Total Errors first)
    print("\n" + "=" * 90)
    print(f"ASWANNA BILL SCANNER EVALUATION SUMMARY (Split: {split})")
    print("=" * 90)
    print(f"{'Level':<10} {'N':<6} {'Silent Tot Errs (95% CI)':<26} {'Correct Tot (95% CI)':<24} {'Vendor Exact':<12}")
    print("-" * 90)

    for lvl in sorted(degradation_buckets.keys()):
        s = degradation_summaries[lvl]
        ste = s["silent_total_errors"]
        ct = s["correct_total"]
        ste_str = f"{ste['count']} ({ste['rate']*100:.1f}%, [{ste['ci_95'][0]*100:.1f}%, {ste['ci_95'][1]*100:.1f}%])"
        ct_str = f"{ct['count']} ({ct['rate']*100:.1f}%, [{ct['ci_95'][0]*100:.1f}%, {ct['ci_95'][1]*100:.1f}%])"
        vem_str = f"{s['vendor_exact_match']['count']}/{s['count']}"
        print(f"Level {lvl:<4} {s['count']:<6} {ste_str:<26} {ct_str:<24} {vem_str:<12}")

    print("-" * 90)
    o_ste = overall_summary["silent_total_errors"]
    o_ct = overall_summary["correct_total"]
    o_ste_str = f"{o_ste['count']} ({o_ste['rate']*100:.1f}%, [{o_ste['ci_95'][0]*100:.1f}%, {o_ste['ci_95'][1]*100:.1f}%])"
    o_ct_str = f"{o_ct['count']} ({o_ct['rate']*100:.1f}%, [{o_ct['ci_95'][0]*100:.1f}%, {o_ct['ci_95'][1]*100:.1f}%])"
    o_vem_str = f"{overall_summary['vendor_exact_match']['count']}/{overall_summary['count']}"
    print(f"{'OVERALL':<10} {overall_summary['count']:<6} {o_ste_str:<26} {o_ct_str:<24} {o_vem_str:<12}")
    print("=" * 90 + "\n")

    return eval_output


def main():
    parser = argparse.ArgumentParser(description="Evaluate Aswanna Bill Scanner against ground truth.")
    parser.add_argument("--split", type=str, default="development", choices=["development", "test"],
                        help="Dataset split to evaluate (default: development).")
    parser.add_argument("--data-dir", type=str, default=None,
                        help="Optional explicit path to the dataset directory.")
    parser.add_argument("--force-new-run", action="store_true",
                        help="Force re-running evaluation on test split even if lockfile exists.")

    args = parser.parse_args()

    # Rule 4: Refuse to run on test split unless requested and lock passed
    if args.split == "test":
        print("[WARNING] Running on TEST split. Enforcing test split lockfile protocol.")

    try:
        run_evaluation(split=args.split, data_dir=args.data_dir, force_new_run=args.force_new_run)
    except Exception as e:
        print(f"[ERROR] Evaluation aborted: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
