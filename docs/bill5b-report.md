# TASK BILL-5b: In-Depth Error Analysis & Wilson Intervals Report

**Date:** 2026-10-29  
**Execution Context:** Read-only analysis of `logs/bill-eval-development.json` and `logs/bill-eval-test.json`. Strictly zero modifications to parser, OCR, evaluation harnesses, test split, or lockfiles.

---

## 1. Disk Space & Environment Preconditions

- **D: Drive Free Space:** 4.79 GB (Requirement: > 1.0 GB)
- **Voice Service Integrity:** SHA-256 hashes of `shared/voice` verified identical.
- **Lockfile Check:** Real lockfile `logs/bill-eval-test.lock` untouched.

---

## 2. Item 1: Wilson Score Intervals for Both Splits & Date Outcome Definition

Wilson interval function imported directly from `bill-service/eval/eval_bills.py` (`from eval_bills import wilson_score_interval`).

### 2.1. Full Console Output for Development and Test Splits

```
=== DEVELOPMENT SPLIT (N=20) ===

--- OVERALL (N=20) ---
TOTALS:
  correct        :  9/20 ( 45.0%) 95% CI: [0.2582, 0.6579]
  silent wrong   :  0/20 (  0.0%) 95% CI: [0.0000, 0.1611]
  wrong flagged  :  6/20 ( 30.0%) 95% CI: [0.1455, 0.5190]
  no value       :  5/20 ( 25.0%) 95% CI: [0.1119, 0.4687]
DATES:
  correct        :  5/20 ( 25.0%) 95% CI: [0.1119, 0.4687]
  wrong flagged  :  1/20 (  5.0%) 95% CI: [0.0089, 0.2361]
  silent wrong   :  0/20 (  0.0%) 95% CI: [0.0000, 0.1611]
  no value       : 14/20 ( 70.0%) 95% CI: [0.4810, 0.8545]

--- Level 0 (N=5) ---
TOTALS:
  correct        :  3/ 5 ( 60.0%) 95% CI: [0.2307, 0.8824]
  silent wrong   :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  wrong flagged  :  1/ 5 ( 20.0%) 95% CI: [0.0362, 0.6245]
  no value       :  1/ 5 ( 20.0%) 95% CI: [0.0362, 0.6245]
DATES:
  correct        :  3/ 5 ( 60.0%) 95% CI: [0.2307, 0.8824]
  wrong flagged  :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  silent wrong   :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  no value       :  2/ 5 ( 40.0%) 95% CI: [0.1176, 0.7693]

--- Level 1 (N=5) ---
TOTALS:
  correct        :  2/ 5 ( 40.0%) 95% CI: [0.1176, 0.7693]
  silent wrong   :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  wrong flagged  :  2/ 5 ( 40.0%) 95% CI: [0.1176, 0.7693]
  no value       :  1/ 5 ( 20.0%) 95% CI: [0.0362, 0.6245]
DATES:
  correct        :  1/ 5 ( 20.0%) 95% CI: [0.0362, 0.6245]
  wrong flagged  :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  silent wrong   :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  no value       :  4/ 5 ( 80.0%) 95% CI: [0.3755, 0.9638]

--- Level 2 (N=5) ---
TOTALS:
  correct        :  2/ 5 ( 40.0%) 95% CI: [0.1176, 0.7693]
  silent wrong   :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  wrong flagged  :  1/ 5 ( 20.0%) 95% CI: [0.0362, 0.6245]
  no value       :  2/ 5 ( 40.0%) 95% CI: [0.1176, 0.7693]
DATES:
  correct        :  1/ 5 ( 20.0%) 95% CI: [0.0362, 0.6245]
  wrong flagged  :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  silent wrong   :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  no value       :  4/ 5 ( 80.0%) 95% CI: [0.3755, 0.9638]

--- Level 3 (N=5) ---
TOTALS:
  correct        :  2/ 5 ( 40.0%) 95% CI: [0.1176, 0.7693]
  silent wrong   :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  wrong flagged  :  2/ 5 ( 40.0%) 95% CI: [0.1176, 0.7693]
  no value       :  1/ 5 ( 20.0%) 95% CI: [0.0362, 0.6245]
DATES:
  correct        :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  wrong flagged  :  1/ 5 ( 20.0%) 95% CI: [0.0362, 0.6245]
  silent wrong   :  0/ 5 (  0.0%) 95% CI: [0.0000, 0.4345]
  no value       :  4/ 5 ( 80.0%) 95% CI: [0.3755, 0.9638]
=== TEST SPLIT (N=40) ===

--- OVERALL (N=40) ---
TOTALS:
  correct        : 21/40 ( 52.5%) 95% CI: [0.3750, 0.6706]
  silent wrong   :  1/40 (  2.5%) 95% CI: [0.0044, 0.1288]
  wrong flagged  : 10/40 ( 25.0%) 95% CI: [0.1419, 0.4019]
  no value       :  8/40 ( 20.0%) 95% CI: [0.1050, 0.3476]
DATES:
  correct        : 16/40 ( 40.0%) 95% CI: [0.2635, 0.5540]
  wrong flagged  :  2/40 (  5.0%) 95% CI: [0.0138, 0.1650]
  silent wrong   :  0/40 (  0.0%) 95% CI: [0.0000, 0.0876]
  no value       : 22/40 ( 55.0%) 95% CI: [0.3983, 0.6929]

--- Level 0 (N=10) ---
TOTALS:
  correct        :  7/10 ( 70.0%) 95% CI: [0.3968, 0.8922]
  silent wrong   :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
  wrong flagged  :  3/10 ( 30.0%) 95% CI: [0.1078, 0.6032]
  no value       :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
DATES:
  correct        :  7/10 ( 70.0%) 95% CI: [0.3968, 0.8922]
  wrong flagged  :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
  silent wrong   :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
  no value       :  3/10 ( 30.0%) 95% CI: [0.1078, 0.6032]

--- Level 1 (N=10) ---
TOTALS:
  correct        :  7/10 ( 70.0%) 95% CI: [0.3968, 0.8922]
  silent wrong   :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
  wrong flagged  :  2/10 ( 20.0%) 95% CI: [0.0567, 0.5098]
  no value       :  1/10 ( 10.0%) 95% CI: [0.0179, 0.4042]
DATES:
  correct        :  2/10 ( 20.0%) 95% CI: [0.0567, 0.5098]
  wrong flagged  :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
  silent wrong   :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
  no value       :  8/10 ( 80.0%) 95% CI: [0.4902, 0.9433]

--- Level 2 (N=10) ---
TOTALS:
  correct        :  5/10 ( 50.0%) 95% CI: [0.2366, 0.7634]
  silent wrong   :  1/10 ( 10.0%) 95% CI: [0.0179, 0.4042]
  wrong flagged  :  3/10 ( 30.0%) 95% CI: [0.1078, 0.6032]
  no value       :  1/10 ( 10.0%) 95% CI: [0.0179, 0.4042]
DATES:
  correct        :  4/10 ( 40.0%) 95% CI: [0.1682, 0.6873]
  wrong flagged  :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
  silent wrong   :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
  no value       :  6/10 ( 60.0%) 95% CI: [0.3127, 0.8318]

--- Level 3 (N=10) ---
TOTALS:
  correct        :  2/10 ( 20.0%) 95% CI: [0.0567, 0.5098]
  silent wrong   :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
  wrong flagged  :  2/10 ( 20.0%) 95% CI: [0.0567, 0.5098]
  no value       :  6/10 ( 60.0%) 95% CI: [0.3127, 0.8318]
DATES:
  correct        :  3/10 ( 30.0%) 95% CI: [0.1078, 0.6032]
  wrong flagged  :  2/10 ( 20.0%) 95% CI: [0.0567, 0.5098]
  silent wrong   :  0/10 (  0.0%) 95% CI: [0.0000, 0.2775]
  no value       :  5/10 ( 50.0%) 95% CI: [0.2366, 0.7634]
```

