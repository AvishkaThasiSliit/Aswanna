# TASK BILL-1f: Parser Independence & Grounding Whitespace Report

**Date:** 2026-10-29  
**Service:** `bill-service/`  
**Tesseract Status:** `MISSING` (live OCR skipped per task instructions)

---

## 1. Summary of Changes

### 1. Grounding Whitespace (Non-Destructive Local Matching)
- **Problem:** The previous grounding approach used a global regex rewrite (`re.sub(r"(?<=\d)[,\s](?=\d{3}\b)", "", ocr_text)`). Because `\s` includes `\r` and `\n`, newline-adjacent tokens (such as `1,250.00\n123`) were collapsed into `1250.00123`, causing valid totals to fail boundary checks. Furthermore, unrestricted `\s` across columns risked fusing unrelated numbers (e.g. quantity `2` and unit price `100.00` into `2100.00`).
- **Solution:** 
  1. Completely eliminated global text transformation.
  2. Grounding dynamically computes candidate amount digit groups (e.g. `1250` -> `["1", "250"]`).
  3. Comma-grouped amounts (`1,250`) and unseparated amounts (`1250`) match with strict token boundaries (`(?<!\d)(?<!\d,)(?<!\d[ \t])(?<!(?<![A-Za-z])\.)` and `(?!\d)(?!,\d)(?![ \t]\d{3}\b)`).
  4. Same-line horizontal whitespace (`[ \t]`) grouping (e.g. `1 250.00`) is supported strictly when accompanied by monetary context (currency prefix `Rs`, `LKR`, `රු`, Sri Lankan currency suffix `/=` or `/-`, or explicit total labels like `Total:`, `Net Total:`, etc.).
  5. Verified:
     - `"Total 1,250.00\n123 Main Street"` grounds `1250`.
     - `"Urea 2 100.00"` does **NOT** ground a total of `2100`.
     - `"Total 1 250.00"` grounds `1250`.
     - All prior cases continue to pass (`Rs.1,250.00`, `Rs.1250`, `LKR 1250`, `1250/=`, `Rs 1,250/=`, `"Total 1250."` at line end, `1250.5`; `250` vs `12500` and `25` vs `2500.00` rejected).

### 2. Field Independence
- Conflicting or missing totals never blank or skip vendor, date, line items, or their respective status and review reasons.
- Date extraction and vendor extraction run independently before total determination and maintain their own flags (`ambiguous_date`, etc.).
- Conflicting totals behavior is preserved: returns `total: null` with reason `conflicting_totals` and status `needs_review`. No net-total precedence rule was added.
- Full output for the two A3 cases confirmed:
  - **Case 1 (`Total 1200 / Discount 100 / Net Total 1100` with `Date: 12/10/2026`):**
    ```json
    {
      "source": "bill",
      "vendor": null,
      "date": "2026-10-12",
      "total": null,
      "items": [],
      "status": "needs_review",
      "reasons": [
        "ambiguous_date",
        "conflicting_totals"
      ],
      "rawText": "Date: 12/10/2026\nTotal 1200\nDiscount 100\nNet Total 1100",
      "confidence": null
    }
    ```
  - **Case 2 (`Total 1200 / Net Total 1500` with `Date: 25/10/2026`):**
    ```json
    {
      "source": "bill",
      "vendor": null,
      "date": "2026-10-25",
      "total": null,
      "items": [],
      "status": "needs_review",
      "reasons": [
        "conflicting_totals"
      ],
      "rawText": "Date: 25/10/2026\nTotal 1200\nNet Total 1500",
      "confidence": null
    }
    ```

### 3. Cleanup Verification
- In `bill-service/tests/test_api.py`, `test_multipart_upload_spooling_evidence` closes and unlinks temporary files in a `finally` block.
- `D:\Aswanna\temp` was inspected: confirmed 0 leftover temporary files from `bill-service` test runs.

---

## 2. Code Changes Diff

