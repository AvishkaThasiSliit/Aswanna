# TASK BILL-4 Report: Bill Scanner Integration & App Gating

**Date:** 2026-10-29  
**Branch:** `feature/bill-scanner`  
**Working Directory:** `D:\Aswanna`  

---

## 1. Item-by-Item Status Table

| Item | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **1** | **Read First:** Verify existing voice proxy, `VoiceExpenseEntry.jsx` save flow, `Expense.js` integer rupees unit, `categoryMap.js`, client env flags | **DONE** | Paths inspected: `server/src/routes/voice.js`, `client/src/components/VoiceExpenseEntry.jsx`, `server/src/models/Expense.js`, `shared/categoryMap.js`. Verified storage is integer rupees. |
| **2** | **Server Route:** Express router `server/src/routes/billScan.js` mounted at `/api/bill-scan` gated by `BILL_SCAN=on` (404 when off), `requireAuth`, rate limiter, raw body up to 5 MB (413 beyond), magic bytes check (PNG/JPEG), upstream proxy with `BILL_INTERNAL_TOKEN`, timeout, error mapping (503 `BILL_SERVICE_DOWN` and `OCR_ENGINE_MISSING`) | **DONE** | `server/src/routes/billScan.js`, `server/src/config/env.js`, `server/src/app.js`. 12/12 tests passing in `server/tests/billScan.test.js`. |
| **3** | **Mapping:** Pure function `mapBillServiceToReviewItems` in `server/src/services/billMapping.js`. Decimal-safe integer rounding (`roundToStoredRupees`), `amount_rounded` flag, 8 canonical categories, single fallback row if items empty, preserve `needs_review` and digit confusion reasons | **DONE** | `server/src/services/billMapping.js`. Unit tests in `server/tests/billScan.test.js` verify integer rounding, fallback row creation, category normalization, and flag retention. |
| **4** | **Client:** Camera button in `VoiceExpenseEntry.jsx` conditional on `VITE_BILL_SCAN=on` (`capture="environment"`, file type/size validation, optional <=1600px downscale, error/loading states, appends to review table without auto-saving, i18n English/Sinhala with ZWJ preserved, `check:sinhala` passes) | **DONE** | `client/src/components/VoiceExpenseEntry.jsx`, `client/src/i18n/locales/en.json`, `client/src/i18n/locales/si.json`. `npm run check:sinhala` passed with 0 errors. |
| **5** | **Tests:** Server unit tests (`server/tests/billScan.test.js`) and client tests (`client/src/test/BillScan.test.jsx`) covering flags, auth, errors, mapping, and UI behavior | **DONE** | `server/tests/billScan.test.js` (12 passed); `client/src/test/BillScan.test.jsx` (5 passed). |
| **6** | **Docs:** Update `docs/SO3-README.md` with env table (`BILL_SCAN`, `BILL_SERVICE_URL`, `BILL_INTERNAL_TOKEN`, `VITE_BILL_SCAN`), how to run `bill-service`, and cluster security boundary note | **DONE** | `docs/SO3-README.md` diff verified and documented. |
| **7** | **Verification:** Full test suites (`bill-service`, `server`, `client`), `shared/voice` hashes unchanged, free disk space before/after > 1 GB | **DONE** | Pytest 48 passed; Server Jest 462 passed; Client Vitest 131 passed; voice hashes intact; Free disk space 5.14 GB. |

---

## 2. Command Verification & Test Output

### 2.1. Disk Free Space Before & After
**Before (`logs\bill4-free-space.txt`):**
```
        Used       Free FreeGB
        ----       ---- ------
316978114560 5142331392  4.789
```

**After (`logs\bill4-free-space-after.txt`):**
```
        Used       Free
        ----       ----
316979724288 5140721664
```
*Disk space remained at ~5.14 GB, comfortably above the 1 GB minimum threshold.*

---

### 2.2. Sinhala Parity & Heading Verification (`logs\bill4-sinhala.txt`)
```
> aswanna@1.0.0 check:sinhala
> node shared/scripts/checkSinhala.js

✅ All Sinhala label & locale key parity checks passed successfully.
```

---

### 2.3. Bill Service Pytest Suite (`logs\bill4-pytest.txt`)
```
................................................                         [100%]
============================== warnings summary ===============================
.venv\Lib\site-packages\fastapi\testclient.py:1
  D:\Aswanna\bill-service\.venv\Lib\site-packages\fastapi\testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
48 passed, 1 warning in 3.12s
```

---

### 2.4. Server Bill Scan Test Suite (`logs\bill4-server-tests.txt`)
```
PASS tests/billScan.test.js (12.856 s)
  Bill Scan Route & Mapping Tests (TASK BILL-4)
    1. Pure Mapping Unit Tests (roundToStoredRupees & mapBillServiceToReviewItems)
      √ roundToStoredRupees handles integer, fractional cents, and zero correctly (993 ms)
      √ maps bill-service line items into canonical voice review shape with 8 categories (558 ms)
      √ creates single fallback row from vendor and total when no line items extracted (526 ms)
    2. Server Route Tests (/api/bill-scan)
      √ returns 404 when BILL_SCAN is off (649 ms)
      √ returns 401 when auth token is missing (618 ms)
      √ returns 400 for bad content type (728 ms)
      √ returns 400 for invalid magic bytes (681 ms)
      √ returns 413 for oversized file > 5 MB (585 ms)
      √ returns 503 when BILL_INTERNAL_TOKEN is unset (552 ms)
      √ maps upstream down / network error to 503 BILL_SERVICE_DOWN (532 ms)
      √ maps upstream 503 (Tesseract missing) to OCR_ENGINE_MISSING (548 ms)
      √ successfully proxies image and returns mapped items on 200 (614 ms)

Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Snapshots:   0 total
Time:        12.973 s
Ran all test suites matching /tests\\billScan.test.js/i.
```

