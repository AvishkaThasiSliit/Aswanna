# TASK BILL-1e: Upload Path, Grounding Formats & Resilience Report

**Date:** 2026-10-29  
**Service:** `bill-service/`  
**Tesseract Status:** `MISSING`

---

## 1. Tesseract Status & Part B Note

- Status: **MISSING** (verified via `shutil.which('tesseract')`, standard program paths, and `TESSERACT_CMD`).
- Per task specification: **Part B (Live OCR & synthetic dry run) is skipped**.

---

## 2. Part A: Fixes & Changes

### A1. Upload Path & Disk Spooling Evidence

#### Evidence Test Output
```
[SPOOL CHECK] FastAPI Version: 0.162.0
[SPOOL CHECK] Starlette Version: 1.10.0
[SPOOL CHECK] 3 MB payload _file type: <class 'tempfile._TemporaryFileWrapper'>
[SPOOL CHECK] Spooled temp file on disk: D:\Aswanna\temp\tmp_l8xo5tp
```
**Finding:** Starlette's `UploadFile` (wrapping Python's `tempfile.SpooledTemporaryFile(max_size=1024*1024)`) automatically rolls over to a real file on disk when a multipart payload exceeds 1 MB. This violated the strict in-memory privacy rule.

#### Architectural Fix in `/scan-bill`
- The endpoint now accepts raw image bytes (`Content-Type: image/png` or `image/jpeg`).
- Reads the payload via `request.stream()` with an in-memory running byte counter.
- Aborts immediately with **HTTP 413** as soon as cumulative bytes exceed 5 MB (`5 * 1024 * 1024`), without buffering the remainder of the stream.
- Zero disk touches: data remains entirely in memory.
- Malformed `Content-Length` headers return **HTTP 400 Bad Request** (not HTTP 500).
- Fully supports chunked transfer encoding where `Content-Length` is omitted.
- Magic bytes (`\x89PNG` and `\xff\xd8\xff`) are validated on the in-memory buffer.
- Response JSON schema remains 100% identical.

#### Diff for `bill-service/main.py`:
```diff
--- a/bill-service/main.py
+++ b/bill-service/main.py
@@ -79,27 +79,43 @@
 @app.post("/scan-bill", dependencies=[Depends(verify_token)])
-async def scan_bill(request: Request, file: UploadFile = File(...)):
-    # 1. Immediate Content-Length rejection if provided
-    cl = request.headers.get("content-length")
-    if cl:
+async def scan_bill(request: Request):
+    # 1. Content-Type check
+    raw_ct = request.headers.get("content-type", "")
+    content_type = raw_ct.lower().split(";")[0].strip()
+    if content_type not in ["image/png", "image/jpeg", "image/jpg"]:
+        raise HTTPException(
+            status_code=status.HTTP_400_BAD_REQUEST,
+            detail="Invalid Content-Type. Only image/png and image/jpeg are supported."
+        )
+
+    # 2. Content-Length validation (if present)
+    cl_header = request.headers.get("content-length")
+    if cl_header is not None:
         try:
-            if int(cl) > MAX_FILE_SIZE:
+            cl = int(cl_header)
+            if cl > MAX_FILE_SIZE:
                 raise HTTPException(
                     status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                     detail="File size exceeds 5 MB limit"
                 )
+            if cl < 0:
+                raise HTTPException(
+                    status_code=status.HTTP_400_BAD_REQUEST,
+                    detail="Invalid Content-Length header"
+                )
         except ValueError:
-            pass
+            raise HTTPException(
+                status_code=status.HTTP_400_BAD_REQUEST,
+                detail="Malformed Content-Length header"
+            )
 
-    # Read at most MAX_FILE_SIZE + 1 bytes to prevent reading large body into memory
-    content = await file.read(MAX_FILE_SIZE + 1)
-    if len(content) > MAX_FILE_SIZE:
-        raise HTTPException(
-            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
-            detail="File size exceeds 5 MB limit"
-        )
+    # 3. Stream body with running byte counter (never touches disk)
+    chunks = []
+    total_bytes = 0
+    async for chunk in request.stream():
+        total_bytes += len(chunk)
+        if total_bytes > MAX_FILE_SIZE:
+            raise HTTPException(
+                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
+                detail="File size exceeds 5 MB limit"
+            )
+        chunks.append(chunk)
+
+    content = b"".join(chunks)
     if not content:
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="Uploaded file is empty"
         )
```

---

### A2. Grounding Formats & Anti-Collision Precision

