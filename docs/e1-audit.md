# Aswanna Task E1-AUDIT Report

- **Date**: 2026-10-28
- **Scope**: Read-only audit of test counts, harness consistency (Take 3), per-item results availability, and `shared/voice` hash integrity.
- **Run-Once Guard**: `logs/e1-real-eval.lock` remains active and untouched; no models, data, extractors, or tests were altered or re-run.

---

## 1. Test Counts Reconciliation & Diff

### Baseline vs Current Full Regression Comparison

| Suite / Workspace | Baseline (`logs/w1-test.txt`, 2026-10-27 05:22) | Current (`logs/e1-test.txt`, 2026-10-28 08:17) | Net Difference |
| :--- | :--- | :--- | :--- |
| **Server Jest Suites** | 15 suites passed / 15 total | 19 suites passed / 19 total | **+4 suites** |
| **Server Jest Tests** | 335 passed / 335 total | 442 passed / 442 total | **+107 tests** |
| **Client Vitest Files** | 21 files passed / 21 total | 22 files passed / 22 total | **+1 file** |
| **Client Vitest Tests** | 121 passed / 121 total | 126 passed / 126 total | **+5 tests** |

---

### Inventory of All Current Test Files

#### Server Test Suites (`server/tests`)

| File Name | Test Count | Creation Time | Last Modified | Creator Task / Origin |
| :--- | :---: | :---: | :---: | :--- |
| `api.test.js` | 44 | 2026-10-08 10:46:32 | 2026-10-20 11:30:03 | Phase 0.6: Core REST API & CRUD routes |
| `coverage.test.js` | 5 | 2026-10-08 08:50:16 | 2026-10-08 13:33:19 | Phase 0.6: Coverage requirements |
| `datasetCollection.test.js` **[NEW]** | 19 | 2026-10-27 11:14:58 | 2026-10-27 15:07:01 | **Phase 2**: Dataset collection endpoints, audio upload validation, review queue |
| `datasetCollectionSecurity.test.js` **[NEW]** | 42 | 2026-10-27 14:16:03 | 2026-10-27 15:34:39 | **Phase 2.1.2**: Quota enforcement, idempotency, disk-space, client disconnects, HMAC rotation |
| `evalHarness.test.js` | 12 | 2026-10-11 10:22:44 | 2026-10-11 10:46:23 | Phase 3: Evaluation harness verification |
| `evaluatorMetrics.test.js` **[NEW]** | 11 | 2026-10-27 09:16:05 | 2026-10-27 09:16:05 | **Phase 4.3**: Regression evaluator matching & metrics unit tests |
| `forecast.test.js` | 15 | 2026-10-22 17:21:35 | 2026-10-22 18:24:32 | Forecast engine unit and integration tests |
| `generativeNumberParser.test.js` | 9 | 2026-10-26 15:28:29 | 2026-10-26 15:29:07 | Generative number parser tests |
| `logic.test.js` | 14 | 2026-10-08 08:50:35 | 2026-10-20 11:32:09 | Business logic & financial rules |
| `phase3.test.js` | 29 | 2026-10-10 09:20:02 | 2026-10-11 11:18:37 | Phase 3 integration tests |
| `recommendation.test.js` | 16 | 2026-10-10 17:21:54 | 2026-10-22 13:03:52 | Crop recommendation tests |
| `sinhalaNumbers.test.js` | 15 | 2026-10-26 13:12:23 | 2026-10-26 15:12:31 | Spoken Sinhala number parsing |
| `so1Contract.test.js` | 17 | 2026-10-20 15:29:17 | 2026-10-22 12:25:50 | SO1 integration contract tests |
| `so1RealIntegration.test.js` | 5 | 2026-10-22 12:02:10 | 2026-10-22 12:05:01 | SO1 real service integration |
| `validationMatrix.test.js` | 38 | 2026-10-11 18:39:37 | 2026-10-20 11:55:41 | Validation matrix tests |
| `voiceCommand.test.js` | 12 | 2026-10-26 10:42:17 | 2026-10-26 10:42:17 | Voice command intent parsing |
| `voiceExtract.test.js` | 40 | 2026-10-26 09:40:47 | 2026-10-26 16:53:47 | Voice entity extraction tests |
| `voicePipelineRegression.test.js` **[NEW]** | 35 | 2026-10-27 08:38:05 | 2026-10-27 10:33:40 | **Tasks 4, 5, 7**: Voice pipeline regression & financial safety suite |
| `voiceProxy.test.js` | 5 | 2026-10-27 05:05:41 | 2026-10-27 05:06:17 | Task W1: Voice proxy & Whisper plumbing |
| **Total Server Tests** | **442** | | | **19 Suites (335 baseline + 107 new)** |

