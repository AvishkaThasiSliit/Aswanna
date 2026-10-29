# Task SECURITY-1 Report: Database Credential Removal & Archive v2 Rebuild

**Execution Date**: 2026-10-28  
**Repository Working Directory**: `D:\Aswanna`  
**Target v2 Archive Directory**: `D:\Aswanna_archive_2026-10-28_v2`  
**Status**: COMPLETE - All Verifications Passed

---

## 1. Disk Free Space Guard

- **Free Space Before Task**: `2,132,140,032` bytes (2.09 GB / ~1.98 GiB)
- **Free Space After Task**: `1,814,589,440` bytes (1.81 GB / ~1.69 GiB)
- **Safety Threshold**: Minimum 1.0 GB free (Constraint met throughout execution).

---

## 2. Git Forensics (Read-Only)

### 2.1 Git Remotes & Commit History
```
$ git remote -v
origin	https://github.com/AvishkaThasiSliit/Aswanna.git (fetch)
origin	https://github.com/AvishkaThasiSliit/Aswanna.git (push)

$ git log --format="%h %an %ad %s"
f2821d4 AvishkaThasiSliit Wed Oct 28 12:31:20 2026 +0530 Aswanna SO3: Financial tracking, variance engine, tiered alerts, voice pipeline, and documentation
92d96d0 Avishka Thu Oct 8 16:14:39 2026 +0530 Phase 0.6: data layer hardened, 51 tests passing
```

### 2.2 Tracked Files by Top-Level Directory (`git ls-files`)
| Top-Level Directory | Tracked File Count | Tracked Status |
| :--- | :--- | :--- |
| `(root)` | 8 | Tracked |
| `Profit Folder/` | 3,088 | Tracked (pre-existing from Phase 0.6) |
| `client/` | 77 | Tracked |
| `docs/` | 34 | Tracked |
| `logs/` | 124 | Tracked |
| `ml/` | 34 | Tracked |
| `scripts/` | 2 | Tracked |
| `server/` | 183 | Tracked |
| `shared/` | 37 | Tracked |
| `so1-service/` | 15 | Tracked |
| `voice-learn/` | 13 | Tracked |
| `voice-service/` | 19 | Tracked |

**Specific Tracked Checks**:
- `Profit Folder`: Tracked (3,088 files)
- `ml`: Tracked (34 files)
- `so1-service`: Tracked (15 files)
- `node_modules`: **NOT tracked** (0 files)
- `.venv`: **NOT tracked** (0 files)
- `voice-service/models`: **NOT tracked** (0 files)
- `*.wav`: **NOT tracked** (0 files)
- `*.env` (secrets): **NOT tracked** (0 files)

### 2.3 15 Largest Objects in Git History
All 15 largest objects in Git history originate from the `Profit Folder` price forecasting module committed in Phase 0.6:
1. `6,995,956` bytes (`ac75f6b885`): `Profit Folder/Price folder/etl/_output/master_prices_long.csv`
2. `6,156,344` bytes (`776a38a30a`): `Profit Folder/Price folder/veg_price_forecasting/models/frozen/candidates/gradient_boosting_h8.joblib`
3. `6,124,936` bytes (`50b6003940`): `Profit Folder/Price folder/veg_price_forecasting/models/frozen/candidates/svr_h8.joblib`
4. `6,093,960` bytes (`8ae33c2d55`): `Profit Folder/Price folder/veg_price_forecasting/models/frozen/candidates/svr_h4.joblib`
5. `5,982,160` bytes (`32c07e0d5e`): `Profit Folder/Price folder/veg_price_forecasting/models/frozen/candidates/svr_h12.joblib`
6. `5,945,376` bytes (`7c35c58aa2`): `Profit Folder/Price folder/veg_price_forecasting/models/frozen/candidates/svr_h1.joblib`
7. `5,229,457` bytes (`b690f77821`): `Profit Folder/Price folder/veg_price_forecasting/models/extra_trees_h1.joblib`
8. `5,211,025` bytes (`9d3b6aa8b6`): `Profit Folder/Price folder/veg_price_forecasting/models/frozen/candidates/random_forest_h4.joblib`
9. `4,739,800` bytes (`0b0b93defe`): `Profit Folder/Price folder/veg_price_forecasting/models/frozen/candidates/gradient_boosting_h1.joblib`
10. `4,495,393` bytes (`55d517f1a5`): `Profit Folder/Price folder/veg_price_forecasting/models/extra_trees_h4.joblib`
11. `4,069,928` bytes (`fbe32c6b02`): `Profit Folder/Price folder/veg_price_forecasting/models/frozen/candidates/gradient_boosting_h12.joblib`
12. `3,600,481` bytes (`9848ccd291`): `Profit Folder/Price folder/veg_price_forecasting/models/extra_trees_h12.joblib`
13. `3,570,961` bytes (`7a6b128493`): `Profit Folder/Price folder/veg_price_forecasting/models/extra_trees_h8.joblib`
14. `3,291,457` bytes (`93d1f5f960`): `Profit Folder/Price folder/veg_price_forecasting/models/frozen/candidates/random_forest_h8.joblib`
15. `3,272,353` bytes (`1cd4e60306`): `Profit Folder/Price folder/veg_price_forecasting/models/frozen/candidates/random_forest_h12.joblib`

