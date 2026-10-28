# Aswanna Project – Open Questions & Assumptions Log

This document consolidates all architectural assumptions, domain queries, and pending confirmations requiring review by the **Department of Agriculture (DoA)**, agronomic extension officers, and technical stakeholders.

---

## 1. Core Data Layer & Paper Form Mapping

The physical DoA paper cost record sheet (*කෘෂි වියදම් වාර්තා*) has been digitized into standardized schemas. The following domain conventions require formal confirmation:

### 1.1. Labour Cost Valuation
* **Current Implementation**:
  $$\text{labour.cost} = (\text{familyLabour} + \text{hiredLabour}) \times \text{dailyWage}$$
  (Located in `server/src/models/Expense.js` and `shared/calc.js`).
* **Open Questions**:
  1. **Units**: Are `familyLabour` and `hiredLabour` recorded as headcount (number of persons), hours, or person-days (මිනිස් දින)?
  2. **Family Labour Cost**: Should family labour be imputed at the commercial daily wage rate to reflect true economic cost, or should it be tracked at zero cash outlay so the farmer's cash flow remains accurate?
  3. **Gender/Task Differentiation**: Do certain tasks (e.g. harvesting, spraying) carry standard wage differentials that need separate tracking?

### 1.2. Machinery Cost Calculation
* **Current Implementation**:
  `machinery.cost` is directly entered by the farmer; `unitPrice` and `quantity` (hours or acres) are captured as supplementary metadata but are not automatically multiplied unless specified.
* **Open Questions**:
  1. **Owned vs. Hired**: Should owned machinery calculate depreciation or fuel/maintenance costs separately from hired machinery rental fees?
  2. **Billing Basis**: Is machinery hired primarily by time (hours/days), land area (acres/perches), or flat rate per operation?

### 1.3. Land Tenure Classification
* **Current Implementation**:
  `tenure` enum values in `server/src/models/Land.js`: `['freehold', 'ande', 'bhaddha', 'kuli', 'state', 'private']`.
* **Open Questions**:
  1. Do these 6 categories strictly match the agrarian service centre (ගොවිජන සේවා මධ්‍යස්ථානය) legal definitions?
  2. Is Ande (අඳ) tenant-farming expected to capture crop-share percentages (e.g., 1/4 or 1/2 share) in future phases?

### 1.4. Input Classification & Units
* **Current Implementation**:
  `inputType` enum: `['seed', 'fertilizer', 'agrochemical', 'other']`.
* **Open Questions**:
  1. Should `agrochemical` be split into specific sub-types (e.g., Weedicide / වල්නාශක, Pesticide / කීටනාශක, Fungicide / දිලීරනාශක)?
  2. Should standard packaging units (e.g., 50kg bag, 500ml bottle, pkt) be governed by a restricted DoA-approved registry per crop?

### 1.5. Handwritten Annotation on Paper Form
* **Context**: A handwritten note was observed next to the "Machinery Owned" heading (*කෘෂි යන්ත්‍රෝපකරණ පිළිබඳව තොරතුරු*) on the source DoA document.
* **Current Implementation**: Stored in `MachineryOwned.annotationNote` (nullable string).
* **Action Required**: Agronomy team to verify and transcribe the handwritten annotation once source documents are reviewed.

---

## 2. Phase 3: Baseline, Variance & Tiered Alerts

Phase 3 introduces real-time comparison between actual daily expenses and predicted cost baselines, calculating variance and triggering tiered alerts.

### 2.1. Alert Threshold Boundaries (Table 3)
* **Current Implementation** (`shared/variance.js` & `ThresholdConfig.js`):
  | Category Group | Normal Tier | Attention Tier (Overspend) | Significant Tier (Overspend) |
  | :--- | :--- | :--- | :--- |
  | **Volatile** (`seed`, `fertilizer`, `agrochemical`, `fuel`) | $\le 7\%$ | $> 7\%$ and $\le 12\%$ | $> 12\%$ |
  | **Stable** (`labour`, `machinery`, `irrigation`, `other`) | $\le 10\%$ | $> 10\%$ and $\le 15\%$ | $> 15\%$ |
* **Open Questions**:
  1. Are these percentage thresholds appropriate across all crops and ecological zones, or should they vary by crop life cycle (e.g., short-term vegetables vs. seasonal paddy)?
  2. Should an officer/admin have authority to override thresholds globally, or only per specific farming cycle?

