# TASK BILL-4b: BILL-4 Fixes and Invariant Hardening Report

**Date:** 2026-10-29  
**Execution Context:** Fix deviations from BILL-4 in `server/src/services/billMapping.js`, `server/src/routes/billScan.js`, `client/src/components/VoiceExpenseEntry.jsx`, locales, documentation, and unit tests.

---

## 1. Item-by-Item Status Table

| Item | Description | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **Preconditions** | D: free space check (> 1 GB) | **DONE** | `logs\bill4b-free-space.txt` (4.79 GB free) |
| **1. Bill Mapping Hardening** | `mapBillServiceToReviewItems` ALWAYS returns exactly ONE row from bill-level fields (`total`, `date`, `vendor`). Removed line item row creation. `description = vendor || "Scanned bill"`. `category`: single category all parsed items agree on, else `"other"` with reason `category_unsure`. If `total` is null: one row, no amount, reason `total_missing`. If rounding to integer rupees changes value: reason `amount_rounded`. Carry all bill-level reasons through. | **DONE** | `server/src/services/billMapping.js`, `server/tests/billScan.test.js` |
| **2. Client Review Table Guard** | Scanned amount ALWAYS needs an explicit Accept tap before Save is enabled, even when status is `ok`. Nothing saved before user confirms. Image not kept in state, storage or DOM after response arrives (all object URLs revoked). | **DONE** | `client/src/components/VoiceExpenseEntry.jsx`, `client/src/test/BillScan.test.jsx` |
| **3. Test Suites** | Added and verified tests: `mapping returns one row even when items exist`, `total_missing`, `category_unsure with disagreeing items`, `amount_rounded`, `upstream timeout maps to 504 with { error: { code, message } }`, `client: Save disabled until Accept, nothing saved before confirm, no img element or object URL left after processing`. | **DONE** | `logs\bill4b-server-tests.txt`, `logs\bill4b-client-tests.txt` |
| **4. Documentation Cleanup** | Fixed broken markdown env tables in `docs/SO3-README.md` (`BILL_SCAN`, `BILL_SERVICE_URL`, `BILL_INTERNAL_TOKEN`, `VITE_BILL_SCAN`, `VITE_VOICE_CAPTURE`, `FORECAST_MODE`). Removed claim that "bills are predominantly English numerals" from `docs/bill4-report.md`. | **DONE** | `docs/SO3-README.md`, `docs/bill4-report.md` |
| **5. Full Suite Verification** | Ran server full suite (21 suites, 465 passed), client full suite (23 suites, 132 passed), `npm run check:sinhala`, verified `shared/voice` SHA-256 hashes, recorded free space before (4.79 GB) and after (4.78 GB). | **DONE** | `logs\bill4b-server-full-tests.txt`, `logs\bill4b-client-full-tests.txt`, `logs\bill4b-sinhala.txt`, `logs\bill4b-voice-hashes.txt`, `logs\bill4b-free-space-after.txt` |

---

## 2. Test Execution Outputs

### 2.1. Initial Unit Test Verification

#### Server `billScan.test.js`
Raw output from `logs\bill4b-server-tests.txt`:
```
> server@1.0.0 test
> cross-env NODE_ENV=test TMP=d:/Aswanna/temp TEMP=d:/Aswanna/temp NODE_OPTIONS=--experimental-vm-modules jest --runInBand tests/billScan.test.js

(node:31068) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
PASS tests/billScan.test.js (17.667 s)
  Bill Scan Route & Mapping Tests (TASK BILL-4 & BILL-4b)
    1. Pure Mapping Unit Tests (TASK BILL-4b)
      √ roundToStoredRupees handles integer, fractional cents, and zero correctly (1112 ms)
      √ mapping returns one row even when items exist (779 ms)
      √ total_missing (655 ms)
      √ category_unsure with disagreeing items (767 ms)
      √ amount_rounded (611 ms)
    2. Server Route Tests (/api/bill-scan)
      √ returns 404 when BILL_SCAN is off (645 ms)
      √ returns 401 when auth token is missing (669 ms)
      √ returns 400 for bad content type (664 ms)
      √ returns 400 for invalid magic bytes (827 ms)
      √ returns 413 for oversized file > 5 MB (676 ms)
      √ returns 503 when BILL_INTERNAL_TOKEN is unset (694 ms)
      √ maps upstream down / network error to 503 BILL_SERVICE_DOWN (678 ms)
      √ maps upstream 503 (Tesseract missing) to OCR_ENGINE_MISSING (676 ms)
      √ upstream timeout maps to 504 with { error: { code, message } } (676 ms)
      √ successfully proxies image and returns mapped items on 200 (644 ms)

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        17.84 s
Ran all test suites matching /tests\\billScan.test.js/i.
```

