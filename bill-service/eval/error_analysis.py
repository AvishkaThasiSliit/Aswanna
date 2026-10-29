import json
import re

with open("D:/Aswanna/logs/bill-eval-development.json", "r", encoding="utf-8") as f:
    d = json.load(f)

records = d["records"]

print(f"Total evaluated records: {len(records)}")
non_correct = [r for r in records if r["total"]["outcome"] != "correct"]
print(f"Non-correct total records: {len(non_correct)}\n")

for r in non_correct:
    b_id = r["id"]
    deg = r["degradation_level"]
    outcome = r["total"]["outcome"]
    pred = r["total"]["predicted"]
    gt = r["total"]["ground_truth"]
    reasons = r["reasons"]
    raw = r["raw_text"]

    # Locate true total in raw text
    # True total could appear as int or decimal
    gt_int = int(round(gt))
    gt_cents = int(round(gt * 100))

    # Find context around lines containing keywords or digits
    lines = raw.split("\n")
    matching_lines = []
    for idx, l in enumerate(lines):
        if any(w in l.lower() for w in ["total", "due", "balance", "net", "amount", "payable"]) or str(gt_int) in l or f"{gt:.2f}" in l:
            # show surrounding lines
            start = max(0, idx - 1)
            end = min(len(lines), idx + 2)
            for j in range(start, end):
                if lines[j] not in matching_lines:
                    matching_lines.append(lines[j])

    # Diagnose failing stage:
    # 1. OCR misread: true total digits don't appear in raw text at all
    # 2. Grounding rejected: total keyword found or candidate found, but grounding format rejected
    # 3. Wrong line / conflict rule: conflicting totals, net total vs total, or balance due
    gt_str_clean = str(gt_int)
    digits_found = gt_str_clean in raw.replace(",", "").replace(" ", "")

    failing_stage = "Unknown"
    if not digits_found:
        failing_stage = "OCR misread (true total digits distorted/absent in OCR text)"
    elif pred is None and "conflicting_totals" in reasons:
        failing_stage = "Conflict rule (multiple competing TOTAL/NET TOTAL lines detected)"
    elif pred is None and "balance_due_conflict" in reasons:
        failing_stage = "Conflict rule (BALANCE DUE vs TOTAL conflict)"
    elif pred is not None and abs(pred - gt) > 0.01:
        failing_stage = "Wrong line (picked subtotal, tendered cash, or line item instead of net total)"
    elif pred == gt:
        failing_stage = "Flagged review (correct total extracted, but whole receipt flagged for other reasons)"
    elif pred is None:
        failing_stage = "Grounding rejected or total keyword missed"

    print("=" * 80)
    print(f"BILL: {b_id} | Level: {deg} | Outcome: {outcome}")
    print(f"Predicted Total: {pred} | Ground Truth Total: {gt}")
    print(f"Flags/Reasons: {reasons}")
    print(f"Diagnosed Stage: {failing_stage}")
    print("OCR Text Context around Total/Keywords:")
    for ml in matching_lines[:6]:
        print(f"  > {ml}")
    print("=" * 80 + "\n")