### 2.2. Under-spend Alerts vs. Overspend Alerts
* **Current Implementation**:
  Only **positive variance** (overspending against expected to date) generates Attention or Significant alerts.
* **Open Questions**:
  1. In agriculture, severe under-spending on critical inputs (e.g. skipping basal fertilizer or pest prevention) often causes yield collapse.
  2. Should an "Under-application Warning" tier be introduced when cumulative spend drops $> 20\%$ below baseline during critical growth stages?

### 2.3. Spend Phasing Curves (S-Curves)
* **Current Implementation** (`shared/phasing.js`):
  - **Front-loaded curve**: 70% spend within the first 15% of the cycle, 90% by 40% (used for `seed`, `fertilizer`, `agrochemical`).
  - **Linear curve**: Spend evenly distributed across cycle days (used for `labour`, `machinery`, `fuel`, `irrigation`, `other`).
* **Open Questions**:
  1. Fertilizer application is typically staged in 2–3 specific dressings (basal, top dressing 1, top dressing 2) rather than smooth front-loading. Should phasing curves reflect discrete milestone days?
  2. Does DoA maintain standard stage-wise expenditure guidelines per crop?

---

## 3. SO1 Predictive Service Integration

The application interfaces with the teammate's SO1 Cost Prediction Service (`D:\Aswanna\so1-service` / `Profit Folder\COC folder`, ExtraTrees champion model) to obtain baseline cost predictions per cultivation cycle. The integration adapter (`server/src/services/so1Adapter.js`) makes several critical assumptions that require confirmation with the SO1 lead and agronomy experts:

### 3.1. Compound Disaggregation Split Proportions ("CONFIRM WITH SO1 LEAD")
* **Context**: The SO1 ML model predicts a single scalar `predicted_cost` (total cost per acre) and generates an illustrative 7-category breakdown based on historical district ratios. SO3 requires exactly 8 standardized categories matching the DoA paper form (`seed`, `fertilizer`, `agrochemical`, `labour`, `machinery`, `fuel`, `irrigation`, `other`).
* **Current Implementation** (`shared/config/so1Mapping.js`):
  - `Seeds` $\rightarrow$ `seed` (1:1 direct)
  - `Fertilizer` $\rightarrow$ `fertilizer` (1:1 direct)
  - `Cultivation Labour` $\rightarrow$ `labour` (1:1 direct)
  - `Mechanized Irrigation` $\rightarrow$ `irrigation` (1:1 direct)
  - **Land Preparation + Fuel & Machinery** is split into:
    - `machinery`: **70%** (placeholder, marked `CONFIRM WITH SO1 LEAD`)
    - `fuel`: **30%** (placeholder, marked `CONFIRM WITH SO1 LEAD`)
  - **Agrochemicals & Other** is split into:
    - `agrochemical`: **85%** (placeholder, marked `CONFIRM WITH SO1 LEAD`)
    - `other`: **15%** (placeholder, marked `CONFIRM WITH SO1 LEAD`)
* **Open Questions**:
  1. What empirical ratio does the SO1 team recommend for splitting Land Prep + Fuel & Machinery into physical machinery depreciation/hire vs consumable fuel?
  2. Does the DoA benchmark cost-of-cultivation dataset contain separate accounting lines for fuel vs machinery hire?
  3. Should these split proportions vary by crop type (e.g., mechanized paddy vs manual vegetable plots)?

### 3.2. Category-Level Prediction Interval Derivation
* **Context**: The SO1 service returns confidence interval bounds (`interval_low`, `interval_high`) only for the total per-acre cost via conformal prediction / quantile evaluation.
* **Current Implementation** (`server/src/services/so1Adapter.js`):
  - Category low and high bounds are derived proportionally:
    $$\text{category.low} = \text{round}\left(\text{category.expected} \times \frac{\text{interval\_low}}{\text{predicted\_cost}}\right)$$
    $$\text{category.high} = \text{round}\left(\text{category.expected} \times \frac{\text{interval\_high}}{\text{predicted\_cost}}\right)$$
  - Flagged in database and UI with `derived: true` and `is_estimated_split`.
* **Open Questions**:
  1. Does the SO1 team plan to train multi-output quantile regressors or separate category-level interval models?
  2. Is equal relative uncertainty across all categories acceptable for extension officer guidance, or do volatile inputs (e.g. fertilizer) exhibit significantly wider prediction intervals than fixed labour?

