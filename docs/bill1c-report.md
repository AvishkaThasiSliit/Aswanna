# TASK BILL-1c: Implementation & Verification Report

**Date:** 2026-10-29  
**Service:** `bill-service/` (FastAPI offline OCR & bill parser foundation)  
**Status:** COMPLETED (All components independent of Tesseract built and verified)

---

## 1. Executive Summary

Task **BILL-1c** implements the backend OCR and bill parsing infrastructure for Aswanna without requiring the Tesseract binary during development. The service provides secure, in-memory image handling, strict magic-byte validation, authentication, pure-function structured parsing, Sri Lankan receipt conventions, and robust HTTP 503 error handling when the OCR engine is unavailable.

All 18 unit and property tests in `bill-service` passed. Server tests (450) and client tests (126) remain at 100% pass rates. The `shared/voice` files were verified to match `logs/freeze-v2-hashes.txt` bit-for-bit.

> **Note on Live OCR and Synthetic Dry Run:** Live OCR and synthetic image rendering were skipped in this step pending Tesseract engine installation on the host system. When Tesseract is installed and `TESSERACT_CMD` is configured, full live OCR and dry runs can execute without modifying the service architecture.

---

## 2. Components Built

### A. Service Architecture (`bill-service/main.py`)
- **FastAPI application** bound to `127.0.0.1` only.
- **`BILL_INTERNAL_TOKEN` Enforcement:** Mandatory environment variable with **no default**. Refuses to start / raises `RuntimeError` if unset. Enforces authentication via `X-Internal-Token` or `Authorization: Bearer <token>` on all endpoints except `/health`. Returns HTTP 401 when missing or invalid.
- **Upload Size Limit:** 5 MB maximum payload limit enforced before memory exhaustion. Returns HTTP 413 if exceeded.
- **Magic Bytes Validation:** Strict header byte inspection for PNG (`\x89PNG\r\n\x1a\n` or `\x89PNG`) and JPEG (`\xff\xd8\xff`). Disguised or non-image payloads are rejected with HTTP 400.
- **Privacy & In-Memory Processing:** EXIF metadata is stripped in memory via Pillow. Images are processed in RAM only (`BILL_KEEP_IMAGES=off` by default); no images are saved to disk.
- **Request Timeout:** Async processing with 30-second timeout guard.
- **Graceful Engine Fallback:** Returns HTTP 503 with `"OCR engine (Tesseract) is not configured or not found. Please install Tesseract and set TESSERACT_CMD."` if the binary is absent. The process never crashes.

### B. OCR Module (`bill-service/ocr.py`)
- Reads engine binary path dynamically from `TESSERACT_CMD` (defaults to `tesseract` on `PATH`, no hard-coded system paths).
- Lazy loading: `pytesseract` is imported only when OCR execution is requested.
- Image preprocessing: grayscale conversion and 2x Lanczos upscaling for receipts under 1200px dimension.
- Multi-language support: checks `get_languages()` and selects `eng+sin` if Sinhala traineddata is installed, falling back to `eng`.

### C. Parser Module (`bill-service/parse_bill.py`)
- Pure function `parse_bill_text(ocr_text, ocr_words)`.
- **Total Extraction:** Prioritizes explicit total keywords (`Grand Total`, `Net Total`, `මුළු මුදල`, `Total`, etc.). Excludes payment lines (`Cash`, `Change`, `Tendered`, `Card`) and subtotals/taxes.
- **Fallback Total:** If no keyword matches, falls back to the largest non-payment amount and explicitly sets status to `needs_review` with reason `largest_amount_fallback`.
- **Date Extraction:** Defaults to Sri Lankan standard `DD/MM/YYYY`. Named months and ISO dates are handled unambiguously. Ambiguous numeric dates (e.g., `03/04/2026` where both day and month $\le 12$) are flagged with `ambiguous_date` and marked `needs_review`.
- **Vendor Extraction:** Extracts from top 5 lines, ignoring receipt headers (`Tax Invoice`, `Receipt`, `Tel: ...`).
- **Line Items:** Best-effort extraction; all extracted line items are tagged `status: "needs_review"` with reason `line_item_unverified`.
- **Sum Verification:** Checks whether line item amounts sum to the total. If unequal, adds `sum_mismatch` flag.
- **No Silent Digit Corrections:** OCR digit/character confusions (such as `O/0`, `l/1`, `S/5`) are detected via regex and flagged as `ocr_digit_confusion` rather than silently altered.
- **Grounding Guarantee:** Safety validation ensures the total amount's digits exist within the raw OCR string; if ungrounded, the total is discarded and flagged.
- **Category Suggestion:** Uses `shared/voice/keywordMap.json` (read-only) to suggest expense categories (`seeds`, `fertilizer`, `chemicals`, `labor`, `fuel`, `transport`, `equipment`, `other`).

