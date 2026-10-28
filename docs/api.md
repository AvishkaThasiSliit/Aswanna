# Aswanna REST API Documentation

## Overview
The Aswanna REST API is an Express & Node.js application backing agricultural data management. It enforces strict ownership policies, state machine cycle transitions, complex expense filtering, and audit logging.

- **Base URL**: `/api`
- **Authentication**: Bearer JWT token in header `Authorization: Bearer <token>`
- **Content-Type**: `application/json`

---

## Central Error Handling & Response Shape

All API responses follow standard HTTP status codes. Errors return a unified JSON response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": [
      {
        "field": "cost",
        "message": "Expected number, received string"
      }
    ]
  }
}
```

### Common Error Codes
- `400 BAD_REQUEST` / `VALIDATION_ERROR`: Invalid inputs or Zod validation failure.
- `401 UNAUTHORIZED`: Missing or invalid JWT token.
- `403 FORBIDDEN`: Action denied by ownership policy or role restriction.
- `404 NOT_FOUND`: Resource does not exist or has been soft deleted.
- `409 CYCLE_CLOSED`: Modification attempted on a closed crop cycle.
- `409 CONFLICT`: Duplicate registration or conflict.
- `422 UNPROCESSABLE_ENTITY` / `ZERO_COST_WORKED_DAY`: Worked day with 0 cost.

---

## Ownership Rules

Access control is centrally governed by a unified ownership policy (`src/middleware/ownership.js`):
1. **farmer**: Can only read and write their own records (resolved via `cycle -> farmerId`).
2. **officer**: Can only read/write records for farmers listed in `assignedFarmerIds`.
3. **admin**: Unrestricted read/write across all records.

---

## API Endpoints

### 1. Authentication (`/api/auth`)

#### `POST /api/auth/register`
Register a new user (farmer, officer, or admin).

- **Request Body**:
  ```json
  {
    "email": "farmer@example.com",
    "password": "SecretPassword123",
    "role": "farmer",
    "farmerProfile": {
      "fullName": "Saman Kumara",
      "nic": "199012345678",
      "district": "Kurunegala",
      "dsDivision": "Kuliyapitiya",
      "phone": "0771234567"
    }
  }
  ```
- **Response** `201 Created`:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "_id": "651f...",
      "email": "farmer@example.com",
      "role": "farmer"
    }
  }
  ```

#### `POST /api/auth/login`
Authenticate user and receive JWT.

- **Request Body**:
  ```json
  {
    "email": "farmer@example.com",
    "password": "SecretPassword123"
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "_id": "651f...",
      "email": "farmer@example.com",
      "role": "farmer"
    }
  }
  ```

#### `GET /api/auth/me`
Retrieve authenticated user's profile information.

- **Headers**: `Authorization: Bearer <token>`
- **Response** `200 OK`:
  ```json
  {
    "user": {
      "_id": "651f...",
      "email": "farmer@example.com",
      "role": "farmer"
    },
    "farmerProfile": {
      "_id": "651e...",
      "farmerId": "FARM-1001",
      "fullName": "Saman Kumara"
    }
  }
  ```

---

### 2. Crop Cycles (`/api/cycles`)

#### `GET /api/cycles`
List crop cycles matching user's permissions. Supports pagination (`?page=1&pageSize=10`).

#### `POST /api/cycles`
Create a new cycle.

#### `GET /api/cycles/:id`
Get cycle by ID.

#### `PUT /api/cycles/:id`
Update cycle details.

#### `DELETE /api/cycles/:id`
Soft-delete cycle.

#### `POST /api/cycles/:id/transition`
Transition cycle status along the forward-only state machine: `draft -> active -> harvesting -> closed`. Skipping states or reverting is rejected with `400 BAD_REQUEST`.

- **Request Body**:
  ```json
  {
    "status": "active"
  }
  ```
- **Response** `200 OK`: Returns updated cycle object.

#### `GET /api/cycles/:id/summary`
Get financial breakdown and metrics for the cycle.