### 3.3. Linear Acreage Scaling vs Economies of Scale
* **Context**: SO1 predicts cost per acre.
* **Current Implementation**:
  - Linear multiplication: $\text{totalTarget} = \text{round}(\text{predicted\_cost} \times \text{acres})$.
  - Largest-remainder (Hare-Niemeyer) integer rounding guarantees that $\sum \text{category.expected} \equiv \text{totalTarget}$.
* **Open Questions**:
  1. Agricultural operational costs typically exhibit economies of scale: per-acre machinery transport and land preparation decrease as plot size increases (e.g. 5 acres vs 0.5 acre). Does SO1 plan to ingest land extent directly as a non-linear feature?
  2. Should SO3 apply an acreage diminishing-cost curve pending model updates?

### 3.4. Reference Year Economic Lag & Lag Feature Saturation
* **Context**: SO1 training data spans 2018–2024; the model reference year is currently fixed to 2025 (`reference_year: 2025`, `USD_LKR_Rate: 305.0`).
* **Current Implementation**:
  - Predictions for upcoming seasons (2026+) rely on 2025 base year economic factors and historical lag imputations.
  - When lag values exceed historical feature boundaries, SO1 flags `lag_saturation_detected: true`. SO3 captures this in `so1Metadata` and renders a warning banner in the UI.
* **Open Questions**:
  1. What is the scheduled cadence for ingesting new Department of Agriculture Cost of Cultivation surveys and updating inflation/FX indices?
  2. What is the agreed threshold where lag saturation should invalidate the baseline and force fallback to manual baseline entry?

### 3.5. District Fallback Order & Extrapolation Governance
* **Context**: 36 of 64 tested (crop, district, season, irrigation) combinations return 422 Unprocessable Entity due to absence of direct DoA survey records in specific districts (e.g. Green Chilli in Galle, Tomato in Anuradhapura).
* **Current Implementation**:
  - Sequential 3-step policy in `so1Adapter.js`:
    1. Exact District (`allow_extrapolation=false`) $\rightarrow$ policy `exact`
    2. 'Whole Island' national average $\rightarrow$ policy `whole_island`
    3. Model Extrapolation (`allow_extrapolation=true`) $\rightarrow$ policy `extrapolated` (sets `low_confidence: true`)
    4. If all fail: `baselineStatus: 'missing'` (never block cycle activation).
* **Open Questions**:
  1. Does DoA policy permit displaying an extrapolated baseline to farmers in districts where a crop is not traditionally recommended?
  2. Should an officer override be required before an extrapolated baseline is activated?

### 3.6. Crop Alias Normalization ('Chili' -> 'Green Chilli')
* **Context**: SO3 uses standard vernacular crop name `'Chili'`, whereas the SO1 ML training catalog strictly requires `'Green Chilli'`. Passing `'Chili'` directly results in HTTP 422 validation error.
* **Current Implementation** (`shared/config/so1Mapping.js`):
  - Adapter normalizes `'Chili'`, `'chili'`, `'Green Chili'` $\rightarrow$ `'Green Chilli'`.
* **Open Questions**:
  1. Will the SO1 team implement native alias / canonical name handling directly inside the Pydantic `PredictionRequest` validator?
  2. Are other crop variants (e.g., Red Onion vs Big Onion vs Shallots) planned for separate or unified modeling?

### 3.7. Macroeconomic Feature Defaults (USD/LKR Rate & Reference Year)
* **Context**: The SO1 ML model incorporates `USD_LKR_Rate` (feature importance 15–42%) and `reference_year` (range 2014–2030).
* **Current Implementation** (`shared/config/so1Mapping.js`):
  - Configurable defaults: `defaultReferenceYear: 2025` and `defaultUsdLkrRate: 300.73` (drawn from Central Bank of Sri Lanka 2025 baseline).
  - Values are read dynamically from configuration/environment variables, never hard-coded in request paths.
* **Open Questions**:
  1. Should SO3 subscribe to a live Central Bank of Sri Lanka (CBSL) exchange rate feed or rely on periodic administrative configuration?
  2. How sensitive are individual crop models to currency fluctuations outside the historical training range $[130.54, 326.63]$?

---

## 4. Crop Recommendation & Decision Support

The crop recommendation engine ranks candidate crops based on profitability, environmental fit, and historical performance.

