# Aswanna SO3 System Documentation

**System Title:** Aswanna (Financial & Agronomic Expense Tracking System for Sri Lankan Farmers)  
**SO Deliverable:** SO3 (Core Financial Tracking, Variance Engine, Dynamic Tiered Alerts, and Crop Recommendations)  

---

## 1. Quick Start & Execution

### Prerequisites
- **Node.js:** v18.x or v20+ (ESM modules enabled)
- **MongoDB:** Local instance on port `27017` or MongoDB Atlas URI
- **Python:** 3.10+ with `voice-service/.venv` (optional, for Whisper voice transcription service)

### Environment Configuration
Copy `.env.example` to `server/.env`:
```powershell
Copy-Item server\.env.example server\.env
```

### Running the Services

#### 1. Backend Server (Express API on Port 4000)
```powershell
npm start --workspace=server
# Or with dev hot-reload:
npm run dev --workspace=server
```

#### 2. Frontend Client (Vite Dev Server on Port 3000)
```powershell
npm run dev --workspace=client
```

#### 3. Optional: Python Whisper Speech Service (FastAPI on Port 8000)
```powershell
$env:VOICE_INTERNAL_TOKEN = "your-high-entropy-secret-token"
$env:PORT = "8000"
& "voice-service\.venv\Scripts\uvicorn.exe" app:app --app-dir voice-service --host 127.0.0.1 --port 8000
```

---

## 2. Test Suites & Verification

### Running the Tests
```powershell
# 1. Full Server Jest Test Suite (450 tests across 20 suites)
npm run test --workspace=server

# 2. Client Vitest Test Suite (126 tests across 22 suites)
npm run test --workspace=client

# 3. Core Agronomic & Financial Evaluation Harness (65/65 test vectors, alert benchmarks, latency)
node server/eval/evaluate.js

# 4. Client Production Build
npm run build --workspace=client

# 5. Python Voice Service & Voice Learn Test Suites (33 passed, 1 skipped)
& "voice-service\.venv\Scripts\pytest.exe" -v voice-service voice-learn
```

---

## 3. Environment Variables Reference

All runtime variables are loaded through `server/src/config/env.js` and Vite's `import.meta.env`.

### 3.1. SO3 Core Variables

| Variable | Default Value | Allowed Values | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | `4000` | Port number | HTTP port for the Node.js Express server. |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` | Runtime environment mode. Disables dev routes in production. |
| `MONGODB_URI` | *None* (Required) | MongoDB URI | Connection string for MongoDB. Must be set via environment / `server/.env` (server fails at startup if unset, except `NODE_ENV=test`). |
| `JWT_SECRET` | `dev-jwt-secret-change-in-prod` | String | Secret key for signing and verifying JSON Web Tokens. |
| `JWT_EXPIRES_IN` | `7d` | String (`7d`, `24h`) | Session token expiration duration. |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Milliseconds | Window size for Express rate limiting. |
| `RATE_LIMIT_MAX` | `20` / `1000` | Integer | Maximum allowable requests per rate-limiting window. |
| `BACKEND_PORT` | `4000` | Port number | Target port used by Vite proxy during client development. |
| `BACKEND_URL` | `http://localhost:4000` | URL | Target URL used by Vite proxy during client development. |

### 3.2. SO1 & External Service Integration Variables

| Variable | Default Value | Allowed Values | Description |
| :--- | :--- | :--- | :--- |
| `SO1_MODE` | `mock` | `mock` \| `real` | Switches cultivation baseline predictions between internal mock and live SO1 API. |
| `SO1_BASE_URL` | `http://127.0.0.1:8000` | URL | HTTP base URL of the live SO1 Cost of Cultivation prediction service. |
| `SO1_TIMEOUT_MS` | `3000` | Milliseconds | Request timeout for outbound HTTP calls to SO1. |
| `SO1_REC_CACHE_TTL_MS` | `86400000` (24 hr) | Milliseconds | Cache TTL for successful crop recommendation predictions. |
| `SO1_REC_ERROR_CACHE_TTL_MS`| `30000` (30 sec) | Milliseconds | Negative-cache TTL for failed SO1 prediction responses. |

### 3.3. Optional Feature Variables

#### A. Voice Expense Entry & Whisper Service
| Variable | Default Value | Allowed Values | Description |
| :--- | :--- | :--- | :--- |
| `VOICE_ASR` | `browser` | `browser` \| `whisper` | Selects primary ASR engine for voice expense input. |
| `VOICE_SERVICE_URL` | `http://127.0.0.1:8001` | URL | Target address of the Python Whisper microservice proxy. |
| `VOICE_INTERNAL_TOKEN` | *None* (Empty string) | Secret String | Shared secret token required for authentication between Express and Python Whisper service. Returns 503 if unset. |
| `VITE_VOICE_ENTRY` | `on` | `off` \| `on` | Client UI toggle to display the Voice Expense Entry component. |

