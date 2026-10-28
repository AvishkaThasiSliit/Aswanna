"""
Comparison Systems Interface: R, L, G (Task E1)
  R: Frozen rule-based extractor (called via Node.js bridge to extractExpenses)
  L: Learned extractor alone
  G: Gated: uses R's items, but marks needs_review ('learned_disagrees') whenever
     L disagrees on amount or category. NEVER promotes L's value over R's.
"""

import copy
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional

from learned_extract import extract_expenses_learned

BRIDGE_SCRIPT = Path(__file__).resolve().parent / "rule_bridge.mjs"


def extract_r_batch(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Runs frozen rule extractor on a batch of records via rule_bridge.mjs.
    records: list of dicts with 'transcript' and optional 'alternatives'.
    """
    payload = []
    for r in records:
        payload.append({
            "transcript": r.get("transcript") or r.get("rawTranscript") or "",
            "alternatives": r.get("alternatives") or []
        })
        
    proc = subprocess.run(
        ["node", str(BRIDGE_SCRIPT)],
        input=json.dumps(payload),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True
    )
    return json.loads(proc.stdout)


def extract_l_batch(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Runs learned extractor on a batch of records.
    """
    results = []
    for r in records:
        t = r.get("transcript") or r.get("rawTranscript") or ""
        alts = r.get("alternatives") or []
        res = extract_expenses_learned(t, alternatives=alts)
        results.append(res)
    return results


def extract_g_batch(r_results: List[Dict[str, Any]], l_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Gated extractor:
    Uses R's items unchanged, but marks status='needs_review' with reason 'learned_disagrees'
    whenever L disagrees on amount or category.
    Strict Invariant: NEVER promotes or overwrites R's amount or category with L's values.
    """
    g_results = []
    for r_res, l_res in zip(r_results, l_results):
        g_res = copy.deepcopy(r_res)
        r_items = g_res.get("items", [])
        l_items = l_res.get("items", [])
        
        # Check item count disagreement
        count_mismatch = len(r_items) != len(l_items)
        
        for idx, r_item in enumerate(r_items):
            disagrees = False
            
            if count_mismatch or idx >= len(l_items):
                disagrees = True
            else:
                l_item = l_items[idx]
                r_amt = r_item.get("totalAmount")
                l_amt = l_item.get("totalAmount")
                r_cat = r_item.get("category")
                l_cat = l_item.get("category")
                
                if r_amt != l_amt:
                    disagrees = True
                if r_cat != l_cat:
                    disagrees = True
                    
            if disagrees:
                if "learned_disagrees" not in r_item["reasons"]:
                    r_item["reasons"].append("learned_disagrees")
                r_item["status"] = "needs_review"
                
        g_results.append(g_res)
    return g_results