### 2.4 Credential Introduction & Git Blame
- **Commit introducing `mongodb+srv`**:
  - `git log -S"mongodb+srv" --oneline --all` returned only: `f2821d4 Aswanna SO3: Financial tracking, variance engine, tiered alerts, voice pipeline, and documentation`
- **Git Blame for line in `env.js`**:
  - Author: `AvishkaThasiSliit`
  - Author Time: `Wed Oct 28 12:31:20 2026 +0530` (timestamp `1793170880`)

---

## 3. Code Fix & Diff

### 3.1 `server/src/config/env.js`
Removed hard-coded fallback connection string. Automatically loads `.env` if available via `process.loadEnvFile`. In non-test modes, requires `MONGODB_URI` from the environment; fails immediately at startup with `CONFIG_ERROR` if missing. In `NODE_ENV=test`, defaults to empty string to permit in-memory MongoDB runner.

```diff
--- a/server/src/config/env.js
+++ b/server/src/config/env.js
@@ -1,14 +1,53 @@
 import path from 'path';
+import fs from 'fs';
 import { fileURLToPath } from 'url';
 
 const __filename = fileURLToPath(import.meta.url);
 const __dirname = path.dirname(__filename);
 
+// Attempt to load .env file if process.loadEnvFile is available
+if (typeof process.loadEnvFile === 'function') {
+  const candidateEnvPaths = [
+    path.resolve(process.cwd(), '.env'),
+    path.resolve(process.cwd(), 'server', '.env'),
+    path.resolve(__dirname, '../../..', '.env'),
+    path.resolve(__dirname, '../../..', 'server', '.env'),
+    path.resolve(__dirname, '../..', '.env')
+  ];
+  for (const envPath of candidateEnvPaths) {
+    if (fs.existsSync(envPath)) {
+      try {
+        process.loadEnvFile(envPath);
+        break;
+      } catch {
+        // continue if already loaded or unable to parse
+      }
+    }
+  }
+}
+
+const nodeEnv = process.env.NODE_ENV || 'development';
+
+function getValidatedMongoUri() {
+  if (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) {
+    return process.env.MONGODB_URI.trim();
+  }
+  if ((process.env.NODE_ENV || nodeEnv) === 'test') {
+    return ''; // test environment uses in-memory MongoMemoryServer
+  }
+  throw new Error('CONFIG_ERROR: MONGODB_URI environment variable is required. Please set MONGODB_URI in your environment or server/.env file.');
+}
+
 // Central env config – all process.env access lives here
 export const ENV = {
-  NODE_ENV: process.env.NODE_ENV || 'development',
+  NODE_ENV: nodeEnv,
   PORT: parseInt(process.env.PORT || '4000', 10),
-  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://[REDACTED]',
+  get MONGODB_URI() {
+    return getValidatedMongoUri();
+  },
+  set MONGODB_URI(val) {
+    process.env.MONGODB_URI = val;
+  },
   JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod',
   JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
```

### 3.2 `server/.env.example`
```diff
--- a/server/.env.example
+++ b/server/.env.example
@@ -1,7 +1,7 @@
 # Aswanna Server Environment Configuration Example
 NODE_ENV=development
 PORT=4000
-MONGODB_URI=mongodb://localhost:27017/aswanna
+MONGODB_URI=<your connection string>
 JWT_SECRET=dev-jwt-secret-change-in-prod
 JWT_EXPIRES_IN=7d
 RATE_LIMIT_WINDOW_MS=900000
```

### 3.3 `docs/SO3-README.md`
```diff
--- a/docs/SO3-README.md
+++ b/docs/SO3-README.md
@@ -73,7 +73,7 @@ All runtime variables are loaded through `server/src/config/env.js` and Vite's `
 | :--- | :--- | :--- | :--- |
 | `PORT` | `4000` | Port number | HTTP port for the Node.js Express server. |
 | `NODE_ENV` | `development` | `development` \| `production` \| `test` | Runtime environment mode. Disables dev routes in production. |
