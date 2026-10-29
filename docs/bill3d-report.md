# TASK BILL-3d: Parser Fixes Driven by Development Errors

**Date:** 2026-10-29  
**Branch:** `feature/bill-scanner`  
**Evaluation Scope:** Development split ONLY (`bill-scan-data/synthetic/development`).  
> **Notice:** The development split was used for error diagnosis and tuning. Therefore, these performance metrics are development-set results, **NOT held-out test split results**. The held-out test split (`bill-scan-data/synthetic/test`) remained untouched and uninspected throughout this task, and `logs\bill-synth-test.lock` was not accessed.

---

## 1. Item-by-Item Status Table

| Item | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **0** | **Safety & Invariants:** Check D: free space (> 1 GB); do not touch test split/lock, voice, server, client; no commits | **DONE** | Free space: 4.787 GB before / 4.787 GB after. No touches to `server/`, `client/`, `shared/voice`, `so1-service/`, `voice-service/`, or test split. |
| **F1** | **Metadata Lines & Fallback Candidates:** Lines containing Tel, Phone, Mob, Hotline, Bill No, Invoice, Inv No, Reg, VAT No, Date, Time, or phone patterns never provide candidate totals or item amounts. Fallbacks require decimal part or currency marker (Rs, LKR, /=), else null with reason `total_missing` | **DONE** | Implemented `is_metadata_line()` and `is_valid_fallback_amount()` in `bill-service/parse_bill.py`. Unit test `test_f1_metadata_exclusion_and_fallback_candidate_rules` passes. |
| **F2** | **Total Precedence & Consistency:** Net Total / Grand Total / Amount Payable / Amount Due / Balance Due outrank Total, which outranks Subtotal. Accept chosen line only if arithmetic is consistent (subtotal - discount + tax + round = chosen total), or single top-ranked line without conflicting equal-rank line; else `conflicting_totals` and null. Update recorded A3 tests | **DONE** | Implemented total precedence ranking and exact decimal arithmetic in `bill-service/parse_bill.py`. Recorded A3 tests updated and passing: "Total 1200 / Discount 100 / Net Total 1100" now yields 1100; "Total 1200 / Net Total 1500" stays conflicting. Unit test `test_f2_total_precedence_and_arithmetic_consistency` passes. |
| **F3** | **Vendor Root Cause & General Fix:** Identify and paste root cause of vendor being null on clean bills (bill_001, bill_031). Fix generally: first non-numeric header lines before Tel or Date, case-insensitive, no filtering of words like STORES or CENTER | **DONE** | Root cause diagnosed and pasted below. Implemented robust header extraction in `extract_vendor()` in `bill-service/parse_bill.py`. Unit test `test_f3_vendor_header_extraction_clean_and_merged` passes. Vendor exact matches on dev split rose from 5/20 (25%) to 19/20 (95%). |
| **F4** | **Column Separators & Row Formats:** Strip "|" and "||" from descriptions; lines with Bill No, Tel, Date never provide item amounts; handle "qty @ price each \|\| amount" multi-line rows | **DONE** | Implemented separator stripping and multi-line row handling with `pending_desc` in `bill-service/parse_bill.py`. Unit test `test_f4_column_separators_and_qty_at_price_rows` passes. |
| **Eval** | **Before & After Table:** Re-run `eval_bills.py --split development` and paste table (silent errors first, correct totals, wrong flagged, no value, vendor exact, overall and by level) | **DONE** | Re-run logged in `logs/bill3d-eval-development.txt`. Silent errors: 0. Correct totals: 6 -> 9 (45%). Vendor exact: 5/20 -> 19/20 (95%). |
| **Verify** | **Verification:** bill-service pytest, `shared/voice` hashes, free disk space before and after | **DONE** | Pytest: 52 passed, 0 failed in 2.54s (`logs/bill3d-pytest.txt`). Voice hashes verified. Free disk space: 4.787 GB. |

---

## 2. Root Cause Analysis: Vendor Null on Clean Bills (F3)