### Diff: `bill-service/parse_bill.py`
```diff
--- a/bill-service/parse_bill.py
+++ b/bill-service/parse_bill.py
@@ -174,38 +174,61 @@ def parse_decimal_cents(text: str) -> Optional[Decimal]:
 def is_total_grounded(total: Decimal, ocr_text: str) -> bool:
     """
     A total is grounded only if its normalised amount (thousands separators removed)
     appears as a whole number token in the OCR text.
+    Uses only same-line horizontal space (not newlines), and only as part of matching
+    the candidate amount itself (the amount's own digit groups, e.g. '1 250.00' for 1250),
+    never by rewriting the whole OCR text.
+    Handles 'Total 1,250.00\n123 Main Street', 'Total 1 250.00', 'Rs.1,250.00',
+    'Rs.1250', 'LKR 1250', '1250/=', 'Rs 1,250/=', 'Total 1250.' at line end, and '1250.5'.
+    Rejects 'Urea 2 100.00' for total 2100, '12500' for 250, and '2500.00' for 25.
     """
     if not ocr_text or total is None:
         return False
 
-    # Normalize thousands separators (commas and spaces between digits)
-    text_clean = re.sub(r"(?<=\d)[,\s](?=\d{3}\b)", "", ocr_text)
-
     cents = (total * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
     int_part = int(total)
     cents_part = int(cents % 100)
 
+    int_str = str(int_part)
+    groups = []
+    s = int_str
+    while len(s) > 3:
+        groups.insert(0, s[-3:])
+        s = s[:-3]
+    groups.insert(0, s)
+
+    comma_grouped = r",".join(groups)
+    space_grouped = r"[ \t]".join(groups)
+
     if cents_part == 0:
-        cents_pat = r"(?:\.00?|\.(?!\d))?"
+        cents_pat = r"(?:\.00?|\.(?!\d))?"
     elif cents_part % 10 == 0:
         single_d = cents_part // 10
-        cents_pat = rf"\.{single_d}0?"
+        cents_pat = rf"\.{single_d}0?"
     else:
-        cents_pat = rf"\.{cents_part:02d}"
+        cents_pat = rf"\.{cents_part:02d}"
 
-    int_str = str(int_part)
     suf = r"(?:[/][=-])?"
-    lb = r"(?<!\d)(?<!(?<![A-Za-z])\.)"
-    la = r"(?!\d)"
+    num_pat = rf"(?:{int_str}|{comma_grouped})" if len(groups) > 1 else int_str
 
-    pat = rf"{lb}{int_str}{cents_pat}{suf}{la}"
-    return bool(re.search(pat, text_clean))
+    # Boundaries:
+    # Not preceded by digit, nor digit+comma, nor digit+space, nor dot preceded by non-letter
+    # Not followed by digit, nor comma+digit, nor space+3digits
+    lb = r"(?<!\d)(?<!\d,)(?<!\d[ \t])(?<!(?<![A-Za-z])\.)"
+    la = r"(?!\d)(?!,\d)(?![ \t]\d{3}\b)"
+
+    # 1. Standard pattern: ungrouped (1250) or comma-grouped (1,250) anywhere with boundaries
+    std_pat = rf"{lb}{num_pat}{cents_pat}{suf}{la}"
+    if re.search(std_pat, ocr_text):
+        return True
+
+    # 2. Space-grouped pattern (e.g. '1 250.00'):
+    # Requires currency or total context prefix, or currency suffix (/= or /-)
+    if len(groups) > 1:
+        ctx_prefix = r"(?:(?:Rs\.?|LKR|රු\.?|Total|Grand\s+total|Net\s+total|Net|Amount|Balance|Due|Payable|මුළු\s*මුදල|එකතුව|මුළු)\s*[:.-]?\s*)"
+        space_pat_with_prefix = rf"{ctx_prefix}{space_grouped}{cents_pat}{suf}{la}"
+        space_pat_with_suffix = rf"{lb}{space_grouped}{cents_pat}[/][=-]{la}"
+        if re.search(space_pat_with_prefix, ocr_text, re.IGNORECASE) or re.search(space_pat_with_suffix, ocr_text):
+            return True
+
+    return False
```

### Diff: `bill-service/tests/test_api.py`
```diff
--- a/bill-service/tests/test_api.py
+++ b/bill-service/tests/test_api.py
@@ -50,6 +50,7 @@ def test_multipart_upload_spooling_evidence():
     spooled = tempfile.SpooledTemporaryFile(max_size=1024 * 1024)
     assert isinstance(spooled._file, io.BytesIO)
 
+    file_name = None
     try:
         # Write 3 MB of PNG data
         png_3mb = b"\x89PNG\r\n\x1a\n" + (b"\x00" * (3 * 1024 * 1024))
@@ -62,5 +63,13 @@ def test_multipart_upload_spooling_evidence():
         assert is_disk_file is True
         assert file_name is not None
         assert os.path.exists(file_name) is True
     finally:
         spooled.close()
+        if file_name and os.path.exists(file_name):
+            try:
+                os.remove(file_name)
+            except Exception:
+                pass
+        # Confirm cleanup
+        if file_name:
+            assert os.path.exists(file_name) is False
```

---

## 3. Test Suite Proofs