### 4.1. Multi-Criteria Scoring Weights
* **Current Implementation** (`server/src/services/recommendationService.js` & `shared/ranking.js`):
  Candidate crops are evaluated across:
  - Projected Gross Profit / Margin
  - Historical Accuracy / Volatility Penalty
  - Local Agro-Ecological Suitability
* **Open Questions**:
  1. What weighting does DoA recommend between economic return (profit) vs. risk mitigation (price volatility, water scarcity)?
  2. Should national food security quotas (e.g. promoting onion or chili cultivation during specific seasons) inject policy priority bonuses into the ranking?

### 4.2. Baseline Yield and Price Standards
* **Current Implementation** (`shared/config/cropYields.js`):
  Benchmark yields: Paddy (2,200 kg/acre), Maize (1,800 kg/acre), Tomato (3,500 kg/acre), Chili (1,200 kg/acre).
* **Open Questions**:
  1. Can DoA provide the official seasonal cost-of-cultivation (*වගා වියදම් හා ආදායම් වාර්තා*) benchmark datasets to replace these preliminary defaults?
  2. How frequently are farm-gate price benchmarks updated?

### 4.3. SO1 Yield Prediction Gap & Cost-Efficiency Formulation
* **Context**: The SO1 ML model predicts nominal cost of cultivation per acre, NOT crop yield.
* **Current Implementation** (`recommendationService.js` & `shared/ranking.js`):
  - Cost efficiency ($\text{LKR/kg}$) is derived by dividing SO1 predicted total cost by static expected yields in `shared/config/cropYields.js`.
* **Open Questions**:
  1. Does the research team or DoA plan to build an empirical yield prediction model factoring in seasonal weather, soil type, and input intensity?
  2. Until a dynamic yield model exists, should seasonal yield variation (e.g. Yala vs Maha yield differences) be reflected in `cropYields.js`?

### 4.4. Green Chilli Regional Observation Limitation
* **Context**: In the DoA historical survey dataset (`coc_model_ready.csv`), Green Chilli records exist exclusively for Anuradhapura.
* **Current Implementation**:
  - In all other districts (Galle, Kandy, Ampara, etc.), SO1 returns 422 under empirical mode and requires national fallback extrapolation (`dataQuality: 'extrapolated'`, `low_confidence: true`).
* **Open Questions**:
  1. Can DoA provide field survey cost records for commercial chili cultivation in the Intermediate and Wet zones?
  2. Should chili recommendations in non-Anuradhapura districts require an extension officer suitability sign-off before being presented as a recommended crop?

### 4.5. Bayesian Shrinkage & Penalty Placeholder Parameters
* **Context**: The accuracy-weighted ranking formula uses Bayesian shrinkage to regularize small sample sizes and penalize volatile error histories.
* **Current Implementation** (`shared/config/recommendationConfig.js`):
  - Prior pseudo-observation weight: $k = 3$
  - Prior baseline error: $\text{priorError} = 0.15$ ($15\%$)
  - Error penalty multiplier: $\text{penalty} = 2.0$
* **Open Questions**:
  1. Are $k = 3$ and $\text{penalty} = 2.0$ appropriately calibrated to smallholder risk profiles, or does a penalty of $2.0$ overly penalize crops experiencing a single anomaly season (e.g. flood damage)?
  2. Should the prior error rate $\text{priorError} = 15\%$ vary between stable staple crops (Paddy) and volatile cash vegetables (Tomato, Chili)?


---

## 5. Localization & UX Standards

### 5.1. Sinhala Terminology Validation
* All primary workflows have dual Sinhala/English parity. Key terms include:
  - කන්නය (Cultivation Season / Cycle)
  - මුරය (Harvest / Sale Round)
  - ගොඩ / මඩ (Upland / Lowland)
  - යෙදවුම් (Inputs)
  - අනතුරු ඇඟවීම් (Alerts)
* **Action Required**: Official sign-off on all UI strings in `client/src/i18n/locales/si.json` by DoA communication officers.

---

## 6. SO3 Receipt Reader & Document Retention Policy

### 6.1. Receipt Image Purge vs. Physical Audit Trail Compliance
* **Current Implementation** (`docs/receipt-reader-design.md` & `shared/receipt/schema.js`):
  - Receipt images are uploaded to temporary storage for OCR extraction and draft generation.
  - Confirmed expense ledger records in MongoDB are permanent.
  - Raw receipt images are scheduled for automatic purge after a configurable default of **7 days** (`RECEIPT_IMAGE_RETENTION_DAYS = 7`) to preserve farmer privacy and control storage volume.