### Pasted Root Cause
In `bill-service/parse_bill.py`, the previous `extract_vendor(text)` implementation checked candidate lines against a restrictive address regex:
```python
if re.search(r"\b(tel|phone|fax|mobile|p\.?o\.?|box|no|street|road|rd|st)\b", low):
    continue
```
On clean bills rendered in Layout 2 (such as `bill_001_deg0` and `bill_031_deg2`), Tesseract OCR grouped the store title and the physical street address onto a single header line:
- `bill_001`: `"NEW GAMINI HARDWARE STORES 33 Hospital Road, Tambuttegama"`
- `bill_031`: `"DAMBULLA AGRI INPUTS CENTER 88 Market Road, Dambulla"`

Because the string contained the address keyword `road` (and street numbers), the line filter discarded the entire vendor line. The subsequent header lines contained `Tel:` and `Date:`, which were also skipped. Consequently:
1. On bills with item lines, the loop picked the first line that lacked address keywords (e.g. item description `"Foot Valve 2 inch"` or `"Pump Repair Labour Charge"`).
2. On bills without subsequent eligible lines within the first 5 lines, `extract_vendor` returned `None` (`null`).

### General Fix Applied
`extract_vendor(text)` now collects the initial header block stopping strictly before lines containing `Tel:`, `Date:`, or phone numbers. For the top non-generic title line, it splits off trailing street addresses (matching patterns like `No. XX`, street names ending in `Road|Street|Highway|Avenue|Lane|Zone|Rd|St`, etc.), preserving the full store name without filtering domain nouns like `STORES`, `CENTER`, `SUPPLIES`, `MART`, or `AGRO`.

---

## 3. Changes to Recorded A3 Behavior (F2)

| Input Scenario | Previous Behavior (BILL-1e/f) | New Behavior (BILL-3d F2) | Explanation |
| :--- | :--- | :--- | :--- |
| `"Total 1200 / Discount 100 / Net Total 1100"` (`Date: 12/10/2026`) | `total = null`, `conflicting_totals` in reasons | `total = 1100.0`, `conflicting_totals` NOT in reasons | `Net Total` (Rank 1) outranks `Total` (Rank 2). Arithmetic check verifies that `Total (1200) - Discount (100) == Net Total (1100)`. Because the arithmetic is consistent, `Net Total (1100.0)` is accepted. |
| `"Total 1200 / Net Total 1500"` (`Date: 25/10/2026`) | `total = null`, `conflicting_totals` in reasons | `total = null`, `conflicting_totals` in reasons | `Net Total (1500)` outranks `Total (1200)`, but without a discount or tax line, `1200 != 1500`. Arithmetic is inconsistent, so the parser refuses to guess and flags `conflicting_totals`. |

---

## 4. Development Split Evaluation: BEFORE vs AFTER Table

> **Tuning Notice:** The development set (20 synthetic bills across 4 degradation levels) was used for diagnosis and tuning. These are development metrics, not held-out test set performance.

### Comparison Table

