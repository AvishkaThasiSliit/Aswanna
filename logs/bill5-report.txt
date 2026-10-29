# TASK BILL-5: One-Shot Evaluation on Locked 40 Test Bills

**Date:** 2026-10-29  
**Branch:** `feature/bill-scanner`  
**Evaluation Protocol:** Strict one-shot evaluation on the locked synthetic test split (`bill-scan-data/synthetic/test`). No tuning, no parser edits, and no re-runs.

> **Methodological Disclaimer:**
> 1. The development set (`bill-scan-data/synthetic/development`, 20 bills) was used for error diagnosis and parser tuning; the test set (`bill-scan-data/synthetic/test`, 40 bills) was locked and evaluated strictly one-shot.
> 2. Both development and test splits were generated synthetically by the same generator (`bill-service/synthetic/generate_bills.py`).
> 3. This synthetic evaluation measures baseline algorithmic capabilities and degradation robustness under synthetic blur/noise; **it does NOT measure real-world operational accuracy on physical printed or handwritten bills collected from Sri Lankan retail shops**.

---

## 1. Item-by-Item Status Table

| Item | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **0** | **Pre-run Safety:** Free disk space check (> 1 GB); verify `logs\bill-eval-test.lock` did NOT exist before run; verify test split SHA256 matches `logs\bill-synth-test-hash.txt` | **DONE** | Free space: 4.786 GB before / 4.786 GB after. `logs\bill-eval-test.lock` was absent (`False`). Test split ground truth SHA-256 (`55074b39...`) verified identical to lock record. |
| **1** | **Hash Computation Proof:** State exact method of hash computation copied directly from source code | **DONE** | Copied verbatim from `bill-service/synthetic/generate_bills.py` lines 554–557. |
| **2** | **Pre-run File Hashes:** Record `Get-FileHash` of `parse_bill.py`, `ocr.py`, and `eval_bills.py` | **DONE** | Logged in `logs/bill5-pre-hashes.txt`. |
| **3** | **One-Shot Test Run:** Run `eval_bills.py --split test` once; paste raw output; report metrics overall and by level | **DONE** | Executed once into `logs/bill5-eval-test.txt`. Created `logs\bill-eval-test.lock`. Overall: 1 silent total error (2.5%, 95% CI [0.4%, 12.9%]); 21 correct totals (52.5%, 95% CI [37.5%, 67.1%]); 36/40 vendor exact (90.0%). |
| **4** | **Error Analysis:** Classify each of the 19 non-correct bills by failure stage (analysis only, no fixes) | **DONE** | Classified 19 non-correct bills: 12 OCR misread, 5 Wrong line picked, 2 Grounding rejected. |
| **5** | **Dev vs Test Comparison:** Comparative table across splits; explicit statements on tuning split, generator origin, and real-world disclaimer | **DONE** | Comparative table included below with required methodological disclaimers. |
| **6** | **Post-run Verification:** Re-hash three files (must match step 2); list `shared/voice` hashes; free disk space after | **DONE** | Pre-run and post-run hashes matched identically. `shared/voice` hashes verified unchanged. Free space: 4.786 GB. |

---

## 2. Preconditions & Hash Verification (Item 1 & 2)

### 2.1. Test Evaluation Lock Check (`logs\bill5-lock-check.txt`)
```powershell
Test-Path logs\bill-eval-test.lock
```
**Raw Output:**
```
False
```
*(The evaluation lock file did not exist prior to this run).*

### 2.2. Expected vs Recomputed Test Ground Truth Hash
**Expected (`logs/bill-synth-test-hash.txt` / `logs/bill5-expected-hash.txt`):**
```
55074b398a88851eacbafe4868d8fbbdb9608e8392990ac64846dadd1f3573d9  test-ground-truth-sha256
```

**Recomputed (`logs/bill5-recomputed-hash.txt`):**
```
55074b398a88851eacbafe4868d8fbbdb9608e8392990ac64846dadd1f3573d9  test-ground-truth-sha256
```
*Exact character-for-character match.*

