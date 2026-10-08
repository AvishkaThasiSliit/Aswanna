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