#### B. Voice Dataset Collection (Phase 2)
| Variable | Default Value | Allowed Values | Description |
| :--- | :--- | :--- | :--- |
| `VOICE_DATASET_COLLECTION` | `off` | `off` \| `on` | Gating flag for `/api/dataset-collection`. Returns 404 when `off`. |
| `VITE_VOICE_DATASET_COLLECTION`| `off` | `off` \| `on` | Client route toggle for Voice Dataset Collection and Reviewer views. |
| `VOICE_DATASET_STORAGE_DIR` | `private_dataset_storage/audio`| Relative/Abs Path | Directory on host storage where participant audio recordings are stored. |
| `VOICE_DATASET_RETENTION_DAYS`| `365` | Days (Integer) | Retention period before soft-deleted or unconsented recordings are purged. |
| `VOICE_PSEUDONYMIZATION_KEY`| `aswanna-voice-pseudo-salt...` | High-entropy secret | Secret HMAC key used to generate pseudonymized speaker IDs without PII. |
| `VOICE_DATASET_MAX_CONTRIBUTOR_BYTES`| `104857600` (100 MB) | Bytes | Storage quota cap per contributing farmer. |
| `VOICE_DATASET_MIN_FREE_DISK_BYTES` | `52428800` (50 MB) | Bytes | Minimum free disk space threshold below which uploads return 507. |

#### C. Dev Voice Capture & Forecasting
| Variable | Default Value | Allowed Values | Description |
| :--- | :--- | :--- | :--- |
| `VOICE_CAPTURE` | `off` | `off` \| `on` | Server gating flag for dev capture endpoints (`/api/dev/voice-capture`). Enabled only when flag is `on` and `NODE_ENV !== 'production'`. |
| `VITE_VOICE_CAPTURE` | `off` | `off` \| `on` | Client gating toggle for `/dev/voice-capture` recording page. |
| `FORECAST_MODE` | `off` | `off` \| `on` | Toggles end-of-season forecasting logic. Disabled by default as it overlaps SO1. |

---

## 4. Integrating SO1 and SO2

### 4.1. Operating Modes (`SO1_MODE=mock|real`)
Aswanna is architected with a decoupled adapter layer (`server/src/services/so1Adapter.js`) interfacing with the SO1 Cost of Cultivation prediction service:
- **`SO1_MODE=mock` (Default):** Uses in-memory agrarian fixture models and deterministic responses, allowing offline development and testing of financial tracking without running the SO1 service.
- **`SO1_MODE=real`:** Directs `/api/crop-recommendation` and baseline initialization to issue live HTTP POST requests to `${SO1_BASE_URL}/predict`.

### 4.2. Running Contract and Integration Tests Against Real SO1
The test suite includes dedicated contract and live network regression suites:
```powershell
# 1. Run Contract Validation Tests (schema validation, remainder rounding, alias normalization)
npm run test --workspace=server -- tests/so1Contract.test.js

# 2. Run Real Code Path Integration Tests (tests live HTTP error handling, connection failures, fallbacks)
npm run test --workspace=server -- tests/so1RealIntegration.test.js
```

### 4.3. Verified Integration Invariants
The following core mechanisms were verified directly in the codebase:
1. **Largest-Remainder Integer Rounding (`mapSo1ResponseToCategories`):**
   - Disaggregates SO1 cost predictions into SO3's exact 8 categories: `seed`, `fertilizer`, `agrochemical`, `labour`, `machinery`, `fuel`, `irrigation`, `other`.
   - Distributes rounding remainders using the largest-remainder method so that $\sum (\text{categories}) \equiv \text{totalTarget}$ exactly without losing a single rupee.
2. **Sequential District Fallback Policy (`getSo1Predictions`):**
   - Step 1: Attempts query with exact farmer district (`allow_extrapolation=false`).
   - Step 2: On failure or unsupported district, queries `'Whole Island'` national baseline (`allow_extrapolation=false`).
   - Step 3: On further failure, requests extrapolated model estimate (`allow_extrapolation=true`).
   - If all steps fail, returns `{ success: false, baselineStatus: 'missing' }` and falls back gracefully to manual expense tracking.
3. **Acreage Scaling:**
   - Predictions scale linearly by acreage (`totalTarget = Math.round(predictedCost * acres)`).
   - Interval bounds (`low`, `high`) scale identically and maintain strict invariant: $\text{low} \le \text{expected} \le \text{high}$.

### 4.4. Open Integration Items & Known Assumptions
The following items remain open for confirmation with the SO1 team:
1. **Category Split Ratios (Placeholder Assumptions in `shared/config/so1Mapping.js`):**
   - `Land Preparation` + `Fuel & Machinery` is divided into **70% Machinery** and **30% Fuel**.
   - `Agrochemicals & Other` is divided into **85% Agrochemicals** and **15% Other**.
   - *Status:* Tagged with `PLACEHOLDER: CONFIRM WITH SO1 LEAD`. Needs empirical validation against the Department of Agriculture cost survey data before final production deployment.
2. **Acreage Linearity Assumption:**
   - Current scaling assumes constant cost per acre. Non-linear economies of scale (e.g. bulk fertilizer discounts or fixed transport costs on plots $> 5$ acres) are not currently modeled by the SO1 adapter.
3. **HTTP 422 Matrix Execution Against Live SO1:**
   - While mock contract tests verify that 422 unprocessable entity responses from SO1 are caught and cleanly serialized, the full 422 combinatorial matrix against a running live SO1 model service instance has not yet been executed in a production staging environment.