The whole-number token grounding check was upgraded in [`bill-service/parse_bill.py`](file:///D:/Aswanna/bill-service/parse_bill.py) to support:
- Attached currency symbol with dot: `"Rs.1,250.00"`, `"Rs.1250"`
- Currency code: `"LKR 1250"`
- Sri Lankan slash-equal suffix: `"1250/="`, `"Rs 1,250/="`
- Space thousands separators: `"1 250.00"`
- Sentence/line trailing dot: `"Total 1250."`
- Single-decimal amounts: `"1250.5"` (for 1250.50)
- **Anti-Collision:** candidate total of `250` is **rejected** when matching inside `"12500"`, and `25` is **rejected** when matching inside `"2500.00"`.

#### Diff for `bill-service/parse_bill.py`:
```diff
--- a/bill-service/parse_bill.py
+++ b/bill-service/parse_bill.py
@@ -174,23 +174,26 @@
 def is_total_grounded(total: Decimal, ocr_text: str) -> bool:
     """
     A total is grounded only if its normalised amount (thousands separators removed)
     appears as a whole number token in the OCR text.
-    E.g. a total of 250 is NOT grounded by the text '12500'.
+    Handles 'Rs.1,250.00', 'Rs.1250', 'LKR 1250', '1250/=', 'Rs 1,250/=', '1 250.00',
+    'Total 1250.' at line end, and one-decimal total '1250.5'.
+    Ensures 250 is NOT grounded by '12500', and 25 is NOT grounded by '2500.00'.
     """
     if not ocr_text or total is None:
         return False
 
-    # Remove commas used as thousands separators in numbers (e.g. 1,250 -> 1250)
-    norm_text = re.sub(r"(?<=\d),(?=\d{3}\b)", "", ocr_text)
+    # Remove thousands separators (commas and spaces between digits)
+    text = re.sub(r"(?<=\d)[,\s](?=\d{3}\b)", "", ocr_text)
+    # Normalize Sri Lankan /= or /- suffix after digits
+    text = re.sub(r"(?<=\d)[/][=-]", "", text)
 
     cents = (total * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
     int_part = int(total)
     cents_part = int(cents % 100)
 
     if cents_part == 0:
-        # Match whole number token: e.g. 250 or 250.00
-        pat = rf"(?<![\d.]){int_part}(?:\.00?)?(?![\d.])"
+        pat = rf"(?<!\d)(?<!(?<![A-Za-z])\.){int_part}(?:\.00?|\.(?!\d))?(?!\d)"
+    elif cents_part % 10 == 0:
+        single_d = cents_part // 10
+        pat = rf"(?<!\d)(?<!(?<![A-Za-z])\.){int_part}\.{single_d}0?(?!\d)"
     else:
-        pat = rf"(?<![\d.]){int_part}\.{cents_part:02d}(?![\d.])"
-
-    return bool(re.search(pat, norm_text))
+        pat = rf"(?<!\d)(?<!(?<![A-Za-z])\.){int_part}\.{cents_part:02d}(?!\d)"
+
+    return bool(re.search(pat, text))
```

---

### A3. Conflicting Totals Record (No Behaviour Change)

As instructed, behaviour was recorded without modification:

#### (a) Input: `"Total 1200 / Discount 100 / Net Total 1100"`
```json
{
  "source": "bill",
  "vendor": "FARM STORE",
  "date": null,
  "total": null,
  "items": [],
  "status": "needs_review",
  "reasons": [
    "conflicting_totals"
  ],
  "rawText": "\nFARM STORE\nTotal 1200\nDiscount 100\nNet Total 1100\n",
  "confidence": null
}
```

#### (b) Input: `"Total 1200 / Net Total 1500"`
```json
{
  "source": "bill",
  "vendor": "FARM STORE",
  "date": null,
  "total": null,
  "items": [],
  "status": "needs_review",
  "reasons": [
    "conflicting_totals"
  ],
  "rawText": "\nFARM STORE\nTotal 1200\nNet Total 1500\n",
  "confidence": null
}
```

---

## 3. Real Verification Outputs

### 1. Pytest (`bill-service/tests` - 39 passed)
```
============================= test session starts =============================
platform win32 -- Python 3.13.3, pytest-9.2.0, pluggy-1.7.0 -- D:\Aswanna\bill-service\.venv\Scripts\python.exe
cachedir: .pytest_cache
hypothesis profile 'default'
rootdir: D:\Aswanna\bill-service
plugins: anyio-4.15.1, hypothesis-6.170.13
collecting ... collected 39 items

tests/test_api.py::test_multipart_upload_spooling_evidence 
[SPOOL CHECK] FastAPI Version: 0.162.0
[SPOOL CHECK] Starlette Version: 1.10.0
[SPOOL CHECK] 3 MB payload _file type: <class 'tempfile._TemporaryFileWrapper'>
[SPOOL CHECK] Spooled temp file on disk: D:\Aswanna\temp\tmp_l8xo5tp
PASSED
tests/test_api.py::test_startup_token_check_raises_when_unset PASSED
tests/test_api.py::test_health_endpoint_no_auth PASSED
tests/test_api.py::test_auth_rejection_missing_token PASSED
tests/test_api.py::test_auth_rejection_bad_token PASSED
tests/test_api.py::test_auth_acceptance_bearer_token PASSED
tests/test_api.py::test_invalid_content_type_rejected PASSED
tests/test_api.py::test_magic_bytes_validation_with_png_content_type PASSED
tests/test_api.py::test_malformed_content_length_returns_400 PASSED
tests/test_api.py::test_negative_content_length_returns_400 PASSED
tests/test_api.py::test_upload_limit_5mb_rejection PASSED
tests/test_api.py::test_chunked_upload_no_content_length_succeeds PASSED
tests/test_api.py::test_chunked_upload_oversized_rejected_with_413 PASSED
tests/test_api.py::test_missing_tesseract_returns_http_503 PASSED
tests/test_api.py::test_ocr_timeout_returns_http_504 PASSED
tests/test_parse_bill.py::test_allowed_categories_matches_app_spec PASSED
tests/test_parse_bill.py::test_total_standard_comma_decimal PASSED
tests/test_parse_bill.py::test_total_space_separated_with_rs PASSED
tests/test_parse_bill.py::test_subtotal_vs_tax_vs_total PASSED
tests/test_parse_bill.py::test_cash_change_exclusion PASSED
tests/test_parse_bill.py::test_ambiguous_date PASSED
tests/test_parse_bill.py::test_unambiguous_date PASSED
tests/test_parse_bill.py::test_digit_confusion_detection PASSED
tests/test_parse_bill.py::test_missing_total PASSED
tests/test_parse_bill.py::test_category_matching_and_allowed_list PASSED
tests/test_parse_bill.py::test_unknown_item_gets_other_and_category_unsure PASSED
tests/test_parse_bill.py::test_items_sum_mismatch PASSED
tests/test_parse_bill.py::test_grounding_whole_number_token_250_vs_12500 PASSED
tests/test_parse_bill.py::test_parser_ungrounded_total_rejected PASSED
tests/test_parse_bill.py::test_total_qty_and_total_items_are_not_money PASSED
tests/test_parse_bill.py::test_discount_and_rounding_lines_excluded PASSED
tests/test_parse_bill.py::test_balance_due_vs_total_conflict PASSED
tests/test_parse_bill.py::test_conflicting_totals PASSED
tests/test_parse_bill.py::test_qty_x_price_amount_row PASSED
tests/test_parse_bill.py::test_sinhala_total_keyword PASSED
tests/test_parse_bill.py::test_property_grounding_total_digits_must_exist PASSED
tests/test_parse_bill.py::test_grounding_formats_spec PASSED
tests/test_parse_bill.py::test_conflicting_totals_record_behavior_discount_and_net_total PASSED
tests/test_parse_bill.py::test_conflicting_totals_record_behavior_total_and_net_total PASSED

======================== 39 passed, 1 warning in 3.56s ========================
```

### 2. Server Test Suite (`npm test` in `server/`)
```
PASS tests/forecast.test.js (8.909 s)
PASS tests/voiceProxy.test.js (5.396 s)
PASS tests/phase3.test.js (9.199 s)
PASS tests/datasetCollection.test.js (5.742 s)
PASS tests/coverage.test.js
PASS tests/evaluatorMetrics.test.js
PASS tests/voicePipelineRegression.test.js (6.238 s)
PASS tests/generativeNumberParser.test.js
PASS tests/devVoiceCapture.test.js
PASS tests/voiceExtract.test.js
PASS tests/logic.test.js
PASS tests/voiceCommand.test.js
PASS tests/evalHarness.test.js
PASS tests/sinhalaNumbers.test.js
PASS tests/so1Contract.test.js

Test Suites: 20 passed, 20 total
Tests:       450 passed, 450 total
Snapshots:   0 total
Time:        160.913 s
Ran all test suites.
```

### 3. Client Test Suite (`npm test` in `client/`)
```
 Test Files  22 passed (22)
      Tests  126 passed (126)
   Start at  11:09:54
   Duration  47.77s
```

### 4. SHA256 Verification (`shared/voice` vs `logs/freeze-v2-hashes.txt`)
```
Freeze file:
SHA256    9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02 D:\Aswanna_freeze_voice_v2\shared_voice\asrConfusions.json
SHA256    FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177 D:\Aswanna_freeze_voice_v2\shared_voice\extractExpenses.js
SHA256    B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7 D:\Aswanna_freeze_voice_v2\shared_voice\keywordMap.json
SHA256    27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D D:\Aswanna_freeze_voice_v2\shared_voice\parseCommand.js
SHA256    6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687 D:\Aswanna_freeze_voice_v2\shared_voice\sinhalaNumberWords.json
SHA256    EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38 D:\Aswanna_freeze_voice_v2\shared_voice\sinhalaNumbers.js

Live hashes:
9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02  asrConfusions.json
FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177  extractExpenses.js
B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7  keywordMap.json
27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D  parseCommand.js
6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687  sinhalaNumberWords.json
EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38  sinhalaNumbers.js
(6/6 files match exactly)
```

### 5. Disk Space
- **Free space before TASK BILL-1e:** `1,743,945,728` bytes (1.624 GB)
- **Free space after TASK BILL-1e:** `1,743,400,960` bytes (1.624 GB)
- Net delta: -544 KB (well under 300 MB limit, strictly above 1.0 GB floor).
