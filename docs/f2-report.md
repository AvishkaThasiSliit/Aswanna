# Task F2 Report: Baseline Truth, Keyword Forensics, Dataset Storage, and Gitignore Audit

**Execution Date:** 2026-10-28  
**Working Directory:** `D:\Aswanna`  
**Disk Guard Status:** Passed (3.40 GB free on `D:`, threshold: $\ge 1.0\text{ GB}$)  
**Mode:** Strictly read-only. No files edited, moved, audio opened, or deleted. No servers or voice service started.

---

## 1. Baseline Truth (SHA256 Hashes & Freeze Consistency)

### Hash Comparison Table

| File Name in `shared\voice\` | (a) `logs\live-hashes-before.txt` | (b) `logs\freeze-hashes.txt` | (c) Fresh Hash `D:\Aswanna_freeze_voice\shared_voice\` | (d) Current Live `D:\Aswanna\shared\voice\` | (e) `D:\Aswanna_freeze_voice_v2\shared_voice\` | LastWriteTime of Freeze v1 File |
|:---|:---|:---|:---|:---|:---|:---|
| `asrConfusions.json` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | `9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02` | 2026-10-26 14:33:09 |
| `extractExpenses.js` | `0481832CD3BDA05A9DD657A806BF7FA9AE46D9525465CB131214177B0E687AFB` | `0481832CD3BDA05A9DD657A806BF7FA9AE46D9525465CB131214177B0E687AFB` | `0481832CD3BDA05A9DD657A806BF7FA9AE46D9525465CB131214177B0E687AFB` | `FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177` | `FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177` | 2026-10-26 15:26:46 |
| `keywordMap.json` | `6C276A6DC21740C748A7D1C9C3766DEEBB5C9417EB1C7B3A29096C35C2D777E5` | `6C276A6DC21740C748A7D1C9C3766DEEBB5C9417EB1C7B3A29096C35C2D777E5` | `6C276A6DC21740C748A7D1C9C3766DEEBB5C9417EB1C7B3A29096C35C2D777E5` | `B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7` | `B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7` | 2026-10-26 14:45:04 |
| `parseCommand.js` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | `27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D` | 2026-10-26 13:08:31 |
| `sinhalaNumbers.js` | `6DBEBBAD4DCCCA785060B4F14D905760EBB78D8A738761BA48F191DF5582EBC7` | `6DBEBBAD4DCCCA785060B4F14D905760EBB78D8A738761BA48F191DF5582EBC7` | `6DBEBBAD4DCCCA785060B4F14D905760EBB78D8A738761BA48F191DF5582EBC7` | `EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38` | `EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38` | 2026-10-26 15:09:04 |
| `sinhalaNumberWords.json` | `327EE9522F6EE037262D055463755703F98CD409F46F0C844BAACFC4D70DFCDC` | `327EE9522F6EE037262D055463755703F98CD409F46F0C844BAACFC4D70DFCDC` | `327EE9522F6EE037262D055463755703F98CD409F46F0C844BAACFC4D70DFCDC` | `6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687` | `6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687` | 2026-10-26 15:07:29 |

### Column Agreement Statement
Columns (a), (b), and (c) agree across all six files, and columns (d) and (e) agree across all six files; columns (b) and (c) are completely identical, confirming the freeze folder was not altered after it was recorded.

---

## 2. KeywordMap Raw Diff & Term Presence

### Raw `fc.exe` Output
```text
Comparing files D:\ASWANNA_FREEZE_VOICE\SHARED_VOICE\keywordMap.json and D:\ASWANNA\SHARED\VOICE\KEYWORDMAP.JSON
***** D:\ASWANNA_FREEZE_VOICE\SHARED_VOICE\keywordMap.json
    { "term": "ploughing", "lang": "en", "source": "Department of Agriculture Sri Lanka - Cost of Cultivation (DoA COC)" },
    { "term": "ට්‍රැක්ටරේ", "lang": "si", "source": "Department of Agriculture Sri Lanka - Cost of Cultivat
***** D:\ASWANNA\SHARED\VOICE\KEYWORDMAP.JSON
    { "term": "ploughing", "lang": "en", "source": "Department of Agriculture Sri Lanka - Cost of Cultivation (DoA COC)" },
    { "term": "traktor", "lang": "en", "source": "observed-in-captured-data" },
    { "term": "tractor ekak", "lang": "en", "source": "observed-in-captured-data" },
    { "term": "ට්‍රැක්ටරේ", "lang": "si", "source": "Department of Agriculture Sri Lanka - Cost of Cultivat
*****

***** D:\ASWANNA_FREEZE_VOICE\SHARED_VOICE\keywordMap.json
vation (DoA COC)" },
    { "term": "ට්‍රැක්ටර්", "lang": "si", "source": "Department of Agriculture Sri Lanka - Cost of Cultivat
***** D:\ASWANNA\SHARED\VOICE\KEYWORDMAP.JSON
vation (DoA COC)" },
    { "term": "ට්‍රැක්ටර", "lang": "si", "source": "Department of Agriculture Sri Lanka - Cost of Cultivation
 (DoA COC)" },
    { "term": "ට්‍රැක්ටර්", "lang": "si", "source": "Department of Agriculture Sri Lanka - Cost of Cultivat
*****

***** D:\ASWANNA_FREEZE_VOICE\SHARED_VOICE\keywordMap.json
    { "term": "irrigation", "lang": "en", "source": "shared/config/so1Mapping.js" },
    { "term": "water board", "lang": "en", "source": "author-assumption" },
***** D:\ASWANNA\SHARED\VOICE\KEYWORDMAP.JSON
    { "term": "irrigation", "lang": "en", "source": "shared/config/so1Mapping.js" },
    { "term": "water bowser", "lang": "en", "source": "observed-in-captured-data" },
    { "term": "bowser", "lang": "en", "source": "observed-in-captured-data" },
    { "term": "water board", "lang": "en", "source": "author-assumption" },
*****

***** D:\ASWANNA_FREEZE_VOICE\SHARED_VOICE\keywordMap.json
    { "term": "ජලසම්පාදනය", "lang": "si", "source": "author-assumption" },
    { "term": "ජල සම්පාදන", "lang": "si", "source": "author-assumption" }
  ],
***** D:\ASWANNA\SHARED\VOICE\KEYWORDMAP.JSON
    { "term": "ජලසම්පාදනය", "lang": "si", "source": "author-assumption" },
    { "term": "ජල සම්පාදන", "lang": "si", "source": "author-assumption" },
    { "term": "බවුසර්", "lang": "si", "source": "observed-in-captured-data" },
    { "term": "බවුසරය", "lang": "si", "source": "observed-in-captured-data" },
    { "term": "බවුසරයක්", "lang": "si", "source": "observed-in-captured-data" }
  ],
*****

***** D:\ASWANNA_FREEZE_VOICE\SHARED_VOICE\keywordMap.json
    { "term": "fence", "lang": "en", "source": "author-assumption" },
    { "term": "sprayer repair", "lang": "en", "source": "author-assumption" },
***** D:\ASWANNA\SHARED\VOICE\KEYWORDMAP.JSON
    { "term": "fence", "lang": "en", "source": "author-assumption" },
    { "term": "planks", "lang": "en", "source": "author-assumption" },
    { "term": "timber", "lang": "en", "source": "author-assumption" },
    { "term": "sprayer repair", "lang": "en", "source": "author-assumption" },
*****

***** D:\ASWANNA_FREEZE_VOICE\SHARED_VOICE\keywordMap.json
    { "term": "කම්බි", "lang": "si", "source": "author-assumption" },
    { "term": "වැට", "lang": "si", "source": "author-assumption" },
***** D:\ASWANNA\SHARED\VOICE\KEYWORDMAP.JSON
    { "term": "කම්බි", "lang": "si", "source": "author-assumption" },
    { "term": "ලෑලි", "lang": "si", "source": "observed-in-captured-data" },
    { "term": "වැට", "lang": "si", "source": "author-assumption" },
*****
```

### Term Existence in Freeze Folder vs Live

| Term | In (a) Freeze Folder Copy (`D:\Aswanna_freeze_voice`) | In (b) Live (`D:\Aswanna\shared\voice`) | Notes |
|:---|:---:|:---:|:---|
| `ජලසම්පාදනය` | **YES** | **YES** | Exists in both copies under `irrigation` category (`"source": "author-assumption"`). |
| `traktor` | **NO** | **YES** | Added in live under `machinery` category (`"source": "observed-in-captured-data"`). |
| `ට්රැක්ටර` (Exact prompt codepoints: U+0DA7 U+0DCA U+0DBB U+0DD0 U+0D9A U+0DCA U+0DA7 U+0DBB) | **NO** | **NO** | Does not match either file due to missing ZWJ. |
| `ට්‍රැක්ටර` (Standard Sinhala rakaransaya with ZWJ: U+0DA7 U+0DCA U+200D U+0DBB U+0DD0 U+0D9A U+0DCA U+0DA7 U+0DBB) | **NO** | **YES** | Added in live under `machinery` category (`"source": "Department of Agriculture..."`). |
| `ලෑලි` | **NO** | **YES** | Added in live under `other` category (`"source": "observed-in-captured-data"`). |

---

## 3. Dataset Storage Forensics (Metadata Only)

### Storage Metrics

| Metric | `D:\Aswanna\private_dataset_storage` | `D:\Aswanna\server\private_dataset_storage` |
|:---|:---|:---|
| **Total file count** | **886** (885 audio files in `audio/`, 1 `.gitignore` at root) | **2** (2 audio files in `audio/`, 0 at root) |
| **Total MB** | **28.0981 MB** (29,462,992 bytes) | **0.0306 MB** (32,088 bytes) |
| **Min file size** | 52 bytes (`.gitignore`) / 32,044 bytes (audio only) | 16,044 bytes |
| **Median file size** | 32,044 bytes | 16,044 bytes |
| **Max file size** | 64,044 bytes | 16,044 bytes |
| **Number of distinct file sizes** | **4** (52 B, 32,044 B, 48,044 B, 64,044 B) | **1** (16,044 B) |
| **Distinct size distribution** | • 52 B: 1 file (`.gitignore`)<br>• 32,044 B: 836 files (1.0s mono 16kHz WAV)<br>• 48,044 B: 29 files (1.5s mono 16kHz WAV)<br>• 64,044 B: 20 files (2.0s mono 16kHz WAV) | • 16,044 B: 2 files (0.5s mono 16kHz WAV) |
| **Earliest LastWriteTime** | 2026-10-27T11:15:23 | 2026-10-27T15:33:37 |
| **Latest LastWriteTime** | 2026-10-28T08:47:57 | 2026-10-27T15:33:37 |
| **Files per day** | • 2026-10-27: 718 files<br>• 2026-10-28: 168 files | • 2026-10-27: 2 files |

### Test Storage Directory Configuration & Deletion Behavior
- **Configuration Default:** `server/src/config/env.js` (line 14) configures:
  `VOICE_DATASET_STORAGE_DIR: process.env.VOICE_DATASET_STORAGE_DIR || 'private_dataset_storage/audio'`
- **Route Storage Resolution:** `server/src/routes/datasetCollection.js` (lines 24-27) resolves:
  `path.join(__dirname, '../../../', ENV.VOICE_DATASET_STORAGE_DIR)` $\rightarrow$ `D:\Aswanna\private_dataset_storage\audio`.
- **Test Ingestion Resolution:**
  - `server/tests/datasetCollectionSecurity.test.js` lines 434-436, 731-733 use `path.join(process.cwd(), ENV.VOICE_DATASET_STORAGE_DIR)`, which when executed from `server/` writes to `D:\Aswanna\server\private_dataset_storage\audio` (producing the 2 files on 2026-10-27). Line 1332 uses `path.resolve(process.cwd(), '../', ENV.VOICE_DATASET_STORAGE_DIR)`, pointing to `D:\Aswanna\private_dataset_storage\audio`.
- **Temp Directory Override:** **No.** Neither `server/tests/datasetCollection.test.js` nor `server/tests/datasetCollectionSecurity.test.js` overrides `VOICE_DATASET_STORAGE_DIR` to a temporary directory.
- **Deletion After Tests:** **No.** `server/tests/datasetCollection.test.js` has zero `unlink` calls and performs no cleanup of uploaded audio files. Only 3 specific tests in `datasetCollectionSecurity.test.js` delete specific test fixtures via `unlinkSync`. All other files uploaded through test runs remain permanently stored on disk.
- **Database Reachability:**
  - `server\.env` does not exist (`False`).
  - No database is configured in `server\.env`.
  - MongoDB port 27017 connection timed out (not reachable).

---

## 4. Gitignore Audit

### All `.gitignore` Files Under `D:\Aswanna` (Excluding `node_modules`)
1. `.pytest_cache\.gitignore`
2. `ml\.venv\.gitignore`
3. `private_dataset_storage\.gitignore`
4. `Profit Folder\COC folder\frontend\.gitignore`
5. `Profit Folder\Price folder\veg_price_forecasting\frontend\.gitignore`
6. `Profit Folder\profit_engine\frontend\.gitignore`
7. `so1-service\.venv\.gitignore`
8. `voice-service\.venv\.gitignore`

*(Note: There is NO root `.gitignore` at `D:\Aswanna\.gitignore`)*.

### Repository Status & `git check-ignore -v` Execution
- `D:\Aswanna\.git` exists: **True**
- Command executed:
  ```powershell
  git check-ignore -v server/.env node_modules voice-service/.venv voice-service/models logs temp server/temp private_dataset_storage
  ```
- **Return Code:** `1`
- **Output:** `""` (Empty string)
- **Result per target:**
  - `server/.env`: ExitCode `1` (Not ignored)
  - `node_modules`: ExitCode `1` (Not ignored)
  - `voice-service/.venv`: ExitCode `1` (Not ignored)
  - `voice-service/models`: ExitCode `1` (Not ignored)
  - `logs`: ExitCode `1` (Not ignored)
  - `temp`: ExitCode `1` (Not ignored)
  - `server/temp`: ExitCode `1` (Not ignored)
  - `private_dataset_storage`: ExitCode `1` (Not ignored)
  *(Note: Inside `private_dataset_storage/`, child files like `private_dataset_storage/audio/file.wav` match `private_dataset_storage/.gitignore:2:*`, but none of the root target paths are ignored by git because no root `.gitignore` exists).*

---

## 5. Tokens & Storage Directory References

### `voice-service\app.py` Token & Host Binding
- **Token Reading (Line 27):**
  ```python
  INTERNAL_TOKEN = os.getenv("VOICE_INTERNAL_TOKEN", "aswanna-internal-voice-secret-token")
  ```
  It reads from environment variable `VOICE_INTERNAL_TOKEN` with a hardcoded fallback default string `'aswanna-internal-voice-secret-token'`.
- **Host Binding:**
  `voice-service\app.py` contains no `uvicorn.run()` and binds no host itself. In documentation (`docs/voice-asr.md`), it is instructed to be started via `uvicorn app:app --host 127.0.0.1 --port 8000` (server `env.js` defaults `VOICE_SERVICE_URL` to `http://127.0.0.1:8001`).
- **Starts Without a Token:**
  **Yes.** If no `VOICE_INTERNAL_TOKEN` is set, the service boots normally using the default token. If set to empty, it also boots without error.

### Grep Hits for `DATASET_STORAGE_DIR` and `VOICE_DATASET_STORAGE_DIR` Across `server\`

#### Standalone `DATASET_STORAGE_DIR` (not preceded by `VOICE_`):
- **0 hits**

#### `VOICE_DATASET_STORAGE_DIR` (17 hits across 5 files):
1. `server\.env.example:18`: `VOICE_DATASET_STORAGE_DIR=private_dataset_storage/audio`
2. `server\scripts\purgeExpiredVoiceDatasetRecordings.js:29`: `return path.isAbsolute(ENV.VOICE_DATASET_STORAGE_DIR)`
3. `server\scripts\purgeExpiredVoiceDatasetRecordings.js:30`: `? ENV.VOICE_DATASET_STORAGE_DIR`
4. `server\scripts\purgeExpiredVoiceDatasetRecordings.js:31`: `: path.join(REPO_ROOT, ENV.VOICE_DATASET_STORAGE_DIR);`
5. `server\src\config\env.js:14`: `VOICE_DATASET_STORAGE_DIR: process.env.VOICE_DATASET_STORAGE_DIR || 'private_dataset_storage/audio',`
6. `server\src\routes\datasetCollection.js:25`: `const dirPath = path.isAbsolute(ENV.VOICE_DATASET_STORAGE_DIR)`
7. `server\src\routes\datasetCollection.js:26`: `? ENV.VOICE_DATASET_STORAGE_DIR`
8. `server\src\routes\datasetCollection.js:27`: `: path.join(__dirname, '../../../', ENV.VOICE_DATASET_STORAGE_DIR);`
9. `server\tests\datasetCollectionSecurity.test.js:434`: `const storageDir = path.isAbsolute(ENV.VOICE_DATASET_STORAGE_DIR)`
10. `server\tests\datasetCollectionSecurity.test.js:435`: `? ENV.VOICE_DATASET_STORAGE_DIR`
11. `server\tests\datasetCollectionSecurity.test.js:436`: `: path.join(process.cwd(), ENV.VOICE_DATASET_STORAGE_DIR);`
12. `server\tests\datasetCollectionSecurity.test.js:731`: `const storageDir = path.isAbsolute(ENV.VOICE_DATASET_STORAGE_DIR)`
13. `server\tests\datasetCollectionSecurity.test.js:732`: `? ENV.VOICE_DATASET_STORAGE_DIR`
14. `server\tests\datasetCollectionSecurity.test.js:733`: `: path.join(process.cwd(), ENV.VOICE_DATASET_STORAGE_DIR);`
15. `server\tests\datasetCollectionSecurity.test.js:1330`: `const storageDir = path.isAbsolute(ENV.VOICE_DATASET_STORAGE_DIR)`
16. `server\tests\datasetCollectionSecurity.test.js:1331`: `? ENV.VOICE_DATASET_STORAGE_DIR`
17. `server\tests\datasetCollectionSecurity.test.js:1332`: `: path.resolve(process.cwd(), '../', ENV.VOICE_DATASET_STORAGE_DIR);`
