# TASK BILL-1d: Parser Hardening & Service Resilience Report

**Date:** 2026-10-29  
**Service:** `bill-service/`  
**Tesseract Status:** `MISSING`

---

## 1. Tesseract Status & Part B Note

- `shutil.which('tesseract')` returned `None`.
- Paths checked: `C:\Program Files\Tesseract-OCR\tesseract.exe`, `C:\Program Files (x86)\Tesseract-OCR\tesseract.exe`, and environment variable `TESSERACT_CMD`.
- Result: **MISSING**.
- Per task specification, **Part B (Live OCR & synthetic dry run) is skipped**.

---

## 2. Part A: Fixes & Code Diffs

### A1. Categories (Canonical 8 Enforced)
- **Source of Truth Path:** `shared/categoryMap.js` (enforced in Mongoose model `server/src/models/Expense.js`).
- **Allowed Categories:** `['seed', 'fertilizer', 'agrochemical', 'labour', 'machinery', 'fuel', 'irrigation', 'other']`.
- **Behavior:** Unmapped or unknown items are assigned category `"other"` with reason `"category_unsure"`, setting status to `"needs_review"`.

```diff
--- a/bill-service/parse_bill.py
+++ b/bill-service/parse_bill.py
+CATEGORY_MAP_JS_PATH = Path(__file__).resolve().parent.parent / "shared" / "categoryMap.js"
+
+def load_allowed_categories() -> List[str]:
+    """Read allowed categories directly from shared/categoryMap.js."""
+    if CATEGORY_MAP_JS_PATH.exists():
+        try:
+            content = CATEGORY_MAP_JS_PATH.read_text(encoding="utf-8")
+            m = re.search(r"categoryMap\s*=\s*\{([^}]+)\}", content)
+            if m:
+                keys = re.findall(r"['\"]?([a-zA-Z0-9_-]+)['\"]?\s*:", m.group(1))
+                if keys:
+                    return keys
+        except Exception:
+            pass
+    return ["seed", "fertilizer", "agrochemical", "labour", "machinery", "fuel", "irrigation", "other"]
+
+ALLOWED_CATEGORIES = load_allowed_categories()
...
+def match_category(description: str) -> Tuple[str, bool]:
+    """Returns (category, is_unsure). Category is guaranteed to be one of ALLOWED_CATEGORIES."""
+    ...
+    if best_cat == "other" or longest_match == 0:
+        return "other", True
+    return best_cat, False
```

### A2. Grounding (Whole Number Token Match)
- A total is grounded only if its normalised amount (thousands separators removed) appears as a whole number token (`(?<![\d.])<amount>(?![\d.])`) in the OCR text.
- Prevents substring false positives: a candidate total of `250` is NOT grounded by `"12500"`.

```diff
--- a/bill-service/parse_bill.py
+++ b/bill-service/parse_bill.py
+def is_total_grounded(total: Decimal, ocr_text: str) -> bool:
+    """
+    A total is grounded only if its normalised amount (thousands separators removed)
+    appears as a whole number token in the OCR text.
+    E.g. a total of 250 is NOT grounded by the text '12500'.
+    """
+    if not ocr_text or total is None:
+        return False
+    norm_text = re.sub(r"(?<=\d),(?=\d{3}\b)", "", ocr_text)
+    cents = (total * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
+    int_part = int(total)
+    cents_part = int(cents % 100)
+    if cents_part == 0:
+        pat = rf"(?<![\d.]){int_part}(?:\.00?)?(?![\d.])"
+    else:
+        pat = rf"(?<![\d.]){int_part}\.{cents_part:02d}(?![\d.])"
+    return bool(re.search(pat, norm_text))
...
+    if total_val is not None:
+        if not is_total_grounded(total_val, ocr_text):
+            total_val = None
+            reasons.append("total_not_in_ocr_text")
+            status = "needs_review"
```