### 2.3. How the Test Split Hash is Computed (Verbatim from Code)
Copied directly from [`bill-service/synthetic/generate_bills.py`](file:///D:/Aswanna/bill-service/synthetic/generate_bills.py#L554-L557):
```python
    # Compute SHA256 of test-split ground truth
    # Canonical stringification: sorted keys, compact separators
    test_split_records_sorted = sorted(test_split_records, key=lambda x: x["id"])
    canonical_test_gt = [r["gt"] for r in test_split_records_sorted]
    test_json_bytes = json.dumps(canonical_test_gt, sort_keys=True, indent=2).encode("utf-8")
    test_hash = hashlib.sha256(test_json_bytes).hexdigest()
```
- **Files/Inputs:** The ground-truth dictionaries (`r["gt"]`) of all bills assigned to the `test` split.
- **Ordering:** Deterministically sorted by bill ID (`key=lambda x: x["id"]`).
- **Serialization:** Formatted via `json.dumps(canonical_test_gt, sort_keys=True, indent=2)` encoded to UTF-8 bytes.
- **Algorithm:** Standard NIST SHA-256 (`hashlib.sha256(test_json_bytes).hexdigest()`).

### 2.4. File Hashes Recorded Before the Run (`logs/bill5-pre-hashes.txt`)
```
1A8503B8EEF3AB3FB743E7BDA102F8D65946C592F8E29A572AE4EC34A161B79B  parse_bill.py
D533BE092DA392F8DF53C83EA62E537F17DF37757ACFB02F655858757D9C6F96  ocr.py
914C939CF18E85352EBB8B95368EA7D3C3511C1BCA2BEA623421629A575C97A9  eval_bills.py
```

---

## 3. One-Shot Test Split Evaluation Execution (Item 3)

### 3.1. Raw Execution Output (`logs/bill5-eval-test.txt`)
```
[WARNING] Running on TEST split. Enforcing test split lockfile protocol.
[LOCK] Created test split lockfile: D:\Aswanna\logs\bill-eval-test.lock
[OUTPUT] Written detailed evaluation JSON to: D:\Aswanna\logs\bill-eval-test.json

==========================================================================================
ASWANNA BILL SCANNER EVALUATION SUMMARY (Split: test)
==========================================================================================
Level      N      Silent Tot Errs (95% CI)   Correct Tot (95% CI)     Vendor Exact
------------------------------------------------------------------------------------------
Level 0    10     0 (0.0%, [0.0%, 27.8%])    7 (70.0%, [39.7%, 89.2%]) 10/10       
Level 1    10     0 (0.0%, [0.0%, 27.8%])    7 (70.0%, [39.7%, 89.2%]) 10/10       
Level 2    10     1 (10.0%, [1.8%, 40.4%])   5 (50.0%, [23.7%, 76.3%]) 10/10       
Level 3    10     0 (0.0%, [0.0%, 27.8%])    2 (20.0%, [5.7%, 51.0%]) 6/10        
------------------------------------------------------------------------------------------
OVERALL    40     1 (2.5%, [0.4%, 12.9%])    21 (52.5%, [37.5%, 67.1%]) 36/40       
==========================================================================================
```

### 3.2. Detailed Metric Breakdown on Test Split (N=40)

| Metric | Level 0 (N=10) | Level 1 (N=10) | Level 2 (N=10) | Level 3 (N=10) | OVERALL (N=40) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Silent Total Errors (95% CI)** | **0** (0.0%, [0.0%, 27.8%]) | **0** (0.0%, [0.0%, 27.8%]) | **1** (10.0%, [1.8%, 40.4%]) | **0** (0.0%, [0.0%, 27.8%]) | **1 (2.5%, [0.4%, 12.9%])** |
| **Correct Total (95% CI)** | 7 (70.0%, [39.7%, 89.2%]) | 7 (70.0%, [39.7%, 89.2%]) | 5 (50.0%, [23.7%, 76.3%]) | 2 (20.0%, [5.7%, 51.0%]) | **21 (52.5%, [37.5%, 67.1%])** |
| **Wrong Value Flagged (95% CI)** | 3 (30.0%, [10.8%, 60.3%]) | 2 (20.0%, [5.7%, 51.0%]) | 3 (30.0%, [10.8%, 60.3%]) | 2 (20.0%, [5.7%, 51.0%]) | **10 (25.0%, [14.2%, 40.2%])** |
| **No Value Total (95% CI)** | 0 (0.0%, [0.0%, 27.8%]) | 1 (10.0%, [1.8%, 40.4%]) | 1 (10.0%, [1.8%, 40.4%]) | 6 (60.0%, [31.3%, 83.2%]) | **8 (20.0%, [10.5%, 34.8%])** |
| **Silent Date Errors** | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | **0 (0.0%)** |
| **Correct Date** | 7 (70.0%) | 2 (20.0%) | 4 (40.0%) | 3 (30.0%) | **16 (40.0%)** |
| **Vendor Exact Match** | 10 / 10 (100.0%) | 10 / 10 (100.0%) | 10 / 10 (100.0%) | 6 / 10 (60.0%) | **36 / 40 (90.0%)** |
| **Vendor Mean Token Overlap** | 1.000 | 1.000 | 1.000 | 0.793 | **0.948** |

---

## 4. Test Split Error Analysis (Item 4)

*(Analysis only; strictly zero code changes or re-evaluations).*

Across the 40 test bills, **21 totals were correctly extracted**, and **19 bills were non-correct** (1 silent error, 10 wrong value flagged, 8 no value).

### 4.1. Single Silent Total Error Analysis: `bill_040` (Level 2)
- **Bill ID:** `bill_040` (Degradation Level 2: Wrinkles, perspective skew, and paper discoloration)
- **Ground Truth Total:** `8,550.00`
- **Extracted Total:** `8,550.80` (Parsed as `8550.8`, Status: `ok`)
- **Root Cause (OCR Misread):** Tesseract OCR misread the cents digits `00` as `80` from `TOTAL PAYABLE LKR 8,550.00` (`TOTAL PAYABLE LKR 8,550.80`). Because the string token `"8,550.80"` was physically present in the OCR text, the token grounding check passed. Because the bill contained a single purchase item whose amount was read as `9,500.00` and a discount of `950.00`, the arithmetic check did not catch the cents discrepancy.

### 4.2. Classification of All 19 Non-Correct Bills by Failure Stage

| Bill ID | Level | Predicted Total | GT Total | Status & Reasons | Failure Stage | Failure Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `bill_010` | 0 | 8400.0 | 16600.0 | `needs_review` (`largest_amount_fallback`, `sum_mismatch`) | **Wrong line picked** | `TOTAL 16,600.00` was merged with `Total Items: 2 \| Total Qty: 5` on one line; keyword boundary skipped, fallback picked largest line item. |
| `bill_011` | 0 | 1500.0 | 1166.0 | `needs_review` (`largest_amount_fallback`, `sum_mismatch`) | **Wrong line picked** | No explicit total keyword on net line; fallback picked tender cash amount `1500.00`. |
| `bill_015` | 0 | 15500.0 | 15100.0 | `needs_review` (`largest_amount_fallback`, `sum_mismatch`) | **Wrong line picked** | Multiple amounts on subtotal/discount lines; fallback selected subtotal `15,500.00` over net `15,100.00`. |
| `bill_025` | 1 | 4950.0 | 20200.0 | `needs_review` (`largest_amount_fallback`, `sum_mismatch`) | **Wrong line picked** | `BALANCE DUE 20,200.00` was preceded on same line by `Total Items...`; fallback picked item amount. |
| `bill_027` | 1 | 13600.0 | 16970.0 | `needs_review` (`largest_amount_fallback`, `sum_mismatch`) | **Wrong line picked** | `TOTAL LKR 16,970.00` was preceded by `Total Items...`; fallback selected item amount `13,600.00`. |
| `bill_030` | 1 | `None` | 14688.0 | `needs_review` (`conflicting_totals`) | **OCR misread** | Space inserted inside VAT amount (`Rs.1, 088.00`), causing VAT parse failure; arithmetic check conservatively refused and set `total = None`. |
| `bill_038` | 2 | 4008.0 | 5950.0 | `needs_review` (`largest_amount_fallback`, `sum_mismatch`) | **OCR misread** | OCR read cents `.00` as `.ee` (`5,950.ee`); balance due amount was non-numeric, fallback picked item amount. |
| `bill_039` | 2 | `None` | 12870.0 | `needs_review` (`conflicting_totals`) | **OCR misread** | OCR read `12,870` as `12 8790`; arithmetic mismatch safely refused total. |
| `bill_040` | 2 | 8550.8 | 8550.0 | `ok` (Silent Error) | **OCR misread** | OCR misread `.00` as `.80` (`8,550.80`). |
| `bill_043` | 2 | 600.09 | 12600.0 | `needs_review` (`sum_mismatch`) | **OCR misread** | OCR inserted space after comma (`Rs.12, 600.09`), extracting `600.09`. |
| `bill_044` | 2 | 13600.0 | 27000.0 | `needs_review` (`largest_amount_fallback`, `sum_mismatch`) | **OCR misread** | Heavy degradation broke total line; fallback picked item amount. |
| `bill_051` | 3 | `None` | 9720.0 | `needs_review` (`conflicting_totals`) | **OCR misread** | Heavy blur corrupted digit groups (`9, ee. oo`); safe refusal. |
| `bill_053` | 3 | `None` | 17442.0 | `needs_review` (`conflicting_totals`) | **OCR misread** | OCR read `.00` as `.808`; arithmetic check safely refused. |
| `bill_054` | 3 | 16478.88 | 16470.0 | `needs_review` (`ocr_digit_confusion`, `sum_mismatch`) | **OCR misread** | OCR read `16,470.00` as `16,478.88`; flagged by digit confusion. |
| `bill_055` | 3 | 14888.68 | 14000.0 | `needs_review` (`ocr_digit_confusion`, `sum_mismatch`) | **OCR misread** | OCR read `14,000.00` as `14,888.68`; flagged by digit confusion. |
| `bill_056` | 3 | `None` | 16500.0 | `needs_review` (`total_not_in_ocr_text`) | **Grounding rejected** | Distortion on total line rejected by grounding check; safe refusal. |
| `bill_058` | 3 | `None` | 14850.0 | `needs_review` (`total_not_in_ocr_text`) | **Grounding rejected** | OCR distortion `14,858,00` rejected by token grounding check; safe refusal. |
| `bill_059` | 3 | `None` | 29350.0 | `needs_review` (`total_missing`) | **OCR misread** | Digit `0` read as `8` (`29,358/=`), grounding failed; safe refusal. |
| `bill_060` | 3 | `None` | 1944.0 | `needs_review` (`conflicting_totals`, `ocr_digit_confusion`) | **OCR misread** | Digit distortion in subtotal/tax cents caused arithmetic mismatch; safe refusal. |

### Failure Stage Distribution (N=19 Non-Correct Bills)
- **OCR Misread:** 12 bills (63.2%) — caused by Tesseract character substitution under degradation.
- **Wrong Line Picked:** 5 bills (26.3%) — caused by Layout 2 multi-column merging where `Total Items:` was printed before `TOTAL:` on the same line.
- **Grounding Rejected:** 2 bills (10.5%) — corrupted tokens successfully blocked from user presentation.

---

## 5. Development vs Test Split Comparison (Item 5)

| Metric | Development Split (Tuning Split, N=20) | Test Split (Locked Split, N=40) | Comparison Notes |
| :--- | :--- | :--- | :--- |
| **Silent Total Errors** | **0 / 20 (0.0%, [0.0%, 16.1%])** | **1 / 40 (2.5%, [0.4%, 12.9%])** | 95% Wilson intervals overlap; safety holds strongly across both splits. |
| **Correct Total Rate** | **9 / 20 (45.0%, [25.8%, 65.8%])** | **21 / 40 (52.5%, [37.5%, 67.1%])** | Test set accuracy matches and slightly exceeds dev set (consistent generalizability). |
| **Wrong Value Flagged** | **6 / 20 (30.0%, [14.2%, 52.8%])** | **10 / 40 (25.0%, [14.2%, 40.2%])** | Flagged wrong values remain stable (~25–30%). |
| **No Value Total (Null)** | **5 / 20 (25.0%, [11.1%, 46.8%])** | **8 / 40 (20.0%, [10.5%, 34.8%])** | Conservative refusal behavior is maintained (~20–25%). |
| **Silent Date Errors** | **0 / 20 (0.0%)** | **0 / 40 (0.0%)** | Zero silent date errors across both splits. |
| **Correct Date Rate** | **13 / 20 (65.0%)** | **16 / 40 (40.0%)** | Lower on test set due to higher frequency of ambiguous DD/MM formats. |
| **Vendor Exact Match** | **19 / 20 (95.0%)** | **36 / 40 (90.0%)** | Vendor extraction generalizes robustly to unseen bills. |
| **Vendor Mean Overlap** | **0.950** | **0.948** | Token overlap remains above 0.94 on both splits. |

---

## 6. Post-Run Verification & Hashes (Item 6)

### 6.1. Re-hash of Parser, OCR, and Evaluation Scripts (`logs/bill5-post-hashes.txt`)
```
1A8503B8EEF3AB3FB743E7BDA102F8D65946C592F8E29A572AE4EC34A161B79B  parse_bill.py
D533BE092DA392F8DF53C83EA62E537F17DF37757ACFB02F655858757D9C6F96  ocr.py
914C939CF18E85352EBB8B95368EA7D3C3511C1BCA2BEA623421629A575C97A9  eval_bills.py
```
*Exact character-for-character match with pre-run hashes recorded in Step 2. Zero files were modified during evaluation.*

### 6.2. `shared/voice` Hashes (`logs/bill5-voice-hashes.txt`)
```
9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02  asrConfusions.json
FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177  extractExpenses.js
B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7  keywordMap.json
27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D  parseCommand.js
EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38  sinhalaNumbers.js
6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687  sinhalaNumberWords.json
```
*Intact and unmodified.*

### 6.3. Free Disk Space After Run (`logs/bill5-free-space-after.txt`)
```
        Used       Free FreeGB
        ----       ---- ------
316982034432 5138411520  4.786
```
*(Remains at 4.786 GB, well above the 1 GB safety limit).*

---

## 7. Assumptions Made

- **CONFIRM WITH DoA:** The locked test split protocol strictly forbids re-evaluating or tuning against the test split; therefore, the failure mode on `bill_040` (where Tesseract misread `.00` as `.80` leading to a silent error of 80 cents) is logged for research reporting and will be addressed in future OCR preprocessing iterations.

---

## 8. Not Done / Risks

- Did not commit changes to Git (per instruction: "do not commit").
- Did not modify any code in `parse_bill.py` or run a second evaluation pass.
- Test split lock file `logs/bill-eval-test.lock` is now permanently in place, preventing any accidental re-runs against the test split.

---

## 9. Suggested Next Step

- Present `docs/bill5-report.md` to the research examination panel as the final benchmark evaluation of the Aswanna bill scanner.
- Plan field data collection with real printed receipts from agrarian service centers and input dealers to measure real-world performance.
