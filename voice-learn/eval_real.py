"""
Real Audio Transcript Evaluator & Comparison Harness (Task E1)
Compares Three Systems:
  R: Frozen rule extractor (via Node bridge to extractExpenses)
  L: Learned extractor alone
  G: Gated extractor (uses R's items, marks needs_review when L disagrees)

Enforces Run-Once Guard with logs/e1-real-eval.lock.
Evaluates on:
  - real-asr.captured.json (Session 1)
  - real-asr.repeat1.captured.json (Repeat 1)
  - real-asr.take3.clean.json (Take 3 Clean)
Language: English records only (12 distinct phrases x 3 takes = 36 records).
Performs phrase-level bootstrap for (G - R) differences.
Also evaluates R and L on the synthetic validation set to show the synthetic vs real gap.
"""

import copy
import hashlib
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple

import numpy as np

from systems import extract_r_batch, extract_l_batch, extract_g_batch


def compute_model_hash(models_dir: Path) -> str:
    hasher = hashlib.sha256()
    for fn in ["tagger.joblib", "category_clf.joblib"]:
        fp = models_dir / fn
        if fp.exists():
            with open(fp, "rb") as f:
                hasher.update(f.read())
    return hasher.hexdigest()[:16]


def check_run_once_guard(lock_path: Path, model_hash: str, force: bool = False):
    """Enforces run-once guard. Blocks re-running without --force."""
    if lock_path.exists() and not force:
        print("\n" + "=" * 80)
        print("[RUN-ONCE GUARD ACTIVE]")
        print(f"Lock file exists at: {lock_path}")
        print("Real-world evaluation has already been run against the held-out test data.")
        print("To re-run, you must explicitly supply the '--force' flag.")
        print("=" * 80 + "\n")
        sys.exit(1)

    if lock_path.exists() and force:
        print("\n" + "*" * 80)
        print("[WARNING] Real evaluation run with --force:")
        print("   Test results are NO LONGER strictly held-out!")
        print("*" * 80 + "\n")

    # Record lock
    with open(lock_path, "w", encoding="utf-8") as f:
        json.dump({
            "model_hash": model_hash,
            "timestamp": datetime.now().isoformat(),
            "forced": force,
            "argv": sys.argv
        }, f, indent=2)


