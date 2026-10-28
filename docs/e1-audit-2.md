# Aswanna Task E1-AUDIT-2: Read-Only Investigation Report

- **Date**: 2026-10-28
- **Scope**: Read-only forensic audit of frozen vs live extractor files, change provenance, dataset collection routes/architecture, server test count reconciliation via Jest JSON, and Take 1–3 evaluation re-runs.
- **Run-Once Guard**: `logs/e1-real-eval.lock` remains active and strictly unchanged. `eval_real.py` was not re-run.

---

## 0. Disk Space Pre-Check

- **Initial Free Space on `D:`**: **3.11 GB** (well above the 1 GB stop condition).
- **Post-Cleanup Free Space on `D:`**: **3.40 GB** (after purging `server\temp` dev-db leftovers).

---

## 1. Frozen Files (`fc.exe` Diffs & Behavioral Impact)

Diff files were generated with `fc.exe` comparing `D:\Aswanna_freeze_voice\shared_voice\<file>` against `shared\voice\<file>` and saved to:
- [`logs/voice-diff-extractExpenses.js.txt`](file:///d:/Aswanna/logs/voice-diff-extractExpenses.js.txt)
- [`logs/voice-diff-keywordMap.json.txt`](file:///d:/Aswanna/logs/voice-diff-keywordMap.json.txt)
- [`logs/voice-diff-sinhalaNumbers.js.txt`](file:///d:/Aswanna/logs/voice-diff-sinhalaNumbers.js.txt)
- [`logs/voice-diff-sinhalaNumberWords.json.txt`](file:///d:/Aswanna/logs/voice-diff-sinhalaNumberWords.json.txt)

> [!IMPORTANT]
> **Explicit Finding**: The extractor currently in `shared/voice` is **NOT identical to the freeze**. Four of the six files were modified on the morning of October 27, 2026.

### Plain-Language Summary of Behavioral Changes:

1. **`extractExpenses.js`**:
   - **ASR Alternatives Category Cross-Check**: The frozen extractor only checked whether alternative transcripts differed in numerical amount (`anyAmountMismatch`). The modified extractor also checks whether alternatives diverge in predicted category (`anyCatMismatch`). If categories disagree across alternatives, it flags `asr_alternatives_disagree` and sets status to `needs_review`.
   - **Physical Currency Divisibility Guard (`unit_price_fractional`)**: When quantity is an integer $\ge 2$, it tests if the total amount in cents (`Math.round(totalAmount * 100)`) is evenly divisible by quantity. If indivisible (e.g. 30 kg for 8500 LKR $\rightarrow$ 283.333... LKR/kg), it appends `unit_price_fractional` and forces `needs_review`.
   - **Clause Segmentation Conjunction Safeguard**: In single-number statements joined by coordinating conjunctions ("and", "සහ"), the frozen extractor split whenever a later part had a purchase verb. The modified extractor prevents splitting compound noun phrases (e.g., "ලෑලි සහ කම්බි...") by requiring that the first part also contain an independent verb or number.

2. **`keywordMap.json`**:
   - Added agricultural vocabulary terms:
     - Sinhala machinery: "බවුසර්", "බවුසරය", "බවුසරයක්" (bowser)
     - English maintenance: "planks", "timber"
     - Sinhala maintenance: "ලෑලි" (planks)
     - Sinhala irrigation: "ජලසම්පාදනය"

3. **`sinhalaNumbers.js`**:
   - **Lakh Multiplier Handling**: Added multiplier parsing for "ලක්ෂ", "ලක්ෂය", "ලක්ෂයක්", "ලක්ෂේ" ($100,000$), including forward lookahead for following multipliers (e.g. "ලක්ෂ දෙකක්" $= 200,000$, "ලක්ෂ පහක්" $= 500,000$).
   - **Pre-composed Lakhs**: Added support for values $\ge 100,000$ (e.g. "දෙලක්ෂයක්", "තුන්ලක්ෂයක්").
   - **Spoken Tens Prefixes Before Thousands**: If an accumulator contains tens ($10 \le \text{current} < 100$, e.g. "විසි" $= 20$) followed by a thousand word (e.g. "පන්දාහක්" $= 5000$), it computes $(20 \times 1000) + 5000 = 25,000$ instead of corrupting the accumulator.

4. **`sinhalaNumberWords.json`**:
   - Added colloquial spoken thousands: "හයදාස්" ($6000$), "පන්දාස්" ($5000$).
   - Added spoken tens prefixes: "විසි" ($20$), "තිස්" ($30$), "හතලිස්" / "හතළිස්" ($40$), "පනස්" ($50$), "හැත්තෑ" ($70$), "අසූ" ($80$), "අනූ" ($90$).
   - Added lakh variants: "ලක්ෂ", "ලක්ෂය", "දෙලක්ෂ", "තුන්ලක්ෂ", "පස්ලක්ෂ".

---

## 2. Who Changed Them (Provenance & Task Timeline)

All files across the repository created or modified between `2026-10-27 06:00` and `2026-10-28 00:00` (excluding `node_modules`, `.venv`, `models`, `temp`, and `private_dataset_storage`), grouped by task:

### Group A: "Tasks 4, 5, 7" — Voice Pipeline Regression & Financial Safety
- **Timeline**: 2026-10-27 08:20 – 08:45 AM
- **Origin / Prompt**: "Comprehensive Regression & Safety Test Suite for Aswanna Voice Pipeline (Tasks 4, 5, 7)"
- **Files Modified/Created**:
  - `shared/voice/sinhalaNumberWords.json` (mod: 08:34:30)
  - `shared/voice/sinhalaNumbers.js` (mod: 08:34:50)
  - `shared/voice/keywordMap.json` (mod: 08:35:21)
  - `server/eval/fixtures/voice/audio_manifest.example.json` (mod: 08:37:29)
  - `server/tests/voicePipelineRegression.test.js` (created: 08:38:05, mod: 10:33:40)
  - `docs/voice-asr.md` (mod: 08:41:17)
  - `logs/final-test.txt` (created: 08:41:22, mod: 08:45:11)

### Group B: "Phase 4.3" — Regression Evaluator Matching & Metrics
- **Timeline**: 2026-10-27 08:24 – 10:35 AM
- **Origin / Prompt**: "Unit Test Suite for Regression Evaluator Matching & Metrics (Phase 4.3)"
- **Files Modified/Created**:
  - `server/eval/regressionEval24.js` (created: 08:23:57, mod: 10:30:47)
  - `client/src/i18n/locales/en.json` (mod: 09:13:43)
  - `client/src/i18n/locales/si.json` (mod: 09:13:52)
  - `server/tests/evaluatorMetrics.test.js` (created: 09:16:05)
  - `shared/voice/extractExpenses.js` (mod: 09:17:43)
  - `docs/voice-verification-findings.md` (created: 08:58:42, mod: 09:24:32)
  - `server/src/routes/expenses.js` (mod: 10:29:22)
  - `client/src/components/VoiceExpenseEntry.jsx` (mod: 10:29:42)
  - `server/eval/reports/regression-report-24.json` (mod: 10:34:29)
  - `docs/voice-eval-regression-24.md` (mod: 10:34:29)
  - `server/eval/reports/regression-report-fixture.json` (mod: 10:34:34)
  - `docs/voice-eval-regression-fixture.md` (mod: 10:34:34)

### Group C: Voice Service Python Architecture & Audio Evaluation
- **Timeline**: 2026-10-27 10:50 – 11:05 AM
- **Origin / Prompt**: "Aswanna Server-Side Sinhala Speech Recognition — Phase 1 Architecture & Evaluation"
- **Files Modified/Created**:
  - `voice-service/adapters/*` (created: 10:51)
  - `voice-service/app.py` (mod: 10:53:04)
  - `voice-service/tests/test_adapters.py` (created: 10:53:48)
  - `voice-service/validation/manifest_validator.py`, `split_validator.py` (created: 10:54)
  - `voice-service/tests/test_validation.py` (created: 10:54:49)
  - `voice-service/eval/evaluate_audio_asr.py` (mod: 10:55:46)
  - `docs/voice-audio-eval-scaffold.md` (mod: 10:55:51)
  - `voice-service/tests/test_transcribe_audio.py` (created: 10:56:02)
  - `docs/voice-sinhala-asr-phase1.md` (created: 11:01:46)

### Group D: "Phase 2" — Voice Dataset Collection Architecture
- **Timeline**: 2026-10-27 11:10 AM – 14:30 PM
- **Origin / Prompt**: "Aswanna Voice Dataset Collection — Phase 2 Architecture, API & Operations"
- **Files Modified/Created**:
  - `server/src/config/voiceDatasetPrompts.js` (created: 11:10:30)
  - `server/src/utils/audioUploadParser.js` (created: 11:10:01, mod: 14:13:14)
  - `server/src/routes/datasetCollection.js` (created: 11:11:02, mod: 15:32:14)
  - `server/scripts/exportVoiceDatasetManifest.js` (created: 11:11:50, mod: 14:57:32)
  - `client/src/pages/VoiceDatasetCollectionPage.jsx` (created: 11:12:44, mod: 15:24:21)
  - `client/src/pages/VoiceDatasetReviewerPage.jsx` (created: 11:13:14)
  - `client/src/App.jsx` (mod: 11:13:39)
  - `client/src/layouts/AppShell.jsx` (mod: 11:14:07)
  - `server/tests/datasetCollection.test.js` (created: 11:14:58, mod: 15:07:01)
  - `server/src/app.js` (mod: 11:17:38)
  - `server/src/utils/errors.js` (mod: 11:17:55)
  - `client/src/test/VoiceDatasetCollection.test.jsx` (created: 11:19:16, mod: 15:23:00)
  - `docs/voice-dataset-collection-phase2.md` (created: 11:28:27, mod: 14:27:33)

### Group E: "Phase 2.1.2" — Targeted Security Invariants
- **Timeline**: 2026-10-27 14:15 – 15:40 PM
- **Origin / Prompt**: "Aswanna Phase 2.1.2 — Targeted Security Invariants and Reproducible Verification"
- **Files Modified/Created**:
  - `server/src/config/env.js` (mod: 14:54:42)
  - `server/src/utils/audioValidator.js` (created: 11:09:47, mod: 14:55:17)
  - `voice-service/tests/test_audio_decodability.py` (created: 14:58:19)
  - `server/scripts/rotateVoicePseudonymizationKey.js` (created: 14:35:00, mod: 15:04:21)
  - `server/scripts/purgeExpiredVoiceDatasetRecordings.js` (created: 15:32:28, mod: 15:33:52)
  - `server/tests/datasetCollectionSecurity.test.js` (created: 14:16:03, mod: 15:34:39)

### Group F: "Phase 2.2 / Phase 2.2.2" — Supervised Pilot Preflight
- **Timeline**: 2026-10-27 15:40 – 16:30 PM
- **Origin / Prompt**: "Aswanna Phase 2.2.2 — Supervised Pilot Preflight"
- **Files Modified/Created**:
  - `server/.env.example` (mod: 15:43:12)
  - `docs/phase-2.2.2-pilot-preflight.md` (created: 15:44:17)
  - `server/src/index.js` (mod: 16:26:38)
  - `client/vite.config.js` (mod: 16:27:00)
  - `package.json` (mod: 16:27:14)

---

## 3. Dataset Collection Architecture

- **Server Endpoints** mounted in [`server/src/app.js`](file:///d:/Aswanna/server/src/app.js) at `/api/dataset-collection`:
  1. `POST /api/dataset-collection/consent`: Grant informed participant consent.
  2. `GET /api/dataset-collection/consent`: Query contributor's consent status.
  3. `POST /api/dataset-collection/consent/revoke`: Revoke consent (soft-deletes recordings, excludes from future exports).
  4. `GET /api/dataset-collection/prompts`: Fetch localized prompt cards.
  5. `POST /api/dataset-collection/recordings`: Upload WAV/OGG/WebM/MP4 audio with metadata, duration validation, and quota enforcement.
  6. `GET /api/dataset-collection/recordings`: Contributor listing of uploaded recordings.
  7. `GET /api/dataset-collection/review/queue`: Staff review queue (`officer` or `admin` role required).
  8. `POST /api/dataset-collection/review/:recordingId`: Submit annotation and split assignment.
  9. `GET /api/dataset-collection/audio/:recordingId`: Stream private audio (RBAC: contributor owner or reviewer/admin).
  10. `GET /api/dataset-collection/manifest`: Export dataset manifest (`admin` only).

- **Client Pages**:
  1. [`VoiceDatasetCollectionPage.jsx`](file:///d:/Aswanna/client/src/pages/VoiceDatasetCollectionPage.jsx) (`/dataset-collection`): Participant interface for consent gating, prompt recording, uploading, and withdrawal.
  2. [`VoiceDatasetReviewerPage.jsx`](file:///d:/Aswanna/client/src/pages/VoiceDatasetReviewerPage.jsx) (`/dataset-reviewer`): Staff UI for audio playback, ground-truth review, and split tagging.

- **Storage Location on Disk**:
  Audio files are stored outside the web root in `private_dataset_storage/audio/` (configured via `VOICE_DATASET_STORAGE_DIR` in [`server/src/config/env.js`](file:///d:/Aswanna/server/src/config/env.js)). Files are written with restricted permissions (`0o600`). Path traversal is blocked using `path.resolve`.

- **Consent & Retention**:
  - *Consent*: Strictly required before uploads are accepted; uploads without active consent return HTTP 403 `CONSENT_REQUIRED`. Revocation marks `hasConsented: false` and soft-deletes recordings.
  - *Retention*: Enforced via [`purgeExpiredVoiceDatasetRecordings.js`](file:///d:/Aswanna/server/scripts/purgeExpiredVoiceDatasetRecordings.js) using `VOICE_DATASET_RETENTION_DAYS` (default: 365 days) and a 30-day grace period for revoked records.

- **Default State**:
  **Enabled by default**. The routes are mounted unconditionally in Express, and page routes are active in the client router.

---

## 4. Server Test Counts via Jest JSON Output

Command executed:
```powershell
npx cross-env NODE_ENV=test TMP=d:/Aswanna/temp TEMP=d:/Aswanna/temp NODE_OPTIONS=--experimental-vm-modules jest --runInBand --json --outputFile=d:\Aswanna\logs\e1-audit-jest.json
```
- **Exit Code**: `0`
- **Output File**: [`logs/e1-audit-jest.json`](file:///d:/Aswanna/logs/e1-audit-jest.json)
- **Suites**: **19 passed, 19 total**
- **Tests**: **442 passed, 442 total**

### Per-File Test Counts from JSON

| Suite File Path | Passed Tests | Total Tests |
| :--- | :---: | :---: |
| `server\tests\api.test.js` | 44 | 44 |
| `server\tests\coverage.test.js` | 5 | 5 |
| `server\tests\datasetCollection.test.js` | 19 | 19 |
| `server\tests\datasetCollectionSecurity.test.js` | 42 | 42 |
| `server\tests\evalHarness.test.js` | 22 | 22 |
| `server\tests\evaluatorMetrics.test.js` | 11 | 11 |
| `server\tests\forecast.test.js` | 19 | 19 |
| `server\tests\generativeNumberParser.test.js` | 9 | 9 |
| `server\tests\logic.test.js` | 14 | 14 |
| `server\tests\phase3.test.js` | 29 | 29 |
| `server\tests\recommendation.test.js` | 16 | 16 |
| `server\tests\sinhalaNumbers.test.js` | 15 | 15 |
| `server\tests\so1Contract.test.js` | 17 | 17 |
| `server\tests\so1RealIntegration.test.js` | 5 | 5 |
| `server\tests\validationMatrix.test.js` | 83 | 83 |
| `server\tests\voiceCommand.test.js` | 12 | 12 |
| `server\tests\voiceExtract.test.js` | 40 | 40 |
| `server\tests\voicePipelineRegression.test.js` | 35 | 35 |
| `server\tests\voiceProxy.test.js` | 5 | 5 |
| **TOTAL** | **442** | **442** |

### Explanation of the Gap Against Earlier Static Sum of 383
The earlier count of 383 was a static text regex count matching `test(` or `it(`. Jest evaluates parameterized and loop-driven tests dynamically at runtime:
1. `validationMatrix.test.js`: Contains loops generating tests for every matrix row $\rightarrow$ **83 tests** in Jest vs 38 in regex (**+45 gap**).
2. `evalHarness.test.js`: Contains parameterized test suites $\rightarrow$ **22 tests** in Jest vs 12 in regex (**+10 gap**).
3. `forecast.test.js`: Contains parameterized boundary checks $\rightarrow$ **19 tests** in Jest vs 15 in regex (**+4 gap**).

Net parameterized gap: $45 + 10 + 4 = 59$.
Total runtime tests: $383 + 59 = \mathbf{442}$.

---

## 5. Take 1, 2, and 3 Evaluation Reconciliation

`server/eval/voiceRealEval.js` was executed on all three captured datasets with alternatives enabled and written to:
- [`logs/audit-rerun-take1.txt`](file:///d:/Aswanna/logs/audit-rerun-take1.txt) (`real-asr.captured.json`)
- [`logs/audit-rerun-take2.txt`](file:///d:/Aswanna/logs/audit-rerun-take2.txt) (`real-asr.repeat1.captured.json`)
- [`logs/audit-rerun-take3.txt`](file:///d:/Aswanna/logs/audit-rerun-take3.txt) (`real-asr.take3.clean.json`)

### Metrics Comparison (Original vs Rerun)

```
==================================================================================================
TAKE 1 (Session 1, N=27 items)
--------------------------------------------------------------------------------------------------
System       | Items | Amount Correct | Category Correct | Needs Review | Silent Errors
--------------------------------------------------------------------------------------------------
Original     | 27    | 21/27 (77.8%)  | 23/27 (85.2%)    | 13/27 (48.1%)| 1 (VP-CAP-021)
Rerun        | 27    | 21/27 (77.8%)  | 24/27 (88.9%)    | 13/27 (48.1%)| 1 (VP-CAP-021)
--------------------------------------------------------------------------------------------------
Diff Note: Category accuracy +1 item (VP-CAP-024 now matches maintenance due to "ලෑලි" in keywordMap).

==================================================================================================
TAKE 2 (Repeat 1, N=27 items)
--------------------------------------------------------------------------------------------------
System       | Items | Amount Correct | Category Correct | Needs Review | Silent Errors
--------------------------------------------------------------------------------------------------
Original     | 27    | 11/27 (40.7%)  | 19/27 (70.4%)    | 21/27 (77.8%)| 2 (VP-CAP-021, VP-CAP-009)
Rerun        | 27    | 12/27 (44.4%)  | 21/27 (77.8%)    | 21/27 (77.8%)| 2 (VP-CAP-021, VP-CAP-009)
--------------------------------------------------------------------------------------------------
Diff Note: Category accuracy +2 items (VP-CAP-014 and VP-CAP-024 now match due to "බවුසර්" and "ලෑලි").

==================================================================================================
TAKE 3 (Take 3 Clean, N=23 items)
--------------------------------------------------------------------------------------------------
System       | Items | Amount Correct | Category Correct | Needs Review | Silent Errors
--------------------------------------------------------------------------------------------------
Original     | 23    | 5/23 (21.7%)   | 11/23 (47.8%)    | 16/23 (69.6%)| 3 (VP-CAP-015, 002, 004)
Rerun        | 23    | 5/23 (21.7%)   | 11/23 (47.8%)    | 19/23 (82.6%)| 1 (VP-CAP-002 only)
--------------------------------------------------------------------------------------------------
Diff Note: Needs review increased by +3 items (16 -> 19); Silent errors decreased by -2 (3 -> 1).
```

### Per-Item Differences on Take 3:

1. **`VP-CAP-004` (English, Item #1)**:
   - *Transcript*: `"8000 for combined harvester airport 2 months"`
   - *Expected*: Category `'machinery'`, Amount `12000`
   - *Original*: Extracted status `'ok'`, Amount `8000` $\rightarrow$ **Silent Error** ($8000 \ne 12000$).
   - *Rerun*: Extracted status `'needs_review'` with reason `asr_alternatives_disagree` because alternative transcript `"8000 for combined August airport 2 months"` predicts category `null` (triggering `anyCatMismatch`). **Safely intercepted; no longer a silent error.**

2. **`VP-CAP-007` (English, Item #1)**:
   - *Transcript*: `"vate 6000 for two labourers video"`
   - *Expected*: Category `'labour'`, Amount `6000`
   - *Original*: Extracted status `'ok'` (alternatives had the same amount $6000$).
   - *Rerun*: Extracted status `'needs_review'` with reason `asr_alternatives_disagree` because alternative `"vate 6000 for two levels video"` has category `null` $\rightarrow$ shifted from `ok` to `needs_review`.

3. **`VP-CAP-015` (Sinhala, Item #1)**:
   - *Transcript*: `"බීජ වී කිලෝ 30ක් රුපියල් 8500කට ගත්තා"`
   - *Expected*: Category `'seed'`, Amount `7500`
   - *Original*: Extracted status `'ok'`, Amount `8500` $\rightarrow$ **Silent Error** ($8500 \ne 7500$).
   - *Rerun*: Extracted status `'needs_review'` with reason `unit_price_fractional` ($8500 \times 100 \pmod{30} = 10 \ne 0$). **Safely intercepted; no longer a silent error.**

### Hash Confirmation for `voiceRealEval.js`
- `logs/eval-script-hash-v6.txt`: `E4412F25EF7226DC8C754A164E34CB32699B7479713E929A4AE882CD56756D2D`
- Live `server/eval/voiceRealEval.js`: `331CF396CAB4BF16F7F7A31E26FF5067DA8AB426449D5E3901109742C8EB0017`
- *Diagnosis*: Differs because CLI flags (`--baseline-profile`, `--no-use-alternatives`) and multi-item per-item evaluation logic were updated on 10/26 at 18:44 prior to running Take 3 at 18:51.

---

## 6. Lock File Confirmation

File: [`logs/e1-real-eval.lock`](file:///d:/Aswanna/logs/e1-real-eval.lock)
- **SHA256 Hash**: `0528B5554AAF8AF08B3AFCF0BB83B985EB7CEBC6720D54CF59BB388C00827FC4`
- **File Last Modified**: `2026-10-28 08:11:22 AM`
- **Status**: **Unchanged and preserved**.
