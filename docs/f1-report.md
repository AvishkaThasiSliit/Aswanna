# Task F1 Report: Freeze v2 and Side Effect Measurement

**Execution Date:** 2026-10-28  
**Working Directory:** `D:\Aswanna`  
**Disk Guard Status:** Passed (Initial: 3.11 GB free, Current: 3.40 GB free; threshold: >= 1.0 GB)  
**Safety Invariants:** No existing files, models, tests, or fixtures modified, reverted, or deleted. No `eval_real.py` re-run. `logs/e1-real-eval.lock` preserved.

---

## 1. Freeze v2

All files in `shared\voice` were copied to `D:\Aswanna_freeze_voice_v2\shared_voice`.  
The original freeze `D:\Aswanna_freeze_voice` was untouched.  
Hashes were written to `logs\freeze-v2-hashes.txt`.

### Hash Comparison (Freeze v1 vs Freeze v2)

> **Definition:**  
> `v1` = `D:\Aswanna_freeze_voice` (captured before 2026-10-27 08:20)  
> `v2` = `D:\Aswanna_freeze_voice_v2` (current live files as of 2026-10-28 09:15)

| File Name | SHA256 (Freeze v1) | SHA256 (Freeze v2) | Status |
|:---|:---|:---|:---|
| `asrConfusions.json` | `9e72e2ea1ad3efbc99c9dfd0094cad4ff57c3260097a6b91d7acaf282070da02` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | Identical |
| `extractExpenses.js` | `3361ce20f8eb33a9bb7f17be2d3795aa7e4e0ae848f0814f9d4e5f0dff33575b` | `FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177` | **Modified** |
| `keywordMap.json` | `7fb17bc093952ba53cb8242d8d85f5e55e092106725dc012a6df7a0fbead73ef` | `B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7` | **Modified** |
| `parseCommand.js` | `27b38e6df9b64ccadfe7c01b313e0b55fe9716b4e80073ff8e5222660f5ee02d` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | Identical |
| `sinhalaNumberWords.json` | `e99da5635f118ae26cbfd7f70bfa0ef9929230559ebfd0ff6b87640c30656a89` | `6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687` | **Modified** |
| `sinhalaNumbers.js` | `3ff490db0281b37dd19d93616238bfeea9c77cb365ee396b29efbbf5a7fffa01` | `EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38` | **Modified** |

---

## 2. Unit Price Fractional Effect (`dev.json`)

**Dataset:** `server/eval/fixtures/voice/dev.json` (38 phrases, 49 labelled items).  
**Evaluation Script:** Isolated Node.js runner outside the repository (`scratch/eval_dev_fractional.mjs`).

### Metrics & Counts

| Metric | Current Extractor (v2) | Frozen Extractor (v1) | Difference |
|:---|:---:|:---:|:---:|
| Total dev set phrases evaluated | 38 | 38 | 0 |
| Total dev set items evaluated | 49 | 49 | 0 |
| Items flagged with `unit_price_fractional` | **0** | **0** | **0** |
| Flagged where amount was right (false alarm) | **0** | **0** | **0** |
| Flagged where amount was wrong (catch) | **0** | **0** | **0** |
| Per-item status differences (v1 vs v2) | — | — | **0** |

### Per-Item Flagged Instances
- **Zero (0)** items received `unit_price_fractional` under either extractor.
- *Rationale from data:* All authored/synthetic benchmark phrases in `dev.json` that feature unit quantities specify prices that divide into exact integer rupee/cent values (e.g., 2 bags for Rs. 14,000 = Rs. 7,000/bag; 3 labourers for Rs. 7,500 = Rs. 2,500/labourer). As a result, `hasFractionalUnitPrice()` is not triggered on `dev.json`.

---

## 3. Keyword Additions Audit

Terms added to `keywordMap.json` between Freeze v1 and Freeze v2 (11 terms):
1. `traktor`
2. `tractor ekak`
3. `ට්‍රැක්ටර`
4. `water bowser`
5. `bowser`
6. `බවුසර්`
7. `බවුසරය`
8. `බවුසරයක්`
9. `planks`
10. `timber`
11. `ලෑලි`