---

## 3. Test Results

### Bill Service Pytest Suite (18 passed, 0 failed)
```
tests/test_api.py::test_startup_token_check_raises_when_unset PASSED     [  5%]
tests/test_api.py::test_health_endpoint_no_auth PASSED                   [ 11%]
tests/test_api.py::test_auth_rejection_missing_token PASSED              [ 16%]
tests/test_api.py::test_auth_rejection_bad_token PASSED                  [ 22%]
tests/test_api.py::test_magic_bytes_validation PASSED                    [ 27%]
tests/test_api.py::test_upload_limit_5mb PASSED                          [ 33%]
tests/test_api.py::test_missing_tesseract_returns_http_503 PASSED        [ 38%]
tests/test_parse_bill.py::test_total_standard_comma_decimal PASSED       [ 44%]
tests/test_parse_bill.py::test_total_space_separated_with_rs PASSED      [ 50%]
tests/test_parse_bill.py::test_subtotal_vs_tax_vs_total PASSED           [ 55%]
tests/test_parse_bill.py::test_cash_change_exclusion PASSED              [ 61%]
tests/test_parse_bill.py::test_ambiguous_date PASSED                     [ 66%]
tests/test_parse_bill.py::test_unambiguous_date PASSED                   [ 72%]
tests/test_parse_bill.py::test_digit_confusion_detection PASSED          [ 77%]
tests/test_parse_bill.py::test_missing_total PASSED                      [ 83%]
tests/test_parse_bill.py::test_category_matching_from_shared_map PASSED  [ 88%]
tests/test_parse_bill.py::test_items_sum_mismatch PASSED                 [ 94%]
tests/test_parse_bill.py::test_property_grounding_total_digits_must_exist PASSED [100%]
======================= 18 passed, 2 warnings in 9.12s ========================
```

### Full Regression Test Suites
- **Server Tests (`npm test` in `server/`):**
  - Test Suites: 20 passed, 20 total
  - Tests: **450 passed, 450 total**
- **Client Tests (`npm test` in `client/`):**
  - Test Files: 22 passed, 22 total
  - Tests: **126 passed, 126 total**

---

## 4. SHA256 Verification (`shared/voice`)

| File Name | `logs/freeze-v2-hashes.txt` | Live File SHA256 | Status |
| :--- | :--- | :--- | :--- |
| `asrConfusions.json` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | MATCH |
| `extractExpenses.js` | `FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177` | `FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177` | MATCH |
| `keywordMap.json` | `B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7` | `B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7` | MATCH |
| `parseCommand.js` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | MATCH |
| `sinhalaNumberWords.json` | `6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687` | `6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687` | MATCH |
| `sinhalaNumbers.js` | `EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38` | `EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38` | MATCH |

---

## 5. Disk Space

- **D: Free Space Before BILL-1c:** 1,804,148,736 bytes (~1.68 GiB / 1.80 GB)
- **D: Free Space After BILL-1c:** 1,708,572,672 bytes (~1.59 GiB / 1.71 GB)
- **Net Consumption:** ~91.1 MB (isolated Python venv, wheels, dependencies, and cache; well under 300 MB limit)
