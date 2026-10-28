# End-of-Season Cost Forecasting (SO3)

> [!IMPORTANT]
> **Out of SO3 scope. Retained as exploratory work; future-work candidate using SO1's model.**
> Exploratory phasing-prior research track. Evaluated on simulated data only (0 real cycles). Not wired into the live variance engine, which uses shared/phasing.js. Candidate for future integration behind a flag after validation on real DoA cycle data.
> End-of-season cost prediction belongs to SO1. The feature is frozen and disabled by default (`FORECAST_MODE=off`).

## 1. Overview & Purpose
The **End-of-Season Cost Forecasting Service** provides smallholder farmers and agricultural extension officers with knowledge-anchored projections of total cycle expenditure while the crop is actively growing.

Instead of naive linear extrapolation or unconstrained regression, the forecaster uses a **ratio estimator anchored to empirical cultivation spend curves** derived from Department of Agriculture (DoA) Cost of Cultivation (COC) surveys and historical closed farm cycles.

---

## 2. Theoretical Formulation

### 2.1. Ratio Estimator
At progress fraction $\tau = \frac{t}{T} \in [0, 1]$ (where $t$ is the elapsed days and $T$ is the cycle duration):
$$\hat{Y}(\tau) = \max\left(S(\tau),\, \frac{S(\tau)}{F(\tau)}\right)$$
where:
- $S(\tau) = \sum_{k=1}^8 S_k(\tau)$ is the cumulative spend recorded across all 8 expense categories up to progress $\tau$.
- $F(\tau) = \sum_{k=1}^8 w_k \cdot f_k(\tau)$ is the expected cumulative spend fraction across all categories.
- $w_k = \frac{B_k}{\sum_{j} B_j}$ is the baseline cost share of category $k$.
- $f_k(\tau)$ is the cumulative spend fraction curve for category $k$ evaluated via piecewise-linear interpolation over 11 knots $\tau \in \{0.0, 0.1, \dots, 1.0\}$.

### 2.2. Monotonicity Enforcement (PAVA)
In learned mode ($n \ge 5$), empirical spend trajectories are blended with the survey prior:
$$\hat{f}_k(\tau_j) = \frac{n \cdot f_k^{\text{emp}}(\tau_j) + \kappa \cdot f_k^{\text{prior}}(\tau_j)}{n + \kappa}$$
To preserve the physical requirement that cumulative spend never decreases over time ($\hat{f}_k(\tau_{j+1}) \ge \hat{f}_k(\tau_j)$), monotonicity is strictly enforced using the **Pool Adjacent Violators Algorithm (PAVA)** isotonic regression, with boundary conditions $\hat{f}(0) = 0$ and $\hat{f}(1) = 1$.

### 2.3. Conformal Prediction Intervals (80% Coverage)
Prediction intervals are calibrated using **Split Conformal Prediction** per $\tau$ knot with normalized relative non-conformity scores:
$$s_i(\tau) = \frac{|y_i - \hat{y}_i(\tau)|}{\hat{y}_i(\tau)}$$
The conformal quantile $\hat{q}_{1-\alpha}(\tau)$ at level $1 - \alpha = 0.80$ is computed as the $\lceil (n_{\text{cal}} + 1)(1 - \alpha) \rceil / n_{\text{cal}}$ empirical quantile over held-out calibration cohorts.

The resulting prediction interval is:
$$\left[ \max(S(\tau),\, \text{round}(\hat{Y} \cdot (1 - \hat{q}))),\, \text{round}(\hat{Y} \cdot (1 + \hat{q})) \right]$$

> [!WARNING]
> **Calibration Disclosure**: The conformal quantiles are currently **simulator-calibrated, not field-calibrated**. They guarantee finite-sample 80% coverage under the exchangeability assumption between simulation cohorts, but field coverage across heterogeneous farming conditions is pending validation against multi-season empirical farm records.

---

## 3. Deployment & Decision Rules

Empirical evaluation across synthetic simulation benchmarks (S1 aligned, S2 misaligned, S3 misspecified prior, and sudden/gradual price shocks) established the following production deployment rules:

| Sample Size ($n$) | Primary Method | Minimum Progress ($\tau_{\min}$) | Rationale |
| :--- | :--- | :--- | :--- |
| **$n = 0$** | **Method C (Survey Prior)** | $\tau \ge 0.30$ ($30\%$) | Ratio estimator anchored to DoA survey priors. Progress below $30\%$ exhibits high variance across farms. |
| **$1 \le n < 5$** | **Method C (Fallback)** | $\tau \ge 0.30$ ($30\%$) | Insufficient closed cycles for stable isotonic regression; falls back to survey prior with UI notice. |
| **$n \ge 5$** | **Method D (Empirical Shrinkage)** | $\tau \ge 0.20$ ($20\%$) | CV-tuned shrinkage $\kappa^*$; unlocks earlier at $\tau = 0.20$ as empirical learning reduces early error. |

> [!IMPORTANT]
> **Method B (Linear Extrapolation) Prohibited**: Linear extrapolation ($\hat{Y} = S(\tau) / \tau$) assumes constant expenditure velocity. In agriculture, spend tapers dramatically after mid-season crop care. Linear extrapolation severely over-projects in late season (tau $\ge 0.8$) and is **never** recommended.

---

## 4. Architectural Invariants

1. **Zero Python at Runtime**: The server forecasting service (`server/src/services/forecastService.js`) is written in 100% pure JavaScript. It evaluates piecewise-linear curve interpolation, share weighting, and conformal quantiles in sub-millisecond execution time without invoking Python subprocesses.
2. **Feature Flagging**: Controlled via `FORECAST_MODE=off|prior|learned` (defaults to `off`). When `off`, `GET /api/cycles/:id/forecast` returns HTTP 404.
3. **Advisory Only**: Forecasting does **not** create, modify, or resolve Alert documents in MongoDB. Alerts remain strictly governed by the Phase 3 variance engine.
4. **Owner Isolation**: Cycles are accessible only by the owner farmer, assigned extension officer, or system admin via `assertOwnership`. Unauthorized requests return HTTP 403 `FORBIDDEN`.
5. **Integer LKR**: All monetary outputs (`spendToDate`, `forecastFinal`, `interval.low`, `interval.high`, `baselineTotal`) are rounded integer LKR values.

---

## 5. Offline Model Training Pipeline

```mermaid
flowchart LR
    A[MongoDB Closed Cycles] -->|server/scripts/exportCycles.js| B[ml/data/derived/exported_cycles.json]
    B -->|ml/src/fit_from_export.py| C[shared/config/learnedPhasing.json]
    C -->|FORECAST_MODE=learned| D[server/src/services/forecastService.js]
```

1. **Export Closed Cycles**:
   ```bash
   node server/scripts/exportCycles.js --out ml/data/derived/exported_cycles.json
   ```
2. **Fit Learned Shrinkage Curves**:
   ```bash
   python ml/src/fit_from_export.py --input ml/data/derived/exported_cycles.json --output shared/config/learnedPhasing.json
   ```
3. **Automated Fallback**:
   If a crop has fewer than 5 closed cycles in the export, `fit_from_export.py` writes `"status": "insufficient_data"`. The server runtime automatically falls back to the survey prior curve.

---

## 6. Frontend Presentation

The projected end-of-season cost is rendered on the **Predicted vs Actual Cost Impact** page (`client/src/pages/BudgetOverview.jsx`):
- **Component**: `client/src/components/ForecastCard.jsx`
- **States**:
  - `too_early`: Informative banner showing current progress and the unlocking threshold.
  - `insufficient_data`: Guidance that baseline prediction and recorded expenses are required.
  - `ready`: 4-column KPI grid displaying Projected Total, 80% Conformal Range, Spend to Date, and Projected Overspend %, accompanied by standard advisory disclaimers.
- **Bilingual Support**: Fully localized with 100% key and label parity across English (`en.json`) and Sinhala (`si.json`).
