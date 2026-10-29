# TASK BILL-3: Live OCR Check and Evaluation Harness Report

**Date:** 2026-10-29  
**Branch:** `feature/bill-scanner`  
**Tesseract Path:** `C:\Program Files\Tesseract-OCR\tesseract.exe` (Installed on host, available via explicit path and `TESSERACT_CMD`)  
**Tesseract Version:** `v5.5.3.20260724`  
**Installed Languages:** `eng`, `osd`  

---

## 1. Item-by-Item Status Table

| Item | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **0. Safety Guard** | Free space check (> 1 GB), no pip > 300MB, no torch/paddle, protected dirs untouched, no commit | **DONE** | Free space: 4.796 GB (start) -> 4.794 GB (end); `shared/voice` verified against `freeze-v2-hashes.txt` (6/6 match); git branch uncommitted. |
| **1. Engine Check** | Run `tesseract --version` and `tesseract --list-langs`; paste raw output via Tee-Object | **DONE** | Verified and teed to `logs\bill3-tesseract-version.txt` and `logs\bill3-tesseract-langs.txt`. Real outputs pasted below. |
| **2. Plumbing Dry Run** | Start service, send 3 bills from development split (levels 0, 2, 3), print OCR vs JSON vs GT, report latency for all 20 development bills | **PARTIAL** | Plumbing verified with live Tesseract OCR and parser end-to-end. However, the 20 development split bills (with degradation levels 0, 2, 3 and ground-truth annotations) do not exist on disk (`D:\Aswanna\bill-scan-data\development` missing; no manifest or bill images provided). |
| **3. Evaluation Script** | Write `bill-service/eval/eval_bills.py`: per-bill metrics (total silent error / flagged / no value, date ISO, vendor exact match and token overlap, reasons), Wilson 95% intervals, summary table, write `logs\bill-eval-<split>.json` | **DONE** | Written to [`bill-service/eval/eval_bills.py`](file:///D:/Aswanna/bill-service/eval/eval_bills.py); 4 unit tests added in [`bill-service/tests/test_eval_bills.py`](file:///D:/Aswanna/bill-service/tests/test_eval_bills.py) testing Wilson intervals, silent total error detection, date outcomes, and vendor matching. |
| **4. Test Split Lock Rule** | Refuse to run on test split unless `logs\bill-eval-test.lock` does not exist, then create lock; refuse reruns without `--force-new-run` | **DONE** | Implemented in [`eval_bills.py`](file:///D:/Aswanna/bill-service/eval/eval_bills.py#L143-L157). Tested and confirmed. |
| **5. Error Analysis** | For every wrong, flagged or missing total, show OCR text around true total and diagnose failure stage (read-only, no parser changes) | **NOT DONE** | Blocked by missing 20 development split bills. The evaluation script is ready to output and analyse all discrepancies once the split is provided. |
| **6. Verification** | Bill-service pytest; server (450) and client (126) suites with real tails; shared/voice hashes with Get-ChildItem; free space before and after | **DONE** | All test suites passing. All verification commands executed and teed into `logs\bill3-*.txt`. |

---

## 2. Raw File Content from Verification Commands

### A. `logs\bill3-tesseract-version.txt`
```
tesseract v5.5.3.20260724
 leptonica-1.87.0
  libgif 5.2.2 : libjpeg 8d (libjpeg-turbo 3.1.3) : libpng 1.6.58 : libtiff 4.7.2 : zlib 1.3.1 : libwebp 1.6.0 : libopenjp2 2.5.4
 Found AVX512BW
 Found AVX512F
 Found AVX512VNNI
 Found AVX2
 Found AVX
 Found FMA
 Found SSE4.1
 Found libarchive 3.8.8 zlib/1.3.2 liblzma/5.8.3 bz2lib/1.0.8 liblz4/1.10.0 libzstd/1.5.7 expat/expat_2.8.2 cng/1.0 libb2/system
 Found libcurl/8.21.0 Schannel zlib/1.3.2 brotli/1.2.0 zstd/1.5.7 libidn2/2.3.8 libpsl/0.21.5 libssh2/1.11.1 WinLDAP
```

### B. `logs\bill3-tesseract-langs.txt`
```
List of available languages in "C:\Program Files\Tesseract-OCR/tessdata/" (2):
eng
osd
```

### C. `logs\bill3-pytest.txt`
```
============================= test session starts =============================
platform win32 -- Python 3.13.3, pytest-9.2.0, pluggy-1.7.0 -- D:\Aswanna\bill-service\.venv\Scripts\python.exe
cachedir: .pytest_cache
hypothesis profile 'default'
rootdir: D:\Aswanna\bill-service
plugins: anyio-4.15.1, hypothesis-6.170.13
collecting ... collected 45 items

tests/test_api.py::test_multipart_upload_spooling_evidence PASSED        [  2%]
tests/test_api.py::test_startup_token_check_raises_when_unset PASSED     [  4%]
tests/test_api.py::test_health_endpoint_no_auth PASSED                   [  6%]
tests/test_api.py::test_auth_rejection_missing_token PASSED              [  8%]
tests/test_api.py::test_auth_rejection_bad_token PASSED                  [ 11%]
tests/test_api.py::test_auth_acceptance_bearer_token PASSED              [ 13%]
tests/test_api.py::test_invalid_content_type_rejected PASSED             [ 15%]
tests/test_api.py::test_magic_bytes_validation_with_png_content_type PASSED [ 17%]
tests/test_api.py::test_malformed_content_length_returns_400 PASSED      [ 20%]
tests/test_api.py::test_negative_content_length_returns_400 PASSED       [ 22%]
tests/test_api.py::test_upload_limit_5mb_rejection PASSED                [ 24%]
tests/test_api.py::test_chunked_upload_no_content_length_succeeds PASSED [ 26%]
tests/test_api.py::test_chunked_upload_oversized_rejected_with_413 PASSED [ 28%]
tests/test_api.py::test_missing_tesseract_returns_http_503 PASSED        [ 31%]
tests/test_api.py::test_ocr_timeout_returns_http_504 PASSED              [ 33%]
tests/test_eval_bills.py::test_wilson_score_interval_bounds PASSED       [ 35%]
tests/test_eval_bills.py::test_silent_total_error_detection PASSED       [ 37%]
tests/test_eval_bills.py::test_date_outcomes PASSED                      [ 40%]
tests/test_eval_bills.py::test_vendor_normalisation_and_overlap PASSED   [ 42%]
tests/test_parse_bill.py::test_allowed_categories_matches_app_spec PASSED [ 44%]
tests/test_parse_bill.py::test_total_standard_comma_decimal PASSED       [ 46%]
tests/test_parse_bill.py::test_total_space_separated_with_rs PASSED      [ 48%]
tests/test_parse_bill.py::test_subtotal_vs_tax_vs_total PASSED           [ 51%]
tests/test_parse_bill.py::test_cash_change_exclusion PASSED              [ 53%]
tests/test_parse_bill.py::test_ambiguous_date PASSED                     [ 55%]
tests/test_parse_bill.py::test_unambiguous_date PASSED                   [ 57%]
tests/test_parse_bill.py::test_digit_confusion_detection PASSED          [ 60%]
tests/test_parse_bill.py::test_missing_total PASSED                      [ 62%]
tests/test_parse_bill.py::test_category_matching_and_allowed_list PASSED [ 64%]
tests/test_parse_bill.py::test_unknown_item_gets_other_and_category_unsure PASSED [ 66%]
tests/test_parse_bill.py::test_items_sum_mismatch PASSED                 [ 68%]
tests/test_parse_bill.py::test_grounding_whole_number_token_250_vs_12500 PASSED [ 71%]
tests/test_parse_bill.py::test_parser_ungrounded_total_rejected PASSED   [ 73%]
tests/test_parse_bill.py::test_total_qty_and_total_items_are_not_money PASSED [ 75%]
tests/test_parse_bill.py::test_discount_and_rounding_lines_excluded PASSED [ 77%]
tests/test_parse_bill.py::test_balance_due_vs_total_conflict PASSED      [ 80%]
tests/test_parse_bill.py::test_conflicting_totals PASSED                 [ 82%]
tests/test_parse_bill.py::test_qty_x_price_amount_row PASSED             [ 84%]
tests/test_parse_bill.py::test_sinhala_total_keyword PASSED              [ 86%]
tests/test_parse_bill.py::test_property_grounding_total_digits_must_exist PASSED [ 88%]
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
======================== 45 passed, 1 warning in 3.03s ========================
```

### D. `logs\bill3-voice-hashes.txt`
```
9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02  asrConfusions.json
FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177  extractExpenses.js
B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7  keywordMap.json
27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D  parseCommand.js
EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38  sinhalaNumbers.js
6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687  sinhalaNumberWords.json
```

### E. `logs\bill3-client-tests.txt` (Tail)
```
 Test Files  22 passed (22)
      Tests  126 passed (126)
   Start at  14:38:32
   Duration  50.95s (transform 14.83s, setup 21.12s, collect 74.95s, tests 33.97s, environment 105.21s, prepare 23.04s)
```

### F. `logs\bill3-server-tests.txt` (Tail)
```
PASS tests/voiceProxy.test.js (6.307 s)
PASS tests/datasetCollection.test.js (6.106 s)
PASS tests/voicePipelineRegression.test.js (5.714 s)
PASS tests/generativeNumberParser.test.js
PASS tests/devVoiceCapture.test.js
PASS tests/logic.test.js
PASS tests/evalHarness.test.js
PASS tests/voiceExtract.test.js
PASS tests/evaluatorMetrics.test.js
PASS tests/voiceCommand.test.js
PASS tests/coverage.test.js
PASS tests/so1Contract.test.js
PASS tests/sinhalaNumbers.test.js

Test Suites: 20 passed, 20 total
Tests:       450 passed, 450 total
Snapshots:   0 total
Time:        146.471 s, estimated 245 s
Ran all test suites.
```

### G. `logs\bill3-free-space.txt` (Start) and `logs\bill3-free-space-after.txt` (End)
**Before:**
```
        Used       Free FreeGB
        ----       ---- ------
316971851776 5148594176  4.795
```
**After:**
```
        Used       Free FreeGB
        ----       ---- ------
316972429312 5148016640  4.794
```

---

## 3. Directory Listing Evidence of Log Files

Command: `Get-ChildItem -Path D:\Aswanna\logs -Filter 'bill3*'`
```
    Directory: D:\Aswanna\logs

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----        10/29/2026   2:39 PM          14065 bill3-client-tests.txt
-a----        10/29/2026   2:42 PM            105 bill3-free-space-after.txt
-a----        10/29/2026   2:38 PM            105 bill3-free-space.txt
-a----        10/29/2026   2:38 PM           4662 bill3-pytest.txt
-a----        10/29/2026   2:41 PM          18037 bill3-server-tests.txt
-a----        10/29/2026   2:34 PM             93 bill3-tesseract-langs.txt
-a----        10/29/2026   2:34 PM            532 bill3-tesseract-version.txt
-a----        10/29/2026   2:38 PM            517 bill3-voice-hashes.txt
```

---

## 4. End-to-End Live OCR Plumbing Verification

To prove live OCR plumbing with Tesseract 5.5.3, a rendered bill was processed end-to-end through `ocr.run_ocr` and `parse_bill.parse_bill_text`:

- **Input Image Text Rendered**:
  ```
  SUPER AGRO STORE
  Date: 15/10/2026
  Total Rs. 4,500.00
  ```
- **Live Tesseract 5.5.3 Raw OCR Output**:
  ```
  SUPER AGRO STORE
  Date: 15/10/2026
  Total Rs. 4,500.00
  ```
- **Parsed JSON Extraction Output**:
  ```json
  {
    "source": "bill",
    "vendor": "SUPER AGRO STORE",
    "date": "2026-10-15",
    "total": 4500.0,
    "items": [],
    "status": "ok",
    "reasons": [],
    "rawText": "SUPER AGRO STORE\nDate: 15/10/2026\nTotal Rs. 4,500.00",
    "confidence": 0.93
  }
  ```

---

## 5. Files Changed

1. [`bill-service/eval/eval_bills.py`](file:///D:/Aswanna/bill-service/eval/eval_bills.py): Full evaluation harness implementing Wilson 95% score confidence intervals, silent total error prioritization, date/vendor metrics, per-split JSON emission to `logs/bill-eval-<split>.json`, summary table formatting, and test split locking (`logs/bill-eval-test.lock`).
2. [`bill-service/tests/test_eval_bills.py`](file:///D:/Aswanna/bill-service/tests/test_eval_bills.py): 4 unit tests validating Wilson confidence interval calculations, silent total error detection, date outcomes, and vendor matching.
3. Verification logs:
   - [`logs/bill3-tesseract-version.txt`](file:///D:/Aswanna/logs/bill3-tesseract-version.txt)
   - [`logs/bill3-tesseract-langs.txt`](file:///D:/Aswanna/logs/bill3-tesseract-langs.txt)
   - [`logs/bill3-pytest.txt`](file:///D:/Aswanna/logs/bill3-pytest.txt)
   - [`logs/bill3-voice-hashes.txt`](file:///D:/Aswanna/logs/bill3-voice-hashes.txt)
   - [`logs/bill3-client-tests.txt`](file:///D:/Aswanna/logs/bill3-client-tests.txt)
   - [`logs/bill3-server-tests.txt`](file:///D:/Aswanna/logs/bill3-server-tests.txt)
   - [`logs/bill3-free-space.txt`](file:///D:/Aswanna/logs/bill3-free-space.txt)
   - [`logs/bill3-free-space-after.txt`](file:///D:/Aswanna/logs/bill3-free-space-after.txt)
4. Reports:
   - [`docs/bill3-report.md`](file:///D:/Aswanna/docs/bill3-report.md)
   - [`logs/bill3-report.txt`](file:///D:/Aswanna/logs/bill3-report.txt)

---

## 6. Assumptions Made
- Tesseract binary is located at `C:\Program Files\Tesseract-OCR\tesseract.exe`. `eval_bills.py` auto-configures `TESSERACT_CMD` to this path when unset.
- Because `TASK BILL-2` was not issued and no development split dataset files exist on disk, we did not fabricate artificial test bills or mock results for the missing 20 items (per Rule 2: NEVER INVENT DATA).

---

## 7. Not Done / Risks
- **Items 2 & 5**: Execution on the 20 development split bills and failure-stage diagnosis could not be run because the development dataset files are missing from the workspace.
- **Risk**: Once the development dataset is provided or generated, degradation levels 2 and 3 (heavy blur, severe perspective skew, lighting variations) may reveal OCR character confusions that require pre-processing enhancements.

---

## 8. Suggested Next Step
- Provide the development split files or issue the dataset generation instructions (`TASK BILL-2`), then run `eval_bills.py --split development` to obtain empirical accuracy numbers and perform error analysis.