- **Response** `200 OK`:
  ```json
  {
    "totalCost": 45000,
    "totalIncome": 120000,
    "netProfit": 75000,
    "totalHarvestKg": 1500,
    "costPerKg": 30,
    "categoryActuals": {
      "inputs": 15000,
      "machinery": 20000,
      "labour": 10000,
      "other": 0
    }
  }
  ```

#### `GET /api/cycles/:id/calendar`
Get daily activity calendar for the cycle.

- **Response** `200 OK`:
  ```json
  [
    {
      "date": "2026-05-01",
      "hasActivity": true,
      "dayStatus": "worked",
      "totalAmount": 5000,
      "expenseCount": 1
    }
  ]
  ```

---

### 3. Expenses (`/api/expenses`)

#### `POST /api/expenses`
Create expense record. Implements server-side total re-computation and idempotency via `clientRequestId`.
- Submitting an identical `clientRequestId` returns `200 OK` with existing expense record instead of creating a duplicate (`201 Created`).
- Worked day with `totalAmount == 0` throws `422 ZERO_COST_WORKED_DAY`.
- Closed cycles reject creation with `409 CYCLE_CLOSED`.

- **Request Body**:
  ```json
  {
    "cycleId": "651a...",
    "entryDate": "2026-05-01",
    "dayStatus": "worked",
    "inputs": [
      { "inputType": "seed", "quantity": 10, "unit": "kg", "cost": 3000 }
    ],
    "labour": { "hiredLabour": 2, "dailyWage": 2000 },
    "clientRequestId": "req-12345"
  }
  ```

#### `GET /api/expenses`
List expenses with optional filters:
- `cycleId`: Filter by cycle ID
- `startDate` & `endDate`: Date range filter (`entryDate`)
- `category`: `inputs`, `machinery`, `labour`, `other`
- `activityCode`: Filter by activity code
- `dayStatus`: `worked` or `no_work`
- `minAmount` & `maxAmount`: Filter by cost range

#### `GET /api/expenses/export.csv`
Export expenses matching query filters in CSV format.

#### `DELETE /api/expenses/:id`
Soft-delete an expense.

#### `POST /api/expenses/:id/restore`
Restore a soft-deleted expense within the 10-second restoration window. After 10 seconds, restoration throws `400 BAD_REQUEST`.

---

### 4. Other Resources

- **Farmer Profiles** (`/api/farmer-profiles`)
- **Lands** (`/api/lands`)
- **Machinery Owned** (`/api/machinery-owned`)
- **Harvests** (`/api/harvests`)
- **Sales** (`/api/sales`)
- **Cycle Notes** (`/api/cycle-notes`)
- **Activity Codes** (`/api/activity-codes`) - Read by all users, write operations restricted to `admin` role.

---

## Phase 3 – Baseline, Variance & Tiered Alerts

### Mock SO1 Endpoint (**REPLACE WITH REAL SO1 API**)

```
GET /api/mock-so1/predict?crop=Tomato&district=Kurunegala&season=Yala
```

Returns a baseline prediction per category. The server fetches this when a cycle transitions to `active`. The client **never** fabricates baseline values.

**Response** (array of 8 category objects):
```json
[
  { "category": "seed",         "expected": 25000, "low": 22500, "high": 28750 },
  { "category": "fertilizer",   "expected": 45000, "low": 40500, "high": 51750 },
  { "category": "agrochemical", "expected": 60000, "low": 54000, "high": 69000 },
  { "category": "labour",       "expected": 40000, "low": 36000, "high": 46000 },
  { "category": "machinery",    "expected": 25000, "low": 22500, "high": 28750 },
  { "category": "fuel",         "expected": 25000, "low": 22500, "high": 28750 },
  { "category": "irrigation",   "expected": 25000, "low": 22500, "high": 28750 },
  { "category": "other",        "expected": 0,     "low": 0,     "high": 0     }
]
```

---