def score_system_outputs(records: List[Dict[str, Any]], outputs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Scores extracted items against expected ground truth items."""
    total_items = 0
    amount_correct = 0
    category_correct = 0
    needs_review = 0
    silent_errors = []
    
    per_phrase_stats = {}

    for rec, out in zip(records, outputs):
        phrase_id = rec.get("promptId") or rec.get("promptText") or "unknown"
        if phrase_id not in per_phrase_stats:
            per_phrase_stats[phrase_id] = {
                "items": 0, "amount_correct": 0, "category_correct": 0,
                "needs_review": 0, "silent_errors": 0
            }
            
        expected_items = rec.get("expected", {}).get("items", [])
        extracted_items = out.get("items", [])
        transcript = rec.get("rawTranscript") or rec.get("transcript") or ""
        
        for i, exp in enumerate(expected_items):
            total_items += 1
            per_phrase_stats[phrase_id]["items"] += 1
            
            exp_amt = exp.get("totalAmount") if exp.get("totalAmount") is not None else exp.get("cost")
            exp_cat = exp.get("category")
            
            ext = extracted_items[i] if i < len(extracted_items) else None
            
            amt_match = Boolean = bool(ext and ext.get("totalAmount") == exp_amt)
            cat_match = bool(ext and ext.get("category") == exp_cat)
            is_nr = bool(ext and ext.get("status") == "needs_review")
            
            if amt_match:
                amount_correct += 1
                per_phrase_stats[phrase_id]["amount_correct"] += 1
            if cat_match:
                category_correct += 1
                per_phrase_stats[phrase_id]["category_correct"] += 1
            if is_nr:
                needs_review += 1
                per_phrase_stats[phrase_id]["needs_review"] += 1
                
            # Silent error: status ok but wrong amount or category
            if ext and ext.get("status") == "ok":
                issues = []
                if not amt_match:
                    issues.append(f"amount extracted={ext.get('totalAmount')} vs expected={exp_amt}")
                if not cat_match:
                    issues.append(f"category extracted='{ext.get('category')}' vs expected='{exp_cat}'")
                    
                if issues:
                    silent_errors.append({
                        "promptId": phrase_id,
                        "transcript": transcript,
                        "itemIndex": i,
                        "extracted": {"category": ext.get("category"), "amount": ext.get("totalAmount"), "status": ext.get("status")},
                        "expected": {"category": exp_cat, "amount": exp_amt},
                        "issues": issues
                    })
                    per_phrase_stats[phrase_id]["silent_errors"] += 1

    return {
        "items": total_items,
        "amount_correct": amount_correct,
        "category_correct": category_correct,
        "needs_review": needs_review,
        "silent_error_count": len(silent_errors),
        "silent_errors": silent_errors,
        "per_phrase": per_phrase_stats
    }


def bootstrap_phrase_differences(
    r_phrase_stats: Dict[str, Dict[str, int]],
    g_phrase_stats: Dict[str, Dict[str, int]],
    n_bootstrap: int = 10000,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Performs bootstrap over distinct PHRASES (not items) for (G - R) differences.
    """
    rng = np.random.default_rng(seed)
    phrases = sorted(list(r_phrase_stats.keys()))
    k = len(phrases)
    
    diff_silent = np.zeros(k)
    diff_nr = np.zeros(k)
    
    for idx, p in enumerate(phrases):
        diff_silent[idx] = g_phrase_stats[p]["silent_errors"] - r_phrase_stats[p]["silent_errors"]
        diff_nr[idx] = g_phrase_stats[p]["needs_review"] - r_phrase_stats[p]["needs_review"]
        
    boot_silent = np.zeros(n_bootstrap)
    boot_nr = np.zeros(n_bootstrap)
    
    for b in range(n_bootstrap):
        sample_indices = rng.choice(k, size=k, replace=True)
        boot_silent[b] = np.mean(diff_silent[sample_indices])
        boot_nr[b] = np.mean(diff_nr[sample_indices])
        
    return {
        "num_phrases": k,
        "mean_diff_silent_errors": float(np.mean(diff_silent)),
        "ci_diff_silent_errors": [float(np.percentile(boot_silent, 2.5)), float(np.percentile(boot_silent, 97.5))],
        "mean_diff_needs_review": float(np.mean(diff_nr)),
        "ci_diff_needs_review": [float(np.percentile(boot_nr, 2.5)), float(np.percentile(boot_nr, 97.5))],
    }


def run_evaluation(force: bool = False):
    base_dir = Path(__file__).resolve().parent
    models_dir = base_dir / "models"
    fixtures_dir = base_dir.parent / "server" / "eval" / "fixtures" / "voice"
    logs_dir = base_dir.parent / "logs"
    lock_file = logs_dir / "e1-real-eval.lock"
    
    model_hash = compute_model_hash(models_dir)
    check_run_once_guard(lock_file, model_hash, force=force)
    
    # Load Real Datasets
    files = {
        "Take 1 (Session 1)": fixtures_dir / "real-asr.captured.json",
        "Take 2 (Repeat 1)": fixtures_dir / "real-asr.repeat1.captured.json",
        "Take 3 (Take 3 Clean)": fixtures_dir / "real-asr.take3.clean.json"
    }
    
    real_data = {}
    for name, path in files.items():
        if not path.exists():
            raise FileNotFoundError(f"Fixture file missing: {path}")
        with open(path, "r", encoding="utf-8") as f:
            full = json.load(f)
            en_recs = [r for r in full if r.get("language") == "en"]
            real_data[name] = en_recs
            print(f"Loaded {len(en_recs)} English records from {path.name}")
            
    # Evaluation storage
    all_results = {}
    systems = ["R", "L", "G"]
    
    # Evaluate per take
    overall_records = []
    overall_outputs = {"R": [], "L": [], "G": []}
    
    report_lines = []
    report_lines.append("=" * 110)
    report_lines.append("ASWANNA TASK E1: REAL AUDIO EXTRACTOR COMPARISON REPORT (R vs L vs G)")
    report_lines.append("=" * 110)
    report_lines.append(f"Timestamp:  {datetime.now().isoformat()}")
    report_lines.append(f"Model Hash: {model_hash}")
    report_lines.append("Systems:")
    report_lines.append("  R: Frozen rule extractor (extractExpenses via Node bridge)")
    report_lines.append("  L: Learned extractor alone (CRF BIO tagger + char-ngram classifier)")
    report_lines.append("  G: Gated extractor (uses R's items, marks needs_review when L disagrees)")
    report_lines.append("=" * 110)
    report_lines.append(f"| {'System':<8} | {'Take':<23} | {'Items':<6} | {'Amount Correct':<22} | {'Category Correct':<22} | {'Needs Review':<22} | {'Silent Errors':<13} |")
    report_lines.append("|" + "-"*10 + "|" + "-"*25 + "|" + "-"*8 + "|" + "-"*24 + "|" + "-"*24 + "|" + "-"*24 + "|" + "-"*15 + "|")
    
    take_stats = {}
    
    for take_name, records in real_data.items():
        overall_records.extend(records)
        take_stats[take_name] = {}
        
        # System R
        r_outs = extract_r_batch(records)
        overall_outputs["R"].extend(r_outs)
        r_score = score_system_outputs(records, r_outs)
        take_stats[take_name]["R"] = r_score
        
        # System L
        l_outs = extract_l_batch(records)
        overall_outputs["L"].extend(l_outs)
        l_score = score_system_outputs(records, l_outs)
        take_stats[take_name]["L"] = l_score
        
        # System G
        g_outs = extract_g_batch(r_outs, l_outs)
        overall_outputs["G"].extend(g_outs)
        g_score = score_system_outputs(records, g_outs)
        take_stats[take_name]["G"] = g_score
        
        for sys_code, sc in [("R", r_score), ("L", l_score), ("G", g_score)]:
            it = sc["items"]
            amt_pct = (sc["amount_correct"] / it * 100) if it else 0
            cat_pct = (sc["category_correct"] / it * 100) if it else 0
            nr_pct = (sc["needs_review"] / it * 100) if it else 0
            amt_str = f"{sc['amount_correct']}/{it} ({amt_pct:5.1f}%)"
            cat_str = f"{sc['category_correct']}/{it} ({cat_pct:5.1f}%)"
            nr_str = f"{sc['needs_review']}/{it} ({nr_pct:5.1f}%)"
            se_str = f"{sc['silent_error_count']}"
            report_lines.append(f"| {sys_code:<8} | {take_name:<23} | {it:<6} | {amt_str:<22} | {cat_str:<22} | {nr_str:<22} | {se_str:<13} |")
        report_lines.append("|" + "-"*10 + "|" + "-"*25 + "|" + "-"*8 + "|" + "-"*24 + "|" + "-"*24 + "|" + "-"*24 + "|" + "-"*15 + "|")
        
    # Overall scoring across all 3 takes
    report_lines.append("=" * 110)
    report_lines.append("OVERALL AGGREGATE EVALUATION (All 3 Real Takes, N=36 recordings, 36 items):")
    report_lines.append("=" * 110)
    report_lines.append(f"| {'System':<8} | {'Take':<23} | {'Items':<6} | {'Amount Correct':<22} | {'Category Correct':<22} | {'Needs Review':<22} | {'Silent Errors':<13} |")
    report_lines.append("|" + "-"*10 + "|" + "-"*25 + "|" + "-"*8 + "|" + "-"*24 + "|" + "-"*24 + "|" + "-"*24 + "|" + "-"*15 + "|")
    
    overall_scores = {}
    for sys_code in systems:
        sc = score_system_outputs(overall_records, overall_outputs[sys_code])
        overall_scores[sys_code] = sc
        it = sc["items"]
        amt_pct = (sc["amount_correct"] / it * 100) if it else 0
        cat_pct = (sc["category_correct"] / it * 100) if it else 0
        nr_pct = (sc["needs_review"] / it * 100) if it else 0
        amt_str = f"{sc['amount_correct']}/{it} ({amt_pct:5.1f}%)"
        cat_str = f"{sc['category_correct']}/{it} ({cat_pct:5.1f}%)"
        nr_str = f"{sc['needs_review']}/{it} ({nr_pct:5.1f}%)"
        se_str = f"{sc['silent_error_count']}"
        report_lines.append(f"| {sys_code:<8} | {'ALL TAKES (COMBINED)':<23} | {it:<6} | {amt_str:<22} | {cat_str:<22} | {nr_str:<22} | {se_str:<13} |")
    report_lines.append("=" * 110)
    
    # ─── SILENT ERRORS LISTING ──────────────────────────────────────────────────
    report_lines.append("\n### SILENT ERRORS DETAILED BREAKDOWN (Status 'ok' but amount or category wrong):")
    for sys_code in systems:
        errs = overall_scores[sys_code]["silent_errors"]
        report_lines.append(f"\n>> System {sys_code}: {len(errs)} silent error(s)")
        if not errs:
            report_lines.append("   (None)")
        else:
            for e_idx, e in enumerate(errs, 1):
                report_lines.append(f"   [{e_idx}] Prompt ID: {e['promptId']}")
                report_lines.append(f"       Transcript: \"{e['transcript']}\"")
                report_lines.append(f"       Expected:   Amount={e['expected']['amount']}, Category='{e['expected']['category']}'")
                report_lines.append(f"       Extracted:  Amount={e['extracted']['amount']}, Category='{e['extracted']['category']}', Status='{e['extracted']['status']}'")
                report_lines.append(f"       Issues:     {', '.join(e['issues'])}")
                
    # ─── BOOTSTRAP OVER DISTINCT PHRASES ────────────────────────────────────────
    boot_res = bootstrap_phrase_differences(overall_scores["R"]["per_phrase"], overall_scores["G"]["per_phrase"])
    report_lines.append("\n" + "=" * 110)
    report_lines.append("PHRASE-LEVEL BOOTSTRAP ANALYSIS (Difference G vs R across distinct phrases):")
    report_lines.append("=" * 110)
    report_lines.append(f"Distinct Spoken Phrases:           {boot_res['num_phrases']} phrases (repeated across 3 takes = 36 total speech samples)")
    report_lines.append(f"Mean Difference in Silent Errors:  {boot_res['mean_diff_silent_errors']:+.4f} (95% CI: [{boot_res['ci_diff_silent_errors'][0]:+.4f}, {boot_res['ci_diff_silent_errors'][1]:+.4f}])")
    report_lines.append(f"Mean Difference in Needs Review:   {boot_res['mean_diff_needs_review']:+.4f} (95% CI: [{boot_res['ci_diff_needs_review'][0]:+.4f}, {boot_res['ci_diff_needs_review'][1]:+.4f}])")
    report_lines.append("\nNOTE ON STATISTICAL VALIDITY:")
    report_lines.append("  There are only 12 distinct phrases (spoken 3 times), recorded from a single speaker.")
    report_lines.append("  Consequently, these bootstrap results are descriptive of this specific sample,")
    report_lines.append("  not statistically confirmatory across diverse real-world agricultural field settings.")
    report_lines.append("=" * 110)
    
    # ─── SYNTHETIC VALIDATION SET GAP EVALUATION ────────────────────────────────
    val_path = base_dir / "data" / "val.json"
    if val_path.exists():
        with open(val_path, "r", encoding="utf-8") as f:
            val_samples = json.load(f)
            
        report_lines.append("\n" + "=" * 110)
        report_lines.append("SYNTHETIC VALIDATION SET GAP ANALYSIS (Showing synthetic vs real performance gap):")
        report_lines.append("=" * 110)
        
        # Evaluate R and L on synthetic validation set
        val_records = []
        for s in val_samples:
            val_records.append({
                "promptId": s["id"],
                "rawTranscript": s["sentence"],
                "expected": {"items": s["expected"]}
            })
            
        r_val_outs = extract_r_batch(val_records)
        l_val_outs = extract_l_batch(val_records)
        g_val_outs = extract_g_batch(r_val_outs, l_val_outs)
        
        r_val_score = score_system_outputs(val_records, r_val_outs)
        l_val_score = score_system_outputs(val_records, l_val_outs)
        g_val_score = score_system_outputs(val_records, g_val_outs)
        
        report_lines.append(f"| {'System':<8} | {'Dataset':<23} | {'Items':<6} | {'Amount Correct':<22} | {'Category Correct':<22} | {'Needs Review':<22} | {'Silent Errors':<13} |")
        report_lines.append("|" + "-"*10 + "|" + "-"*25 + "|" + "-"*8 + "|" + "-"*24 + "|" + "-"*24 + "|" + "-"*24 + "|" + "-"*15 + "|")
        
        for sys_code, sc in [("R", r_val_score), ("L", l_val_score), ("G", g_val_score)]:
            it = sc["items"]
            amt_pct = (sc["amount_correct"] / it * 100) if it else 0
            cat_pct = (sc["category_correct"] / it * 100) if it else 0
            nr_pct = (sc["needs_review"] / it * 100) if it else 0
            amt_str = f"{sc['amount_correct']}/{it} ({amt_pct:5.1f}%)"
            cat_str = f"{sc['category_correct']}/{it} ({cat_pct:5.1f}%)"
            nr_str = f"{sc['needs_review']}/{it} ({nr_pct:5.1f}%)"
            se_str = f"{sc['silent_error_count']}"
            report_lines.append(f"| {sys_code:<8} | {'Synthetic Validation':<23} | {it:<6} | {amt_str:<22} | {cat_str:<22} | {nr_str:<22} | {se_str:<13} |")
        report_lines.append("=" * 110)
        
    full_report_text = "\n".join(report_lines)
    print(full_report_text)
    
    with open(logs_dir / "e1-real-eval.txt", "w", encoding="utf-8") as f:
        f.write(full_report_text)
        
    print(f"\nReport written to {logs_dir / 'e1-real-eval.txt'}")


if __name__ == "__main__":
    force_run = "--force" in sys.argv
    run_evaluation(force=force_run)
