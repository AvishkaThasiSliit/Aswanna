# Aswanna SO3 Archive Report (Task ARCHIVE-1)

**Execution Date**: 2026-10-28  
**Target Archive Directory**: `D:\Aswanna_archive_2026-10-28`  
**Git Branch**: `master` | **Head Commit**: `f2821d4` ("Aswanna SO3: Financial tracking, variance engine, tiered alerts, voice pipeline, and documentation")  
**Git Working Tree Status**: Clean (`git status --short` = 0 lines)

---

## 1. Pre-Check Summary

### 1.1 Drive Free Space
- **Drive C:**: Used 174.90 GB, Free 0.16 GB.
- **Drive D:**: Used 297.91 GB, Free 2.09 GB (2,244,149,248 bytes).
- **Target Folder**: `D:\Aswanna_archive_2026-10-28` (located on D: where free space $\ge 1.5$ GB).

### 1.2 Reparse Points (Junctions / Symlinks)
All junctions and symlinks across `D:\Aswanna` and `D:\Aswanna_scratch_v1check` were identified and strictly avoided:
- Under `D:\Aswanna` (12 reparse points):
  - `D:\Aswanna\node_modules\client` (npm workspace junction)
  - `D:\Aswanna\node_modules\server` (npm workspace junction)
  - `D:\Aswanna\node_modules\shared` (npm workspace junction)
  - `D:\Aswanna\temp\pytest-of-EBAY\pytest-current` (pytest symlink)
  - `D:\Aswanna\temp\pytest-of-EBAY\pytest-2\test_run_once_guardcurrent` (pytest symlink)
  - `D:\Aswanna\temp\pytest-of-EBAY\pytest-3\test_run_once_guardcurrent` (pytest symlink)
  - `D:\Aswanna\temp\pytest-of-EBAY\pytest-4\test_run_once_guardcurrent` (pytest symlink)
  - `D:\Aswanna\voice-service\models\models--Systran--faster-whisper-base.en\...` (5 HuggingFace cache symlinks)
- Under `D:\Aswanna_scratch_v1check` (1 reparse point):
  - `D:\Aswanna_scratch_v1check\node_modules` (directory junction to `D:\Aswanna\node_modules`)
- **Handling**: Every reparse point was in an excluded directory (`node_modules`, `temp`, `voice-service/models`, `D:\Aswanna_scratch_v1check`). Zero reparse points were traversed, copied, or packaged.

### 1.3 Git State
- `.git` exists: `True`
- Branch: `* master`
- Latest commit: `f2821d4 Aswanna SO3: Financial tracking, variance engine, tiered alerts, voice pipeline, and documentation`
- `git status --short` line count: `0` (clean repository state)

### 1.4 Archive Size Estimation
- **Included source files**: 477 files, 7,523,471 bytes uncompressed (7.17 MB).
- **Estimated zip size**: ~1.3 - 2.5 MB.
- **Threshold**: Free space (2.09 GB) - 1.0 GB = 1.09 GB.
- **Result**: Estimated size (7.17 MB uncompressed) was well below the 1.09 GB threshold. Proceeded safely.

---

## 2. Inclusions, Exclusions, and Teammate Assets