| Degradation Level | Metric | BEFORE (BILL-3c) | AFTER (BILL-3d) | Change |
| :--- | :--- | :--- | :--- | :--- |
| **Level 0 (Clean)** | Silent Total Errors (95% CI)<br>Correct Total (95% CI)<br>Wrong Value Flagged<br>No Value (Total Null)<br>Vendor Exact Match | 0 (0.0%, [0.0%, 43.5%])<br>2 (40.0%, [11.8%, 76.9%])<br>3 (60.0%)<br>0 (0.0%)<br>0 / 5 (0.0%) | 0 (0.0%, [0.0%, 43.5%])<br>3 (60.0%, [23.1%, 88.2%])<br>1 (20.0%)<br>1 (20.0%)<br>**5 / 5 (100.0%)** | 0.0%<br>+20.0%<br>-40.0%<br>+20.0%<br>+100.0% |
| **Level 1 (Slight Blur)** | Silent Total Errors (95% CI)<br>Correct Total (95% CI)<br>Wrong Value Flagged<br>No Value (Total Null)<br>Vendor Exact Match | 0 (0.0%, [0.0%, 43.5%])<br>2 (40.0%, [11.8%, 76.9%])<br>3 (60.0%)<br>0 (0.0%)<br>1 / 5 (20.0%) | 0 (0.0%, [0.0%, 43.5%])<br>2 (40.0%, [11.8%, 76.9%])<br>2 (40.0%)<br>1 (20.0%)<br>**5 / 5 (100.0%)** | 0.0%<br>0.0%<br>-20.0%<br>+20.0%<br>+80.0% |
| **Level 2 (Wrinkles/Faint)** | Silent Total Errors (95% CI)<br>Correct Total (95% CI)<br>Wrong Value Flagged<br>No Value (Total Null)<br>Vendor Exact Match | 0 (0.0%, [0.0%, 43.5%])<br>1 (20.0%, [3.6%, 62.5%])<br>4 (80.0%)<br>0 (0.0%)<br>0 / 5 (0.0%) | 0 (0.0%, [0.0%, 43.5%])<br>2 (40.0%, [11.8%, 76.9%])<br>1 (20.0%)<br>2 (40.0%)<br>**5 / 5 (100.0%)** | 0.0%<br>+20.0%<br>-60.0%<br>+40.0%<br>+100.0% |
| **Level 3 (Heavy Degradation)**| Silent Total Errors (95% CI)<br>Correct Total (95% CI)<br>Wrong Value Flagged<br>No Value (Total Null)<br>Vendor Exact Match | 0 (0.0%, [0.0%, 43.5%])<br>1 (20.0%, [3.6%, 62.5%])<br>3 (60.0%)<br>1 (20.0%)<br>4 / 5 (80.0%) | 0 (0.0%, [0.0%, 43.5%])<br>2 (40.0%, [11.8%, 76.9%])<br>2 (40.0%)<br>1 (20.0%)<br>**4 / 5 (80.0%)** | 0.0%<br>+20.0%<br>-20.0%<br>0.0%<br>0.0% |
| **OVERALL (N=20)** | **Silent Total Errors (95% CI)**<br>**Correct Total (95% CI)**<br>**Wrong Value Flagged**<br>**No Value (Total Null)**<br>**Vendor Exact Match** | **0 (0.0%, [0.0%, 16.1%])**<br>**6 (30.0%, [14.5%, 51.9%])**<br>**13 (65.0%)**<br>**1 (5.0%)**<br>**5 / 20 (25.0%)** | **0 (0.0%, [0.0%, 16.1%])**<br>**9 (45.0%, [25.8%, 65.8%])**<br>**6 (30.0%)**<br>**5 (25.0%)**<br>**19 / 20 (95.0%)** | **0.0%**<br>**+15.0%**<br>**-35.0%**<br>**+20.0%**<br>**+70.0%** |

### Key Takeaways from Evaluation
1. **Safety Maintained:** Silent total errors remained strictly at **0/20 (0.0%)**.
2. **Correctness Improved:** Correct total extractions increased from 6/20 (30%) to **9/20 (45%)**.
3. **Conservative Refusal:** Wrong flagged totals were cut by more than half (from 13 down to 6). Instead of picking phone numbers or invoice IDs as fallback totals, the parser conservatively set `total = null` with `total_missing` / review flags (no-value increased from 1 to 5).
4. **Vendor Recognition Fixed:** Exact vendor name matching increased from 5/20 (25%) to **19/20 (95%)** across the development set. The single un-extracted vendor was `bill_047_deg3`, where heavy Gaussian blur corrupted the store line into OCR noise (`182 Station Road, Mahe`).

---

## 5. Raw Command Outputs

### 5.1. Free Disk Space Before (`logs\bill3d-free-space.txt`)
```
        Used       Free FreeGB
        ----       ---- ------
316980850688 5139595264  4.787
```

### 5.2. Bill Service Pytest (`logs\bill3d-pytest.txt`)
```
....................................................                     [100%]
============================== warnings summary ===============================
.venv\Lib\site-packages\fastapi\testclient.py:1
  D:\Aswanna\bill-service\.venv\Lib\site-packages\fastapi\testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
52 passed, 1 warning in 2.54s
```