---

### 2.5. Client Bill Scan Test Suite (`logs\bill4-client-tests.txt`)
```
> client@1.0.0 test
> vitest run src/test/BillScan.test.jsx


 RUN  v2.1.9 D:/Aswanna/client

 ✓ src/test/BillScan.test.jsx (5 tests) 527ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  15:43:26
   Duration  13.44s (transform 964ms, setup 469ms, collect 2.13s, tests 527ms, environment 2.75s, prepare 522ms)
```

---

### 2.6. Server Full Test Suite (`logs\bill4-server-full-tests.txt`)
```
PASS tests/forecast.test.js (8.938 s)
PASS tests/devVoiceCapture.test.js
PASS tests/datasetCollection.test.js (6.164 s)
PASS tests/voicePipelineRegression.test.js (5.022 s)
PASS tests/generativeNumberParser.test.js
PASS tests/logic.test.js
PASS tests/evalHarness.test.js
PASS tests/voiceExtract.test.js
PASS tests/voiceCommand.test.js
PASS tests/coverage.test.js
PASS tests/so1Contract.test.js
PASS tests/evaluatorMetrics.test.js
PASS tests/sinhalaNumbers.test.js
Test Suites: 21 passed, 21 total
Tests:       462 passed, 462 total
Snapshots:   0 total
Time:        148.679 s, estimated 217 s
Ran all test suites.
```

---

### 2.7. Client Full Test Suite (`logs\bill4-client-full-tests.txt`)
```
 Test Files  23 passed (23)
      Tests  131 passed (131)
   Start at  15:48:39
   Duration  57.84s (transform 10.59s, setup 22.01s, collect 74.03s, tests 40.15s, environment 112.48s, prepare 23.28s)
```

---

### 2.8. `shared/voice` Directory Hash Verification (`logs\bill4-voice-hashes.txt`)
```
9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02  asrConfusions.json
FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177  extractExpenses.js
B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7  keywordMap.json
27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D  parseCommand.js
EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38  sinhalaNumbers.js
6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687  sinhalaNumberWords.json
```
*Exact character-for-character match with pre-task hashes.*

---

## 3. Files Changed / Created

1. `server/src/config/env.js`: Added getters and setters for `BILL_SCAN` (default `'off'`), `BILL_SERVICE_URL` (default `'http://127.0.0.1:8010'`), and `BILL_INTERNAL_TOKEN` (default `''`).
2. `server/src/app.js`: Conditionally mounted `billScanRouter` at `/api/bill-scan` gated by `ENV.BILL_SCAN === 'on'`.
3. `server/src/routes/billScan.js` (NEW): Express route handler for `/api/bill-scan` with `requireAuth`, rate limiter, 5 MB stream limit, PNG/JPEG magic-byte validation, upstream proxying with `X-Internal-Token`, timeout, and 503 error mapping.
4. `server/src/services/billMapping.js` (NEW): Pure functions `roundToStoredRupees` and `mapBillServiceToReviewItems` to transform bill-service schema into `VoiceExpenseEntry` review items.
5. `client/src/components/VoiceExpenseEntry.jsx`: Added conditional Camera button (`capture="environment"`), file type/size validation, 1600px long edge downscaling, error/loading state, and appending to `pendingItems`.
6. `client/src/i18n/locales/en.json` & `client/src/i18n/locales/si.json`: Added `billScan` namespace keys and reason strings with ZWJ preserved.
7. `server/tests/billScan.test.js` (NEW): 12 server unit and integration tests.
8. `client/src/test/BillScan.test.jsx` (NEW): 5 client integration tests.
9. `docs/SO3-README.md`: Updated environment table, running instructions, and security boundary note.

---

## 4. Assumptions Made

- **CONFIRM WITH DoA:** Bill items without an unambiguous agronomic category match default to 'other' within the 8 canonical categories.
- **CONFIRM WITH DoA:** Sinhala translations for new bill scan UI actions are marked NATIVE REVIEW NEEDED for official agricultural extension review.

---

## 5. Not Done / Risks

- Did not commit to Git (per explicit instruction: "do not commit").
- Synthetic test split (`bill-scan-data/synthetic/test`) remained untouched and uninspected; lock file was neither read nor modified.
- Existing voice routes and Whisper/browser transcription pipelines were not touched.

---

## 6. Suggested Next Step

- Review `docs/bill4-report.md`.
- Once verified, the team can run a test execution against the test split (TASK BILL-5) or begin live user acceptance testing of the bill scanner camera button behind the feature flag.