-| `MONGODB_URI` | `mongodb://localhost:27017/aswanna` | MongoDB URI | Connection string for MongoDB database instance. |
+| `MONGODB_URI` | *None* (Required) | MongoDB URI | Connection string for MongoDB. Must be set via environment / `server/.env` (server fails at startup if unset, except `NODE_ENV=test`). |
 | `JWT_SECRET` | `dev-jwt-secret-change-in-prod` | String | Secret key for signing and verifying JSON Web Tokens. |
 | `JWT_EXPIRES_IN` | `7d` | String (`7d`, `24h`) | Session token expiration duration. |
 | `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Milliseconds | Window size for Express rate limiting. |
```

### 3.4 `server/.env` Status & Git Ignore Confirmation
- `server/.env` exists: `True`
- `git check-ignore -v server/.env` output:
  ```
  .gitignore:5:.env	server/.env
  ```
- File content is protected and omitted from reports.

---

## 4. Redaction & Repository Credential Grep

### 4.1 Redaction of Prior Reports
- In `docs/archive-report.md`, credential fragments in the secret scan table were sanitized to `[REDACTED]`.
- In `logs/archive-report.txt`, verified that no credential strings or hosts were present.

### 4.2 Full Repository Grep (Excluding `node_modules`, `.venv`, `.git`, `temp`)
- Files matching `"mongodb+srv://"`:
  ```
  .mongo-cache\mongod-x64-win32-7.0.14.exe (binary executable)
  ```
- Files matching cluster host name (`cluster0.g8sc8.mongodb.net`):
  ```
  (None)
  ```
The database cluster hostname and credentials have been completely eradicated from codebase source and documentation files.

---

## 5. Verification & Test Execution

### 5.1 Server Startup & Database Connection Test
- **Command**: `node src/index.js` in `server/` with new `server/.env`
- **Result**:
  ```
  Local MongoDB not running. Starting MongoMemoryServer for dev...
  ✅ Connected to MongoMemoryServer at mongodb://127.0.0.1:50055/
  ✅ Database seeded successfully!
  🚀 Aswanna API listening on http://localhost:4000
  GET /api/health 200 4.055 ms - 15
  Health Response: {"status":"ok"}
  ```
- **Unset MONGODB_URI Startup Test**:
  When started in `NODE_ENV=development` with `MONGODB_URI` unset, startup failed immediately with the expected error:
  `CONFIG_ERROR: MONGODB_URI environment variable is required. Please set MONGODB_URI in your environment or server/.env file.`

### 5.2 Server Test Suite Output Tail
```
PASS tests/forecast.test.js (8.007 s)
PASS tests/phase3.test.js (8.318 s)
PASS tests/datasetCollection.test.js (5.319 s)
PASS tests/voiceProxy.test.js (5.259 s)
PASS tests/generativeNumberParser.test.js
PASS tests/devVoiceCapture.test.js (5.526 s)
PASS tests/logic.test.js
PASS tests/coverage.test.js
PASS tests/voiceExtract.test.js
PASS tests/sinhalaNumbers.test.js
PASS tests/evalHarness.test.js
PASS tests/voiceCommand.test.js
PASS tests/evaluatorMetrics.test.js
PASS tests/so1Contract.test.js

Test Suites: 20 passed, 20 total
Tests:       450 passed, 450 total
Snapshots:   0 total
Time:        134.865 s, estimated 311 s
Ran all test suites.
```

### 5.3 Client Test Suite Output Tail
```
 ✓ src/test/CostImpactCard.test.jsx (3 tests) 1563ms
 ✓ src/test/StatusBadge.test.jsx (8 tests) 160ms
 ✓ src/test/FilterBar.test.jsx (5 tests) 635ms
 ✓ src/test/AlertsPage.test.jsx (4 tests) 1086ms
 ✓ src/test/formatters.test.js (11 tests) 51ms
 ✓ src/test/i18n.test.js (3 tests) 59ms

 Test Files  22 passed (22)
      Tests  126 passed (126)
   Start at  14:59:17
   Duration  45.93s (transform 7.95s, setup 18.56s, collect 60.06s, tests 32.14s, environment 96.50s, prepare 17.53s)
```