### Occurrences in Real Captured Datasets (List Only)

| Added Term | `real-asr.captured.json` | `real-asr.repeat1.captured.json` | `real-asr.take3.clean.json` |
|:---|:---|:---|:---|
| `traktor` | **`VP-CAP-014`** | None | None |
| `tractor ekak` | None | None | None |
| `ට්‍රැක්ටර` | **`VP-CAP-014`**, **`VP-CAP-016`** | **`VP-CAP-014`**, **`VP-CAP-016`** | None |
| `water bowser` | None | None | None |
| `bowser` | None | None | None |
| `බවුසර්` | None | None | None |
| `බවුසරය` | None | None | None |
| `බවුසරයක්` | None | None | None |
| `planks` | None | None | None |
| `timber` | None | None | None |
| `ලෑලි` | **`VP-CAP-024`** | **`VP-CAP-024`** | None |

*Summary:* Only 3 of the 11 terms (`traktor`, `ට්‍රැක්ටර`, `ලෑලි`) appear across transcripts/alternatives in the captured real sets. 8 terms do not appear.

---

## 4. Dataset Collection Defaults (Read-Only)

### 4.1 Route Availability Without Environment Flags
- **Server Route:** In `server/src/app.js` (line 45):
  ```javascript
  app.use('/api/dataset-collection', datasetCollectionRoutes);
  ```
  The route is mounted unconditionally at server startup. There is no feature flag, environment gate, or toggle.
- **Client Routes:** In `client/src/App.jsx` (lines 40, 44):
  ```jsx
  <Route path="dataset-collection" element={<DatasetCollectionPage />} />
  <Route path="dataset-collection/review" element={<DatasetReviewPage />} />
  ```
  Both dataset collection client pages are mounted unconditionally in the application router.

### 4.2 Git Exclusion (`.gitignore`)
- **Root `.gitignore`:** Does not exist (`D:\Aswanna\.gitignore` is absent).
- **Directory-level `.gitignore`:** `D:\Aswanna\private_dataset_storage\.gitignore` exists and contains:
  ```text
  *
  !.gitignore
  ```
  All contents within `private_dataset_storage` (except `.gitignore` itself) are ignored by Git.

### 4.3 Files in `private_dataset_storage`
- **Location:** `D:\Aswanna\private_dataset_storage`
- **Total file count:** **886** files
  - `1` file: `.gitignore`
  - `885` files: `.wav` audio files (names follow pattern `recording-<timestamp>-<hash>.wav`, e.g., `recording-1740683070404-123689408.wav`)
- *(Note: A secondary directory `D:\Aswanna\server\private_dataset_storage` contains 2 files: `recording-1740685959323-57973004.wav` and `recording-1740685973272-520658392.wav`)*

### 4.4 Default Secrets in `server/src/config/env.js` and `server/.env.example`
- **`server/src/config/env.js` Defaults:**
  - `VOICE_PSEUDONYMIZATION_KEY`: `process.env.VOICE_PSEUDONYMIZATION_KEY || 'aswanna-voice-pseudo-salt-secret-key-2026'`
  - `JWT_SECRET`: `process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod'`
  - `VOICE_INTERNAL_TOKEN`: `process.env.VOICE_INTERNAL_TOKEN || 'aswanna-internal-voice-secret-token'`
  - *Production Safeguard:* `getPseudonymizationKey()` enforces that if `NODE_ENV === 'production'`, `VOICE_PSEUDONYMIZATION_KEY` must be set, cannot equal the fallback string, and must be at least 32 characters long.
- **`server/.env.example` Defaults:**
  - `JWT_SECRET=dev-jwt-secret-change-in-prod`
  - `VOICE_PSEUDONYMIZATION_KEY=change-in-prod-high-entropy-pseudo-key-32chars-min`
  - `VOICE_INTERNAL_TOKEN=aswanna-internal-voice-secret-token`
  - `DATASET_STORAGE_DIR=private_dataset_storage`