*Note*: `server/tests/setup.js` is the test environment setup file, not a test suite.

#### Client Test Files (`client/src/test`)

| File Name | Test Count | Creation Time | Last Modified | Creator Task / Origin |
| :--- | :---: | :---: | :---: | :--- |
| `ActivityCalendar.test.jsx` | 2 | 2026-10-11 15:06:56 | 2026-10-11 15:20:57 | Activity Calendar UI tests |
| `AlertsPage.test.jsx` | 4 | 2026-10-10 09:56:10 | 2026-10-10 15:11:31 | Alerts page UI tests |
| `asrConfidence.test.js` | 5 | 2026-10-27 04:58:27 | 2026-10-27 04:58:27 | Task W1: ASR confidence pure function |
| `BudgetOverview.test.jsx` | 7 | 2026-10-10 09:55:59 | 2026-10-22 12:28:02 | Budget overview dashboard tests |
| `CostImpactCard.test.jsx` | 3 | 2026-10-10 10:03:45 | 2026-10-10 15:12:05 | Cost impact card tests |
| `CropRecommendation.test.jsx` | 6 | 2026-10-10 17:22:09 | 2026-10-22 12:59:28 | Crop recommendation UI tests |
| `CycleNotes.test.jsx` | 3 | 2026-10-11 15:06:19 | 2026-10-20 11:52:24 | Cycle notes UI tests |
| `CycleSummary.test.jsx` | 3 | 2026-10-11 15:06:37 | 2026-10-11 15:14:33 | Cycle summary page tests |
| `DailyCostTrackerHub.test.jsx` | 4 | 2026-10-10 15:09:37 | 2026-10-11 11:20:58 | Daily cost tracker hub tests |
| `deleteUndo.test.jsx` | 7 | 2026-10-09 09:21:45 | 2026-10-09 09:21:45 | Soft delete & undo toast tests |
| `ExpenseForm.test.jsx` | 4 | 2026-10-09 10:29:23 | 2026-10-09 16:40:00 | Expense entry form tests |
| `FilterBar.test.jsx` | 5 | 2026-10-09 09:21:20 | 2026-10-09 09:21:20 | Filter bar component tests |
| `ForecastCard.test.jsx` | 6 | 2026-10-22 17:18:45 | 2026-10-22 18:24:08 | Forecast card component tests |
| `formatters.test.js` | 11 | 2026-10-09 09:20:52 | 2026-10-09 09:20:52 | Formatting utility unit tests |
| `HarvestSales.test.jsx` | 3 | 2026-10-11 15:05:54 | 2026-10-11 16:12:06 | Harvest & sales workflow tests |
| `i18n.test.js` | 3 | 2026-10-10 13:45:26 | 2026-10-11 09:17:00 | Localization unit tests |
| `SetupWizard.test.jsx` | 10 | 2026-10-11 12:11:09 | 2026-10-11 12:14:05 | Setup wizard step-by-step tests |
| `StatusBadge.test.jsx` | 8 | 2026-10-09 09:21:05 | 2026-10-09 09:21:05 | Status badge component tests |
| `validation.test.jsx` | 7 | 2026-10-11 18:35:29 | 2026-10-11 18:37:15 | UI validation error tests |
| `VoiceDatasetCollection.test.jsx` **[NEW]** | 5 | 2026-10-27 11:19:16 | 2026-10-27 15:23:00 | **Phase 2**: Dataset collection page, consent gating & withdrawal |
| `VoiceExpenseEntry.test.jsx` | 17 | 2026-10-26 10:20:48 | 2026-10-26 14:35:07 | Task V2: Voice expense entry UI tests |
| `VoiceExpenseEntryWhisper.test.jsx` | 3 | 2026-10-27 05:13:48 | 2026-10-27 05:16:51 | Task W1: Whisper mode plumbing tests |
| **Total Client Tests** | **126** | | | **22 Files (121 baseline + 5 new)** |