### A3. Hand-Written Fixtures & Ambiguity Handling
- **Quantity totals excluded:** Lines matching `NON_MONETARY_TOTAL_KEYWORDS` (`Total Qty 5`, `Total items 3`) are excluded from total amount matching.
- **Discount & rounding lines excluded:** Lines matching `DISCOUNT_KEYWORDS` (`discount`, `disc`, `less discount`) and `ROUNDING_KEYWORDS` (`rounding`, `round off`) are excluded from total selection.
- **Balance Due vs Total conflict:** When a receipt contains differing amounts for `Total` and `Balance Due`, flagged with `ambiguous_balance_due` and marked `needs_review`.
- **Conflicting TOTAL lines:** If multiple distinct total lines appear (e.g. `Total: 1200` vs `Net Total: 1500`), flagged with `conflicting_totals` and total discarded (`None`).
- **Qty x Price = Amount row:** Regex `(\d+(?:\.\d+)?)\s*(?:x|@)\s*([0-9.,]+)\s*(?:=\s*)?([0-9.,]+)` parses row quantity, unit price, and item amount.
- **Sinhala Total Keyword:** Handles `මුළු මුදල` and `එකතුව`.

### A4. Service Hardening (`bill-service/main.py` & `ocr.py`)
- **5 MB stream limit:** Reads at most `MAX_FILE_SIZE + 1` bytes without reading entire body.
- **Token comparison:** Enforces constant-time `hmac.compare_digest`.
- **OCR Engine Timeout:** Pytesseract call uses `timeout=25` parameter, caught as `HTTP 504 Gateway Timeout`.

```diff
--- a/bill-service/main.py
+++ b/bill-service/main.py
+import hmac
...
-    if not token or token != expected:
+    if not token or not hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8")):
         raise HTTPException(
             status_code=status.HTTP_401_UNAUTHORIZED,
             detail="Unauthorized: invalid or missing internal token"
         )
...
-    content = await file.read(MAX_FILE_SIZE + 1)
-    if len(content) > MAX_FILE_SIZE:
-        raise HTTPException(
-            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
-            detail="File size exceeds 5 MB limit"
-        )
+    cl = request.headers.get("content-length")
+    if cl and int(cl) > MAX_FILE_SIZE:
+        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="File size exceeds 5 MB limit")
+    content = await file.read(MAX_FILE_SIZE + 1)
+    if len(content) > MAX_FILE_SIZE:
+        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="File size exceeds 5 MB limit")
```

```diff
--- a/bill-service/ocr.py
+++ b/bill-service/ocr.py
-def run_ocr(image_bytes: bytes) -> Dict[str, Any]:
+def run_ocr(image_bytes: bytes, timeout: int = 25) -> Dict[str, Any]:
...
-        data = pytesseract.image_to_data(processed, lang=lang, output_type=pytesseract.Output.DICT)
+        data = pytesseract.image_to_data(processed, lang=lang, output_type=pytesseract.Output.DICT, timeout=timeout)
+    except (pytesseract.TesseractTimeoutError, TimeoutError) as e:
+        raise RuntimeError(f"OCR_TIMEOUT: OCR processing exceeded engine timeout of {timeout}s: {str(e)}")
```

---

## 3. Real Verification Command Outputs