### 5.4 Evaluate.js Benchmark Output Tail
```
   Alert Latency (220 runs, same-request):
     p50: 63.98 ms, p95: 108.11 ms
     Same-request alert present: 100.0%
   API Response Times (CRUD + Variance, target < 2 s):
     createExpense   : p50 = 86.49 ms, p95 = 148.95 ms (Target Met: YES)
     listExpenses    : p50 = 23.81 ms, p95 = 27.92 ms (Target Met: YES)
     updateExpense   : p50 = 87.01 ms, p95 = 160.55 ms (Target Met: YES)
     deleteExpense   : p50 = 38.70 ms, p95 = 88.94 ms (Target Met: YES)
     getVariance     : p50 = 28.20 ms, p95 = 38.94 ms (Target Met: YES)

6. Writing output reports...
   Wrote JSON metrics to: D:\Aswanna\server\eval\evaluation-results.json
   Wrote Markdown report to: D:\Aswanna\docs\evaluation-report.md

===============================================================
                 EVALUATION COMPLETE - ALL PASS                
===============================================================
```

### 5.5 Temp Folders Inspection
- `server\temp`: Empty (0 files).
- `client\temp`: Empty (0 files).
- Root `temp\`: Inspected. Contains OS and system-wide files (`WinGet`, `_avast_`, `system-commandline-sentinel-files`, `dd_BackgroundDownload*`). Because it did NOT contain *only* test-created files, it was preserved untouched per instructions.

---

## 6. Rebuilt Archive Deliverables (v2)

Built into the new folder [`D:\Aswanna_archive_2026-10-28_v2`](file:///D:/Aswanna_archive_2026-10-28_v2):

| File | Byte Size | Size (MB) | SHA-256 Checksum | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`archive-source.zip`** | 1,461,081 | 1.39 MB | `811c66318989977f58b2d5066dc874354b841462036cc71aa93498172d525671` | Clean source code + `voice-learn/models/*.joblib` (500 entries) |
| **`archive-freeze.zip`** | 52,278 | 0.05 MB | `a7da24009963641c914df99d47c5c2ab2681499cf0af562988b116da9784b62c` | Unmodified voice freeze v1 and v2 directories (18 entries) |
| **`archive-git.bundle`** | *None* | *Omitted* | *Deliberately omitted because commit f2821d4 in history holds legacy credential* |
| **`MANIFEST.txt`** | 52,864 | 0.05 MB | `8b14fb717cd8034e648020435376f8c4caf0f7d018f3a60d05b109726c6918d5` | 499 file entries sorted with exact byte size and SHA-256 |
| **`ARCHIVE-README.md`** | 7,152 | 0.01 MB | `73fe35be4bd7f74596affe89867087aca71fe8405c749eb8faf0fff584064438` | Full setup runbook, security explanation, and test commands |
| **`ARCHIVE-HASHES.txt`** | 814 | <0.01 MB | `fc29cb32b26aa57bf64ff2823652d88d30e386221c977f0a6fae94d07b46d03f` | SHA-256 checksums of the v2 archive directory |

### 6.1 Archive v2 Secret Scan
- Files scanned: 498 source files.
- Active connection string findings with auth: **0**.
- Candidate secret findings: 25 items (all mock test user credentials, documentation placeholders, or NLP token strings; zero active production secrets).

### 6.2 Archive v2 Integrity Verification
- **Zip inspection without extraction**: 0 excluded paths or disallowed binaries found.
- **Extraction test**: Extracted cleanly into `D:\Aswanna_archive_verify`.
- **Sample comparison**: 27 sampled files (including `voice-learn/models/*.joblib`, `server/src/config/env.js`, `shared/voice/*`) matched live files **100% byte-for-byte**.
- **Freeze v2 confirmation**: All 6 files in `shared/voice` matched [`logs/freeze-v2-hashes.txt`](file:///d:/Aswanna/logs/freeze-v2-hashes.txt) exactly.
- **Cleanup**: 0 reparse points in verification tree; `D:\Aswanna_archive_verify` cleanly deleted.
- **Old Archive Folder**: `D:\Aswanna_archive_2026-10-28` preserved intact.

---

## 7. Summary of Changes & Created Paths

### Paths Created
- `server/.env`
- `D:\Aswanna_archive_2026-10-28_v2\`
  - `archive-source.zip`
  - `archive-freeze.zip`
  - `MANIFEST.txt`
  - `ARCHIVE-README.md`
  - `ARCHIVE-HASHES.txt`
- `docs/security1-report.md`
- `logs/security1-report.txt`

### Files Modified
- `server/src/config/env.js` (credential removed, startup validation added)
- `server/.env.example` (placeholder line added)
- `docs/SO3-README.md` (environment table updated)
- `docs/archive-report.md` (redacted credential fragment)
- `docs/evaluation-report.md` & `server/eval/evaluation-results.json` (benchmark metrics updated by evaluate.js)
