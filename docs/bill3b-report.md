# TASK BILL-3b: Development Evaluation & Prerequisite Status Report

**Date:** 2026-10-29  
**Branch:** `feature/bill-scanner`  
**Prerequisite Status:** **FAILED / STOPPED** (`bill-scan-data/synthetic` does not exist on disk)

---

## 1. Item-by-Item Status Table

| Item | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **0. Safety Guard** | Free space check (> 1 GB), no pip > 300MB, no torch/paddle, protected dirs untouched, no commit | **DONE** | Free space: 4.794 GB (start) -> 4.793 GB (end); `shared/voice` verified against `freeze-v2-hashes.txt` (6/6 match); git branch uncommitted. |
| **Prerequisite Check** | Verify `bill-scan-data/synthetic` with development and test split exists. If not, stop and say so; do NOT generate bills | **STOPPED** | Verified `Test-Path D:\Aswanna\bill-scan-data` is `False`. Directory does not exist on disk. Stopped per instruction without generating bills. Teed to `logs\bill3b-prerequisite-check.txt`. |
| **1. Dataset Listing** | List `bill-scan-data` with `Get-ChildItem` (counts per split and level) and name development ground-truth file | **STOPPED** | `D:\Aswanna\bill-scan-data` does not exist (`False`). 0 files, 0 splits present. |
| **2. Tesseract Resolution** | Replace hard-coded path with `TESSERACT_CMD`, then `shutil.which("tesseract")`, else clear error in `eval_bills.py` and `ocr.py`. Show diff | **DONE** | [`bill-service/ocr.py`](file:///D:/Aswanna/bill-service/ocr.py#L7-L45) and [`bill-service/eval/eval_bills.py`](file:///D:/Aswanna/bill-service/eval/eval_bills.py#L29-L55) updated. Hardcoded paths removed. Diff provided below. |
| **3. Test Split Lock Tests** | Add unit tests for test-split lock using TEMPORARY logs directory (real `logs\bill-eval-test.lock` untouched): refuses when lock exists, creates on first run, `--force-new-run` overrides | **DONE** | 3 unit tests added to [`bill-service/tests/test_eval_bills.py`](file:///D:/Aswanna/bill-service/tests/test_eval_bills.py#L95-L130). All 48 tests passing (`logs\bill3b-pytest.txt`). Real lock confirmed absent (`False`). |
| **4. Service Dry Run** | Start service, send 3 development bills (levels 0, 2, 3), print OCR vs JSON vs GT side-by-side, latency table for all 20 development bills, stop service | **STOPPED** | Blocked by missing `bill-scan-data/synthetic` development split. Stopped per prerequisite instruction. |
| **5. Run Evaluation** | Run `eval_bills.py --split development`, paste summary table (silent total errors first with Wilson 95% CIs; by level and overall), give JSON path | **STOPPED** | Blocked by missing `bill-scan-data/synthetic` development split. Stopped per prerequisite instruction. |
| **6. Error Analysis** | For every wrong, flagged or missing total, show OCR around true total and diagnose stage (OCR misread, wrong line, grounding rejected, conflict rule) | **STOPPED** | Blocked by missing `bill-scan-data/synthetic` development split. Stopped per prerequisite instruction. |
| **7. Amount Representation** | Report how total and item amounts are represented in JSON (float or integer; rupees or cents). Do not change them | **DONE** | Documented in section 4: both `"total"` and `"items[].amount"` are serialized as **floats in Sri Lankan Rupees (LKR)**; internally calculated via integer cents via `Decimal`. |
| **8. Verification** | Do NOT run test split. Bill-service pytest (48), server (450) and client (126) real tails, voice hashes, free space before/after | **DONE** | All test suites passing. Real logs teed into `logs\bill3b-*.txt`. |

---

## 2. Prerequisite Check & Directory Evidence

Command:
```powershell
Write-Output 'Checking D:\Aswanna\bill-scan-data:'; Test-Path D:\Aswanna\bill-scan-data; Write-Output 'Checking D:\Aswanna\bill-scan-data\synthetic:'; Test-Path D:\Aswanna\bill-scan-data\synthetic
```
Output:
```
Checking D:\Aswanna\bill-scan-data:
False
Checking D:\Aswanna\bill-scan-data\synthetic:
False
```
**Conclusion:** `BILL-2a` output (`bill-scan-data/synthetic` with development and test splits) does not exist in the repository. Per the prompt requirement: *"If it does not, stop and say so; do NOT generate bills in this task."* Execution of dataset-dependent steps (Items 1, 4, 5, 6) is stopped.

---

## 3. Code Changes Diff (Item 2)

### Diff: `bill-service/ocr.py`
```diff
--- a/bill-service/ocr.py
+++ b/bill-service/ocr.py
@@ -7,10 +7,18 @@
-def get_tesseract_cmd() -> str:
-    return os.getenv("TESSERACT_CMD", "tesseract")
+def get_tesseract_cmd() -> Optional[str]:
+    """
+    Resolves Tesseract binary:
+    1. TESSERACT_CMD environment variable
+    2. shutil.which('tesseract')
+    3. None if not found
+    """
+    cmd = os.getenv("TESSERACT_CMD")
+    if cmd:
+        return cmd
+    return shutil.which("tesseract")

 def is_tesseract_available() -> bool:
     cmd = get_tesseract_cmd()
+    if not cmd:
+        return False
     if os.path.isabs(cmd):
         return os.path.exists(cmd) and os.path.isfile(cmd)
     return shutil.which(cmd) is not None
@@ -31,8 +39,9 @@
-    cmd = get_tesseract_cmd()
-    if not is_tesseract_available():
+    cmd = get_tesseract_cmd()
+    if not cmd or not is_tesseract_available():
         raise RuntimeError(
-            f"OCR_ENGINE_MISSING: Tesseract executable not found at '{cmd}'. "
+            f"OCR_ENGINE_MISSING: Tesseract executable not found. "
+            f"Searched TESSERACT_CMD environment variable and system PATH via shutil.which('tesseract'). "
             f"Please install Tesseract and set TESSERACT_CMD environment variable."
         )
```

### Diff: `bill-service/eval/eval_bills.py`
```diff
--- a/bill-service/eval/eval_bills.py
+++ b/bill-service/eval/eval_bills.py
@@ -29,6 +29,24 @@
-# Auto-configure Tesseract path if unset and standard Windows path exists
-if "TESSERACT_CMD" not in os.environ:
-    std_tess = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
-    if os.path.exists(std_tess):
-        os.environ["TESSERACT_CMD"] = std_tess
+import shutil
+
+def check_tesseract_engine() -> str:
+    """
+    Checks that Tesseract is discoverable via TESSERACT_CMD or shutil.which('tesseract'),
+    otherwise raises a clear RuntimeError.
+    """
+    cmd = os.getenv("TESSERACT_CMD")
+    if cmd:
+        if os.path.isabs(cmd) and os.path.isfile(cmd):
+            return cmd
+        if shutil.which(cmd):
+            return cmd
+        raise RuntimeError(
+            f"TESSERACT_CMD is set to '{cmd}', but executable was not found."
+        )
+    which_cmd = shutil.which("tesseract")
+    if which_cmd:
+        return which_cmd
+    raise RuntimeError(
+        "Tesseract executable not found. Searched TESSERACT_CMD environment variable and "
+        "system PATH via shutil.which('tesseract'). Please install Tesseract or set TESSERACT_CMD."
+    )
```

---

## 4. Representation of Total and Item Amounts (Item 7)

In `bill-service/parse_bill.py` and the API schema:
1. **Total Amount (`total`)**:
   - Represented as a **JSON float / number** in **Sri Lankan Rupees (LKR)** (e.g. `4500.0` or `1250.50`), or `null` if ungrounded/missing/conflicted.
   - Internally parsed as integer cents via `Decimal` (`(cents / 100).quantize(Decimal('0.01'))`) to prevent binary floating-point rounding errors during line item summation, then converted to `float(total_val)` at response serialization.
2. **Item Amount (`items[].amount`)**:
   - Represented as a **JSON float / number** in **Sri Lankan Rupees (LKR)** (e.g. `1200.0`, `450.0`).
   - Line items represent amounts in rupees, matching the canonical Aswanna schema defined in `docs/bill-scan-spec.md` (`amount: { type: 'number', description: 'Item expenditure in LKR (integer cents / 100)' }`).

---

## 5. Raw File Content from Verification Commands

### A. `logs\bill3b-pytest.txt` (48 passed)
```
============================= test session starts =============================
platform win32 -- Python 3.13.3, pytest-9.2.0, pluggy-1.7.0 -- D:\Aswanna\bill-service\.venv\Scripts\python.exe
cachedir: .pytest_cache
hypothesis profile 'default'
rootdir: D:\Aswanna\bill-service
plugins: anyio-4.15.1, hypothesis-6.170.13
collecting ... collected 48 items

tests/test_api.py::test_multipart_upload_spooling_evidence PASSED        [  2%]
tests/test_api.py::test_startup_token_check_raises_when_unset PASSED     [  4%]
tests/test_api.py::test_health_endpoint_no_auth PASSED                   [  6%]
tests/test_api.py::test_auth_rejection_missing_token PASSED              [  8%]
tests/test_api.py::test_auth_rejection_bad_token PASSED                  [ 10%]
tests/test_api.py::test_auth_acceptance_bearer_token PASSED              [ 12%]
tests/test_api.py::test_invalid_content_type_rejected PASSED             [ 14%]
tests/test_api.py::test_magic_bytes_validation_with_png_content_type PASSED [ 16%]
tests/test_api.py::test_malformed_content_length_returns_400 PASSED      [ 18%]
tests/test_api.py::test_negative_content_length_returns_400 PASSED       [ 20%]
tests/test_api.py::test_upload_limit_5mb_rejection PASSED                [ 22%]
tests/test_api.py::test_chunked_upload_no_content_length_succeeds PASSED [ 25%]
tests/test_api.py::test_chunked_upload_oversized_rejected_with_413 PASSED [ 27%]
tests/test_api.py::test_missing_tesseract_returns_http_503 PASSED        [ 29%]
tests/test_api.py::test_ocr_timeout_returns_http_504 PASSED              [ 31%]
tests/test_eval_bills.py::test_wilson_score_interval_bounds PASSED       [ 33%]
tests/test_eval_bills.py::test_silent_total_error_detection PASSED       [ 35%]
tests/test_eval_bills.py::test_date_outcomes PASSED                      [ 37%]
tests/test_eval_bills.py::test_vendor_normalisation_and_overlap PASSED   [ 39%]
tests/test_eval_bills.py::test_split_lock_creates_on_first_run PASSED    [ 41%]
tests/test_eval_bills.py::test_split_lock_refuses_when_lock_exists PASSED [ 43%]
tests/test_eval_bills.py::test_split_lock_force_new_run_overrides PASSED [ 45%]
tests/test_parse_bill.py::test_allowed_categories_matches_app_spec PASSED [ 47%]
tests/test_parse_bill.py::test_total_standard_comma_decimal PASSED       [ 50%]
tests/test_parse_bill.py::test_total_space_separated_with_rs PASSED      [ 52%]
tests/test_parse_bill.py::test_subtotal_vs_tax_vs_total PASSED           [ 54%]
tests/test_parse_bill.py::test_cash_change_exclusion PASSED              [ 56%]
tests/test_parse_bill.py::test_ambiguous_date PASSED                     [ 58%]
tests/test_parse_bill.py::test_unambiguous_date PASSED                   [ 60%]
tests/test_parse_bill.py::test_digit_confusion_detection PASSED          [ 62%]
tests/test_parse_bill.py::test_missing_total PASSED                      [ 64%]
tests/test_parse_bill.py::test_category_matching_and_allowed_list PASSED [ 66%]
tests/test_parse_bill.py::test_unknown_item_gets_other_and_category_unsure PASSED [ 68%]
tests/test_parse_bill.py::test_items_sum_mismatch PASSED                 [ 70%]
tests/test_parse_bill.py::test_grounding_whole_number_token_250_vs_12500 PASSED [ 72%]
tests/test_parse_bill.py::test_parser_ungrounded_total_rejected PASSED   [ 75%]
tests/test_parse_bill.py::test_total_qty_and_total_items_are_not_money PASSED [ 77%]
tests/test_parse_bill.py::test_discount_and_rounding_lines_excluded PASSED [ 79%]
tests/test_parse_bill.py::test_balance_due_vs_total_conflict PASSED      [ 81%]
tests/test_parse_bill.py::test_conflicting_totals PASSED                 [ 83%]
tests/test_parse_bill.py::test_qty_x_price_amount_row PASSED             [ 85%]
tests/test_parse_bill.py::test_sinhala_total_keyword PASSED              [ 87%]
tests/test_parse_bill.py::test_property_grounding_total_digits_must_exist PASSED [ 89%]
tests/test_parse_bill.py::test_grounding_formats_spec PASSED             [ 91%]
tests/test_parse_bill.py::test_conflicting_totals_record_behavior_discount_and_net_total PASSED [ 93%]
tests/test_parse_bill.py::test_conflicting_totals_record_behavior_total_and_net_total PASSED [ 95%]
tests/test_parse_bill.py::test_bill1f_grounding_whitespace_cases PASSED  [ 97%]
tests/test_parse_bill.py::test_field_independence_unambiguous_date_with_conflicting_total PASSED [100%]

============================== warnings summary ===============================
.venv\Lib\site-packages\fastapi\testclient.py:1
  D:\Aswanna\bill-service\.venv\Lib\site-packages\fastapi\testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
======================== 48 passed, 1 warning in 3.79s ========================
```

### B. `logs\bill3b-voice-hashes.txt`
```
9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02  asrConfusions.json
FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177  extractExpenses.js
B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7  keywordMap.json
27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D  parseCommand.js
EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38  sinhalaNumbers.js
6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687  sinhalaNumberWords.json
```

### C. `logs\bill3b-client-tests.txt` (Tail)
```
 Test Files  22 passed (22)
      Tests  126 passed (126)
   Start at  14:58:49
   Duration  68.27s (transform 15.66s, setup 30.01s, collect 94.48s, tests 40.98s, environment 132.76s, prepare 25.28s)
```

### D. `logs\bill3b-server-tests.txt` (Tail)
```
PASS tests/phase3.test.js (15.561 s)
PASS tests/voiceProxy.test.js (8.747 s)
PASS tests/datasetCollection.test.js (7.39 s)
PASS tests/voicePipelineRegression.test.js (7.15 s)
PASS tests/generativeNumberParser.test.js
PASS tests/logic.test.js
PASS tests/devVoiceCapture.test.js (5.071 s)
PASS tests/voiceExtract.test.js
PASS tests/coverage.test.js
PASS tests/sinhalaNumbers.test.js
PASS tests/voiceCommand.test.js
PASS tests/evalHarness.test.js
PASS tests/evaluatorMetrics.test.js
PASS tests/so1Contract.test.js
Test Suites: 20 passed, 20 total
Tests:       450 passed, 450 total
Snapshots:   0 total
Time:        218.039 s
Ran all test suites.
```

### E. `logs\bill3b-free-space.txt` (Start) and `logs\bill3b-free-space-after.txt` (End)
**Before:**
```
        Used       Free FreeGB
        ----       ---- ------
316973105152 5147340800  4.794
```
**After:**
```
        Used       Free FreeGB
        ----       ---- ------
316973969408 5146476544  4.793
```

---

## 6. Directory Listing Evidence of Log Files

Command output of `Get-ChildItem -Path D:\Aswanna\logs -Filter 'bill3b*'`:
```
    Directory: D:\Aswanna\logs

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----        10/29/2026   2:59 PM          15648 bill3b-client-tests.txt
-a----        10/29/2026   3:04 PM            105 bill3b-free-space-after.txt
-a----        10/29/2026   2:50 PM            105 bill3b-free-space.txt
-a----        10/29/2026   2:51 PM             10 bill3b-prerequisite-check.txt
-a----        10/29/2026   2:55 PM           4906 bill3b-pytest.txt
-a----        10/29/2026   3:04 PM          19159 bill3b-server-tests.txt
-a----        10/29/2026   2:58 PM            517 bill3b-voice-hashes.txt
```

---

## 7. Files Changed
1. [`bill-service/ocr.py`](file:///D:/Aswanna/bill-service/ocr.py): Clean resolution via `TESSERACT_CMD` then `shutil.which('tesseract')` without hardcoded fallbacks.
2. [`bill-service/eval/eval_bills.py`](file:///D:/Aswanna/bill-service/eval/eval_bills.py): Removed hard-coded fallback; added `check_tesseract_engine()`; extracted `enforce_test_split_lock(target_logs_dir)` supporting parameterized log directories.
3. [`bill-service/tests/test_eval_bills.py`](file:///D:/Aswanna/bill-service/tests/test_eval_bills.py): Added 3 unit tests verifying test split lock creation, refusal when lock exists, and `--force-new-run` override using `tmp_path`.
4. Verification logs:
   - [`logs/bill3b-free-space.txt`](file:///D:/Aswanna/logs/bill3b-free-space.txt)
   - [`logs/bill3b-free-space-after.txt`](file:///D:/Aswanna/logs/bill3b-free-space-after.txt)
   - [`logs/bill3b-prerequisite-check.txt`](file:///D:/Aswanna/logs/bill3b-prerequisite-check.txt)
   - [`logs/bill3b-pytest.txt`](file:///D:/Aswanna/logs/bill3b-pytest.txt)
   - [`logs/bill3b-voice-hashes.txt`](file:///D:/Aswanna/logs/bill3b-voice-hashes.txt)
   - [`logs/bill3b-client-tests.txt`](file:///D:/Aswanna/logs/bill3b-client-tests.txt)
   - [`logs/bill3b-server-tests.txt`](file:///D:/Aswanna/logs/bill3b-server-tests.txt)
5. Reports:
   - [`docs/bill3b-report.md`](file:///D:/Aswanna/docs/bill3b-report.md)
   - [`logs/bill3b-report.txt`](file:///D:/Aswanna/logs/bill3b-report.txt)

---

## 8. Assumptions Made
- In accordance with the prompt's explicit prerequisite (*"PREREQUISITE: BILL-2a output must exist in bill-scan-data/synthetic with a development and test split. If it does not, stop and say so; do NOT generate bills in this task"*), synthetic bills were not autonomously generated in this step.
- Tesseract discovery relies on `TESSERACT_CMD` environment variable or `PATH` via `shutil.which('tesseract')`.

---

## 9. Not Done / Risks
- **Items 1, 4, 5, 6**: Stopped per prerequisite rule because `bill-scan-data/synthetic` has not yet been generated.
- **Risk**: Without the dataset, empirical latency measurements and failure-stage diagnosis on degraded images cannot be obtained.

---

## 10. Suggested Next Step
- Execute `TASK BILL-2a` to generate the synthetic bill benchmark dataset into `bill-scan-data/synthetic` (with `development` and `test` splits and degradation levels 0, 1, 2, 3). Once generated, rerun `eval_bills.py --split development` to complete items 4, 5, and 6.