#### Client `BillScan.test.jsx`
Raw output from `logs\bill4b-client-tests.txt`:
```
> client@1.0.0 test
> vitest run src/test/BillScan.test.jsx


 RUN  v2.1.9 D:/Aswanna/client

 ✓ src/test/BillScan.test.jsx (6 tests) 925ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  18:30:59
   Duration  11.32s (transform 599ms, setup 446ms, collect 1.38s, tests 925ms, environment 1.88s, prepare 1.26s)
```

---

### 2.2. Full Test Suites

#### Server Full Suite
Raw output summary from `logs\bill4b-server-full-tests.txt`:
```
Test Suites: 21 passed, 21 total
Tests:       465 passed, 465 total
Snapshots:   0 total
Time:        160.161 s
Ran all test suites.
Exit Code: 0
```

#### Client Full Suite
Raw output summary from `logs\bill4b-client-full-tests.txt`:
```
 Test Files  23 passed (23)
      Tests  132 passed (132)
   Start at  18:34:14
   Duration  54.35s (transform 7.98s, setup 19.30s, collect 67.64s, tests 41.07s, environment 116.27s, prepare 19.91s)
Exit Code: 0
```

#### Sinhala Label Parity Check
Raw output from `logs\bill4b-sinhala.txt`:
```
> aswanna@1.0.0 check:sinhala
> node shared/scripts/checkSinhala.js

✅ All Sinhala label & locale key parity checks passed successfully.
```

#### Voice Module Integrity Check
Raw output from `logs\bill4b-voice-hashes.txt`:
```
9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02  asrConfusions.json
FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177  extractExpenses.js
B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7  keywordMap.json
27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D  parseCommand.js
EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38  sinhalaNumbers.js
6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687  sinhalaNumberWords.json
```

#### Disk Free Space Verification
- Initial (`logs\bill4b-free-space.txt`): 4.79 GB free
- Final (`logs\bill4b-free-space-after.txt`): 4.78 GB free

---

## 3. Files Changed

1. `server/src/services/billMapping.js`:
   - Updated `mapBillServiceToReviewItems` to always return exactly one review row from bill-level fields (`total`, `date`, `vendor`).
   - Removed line-item row creation loop.
   - Set description to `vendor || "Scanned bill"`.
   - Set category to single agreeing category from parsed items, else `"other"` with `category_unsure`.
   - Set `total_missing` when total is null, and `amount_rounded` when fractional cents are rounded.
   - Carried all bill-level reasons through.
2. `client/src/components/VoiceExpenseEntry.jsx`:
   - Enforced `billAccepted: false` on newly scanned bill rows.
   - Required `billAccepted === true` before Save is enabled, even when status is `ok`.
   - Rendered explicit Accept button (`data-testid="bill-accept-btn-${item.id}"`) and handler `handleAcceptBillItem`.
   - Added timeout fallback and object URL cleanup in `downscaleImageIfNeeded` to ensure no image element or object URL persists after processing.
3. `client/src/i18n/locales/en.json` & `client/src/i18n/locales/si.json`:
   - Added localized messages for `voice.reasons.category_unsure` and `voice.reasons.total_missing`.
4. `server/tests/billScan.test.js`:
   - Added test `mapping returns one row even when items exist`.
   - Added test `total_missing`.
   - Added test `category_unsure with disagreeing items`.
   - Added test `amount_rounded`.
   - Added test `upstream timeout maps to 504 with { error: { code, message } }`.
5. `client/src/test/BillScan.test.jsx`:
   - Updated test 4 to verify Save is disabled until Accept is tapped.
   - Added test 6: `client: Save disabled until Accept, nothing saved before confirm, no img element or object URL left after processing`.
6. `docs/SO3-README.md`:
   - Fixed broken markdown pipe formatting in feature environment tables (Tables C and D).
7. `docs/bill4-report.md`:
   - Removed the claim that "bills are predominantly printed in English numerals and Latin characters".

---

## 4. Assumptions Made

- None required. All behaviors implemented strictly according to the specified prompt invariants.

---

## 5. Not Done / Risks

- Did not commit to Git (per explicit instruction: "Do not commit").
- Synthetic test split and lockfiles remained untouched and uninspected.

---

## 6. Suggested Next Step

- Review the test suites and reports. All requirements of TASK BILL-4b have been verified with 100% test pass rates across server and client.