---

### Root Cause: Why 442/126 Appeared in `logs\e1-test.txt`

The earlier benchmark log `logs\w1-test.txt` was recorded at **2026-10-27 05:22:43 AM** upon concluding Task W1. At that exact timestamp, the repository had 15 server suites (335 tests) and 21 client files (121 tests).

Throughout the day of October 27, 2026, subsequent phases added 4 new server suites and 1 new client test file:
1. `tests/voicePipelineRegression.test.js` (+35 tests) was added at 08:38 AM during Tasks 4, 5, 7.
2. `tests/evaluatorMetrics.test.js` (+11 tests) was added at 09:16 AM during Phase 4.3.
3. `tests/datasetCollection.test.js` (+19 tests) and `client/src/test/VoiceDatasetCollection.test.jsx` (+5 tests) were added at 11:14 AM – 11:19 AM during Phase 2.
4. `tests/datasetCollectionSecurity.test.js` (+42 tests) was added at 14:16 (2:16 PM) during Phase 2.1.2.

When `npm test` ran in Task E1 on **2026-10-28 08:17:03 AM**, it ran all test files currently in `server/tests` and `client/src/test`. Consequently, Jest ran $335 + 107 = 442$ server tests (19 suites), and Vitest ran $121 + 5 = 126$ client tests (22 files).

---

## 2. Harness Consistency: Take 3 Comparison

### Parameter Invocation Comparison

| Option / Parameter | E1 Rule Bridge (`voice-learn/rule_bridge.mjs`) | `server/eval/voiceRealEval.js` | Impact / Discrepancy |
| :--- | :--- | :--- | :--- |
| `transcript` | Passed from `item.transcript \|\| item.rawTranscript` | Passed from `cap.rawTranscript` | Identical text passed |
| `lang` | **Omitted** (defaults to `undefined` / auto-detection) | Explicitly passed: `'si'` or `'en'` | Auto-detection matches explicit `'en'` on English cases |
| `today` | **Omitted** (defaults to `new Date()`) | Explicitly passed: `cap.timestamp.split('T')[0]` | Affects relative date resolution (e.g. `dateISO`) |
| `alternatives` | Passed: `item.alternatives \|\| []` | Passed: `useAlternatives ? cap.alternatives : null` | Identical alternatives array passed |
| `baselines` | **Omitted** (no category/total baseline bounds) | Passed if `--baseline-profile` is specified | In `take3-eval.txt`, profile was `None (unconstrained)` |

---

### Dataset Scoping Difference
- `server/eval/voiceRealEval.js` in `logs/take3-eval.txt` evaluates **all 20 recordings** in `real-asr.take3.clean.json` (12 English + 8 Sinhala), totaling **23 scored expected items** (14 English items + 9 Sinhala items).
- `voice-learn/eval_real.py` evaluates **English records only** (`rec.get("language") == "en"`, 12 recordings, 14 expected items).

---

### Take 3 Disagreements Audit (System R vs `take3-eval.txt`)

Comparing the 14 English items of Take 3 between `logs/take3-eval.txt` (English slice) and `logs/e1-real-eval.txt` (System R Take 3):

| Metric | `take3-eval.txt` (en) | `e1-real-eval.txt` (R Take 3) | Agreement |
| :--- | :---: | :---: | :--- |
| Evaluated Items | 14 | 14 | Exact Match |
| Amount Correct | 3/14 (21.4%) | 3/14 (21.4%) | Exact Match |
| Category Correct | 6/14 (42.9%) | 6/14 (42.9%) | Exact Match |
| **Needs Review** | **9/14 (64.3%)** | **11/14 (78.6%)** | **Disagrees (+2 in E1)** |
| **Silent Errors** | **2** | **1** | **Disagrees (-1 in E1)** |

#### Item-Level Disagreement Analysis:

1. **`VP-CAP-004` (Item #1, English)**:
   - *Transcript*: `"8000 for combined harvester airport 2 months"`
   - *Expected*: Category `'machinery'`, Amount `12000`, Quantity `2`, Unit `'hours'`
   - *In `logs/take3-eval.txt`*: Extracted Category `'machinery'`, Amount `8000`, Status `'ok'`. Because status was `'ok'` but amount was wrong ($8000 \ne 12000$), `voiceRealEval.js` flagged it as a **Silent Error**.
   - *In `voice-learn/eval_real.py`*: Extracted Category `'machinery'`, Amount `8000`, Status `'needs_review'` with reason `asr_alternatives_disagree` (due to second alternative `"8000 for combined August airport 2 months"`). Because its status was `'needs_review'`, it was classified as requiring human review and **not a silent error**. This accounts for both the +1 in `needs_review` and -1 in silent errors.

2. **`VP-CAP-015` (Item #1, Sinhala)**:
   - *Transcript*: `"බීජ වී කිලෝ 30ක් රුපියල් 8500කට ගත්තා"`
   - *Expected*: Category `'seed'`, Amount `7500`
   - *Extracted*: Category `'seed'`, Amount `8500`, Status `'ok'`
   - *In `logs/take3-eval.txt`*: Reported as a Sinhala silent error ($8500 \ne 7500$).
   - *In `voice-learn/eval_real.py`*: **Not present**. `eval_real.py` explicitly filters `rec.get("language") == "en"`, so all Sinhala records (including `VP-CAP-015`) are excluded from E1.

---

## 3. Per-Item Cross-Tabulation Status

Per-item extraction results were **NOT** saved to disk by the E1 evaluation script (`voice-learn/eval_real.py`).

Inspection of `voice-learn/eval_real.py` shows:
- Lines 360–366 write aggregate markdown tables, silent error summaries, bootstrap confidence intervals, and synthetic validation comparisons to `logs/e1-real-eval.txt`.
- Lock metadata is written to `logs/e1-real-eval.lock`.
- No per-item classification dump (JSON, CSV, or text) was output for the 42 individual items.

Following the prompt instruction (*"if per-item results were not saved, say so and stop this item"*), this item is formally stopped.

---

## 4. Hash Verification: `shared/voice/*` Integrity

Comparison between baseline hash records and live SHA256 hashes:

| File Path | `logs\live-hashes-before.txt` (2026-10-26 16:20) | Current Live Hash (`shared/voice/*`) | Current Timestamp | Status |
| :--- | :--- | :--- | :--- | :--- |
| `asrConfusions.json` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | 2026-10-26 14:33:09 | **MATCH** |
| `parseCommand.js` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | 2026-10-26 13:08:31 | **MATCH** |
| `extractExpenses.js` | `0481832CD3BDA05A9DD657A806BF7FA9AE46D9525465CB131214177B0E687AFB` | `FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177` | 2026-10-27 09:17:43 | Modified on 10/27 (Task 4/5/7) |
| `keywordMap.json` | `6C276A6DC21740C748A7D1C9C3766DEEBB5C9417EB1C7B3A29096C35C2D777E5` | `B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7` | 2026-10-27 08:35:21 | Modified on 10/27 (Task 4/5/7) |
| `sinhalaNumbers.js` | `6DBEBBAD4DCCCA785060B4F14D905760EBB78D8A738761BA48F191DF5582EBC7` | `EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38` | 2026-10-27 08:34:50 | Modified on 10/27 (Task 4/5/7) |
| `sinhalaNumberWords.json` | `327EE9522F6EE037262D055463755703F98CD409F46F0C844BAACFC4D70DFCDC` | `6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687` | 2026-10-27 08:34:30 | Modified on 10/27 (Task 4/5/7) |

### Key Observations:
1. **Task E1 Integrity**: Task E1 was initiated on **2026-10-28 07:58 AM**. Not a single file in `shared/voice/*` was edited or touched during Task E1 or this audit. All files retain their timestamps from the morning of October 27, 2026.
2. **Prior Task 4/5/7 Updates**: The four files with altered hashes were updated during Tasks 4, 5, and 7 on 10/27 morning to introduce compound Sinhala number words, agricultural vocabulary, and regression safety.
3. **Frozen Directory Preservation**: The directory `D:\Aswanna_freeze_voice\shared_voice` retains the frozen original versions corresponding identically to `logs\live-hashes-before.txt` and `logs\freeze-hashes.txt`.