### 2.2. Date Outcome Definition from `eval_bills.py`

Verbatim code from `bill-service/eval/eval_bills.py` (lines 121–138):
```python
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
```

**Answer to specific question:**
*Is a date flagged `ambiguous_date` but with the right value counted as correct?*
**YES.** Under lines 134–135 (`if pred_date == true_date: return "correct"`), the equality check takes precedence over `is_flagged`. If the predicted ISO date string exactly matches the ground-truth date, it returns `"correct"`, regardless of whether `ambiguous_date` or other review flags are present in `reasons`.

---

## 3. Item 2: The 24 Non-Correct Test Dates

Table of all 24 non-correct test dates:

| Bill ID | Level | Predicted Date | Ground-Truth Date | Outcome | Reasons |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `bill_009` | L0 | `None` | 2025-09-25 | `no_value` | `['category_unsure', 'sum_mismatch']` |
| `bill_011` | L0 | `None` | 2025-01-18 | `no_value` | `['category_unsure', 'largest_amount_fallback', 'sum_mismatch']` |
| `bill_013` | L0 | `None` | 2025-07-19 | `no_value` | `['largest_amount_fallback']` |
| `bill_021` | L1 | `None` | 2025-06-26 | `no_value` | `['sum_mismatch']` |
| `bill_022` | L1 | `None` | 2025-06-21 | `no_value` | `['category_unsure', 'sum_mismatch']` |
| `bill_023` | L1 | `None` | 2026-11-15 | `no_value` | `['balance_due_used_as_total', 'category_unsure', 'sum_mismatch']` |
| `bill_025` | L1 | `None` | 2026-06-24 | `no_value` | `['category_unsure', 'largest_amount_fallback', 'sum_mismatch']` |
| `bill_027` | L1 | `None` | 2026-08-20 | `no_value` | `['category_unsure', 'largest_amount_fallback', 'sum_mismatch']` |
| `bill_028` | L1 | `None` | 2026-05-23 | `no_value` | `['category_unsure', 'sum_mismatch']` |
| `bill_029` | L1 | `None` | 2026-07-02 | `no_value` | `['category_unsure', 'largest_amount_fallback']` |
| `bill_030` | L1 | `None` | 2025-01-03 | `no_value` | `['category_unsure', 'conflicting_totals']` |
| `bill_037` | L2 | `None` | 2026-01-22 | `no_value` | `[]` |
| `bill_038` | L2 | `None` | 2026-04-08 | `no_value` | `['category_unsure', 'largest_amount_fallback', 'sum_mismatch']` |
| `bill_039` | L2 | `None` | 2026-03-23 | `no_value` | `['category_unsure', 'conflicting_totals']` |
| `bill_040` | L2 | `None` | 2025-05-20 | `no_value` | `[]` |
| `bill_043` | L2 | `None` | 2025-09-01 | `no_value` | `['category_unsure', 'sum_mismatch']` |
| `bill_045` | L2 | `None` | 2025-11-26 | `no_value` | `['balance_due_used_as_total', 'category_unsure', 'sum_mismatch']` |
| `bill_052` | L3 | 2028-05-02 | 2026-05-02 | `wrong_flagged` | `['ambiguous_date', 'balance_due_used_as_total', 'category_unsure', 'sum_mismatch']` |
| `bill_053` | L3 | `None` | 2025-02-02 | `no_value` | `['category_unsure', 'conflicting_totals']` |
| `bill_054` | L3 | `None` | 2025-02-07 | `no_value` | `['category_unsure', 'ocr_digit_confusion', 'sum_mismatch']` |
| `bill_055` | L3 | `None` | 2025-06-22 | `no_value` | `['category_unsure', 'ocr_digit_confusion', 'sum_mismatch']` |
| `bill_057` | L3 | `None` | 2025-01-17 | `no_value` | `['category_unsure', 'sum_mismatch']` |
| `bill_059` | L3 | `None` | 2025-04-03 | `no_value` | `['category_unsure', 'missing_total', 'total_missing']` |
| `bill_060` | L3 | 2025-12-18 | 2025-12-10 | `wrong_flagged` | `['category_unsure', 'conflicting_totals', 'ocr_digit_confusion']` |