### 2.1 Included in `archive-source.zip`
- `server/`: Express backend APIs, variance engine, evaluation harness, 15 test suites (442 tests).
- `client/`: React 18 UI, voice drawer, budget overview, Vitest suites (126 tests).
- `shared/`: Expense extractor (`extractExpenses.js`), command parser (`parseCommand.js`), Sinhala numeral transliteration (`sinhalaNumbers.js`), dictionaries (`keywordMap.json`, `sinhalaNumberWords.json`), confusions (`asrConfusions.json`), phasing (`phasing.js`), and variance (`variance.js`).
- `voice-service/`: FastAPI Whisper service code, adapters, requirements, tests.
- `voice-learn/`: CRF extractor training, evaluation pipeline, tests.
- `docs/`: All documentation (`SO3-README.md`, `voice-pipeline.md`, `voice-learned-extractor.md`, runbooks).
- `logs/`: All evaluation, audit, benchmark, and freeze verification logs.
- `scripts/`: Test runner scripts (`run_scope_tests.js`, `scope_inventory.py`).
- Root configuration: `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `AGENTS.md`, `.env.example`, `real-asr.captured.json`.
- Inside Zip: `ARCHIVE-README.md` and `MANIFEST.txt`.

### 2.2 Excluded Categories and Byte Counts
| Category | File Count | Uncompressed Bytes | Uncompressed MB | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `dir:node_modules` | 23,425 | 233,517,485 | 222.70 MB | Third-party dependencies; reproducible via `npm install` |
| `dir:.venv` | 10,505 | 501,638,864 | 478.40 MB | Python virtual environment; reproducible via `pip install` |
| `dir:.git` | 4,386 | 124,486,961 | 118.72 MB | Preserved separately as `archive-git.bundle` |
| `dir:voice-service/models` | 14 | 440,756,745 | 420.34 MB | Pretrained Whisper model weights (downloadable) |
| `dir:temp` | 692 | 426,837,426 | 407.06 MB | Temporary test caches and audio captures |
| `dir:.mongo-cache` | 4 | 65,045,449 | 62.03 MB | MongoDB memory server binary and memory dumps |
| `dir:private_dataset_storage` | 888 | 29,495,080 | 28.13 MB | Private audio dataset recordings (privacy guard) |
| `ext:.joblib` | 2 | 53,349 | 0.05 MB | Trained CRF model checkpoints (retrainable via `train.py`) |
| `dir:__pycache__` | 22 | 229,648 | 0.22 MB | Python bytecode files |
| `dir:.pytest_cache` | 6 | 3,555 | 0.00 MB | Pytest runtime cache |
| `dir:dist` | 4 | 1,216,886 | 1.16 MB | Client production build output (reproducible via `npm run build`) |
| `dir:coverage` | 1 | 11,424 | 0.01 MB | Test coverage reports |
| `file:.env` | 1 | 43 | 0.00 MB | Local environment credentials (excluded for security) |

### 2.3 Teammate Folders (Preserved on Disk, Excluded from Source Zip)
| Teammate Folder | File Count | Total Bytes | Total MB | Description |
| :--- | :--- | :--- | :--- | :--- |
| `Profit Folder/` | 45,437 | 960,216,267 | 915.73 MB | Profit modeling and financial forecasting engine |
| `ml/` | 15,102 | 425,673,639 | 405.95 MB | Agricultural machine learning yield models |
| `so1-service/` | 13,599 | 403,612,228 | 384.91 MB | IoT sensor & irrigation microservice |
| **Total Teammate Assets** | **74,138** | **1,789,502,134** | **1,706.59 MB** | Preserved untouched on `D:\Aswanna` |

---

## 3. Candidate Secret Scan Results

All 477 included candidate files were scanned against secret regex patterns (API keys, passwords, tokens, connection strings, private keys). 26 potential matches were detected; all were reviewed and verified to be safe development/test values or placeholders:

| File and Line | Type | Key | Masked Value | Status / Classification |
| :--- | :--- | :--- | :--- | :--- |
| `client/src/test/smoke.e2e.js:6` | `key_assignment` | `PASSWORD` | `Pass****23` | Dev test fixture password |
| `docs/SO3-README.md:37` | `key_assignment` | `TOKEN` | `your****en` | Documentation placeholder |
| `docs/runbook-heldout-en.md:37` | `key_assignment` | `TOKEN` | `<PAS****E>` | Documentation placeholder |
| `docs/runbook-heldout-en.md:48` | `key_assignment` | `TOKEN` | `<PAS****E>` | Documentation placeholder |
| `logs/f1-report.txt:101` | `key_assignment` | `SECRET` | `dev-****od` | Logged dev default JWT secret |
| `logs/f1-report.txt:102` | `key_assignment` | `TOKEN` | `aswa****en` | Logged dev default voice token |
| `server/src/config/env.js:11` | `mongo_conn_with_auth` | `[REDACTED]` | `[REDACTED]` | [REDACTED] |
| `server/tests/api.test.js:51` | `key_assignment` | `password` | `pass****23` | Test suite mock user credential |
| `server/tests/api.test.js:103` | `key_assignment` | `password` | `secr****23` | Test suite mock user credential |
| `server/tests/api.test.js:111` | `key_assignment` | `password` | `pass****23` | Test suite mock user credential |
| `server/tests/api.test.js:112` | `key_assignment` | `password` | `pass****23` | Test suite mock user credential |
| `server/tests/api.test.js:118` | `key_assignment` | `password` | `secr****23` | Test suite mock user credential |
| `server/tests/api.test.js:119` | `key_assignment` | `password` | `secr****23` | Test suite mock user credential |
| `server/tests/api.test.js:125` | `key_assignment` | `password` | `****` | Test suite mock user credential |
| `server/tests/api.test.js:126` | `key_assignment` | `password` | `****` | Test suite mock user credential |
| `server/tests/recommendation.test.js:44` | `key_assignment` | `password` | `Pass****23` | Test suite mock user credential |
| `server/tests/setup.js:12` | `key_assignment` | `TOKEN` | `test****en` | Test setup mock token |
| `server/tests/so1RealIntegration.test.js:49` | `key_assignment` | `password` | `Pass****23` | Test suite mock user credential |
| `server/tests/validationMatrix.test.js:398` | `key_assignment` | `password` | `Pass****3!` | Test suite mock user credential |
| `server/tests/validationMatrix.test.js:504` | `key_assignment` | `password` | `Pass****3!` | Test suite mock user credential |
| `server/tests/voicePipelineRegression.test.js:527` | `key_assignment` | `password` | `pass****23` | Test suite mock user credential |
| `server/tests/voicePipelineRegression.test.js:631` | `key_assignment` | `password` | `pass****23` | Test suite mock user credential |
| `server/tests/voicePipelineRegression.test.js:675` | `key_assignment` | `password` | `pass****23` | Test suite mock user credential |
| `server/tests/voiceProxy.test.js:19` | `key_assignment` | `password` | `Pass****3!` | Test suite mock user credential |
| `server/tests/voiceProxy.test.js:29` | `key_assignment` | `TOKEN` | `test****en` | Test mock voice token |
| `voice-service/adapters/hf_sinhala_adapter.py:103`| `key_assignment` | `token` | `sinh****se` | NLP token name ("sinhalese") |

---

## 4. Generated Archives & Checksums

All archives were written exclusively to the new directory `D:\Aswanna_archive_2026-10-28`:

| Filename | Byte Size | Size (MB) | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **`archive-source.zip`** | 1,388,999 | 1.32 MB | `5e96bcd5ad8750b271cca20c0f901e136b9e856bafdf39411f4d8f5cfd45b383` |
| **`archive-freeze.zip`** | 52,278 | 0.05 MB | `a7da24009963641c914df99d47c5c2ab2681499cf0af562988b116da9784b62c` |
| **`archive-git.bundle`** | 110,771,594 | 105.64 MB | `d4aaa1fd44301407d202573e7b4db506f8913dcbfafbaf390821c5099afbc759` |
| **`MANIFEST.txt`** | 50,700 | 0.05 MB | `cbf049133e65b832c8bba65517278f55b1ff4e668a6f63b385b806bf7c4ac9a8` |
| **`ARCHIVE-README.md`** | 6,799 | 0.01 MB | `2b21d022ce3d57e175380ddf590dd064b8032b2472cc04e594cad0d8a3e1e61d` |
| **`ARCHIVE-HASHES.txt`** | 751 | <0.01 MB | `971efeb3288f344fc8654ff9cb01851b3e8c9735dbe199e44ff4e6b2cff3df15` |

### Untouched Reference Backups
- **`D:\Aswanna.zip`**: 1,290,009,068 bytes (1,230.25 MB) | SHA256: `d4283885ee8452523ad29fb431a8b41a48802247de7b954aac86e5b4899f21b3`
- **`D:\Aswanna_backup_before_cleanup.zip`**: Historical archive recorded in `logs/cleanup-inventory.txt` (755,646,160 bytes); superseded by `D:\Aswanna.zip`.

---

## 5. Verification and Integrity Confirmation

### 5.1 Inspection Without Extraction
- `archive-source.zip`: Exactly 479 entries (477 project files + `ARCHIVE-README.md` + `MANIFEST.txt`). Zero forbidden directories or files present.
- `archive-freeze.zip`: Exactly 18 entries covering `D:\Aswanna_freeze_voice` and `D:\Aswanna_freeze_voice_v2`.

### 5.2 Test Extraction and 25-File Sample SHA-256 Match
Extracted to `D:\Aswanna_archive_verify`. 25 sampled files verified against live workspace:
1. `server/src/app.js`: **MATCH** (`e1adff18b6a5...`)
2. `server/src/config/env.js`: **MATCH** (`c7cc72d6bb15...`)
3. `server/tests/api.test.js`: **MATCH** (`f5fc7b01147d...`)
4. `server/eval/evaluate.js`: **MATCH** (`9c5567908ed3...`)
5. `server/eval/fixtures/voice/dev.json`: **MATCH** (`6302ef6572d5...`)
6. `server/eval/fixtures/voice/heldout-en.json`: **MATCH** (`b25c03b40754...`)
7. `client/src/App.jsx`: **MATCH** (`3339f6d0026d...`)
8. `client/src/components/VoiceExpenseEntry.jsx`: **MATCH** (`a6331cbf2d49...`)
9. `client/src/pages/BudgetOverview.jsx`: **MATCH** (`bf24731e7b30...`)
10. `client/src/test/smoke.e2e.js`: **MATCH** (`5c7cea51f352...`)
11. `client/src/test/VoiceExpenseEntry.test.jsx`: **MATCH** (`a0e9127e53ca...`)
12. `shared/phasing.js`: **MATCH** (`2e6afd441818...`)
13. `shared/variance.js`: **MATCH** (`c8597d47018f...`)
14. `shared/voice/asrConfusions.json`: **MATCH** (`9e72e2ea1ad3...`)
15. `shared/voice/extractExpenses.js`: **MATCH** (`fe6aae993b2c...`)
16. `shared/voice/keywordMap.json`: **MATCH** (`b71678a7a69b...`)
17. `shared/voice/parseCommand.js`: **MATCH** (`27b38e6df9b6...`)
18. `shared/voice/sinhalaNumbers.js`: **MATCH** (`ebf1dbdace5f...`)
19. `shared/voice/sinhalaNumberWords.json`: **MATCH** (`6486201b80e8...`)
20. `voice-service/app.py`: **MATCH** (`bba6c69249c3...`)
21. `voice-service/requirements.txt`: **MATCH** (`c7162198bfcd...`)
22. `voice-learn/train.py`: **MATCH** (`c3a502af6551...`)
23. `docs/SO3-README.md`: **MATCH** (`6966892135d5...`)
24. `logs/freeze-v2-hashes.txt`: **MATCH** (`40ef274c99b4...`)
25. `package.json`: **MATCH** (`4e2f417fbc5d...`)

### 5.3 Freeze v2 Verification
All 6 files in `shared/voice/` inside the extracted archive match `logs\freeze-v2-hashes.txt` 100%:
- `asrConfusions.json`: `9e72e2ea1ad3efbc99c9dfd0094cad4ff57c3260097a6b91d7acaf282070da02` -> **MATCH**
- `extractExpenses.js`: `fe6aae993b2c87e22db1bf1f4b4e9a9367e5eb88c13bf44417d9aac6e3e28177` -> **MATCH**
- `keywordMap.json`: `b71678a7a69b3aa2b50cb706ade1a04c27a3dee518d6ced68991d5eb89df36f7` -> **MATCH**
- `parseCommand.js`: `27b38e6df9b64ccadfe7c01b313e0b55fe9716b4e80073ff8e5222660f5ee02d` -> **MATCH**
- `sinhalaNumberWords.json`: `6486201b80e801dbb72436236eeb22e67a631e5c7fd9cc62361b7aa6b9ed7687` -> **MATCH**
- `sinhalaNumbers.js`: `ebf1dbdace5f1f350afc8d2b6ebcc13588d5617d9d3a3c772e37439ab3033d38` -> **MATCH**

### 5.4 Reparse Points and Cleanup
- Verification directory reparse point count: `0`
- `D:\Aswanna_archive_verify` cleanly removed: `True`

### 5.5 Repository Invariance Confirmation
No existing project files were modified, moved, or deleted. No test suite, server, or evaluation script was executed during this archive task.