* **Open Questions**:
  1. Does the Department of Agriculture (DoA), Agrarian Development Department, or Auditor General require original receipt images to be archived permanently (e.g. 5–7 years) as physical proof of expenditure for government input subsidies (fertilizer/seed distribution)?
  2. If permanent audit archiving is mandatory, should archived images be migrated to a dedicated compressed cold-storage tier with restricted auditor-only access, or is the 7-day operational purge acceptable given that finalized expenses are signed off by extension officers?

---

## 7. Review & Approval Sign-off Tracker

| Item ID | Category | Topic | Status | Owner | Target Review Date |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Q-01** | Data Layer | Family labour wage imputation | Pending DoA | Agronomy Lead | 2026-10-25 |
| **Q-02** | Data Layer | Machinery billing method | Pending DoA | Agronomy Lead | 2026-10-25 |
| **Q-03** | Data Layer | Handwritten annotation transcription | In Review | Field Team | 2026-10-20 |
| **Q-04** | Alerts | Tier threshold boundaries | Pending DoA | Tech / DoA | 2026-11-05 |
| **Q-05** | Alerts | Under-spend alert necessity | Pending DoA | Agronomy Lead | 2026-11-05 |
| **Q-06** | SO1 API | Production endpoint & auth contract | Pending SO1 Team | System Architect | 2026-11-15 |
| **Q-07** | Ranking | Crop recommendation policy weights | Pending DoA | Policy Advisor | 2026-11-20 |
| **Q-08** | Benchmarks | Official cost of cultivation tables | Pending DoA | Stats Department | 2026-11-20 |
| **Q-09** | SO3 Storage | Receipt image audit retention vs 7-day purge | Pending DoA | Legal / Audit | 2026-11-25 |
| **Q-10** | SO1 API | Compound 8-category disaggregation split ratios | In Discussion | SO1 Lead / Agronomy | 2026-11-15 |
| **Q-11** | SO1 API | Category-level prediction interval derivation | In Discussion | SO1 Lead | 2026-11-15 |
| **Q-12** | SO1 API | Non-linear acreage scaling vs linear assumption | In Discussion | SO1 Lead | 2026-11-15 |
| **Q-13** | SO1 API | Crop alias normalization & validation | Pending SO1 Team | Dev Lead | 2026-11-15 |
| **Q-14** | SO1 API | Macroeconomic feed vs static config (USD/LKR) | Pending DoA | System Architect | 2026-11-20 |
| **Q-15** | SO3 ML | Conformal prediction intervals: field calibration vs simulator calibration | Pending Field Data | ML Engineer | 2026-12-01 |
| **Q-16** | SO3 ML | Minimum progress unlocking thresholds (tau=0.30 prior, tau=0.20 learned) | Pending DoA | Agronomy Lead | 2026-11-30 |
| **Q-17** | SO3 UX | Advisory projection messaging vs farmer anxiety / alarm fatigue | In Review | UX / Field Officers | 2026-11-30 |

---

## 8. SO3 End-of-Season Cost Forecasting

### 8.1. Conformal Interval Calibration on Field Data
* **Context**: Current 80% prediction intervals are calibrated on synthetic daily spend simulation cohorts (`StratifiedConformalCalibrator`), guaranteeing finite-sample coverage under simulation exchangeability.
* **Open Questions**:
  1. Once multi-season empirical farm records are collected in production, what protocol will recalibrate these quantiles on real smallholder cycles?
  2. Should conformal intervals be stratified by ecological zone (Dry vs Wet zone) or farm scale (< 2 acres vs > 5 acres) rather than purely per-tau knots?

### 8.2. Progress Unlocking Thresholds ($\tau_{\min}$)
* **Context**: Mathematical evaluation demonstrates that below $\tau = 0.30$ ($30\%$ progress), variance in early planting and basal fertilizer expenditure causes high MAPE ($> 15\%$). Projections unlock at $\tau \ge 0.30$ for prior mode and $\tau \ge 0.20$ for learned mode.
* **Open Questions**:
  1. Do extension officers find a 30% delay acceptable for seasonal paddy (approx. day 32 of 105 days), or do farmers demand preliminary estimates during initial land preparation?
  2. How should the system visually communicate that early variances are within natural agronomic tolerance bands rather than budget failures?