### 1. `bill-service` Pytest Output (30 passed, 0 failed)
```
============================= test session starts =============================
platform win32 -- Python 3.13.3, pytest-9.2.0, pluggy-1.7.0 -- D:\Aswanna\bill-service\.venv\Scripts\python.exe
cachedir: .pytest_cache
hypothesis profile 'default'
rootdir: D:\Aswanna\bill-service
plugins: anyio-4.15.1, hypothesis-6.170.13
collecting ... collected 30 items

tests/test_api.py::test_startup_token_check_raises_when_unset PASSED     [  3%]
tests/test_api.py::test_health_endpoint_no_auth PASSED                   [  6%]
tests/test_api.py::test_auth_rejection_missing_token PASSED              [ 10%]
tests/test_api.py::test_auth_rejection_bad_token PASSED                  [ 13%]
tests/test_api.py::test_auth_acceptance_bearer_token PASSED              [ 16%]
tests/test_api.py::test_magic_bytes_validation PASSED                    [ 20%]
tests/test_api.py::test_upload_limit_5mb_stream_rejection PASSED         [ 23%]
tests/test_api.py::test_missing_tesseract_returns_http_503 PASSED        [ 26%]
tests/test_api.py::test_ocr_timeout_returns_http_504 PASSED              [ 30%]
tests/test_parse_bill.py::test_allowed_categories_matches_app_spec PASSED [ 33%]
tests/test_parse_bill.py::test_total_standard_comma_decimal PASSED       [ 36%]
tests/test_parse_bill.py::test_total_space_separated_with_rs PASSED      [ 40%]
tests/test_parse_bill.py::test_subtotal_vs_tax_vs_total PASSED           [ 43%]
tests/test_parse_bill.py::test_cash_change_exclusion PASSED              [ 46%]
tests/test_parse_bill.py::test_ambiguous_date PASSED                     [ 50%]
tests/test_parse_bill.py::test_unambiguous_date PASSED                   [ 53%]
tests/test_parse_bill.py::test_digit_confusion_detection PASSED          [ 56%]
tests/test_parse_bill.py::test_missing_total PASSED                      [ 60%]
tests/test_parse_bill.py::test_category_matching_and_allowed_list PASSED [ 63%]
tests/test_parse_bill.py::test_unknown_item_gets_other_and_category_unsure PASSED [ 66%]
tests/test_parse_bill.py::test_items_sum_mismatch PASSED                 [ 70%]
tests/test_parse_bill.py::test_grounding_whole_number_token_250_vs_12500 PASSED [ 73%]
tests/test_parse_bill.py::test_parser_ungrounded_total_rejected PASSED   [ 76%]
tests/test_parse_bill.py::test_total_qty_and_total_items_are_not_money PASSED [ 80%]
tests/test_parse_bill.py::test_discount_and_rounding_lines_excluded PASSED [ 83%]
tests/test_parse_bill.py::test_balance_due_vs_total_conflict PASSED      [ 86%]
tests/test_parse_bill.py::test_conflicting_totals PASSED                 [ 90%]
tests/test_parse_bill.py::test_qty_x_price_amount_row PASSED             [ 93%]
tests/test_parse_bill.py::test_sinhala_total_keyword PASSED              [ 96%]
tests/test_parse_bill.py::test_property_grounding_total_digits_must_exist PASSED [100%]

======================== 30 passed, 1 warning in 3.64s ========================
```

### 2. Server Test Suite Output (`server/`)
```
Test Suites: 20 passed, 20 total
Tests:       450 passed, 450 total
Snapshots:   0 total
Time:        158.331 s, estimated 194 s
Ran all test suites.
```

### 3. Client Test Suite Output (`client/`)
```
 Test Files  22 passed (22)
      Tests  126 passed (126)
   Start at  10:56:58
   Duration  64.02s
```

### 4. SHA256 Verification (`shared/voice` vs `logs/freeze-v2-hashes.txt`)
| File | `logs/freeze-v2-hashes.txt` | Live SHA256 | Status |
| :--- | :--- | :--- | :--- |
| `asrConfusions.json` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | MATCH |
| `extractExpenses.js` | `FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177` | `FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177` | MATCH |
| `keywordMap.json` | `B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7` | `B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7` | MATCH |
| `parseCommand.js` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | MATCH |
| `sinhalaNumberWords.json` | `6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687` | `6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687` | MATCH |
| `sinhalaNumbers.js` | `EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38` | `EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38` | MATCH |

### 5. D: Drive Free Space
- **Before TASK BILL-1d:** `1,708,568,576` bytes (1.591 GB)
- **After TASK BILL-1d:** `1,744,490,496` bytes (1.625 GB)
- **Delta:** Free space remained comfortably above 1.0 GB limit.