#### `POST /api/cycles/:id/retry-baseline`
Force re-fetch of the SO1 baseline for an active cultivation cycle.
- **Access**: Farmer (cycle owner), Officer, Admin.
- **Behavior**: Calls the SO1 adapter (`so1Adapter.js`). Updates baseline records and cycle `so1Metadata`.
- **Response** `200 OK`:
  ```json
  {
    "message": "Baseline recomputed successfully",
    "baselineStatus": "ready",
    "categoriesUpdated": 8
  }
  ```

---

### Variance & SO1 Prediction Interval

```
GET /api/cycles/:id/variance
```

Returns per-category and overall cycle variance metrics enriched with SO1 prediction intervals and model metadata. If no baseline exists or fetching failed, returns `{ "status": "missing_baseline", "baselineStatus": "missing", "baselines": null }`.

**Response** `200 OK`:
```json
{
  "status": "ready",
  "baselineStatus": "ready",
  "withinPredictionInterval": true,
  "intervalLow": 237739,
  "intervalHigh": 346579,
  "categories": {
    "seed": {
      "expected": 24686,
      "low": 20446,
      "high": 29806,
      "actual": 19000,
      "expectedToDate": 17500,
      "variancePct": 0.0857,
      "budgetUsedPct": 0.76,
      "tier": "attention",
      "is_estimated_split": false
    },
    "machinery": {
      "expected": 54655,
      "low": 45266,
      "high": 65991,
      "actual": 48000,
      "expectedToDate": 45000,
      "variancePct": 0.0667,
      "budgetUsedPct": 0.88,
      "tier": "normal",
      "is_estimated_split": true
    }
  },
  "total": {
    "expected": 287046,
    "actual": 275000,
    "expectedToDate": 260000,
    "variancePct": 0.0577,
    "budgetUsedPct": 0.958,
    "tier": "normal",
    "low": 237739,
    "high": 346579
  },
  "so1Metadata": {
    "model_version": "extratrees_champion_v2",
    "request_id": "4c68f651-7338-4fc6-8128-3ec799a2e651",
    "reference_year": 2025,
    "low_confidence": false,
    "breakdown_source": "doa_breakdown_applied",
    "district_policy_used": "exact",
    "derived": {
      "per_acre_scaled": true,
      "categories_split": true,
      "interval_scaled": true
    },
    "warnings": [],
    "lag_saturation_detected": false,
    "lag_saturation_note": null
  }
}
```

#### SO1 Adapter Architectural Invariants:
1. **Operating Modes**: Controlled via `SO1_MODE=real|mock` environment variable (defaults to `mock` in test environments to isolate test execution from external networking).
2. **Sequential District Fallback Policy**:
   - `exact`: Exact district match with `allow_extrapolation=false`.
   - `whole_island`: National Department of Agriculture average when local district empirical records are unavailable (HTTP 422).
   - `extrapolated`: Machine learning model extrapolation with `allow_extrapolation=true` (flags `low_confidence: true`).
   - If all policies fail: gracefully sets `baselineStatus: "missing"` without blocking cycle activation.
3. **Acreage Scaling & Rounding Invariant**: Per-acre baseline predictions are scaled by land extent (`acres`). Integer rounding uses the **Largest-Remainder (Hare-Niemeyer)** algorithm to guarantee $\sum_{i=1}^8 \text{category.expected} \equiv \text{round}(\text{predicted\_cost} \times \text{acres})$ exactly without 1-rupee rounding errors.
4. **Informative Interval vs Deterministic Tiers**: The `withinPredictionInterval` indicator and interval badges are presented strictly as informational context for the farmer and extension officer; they never alter the alert tier boundaries or threshold rules.

---

### Alerts

```
GET  /api/alerts?cycleId=<id>     – List alerts for a cycle
GET  /api/alerts/:id              – Get a single alert
POST /api/alerts/:id/acknowledge  – Farmer acknowledges an alert
```

Alerts are **never** created by the client; `alertService.recomputeAlerts` creates/updates them after every expense mutation.