### Breakdown of the 24 Non-Correct Dates:
- **Null (`no_value`): 22 bills (91.7%)** — The parser extracted no date (`date: null`). In bills like `bill_030`, `bill_038`, `bill_054`, `bill_059`, OCR misread digits (`@3-@1-25`, `8-84-26`, `O7 82/2025`), causing the strict date regexes to reject the token. In other bills, the date header was completely missing or omitted from OCR text.
- **Ambiguous date flagged: 1 bill (4.2%)** — `bill_052` has `'ambiguous_date'` in its review reasons.
- **OCR errors with wrong date string predicted: 2 bills (8.3%)** —
  - `bill_052`: Predicted `'2028-05-02'` vs GT `'2026-05-02'` (OCR read `2026` as `2028`).
  - `bill_060`: Predicted `'2025-12-18'` vs GT `'2025-12-10'` (OCR read day `10` as `18`).

---

## 4. Item 3: Analysis of Single Silent Total Error (`bill_040`)

### 4.1. OCR Text Lines Around Total
```
Line 1: LANKA IOC FUEL POINT Colombo Road, Polonnaruwa
Line 2: Tel: @27-2223840
Line 3: Total Items: 1 | Total Qty: 1 Subtotal LKR 9,500.00
Line 4: Discount (Less) -LKR 950.00
Line 5: TOTAL PAYABLE LKR 8,550.80
Line 6: THANK YOU! PLEASE COME AGAIN
```