### 5.3. Development Split Evaluation Run (`logs\bill3d-eval-development.txt`)
```
[OUTPUT] Written detailed evaluation JSON to: D:\Aswanna\logs\bill-eval-development.json

==========================================================================================
ASWANNA BILL SCANNER EVALUATION SUMMARY (Split: development)
==========================================================================================
Level      N      Silent Tot Errs (95% CI)   Correct Tot (95% CI)     Vendor Exact
------------------------------------------------------------------------------------------
Level 0    5      0 (0.0%, [0.0%, 43.5%])    3 (60.0%, [23.1%, 88.2%]) 5/5         
Level 1    5      0 (0.0%, [0.0%, 43.5%])    2 (40.0%, [11.8%, 76.9%]) 5/5         
Level 2    5      0 (0.0%, [0.0%, 43.5%])    2 (40.0%, [11.8%, 76.9%]) 5/5         
Level 3    5      0 (0.0%, [0.0%, 43.5%])    2 (40.0%, [11.8%, 76.9%]) 4/5         
------------------------------------------------------------------------------------------
OVERALL    20     0 (0.0%, [0.0%, 16.1%])    9 (45.0%, [25.8%, 65.8%]) 19/20       
==========================================================================================
```

### 5.4. `shared/voice` Hashes (`logs\bill3d-voice-hashes.txt`)
```
9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02  asrConfusions.json
FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177  extractExpenses.js
B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7  keywordMap.json
27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D  parseCommand.js
EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38  sinhalaNumbers.js
6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687  sinhalaNumberWords.json
```

### 5.5. Free Disk Space After (`logs\bill3d-free-space-after.txt`)
```
        Used       Free FreeGB
        ----       ---- ------
316980903936 5139542016  4.787
```

---

## 6. Files Changed

1. `bill-service/parse_bill.py`:
   - Added metadata line detection (`is_metadata_line`) excluding Tel, Phone, Mob, Hotline, Bill No, Invoice, Inv No, Reg, VAT No, Date, Time, and phone patterns.
   - Added fallback candidate validation (`is_valid_fallback_amount`) requiring decimal part or currency marker (Rs, LKR, /=), setting `total_missing` when absent.
   - Implemented total precedence ranking (`RANK1_TOTAL_KEYWORDS`, `RANK2_TOTAL_KEYWORDS`, `RANK3_SUBTOTAL_KEYWORDS`) and exact cent arithmetic consistency checks.
   - Rewrote `extract_vendor` to take first non-numeric header line before Tel/Date, stripping attached street addresses without filtering words like STORES or CENTER.
   - Updated item extraction to strip `|` and `||` column separators, reject metadata lines from item amounts, and parse multi-line "qty @ price each || amount" row patterns.
2. `bill-service/tests/test_parse_bill.py`:
   - Updated the two recorded A3 tests for discount arithmetic and conflicting totals.
   - Added 4 dedicated unit tests with hand-written OCR text for F1, F2, F3, F4 (`test_f1_metadata_exclusion_and_fallback_candidate_rules`, `test_f2_total_precedence_and_arithmetic_consistency`, `test_f3_vendor_header_extraction_clean_and_merged`, `test_f4_column_separators_and_qty_at_price_rows`).

---

## 7. Assumptions Made

- **CONFIRM WITH DoA:** Rounding adjustments on paper receipts can be positive or negative cents (e.g. `Round off -0.05` or `Rounding +0.10`) and are integrated into the arithmetic consistency check when present.
- **CONFIRM WITH DoA:** Store header lines grouped with street addresses (e.g. `NEW GAMINI HARDWARE STORES 33 Hospital Road`) are split on standard postal address patterns (`No.`, street names ending in `Road`, `Street`, `Highway`, etc.) to isolate the trading vendor name.

---

## 8. Not Done / Risks

- Did not commit changes to Git.
- Did not run server or client test suites (per instruction: "Do NOT run the server or client suites in this task").
- Did not access or run evaluation on the test split (`bill-scan-data/synthetic/test`), and did not touch `logs\bill-synth-test.lock`.

---

## 9. Suggested Next Step

- When the research lead approves, execute TASK BILL-5 (final held-out test split evaluation using `eval_bills.py --split test`) to produce un-tuned, examination-ready benchmark numbers.