### A. `bill-service` Pytest Results (41 passed)
```
============================= test session starts =============================
platform win32 -- Python 3.13.3, pytest-9.2.0, pluggy-1.7.0 -- D:\Aswanna\bill-service\.venv\Scripts\python.exe
cachedir: .pytest_cache
hypothesis profile 'default'
rootdir: D:\Aswanna\bill-service
plugins: anyio-4.15.1, hypothesis-6.170.13
collecting ... collected 41 items

tests/test_api.py::test_multipart_upload_spooling_evidence PASSED        [  2%]
tests/test_api.py::test_startup_token_check_raises_when_unset PASSED     [  4%]
tests/test_api.py::test_health_endpoint_no_auth PASSED                   [  7%]
tests/test_api.py::test_auth_rejection_missing_token PASSED              [  9%]
tests/test_api.py::test_auth_rejection_bad_token PASSED                  [ 12%]
tests/test_api.py::test_auth_acceptance_bearer_token PASSED              [ 14%]
tests/test_api.py::test_invalid_content_type_rejected PASSED             [ 17%]
tests/test_api.py::test_magic_bytes_validation_with_png_content_type PASSED [ 19%]
tests/test_api.py::test_malformed_content_length_returns_400 PASSED      [ 21%]
tests/test_api.py::test_negative_content_length_returns_400 PASSED       [ 24%]
tests/test_api.py::test_upload_limit_5mb_rejection PASSED                [ 26%]
tests/test_api.py::test_chunked_upload_no_content_length_succeeds PASSED [ 29%]
tests/test_api.py::test_chunked_upload_oversized_rejected_with_413 PASSED [ 31%]
tests/test_api.py::test_missing_tesseract_returns_http_503 PASSED        [ 34%]
tests/test_api.py::test_ocr_timeout_returns_http_504 PASSED              [ 36%]
tests/test_parse_bill.py::test_allowed_categories_matches_app_spec PASSED [ 39%]
tests/test_parse_bill.py::test_total_standard_comma_decimal PASSED       [ 41%]
tests/test_parse_bill.py::test_total_space_separated_with_rs PASSED      [ 43%]
tests/test_parse_bill.py::test_subtotal_vs_tax_vs_total PASSED           [ 46%]
tests/test_parse_bill.py::test_cash_change_exclusion PASSED              [ 48%]
tests/test_parse_bill.py::test_ambiguous_date PASSED                     [ 51%]
tests/test_parse_bill.py::test_unambiguous_date PASSED                   [ 53%]
tests/test_parse_bill.py::test_digit_confusion_detection PASSED          [ 56%]
tests/test_parse_bill.py::test_missing_total PASSED                      [ 58%]
tests/test_parse_bill.py::test_category_matching_and_allowed_list PASSED [ 60%]
tests/test_parse_bill.py::test_unknown_item_gets_other_and_category_unsure PASSED [ 63%]
tests/test_parse_bill.py::test_items_sum_mismatch PASSED                 [ 65%]
tests/test_parse_bill.py::test_grounding_whole_number_token_250_vs_12500 PASSED [ 68%]
tests/test_parse_bill.py::test_parser_ungrounded_total_rejected PASSED   [ 70%]
tests/test_parse_bill.py::test_total_qty_and_total_items_are_not_money PASSED [ 73%]
tests/test_parse_bill.py::test_discount_and_rounding_lines_excluded PASSED [ 75%]
tests/test_parse_bill.py::test_balance_due_vs_total_conflict PASSED      [ 78%]
tests/test_parse_bill.py::test_conflicting_totals PASSED                 [ 80%]
tests/test_parse_bill.py::test_qty_x_price_amount_row PASSED             [ 82%]
tests/test_parse_bill.py::test_sinhala_total_keyword PASSED              [ 85%]
tests/test_parse_bill.py::test_property_grounding_total_digits_must_exist PASSED [ 87%]
tests/test_parse_bill.py::test_grounding_formats_spec PASSED             [ 90%]
tests/test_parse_bill.py::test_conflicting_totals_record_behavior_discount_and_net_total PASSED [ 92%]
tests/test_parse_bill.py::test_conflicting_totals_record_behavior_total_and_net_total PASSED [ 95%]
tests/test_parse_bill.py::test_bill1f_grounding_whitespace_cases PASSED  [ 97%]
tests/test_parse_bill.py::test_field_independence_unambiguous_date_with_conflicting_total PASSED [100%]

======================== 41 passed, 1 warning in 4.50s ========================
```

### B. Server Test Suite (450 passed)
```
Test Suites: 20 passed, 20 total
Tests:       450 passed, 450 total
Snapshots:   0 total
Time:        16.892 s
Ran all test suites.
```

### C. Client Test Suite (126 passed)
```
Test Suites: 22 passed, 22 total
Tests:       126 passed, 126 total
Snapshots:   0 total
Time:        12.923 s
Ran all test suites.
```

### D. Voice File Integrity
- Checked 6 files in `shared/voice/` against `logs/freeze-v2-hashes.txt`:
  - `shared/voice/canonicalWords.json`: MATCH
  - `shared/voice/keywordMap.json`: MATCH
  - `shared/voice/languagePatterns.json`: MATCH
  - `shared/voice/ruleDefinitions.json`: MATCH
  - `shared/voice/sinhalaNumberMap.json`: MATCH
  - `shared/voice/vocabulary.json`: MATCH
- Status: **6 / 6 exact matches, 0 mismatches**.

### E. Disk Space Tracking on D:
- Free Space at Start: **5,163,741,184 bytes** (4.809 GB)
- Free Space at End: **5,149,794,304 bytes** (4.796 GB)
- Free space comfortably exceeds the 1.0 GB safety threshold.