### 4.2. Parsed Line Items with Amounts
```json
[]
```
Items count: **0** (no purchase line items parsed).

### 4.3. Sum-Check Inputs & Result
- `items`: `[]` (length 0)
- `total_val`: `8550.8` (from `TOTAL PAYABLE LKR 8,550.80`, misread by OCR from `8,550.00`)
- Condition evaluation:
  `if items and total_val is not None:` $\rightarrow$ **`False`**
- Result: **The sum check was completely skipped.**

### 4.4. Why the Sum Check Did Not Flag It (Code Quotation)
Verbatim code from `bill-service/parse_bill.py` (lines 732–738):
```python
    # 5. Check sum of items vs total
    if items and total_val is not None:
        items_sum = sum(Decimal(str(it["amount"])) for it in items)
        if items_sum != total_val:
            reasons.append("sum_mismatch")
            status = "needs_review"
```
**Exact reason:** Because `items` was an empty list (`[]`), the guard condition `if items and total_val is not None:` evaluated to `False`. The check `items_sum != total_val` was never executed. Furthermore, Line 3 (`Total Items: 1 | Total Qty: 1 Subtotal LKR 9,500.00`) was skipped during total extraction because it matched `NON_MONETARY_TOTAL_KEYWORDS` (`Total Items: 1`), leaving `subtotal_val = None`. Consequently, the subtotal-discount arithmetic check (`expected = base - discount`) was also bypassed. Finally, `is_total_grounded(Decimal('8550.80'), ocr_text)` evaluated to `True` because the exact string `"8,550.80"` was present in Line 5. Thus, `status` remained `"ok"` with `reasons: []`, yielding a silent error.

---

## 5. Item 4: Analysis of `bill_010`, `bill_025`, and `bill_043`

### 5.1. `bill_010` (Level 0)
- **Evaluation Result:** Total predicted = `8400.0`, GT = `16600.0`, Outcome = `wrong_flagged`, Reasons = `['largest_amount_fallback', 'sum_mismatch']`
- **OCR Text of Total Line and Line Before:**
  ```
  Line before total [5]: At 362 Seed Paddy 20kg 2 x 4,100.00 || 8,200.00
  Total line        [6]: Total Items: 2 | Total Qty: 5 TOTAL 16,600.00
  ```
- **Parser Candidate List:**
  - Rank 1 matches: `[]`
  - Rank 2 matches: `[]`
  - Rank 3 matches: `[]`
  - Fallback candidates: `[(Decimal('2800'), '2,800.00', 'Glyphosate Weedicide.. 3 x 2,800.00 || 8,400.00'), (Decimal('8400'), '8,400.00', 'Glyphosate Weedicide.. 3 x 2,800.00 || 8,400.00'), (Decimal('362'), '362', 'At 362 Seed Paddy 20kg 2 x 4,100.00 || 8,200.00'), (Decimal('4100'), '4,100.00', 'At 362 Seed Paddy 20kg 2 x 4,100.00 || 8,200.00'), (Decimal('8200'), '8,200.00', 'At 362 Seed Paddy 20kg 2 x 4,100.00 || 8,200.00')]`
- **Failure Cause:** Line 6 contains both `Total Items:` and `TOTAL 16,600.00`. The parser matched `NON_MONETARY_TOTAL_KEYWORDS` first and skipped the entire line, leaving Rank 2 empty. Fallback then selected the largest item amount (`8,400.00`), correctly flagged by `largest_amount_fallback` and `sum_mismatch`.