**Tiers** (CONFIRM WITH DoA):
| Tier        | Volatile categories (seed, fertilizer, agrochemical, fuel) | Stable categories (labour, machinery, irrigation, other) |
|-------------|-------------------------------------------------------------|----------------------------------------------------------|
| Normal      | variancePct ≤ 7%                                            | variancePct ≤ 10%                                        |
| Attention   | 7% < variancePct ≤ 12%                                      | 10% < variancePct ≤ 15%                                  |
| Significant | variancePct > 12%                                           | variancePct > 15%                                        |

Only **overspend** (positive `variancePct`) generates Attention/Significant alerts.

---

### Threshold Config

```
GET /api/threshold-config/:cycleId  – Get config or default
PUT /api/threshold-config/:cycleId  – Update thresholds (admin/officer only)
```

**PUT body**:
```json
{
  "mode": "tiered",
  "stable":   { "attention": 0.10, "significant": 0.15 },
  "volatile": { "attention": 0.07, "significant": 0.12 }
}
```

---

### Forecast (`/api/cycles/:id/forecast`)

> [!NOTE]
> **Status**: FROZEN (Out of SO3 scope; candidate for SO1 cost prediction). Disabled by default (`FORECAST_MODE=off`), returning HTTP 404.

#### `GET /api/cycles/:id/forecast`
Owner-only endpoint returning knowledge-anchored end-of-season cost projections and 80% conformal prediction intervals.
- **Operating Modes**: Controlled via `FORECAST_MODE=off|prior|learned` (defaults to `off`, which responds with HTTP 404).
- **Advisory Only**: Does **NOT** mutate database state or create Alert documents.
- **Minimum Progress Invariant**: Unlocks at $\tau \ge 0.30$ in `prior` mode and $\tau \ge 0.20$ in `learned` mode. Below this threshold, returns `{ "status": "too_early" }`.

**Response** `200 OK` (when progress threshold met):
```json
{
  "status": "ready",
  "method": "prior",
  "tau": 0.45,
  "spendToDate": 110000,
  "forecastFinal": 245000,
  "interval": {
    "low": 216580,
    "high": 273420,
    "level": 0.8
  },
  "baselineTotal": 240000,
  "projectedOverspendPct": 2.1,
  "dataQuality": {
    "isEstimatedSplit": false,
    "isDerived": false,
    "isLowConfidence": false,
    "districtPolicy": "exact"
  },
  "notes": [
    "Advisory projection only; not a financial guarantee.",
    "Prediction interval calibrated at 80% coverage using simulation-derived conformal quantiles; field calibration pending."
  ]
}
```

**Response** `200 OK` (when too early):
```json
{
  "status": "too_early",
  "method": "prior",
  "tau": 0.15,
  "minTau": 0.30,
  "spendToDate": 35000,
  "baselineTotal": 240000,
  "message": "Cycle is too early for reliable end-of-season forecasting (minimum progress: 30%).",
  "notes": [
    "Current progress is 15%. Predictions unlock at 30% progress.",
    "Early phase spend exhibits high variance across farms."
  ]
}
```

---

### ML Cycle Export Schema (`server/scripts/exportCycles.js`)

Used to dump closed cycle histories for empirical shrinkage curve fitting (`ml/src/fit_from_export.py`).
File location: `ml/data/derived/exported_cycles.json`.

```json
[
  {
    "cycle_id": "6ad9f665b2e5aaf845db68fb",
    "crop": "Paddy",
    "season": "Maha",
    "district": "Ampara",
    "cycle_length_days": 105,
    "so1_baseline_predicted": 240000,
    "category_baselines": {
      "seed": 20000,
      "fertilizer": 50000,
      "agrochemical": 30000,
      "labour": 80000,
      "machinery": 40000,
      "fuel": 15000,
      "irrigation": 2000,
      "other": 3000
    },
    "true_final_cost": 245000,
    "expenses": [
      {
        "day": 5,
        "category": "seed",
        "amount": 20000
      },
      {
        "day": 18,
        "category": "labour",
        "amount": 15000
      }
    ]
  }
]
```