### 5.2. `bill_025` (Level 1)
- **Evaluation Result:** Total predicted = `4950.0`, GT = `20200.0`, Outcome = `wrong_flagged`, Reasons = `['category_unsure', 'largest_amount_fallback', 'sum_mismatch']`
- **OCR Text of Total Line and Line Before:**
  ```
  Line before total [5]: MOP Fertilizer 50kg
  Total line        [6]: 3 @ 4,800.00 each 14,400.00 Total Items: 3 | Total Qty: 7 BALANCE DUE 20,200.00 Cash Tendered 20,500.00
  ```
- **Parser Candidate List:**
  - Rank 1 matches: `[]`
  - Rank 2 matches: `[]`
  - Rank 3 matches: `[]`
  - Fallback candidates: `[(Decimal('850'), '850.00', '...'), (Decimal('850'), '850.00', '...'), (Decimal('1650.08'), '1,650.08', '...'), (Decimal('4950'), '4,950.00', '3 @ 1,650.08 each 4,950.00')]`
- **Failure Cause:** OCR merged the item row (`14,400.00`), the item count (`Total Items: 3`), the balance due (`BALANCE DUE 20,200.00`), and the tender (`Cash Tendered`) onto a single line. Because `Total Items:` was present, the entire line was skipped under `NON_MONETARY_TOTAL_KEYWORDS`. Fallback selected `4,950.00`, safely flagged with `largest_amount_fallback` and `sum_mismatch`.

### 5.3. `bill_043` (Level 2)
- **Evaluation Result:** Total predicted = `600.09`, GT = `12600.0`, Outcome = `wrong_flagged`, Reasons = `['category_unsure', 'sum_mismatch']`
- **OCR Text of Total Line and Line Before:**
  ```
  Line before total [4]: 3@ 1,200.00 each Rs .3, 600.00
  Total line        [5]: TOTAL PAYABLE Rs.12, 600.09
  ```
- **Parser Candidate List:**
  - Rank 1 matches: `[(Decimal('600.09'), '600.09', 'TOTAL PAYABLE Rs.12, 600.09')]`
  - Rank 2 matches: `[]`
  - Rank 3 matches: `[]`
  - Fallback candidates: `[(Decimal('4500'), '4,500.00', '...'), (Decimal('1200'), '1,200.00', '...'), (Decimal('600'), '600.00', '...')]`
- **Failure Cause:** OCR inserted a space after the thousands comma (`Rs.12, 600.09`) and misread `.00` as `.09`. The parser's amount regex treated `12,` as non-numeric and parsed `600.09` as the line amount. It matched Rank 1 (`TOTAL PAYABLE`), but because line items were parsed (`9000` and `600`), the sum check caught `9600 != 600.09` and safely flagged `sum_mismatch`.

---

## 6. Item 5: Log-Supported Stage Labels vs. Human Interpretation

In `logs/bill-eval-test.json`, the evaluation pipeline logs only machine fields: `status` (`"ok"` or `"needs_review"`) and specific programmatic reasons (`"largest_amount_fallback"`, `"conflicting_totals"`, `"total_not_in_ocr_text"`, `"ocr_digit_confusion"`, `"total_missing"`, `"sum_mismatch"`, `"category_unsure"`). Among the 19 stage labels in `docs/bill5-report.md`, only **"Grounding rejected"** is directly supported by a dedicated log flag (`"total_not_in_ocr_text"` on `bill_056` and `bill_058`). All other 17 failure stage labels—namely classifying cases into **"Wrong line picked"** versus **"OCR misread"**—are engineering interpretations derived from cross-referencing Tesseract's raw OCR text against the ground-truth annotations. For instance, the logs record `"largest_amount_fallback"` for `bill_010`, `bill_025`, and `bill_038` identically, but human inspection reveals that `bill_010` and `bill_025` failed due to layout suppression (`Total Items:` keyword skipping), whereas `bill_038` failed because OCR corrupted the balance due amount into non-numeric characters (`5,950.ee`). Similarly, `bill_040` has no log reasons at all (`reasons: []`), so labeling its failure as an "OCR misread" (`.00` read as `.80`) is entirely an interpretation established by manual text comparison.
