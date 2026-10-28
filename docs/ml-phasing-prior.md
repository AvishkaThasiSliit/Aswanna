# Knowledge-Anchored Cultivation Phasing Prior (v0.2.0)

**Document Scope**: SO3 Expense Phasing Priors & Empirical Agronomic Calibration  
**Status**: Specification & Empirical Research Prior (Not Wired Into Production SO3 Engine)  
**Date**: October 2026  
**Artifact Version**: `v0.2.0` ([`ml/artifacts/phasing_priors_v0.json`](file:///D:/Aswanna/ml/artifacts/phasing_priors_v0.json))  
**Generating Script**: [`ml/src/build_phasing_priors.py`](file:///D:/Aswanna/ml/src/build_phasing_priors.py)  

---

## Executive Summary & Statistical Uncertainty Interpretation

> [!IMPORTANT]
> **Interpretation of $P_{10}$ and $P_{90}$ Bands**:
> The $P_{10}$ and $P_{90}$ credible bands reported in this artifact represent the combined effect of **agronomic timing window uncertainty** (sampling stage start and end times across wide ranges) and **cross-farm survey sampling variance** (cluster bootstrapping over surveyed farm sheets).
>
> They do **NOT** constitute a prediction interval for any individual farm's cash flow or expenditure on a given day. An individual farm may experience lumpy, discrete outlays on specific dates. The bands quantify our population-level uncertainty regarding the median regional cumulative spend fraction curve.

**Status & Scope**:
Exploratory phasing-prior research track. Evaluated on simulated data only (0 real cycles). Not wired into the live variance engine, which uses shared/phasing.js. Candidate for future integration behind a flag after validation on real DoA cycle data. End-of-season cost prediction belongs to SO1 and is explicitly out of scope for SO3.

The production SO3 engine currently tracks cumulative spend against normalized cycle progress $\tau = t / T \in [0, 1]$ using hardcoded piecewise-linear placeholder curves in [`shared/phasing.js`](file:///D:/Aswanna/shared/phasing.js). This document reports the audit, calibration, and sensitivity analysis of empirical phasing priors derived from **7,592 raw operation cost records** extracted from 33 Department of Agriculture (DoA) Cost of Cultivation (COC) survey workbooks (19 seasons, 2014–2025).

---

## 1. Stage Windows Audit & Agronomic Assumptions

In accordance with strict empirical auditing rules:
* Institute home page URLs (e.g. `doa.gov.lk/rrdi/`) do not qualify as citations.
* Because formal, published circulars with exact day-by-day dates were not directly retrievable via permanent document URLs, **every stage timing window is explicitly designated as `assumption`** with widened min-max bounds to prevent false precision.

### 1.1 Stage Timing Windows Table

| Crop | Cultivation Stage | Timing Window ($\tau$) | Status | Agronomic Rationale & Operational Scope |
| :--- | :--- | :---: | :---: | :--- |
| **Paddy** | `land_preparation` | $[0.00, 0.20]$ | `assumption` | 1st/2nd plowing, bund plastering, puddling, final leveling. |
| | `planting` | $[0.05, 0.25]$ | `assumption` | Wet direct-seeding (broadcasting) or seedling transplanting. |
| | `fertilizer_basal`| $[0.05, 0.25]$ | `assumption` | Basal fertilizer incorporated into puddled soil prior to or at sowing. |
| | `crop_care` | $[0.15, 0.80]$ | `assumption` | Early weed control (weedicides/hand), split top-dressings, pest sprays. |
| | `harvest` | $[0.80, 1.00]$ | `assumption` | Combine harvesting, threshing, drying, bagging, transport to store. |
| **Maize** | `land_preparation` | $[0.00, 0.20]$ | `assumption` | Primary tractor tillage, harrowing, ridge and furrow formation. |
| | `planting` | $[0.05, 0.25]$ | `assumption` | Direct seed dibbling into ridges, thinning, and gap filling. |
| | `fertilizer_basal`| $[0.05, 0.25]$ | `assumption` | Basal fertilizer applied in planting furrows at sowing. |
| | `crop_care` | $[0.15, 0.80]$ | `assumption` | Weed control, earthing up, knee-high and tasseling split top-dressings. |
| | `harvest` | $[0.80, 1.00]$ | `assumption` | Cob picking, de-husking, sun drying, mechanical shelling. |
| **Tomato**| `land_preparation` | $[0.00, 0.22]$ | `assumption` | Deep tillage, raised bed forming, basal compost incorporation. |
| | `planting` | $[0.08, 0.28]$ | `assumption` | Nursery management, field transplanting 18-21 day-old seedlings. |
| | `fertilizer_basal`| $[0.08, 0.28]$ | `assumption` | Basal chemical fertilizer applied in planting holes. |
| | `crop_care` | $[0.18, 0.80]$ | `assumption` | Staking (trellising), split top dressings, intensive fungicide/insecticide sprays. |
| | `harvest` | $[0.65, 1.00]$ | `assumption` | Continuous multi-pick harvesting commencing ~70 DAS through 110 DAS. |
| **Green Chilli**| `land_preparation` | $[0.00, 0.22]$ | `assumption` | Primary tillage, ridge and furrow forming, nursery beds. |
| | `planting` | $[0.08, 0.28]$ | `assumption` | Transplanting 21-day nursery seedlings into field at 60x45 cm spacing. |
| | `fertilizer_basal`| $[0.08, 0.28]$ | `assumption` | Basal fertilizer incorporated into ridges before transplanting. |
| | `crop_care` | $[0.18, 0.80]$ | `assumption` | Weed control, earthing up, split top dressings (2, 4, 8 weeks), thrips sprays. |
| | `harvest` | $[0.60, 1.00]$ | `assumption` | Extended multi-pick pod pickings from 85 DAS through final harvest at 140 DAS. |

---

## 2. Fertilizer Phasing: Basal vs. Top-Dress Decomposition

### 2.1 The Premature $\tau = 0.20$ Completion Flaw
In initial prior iterations, fertilizer spend reached $1.00$ by $\tau = 0.20$ across all crops. Investigation revealed two root causes:
1. **Raw Survey Aggregation**: The DoA survey operation tables consolidate seasonal fertilizer applications into a single operation row: `"Fertilizer Application"`.
2. **All-or-Nothing Mapping**: The original parser mapped any operation containing `"fertilizer"` directly to the `fertilizer_basal` stage, whose timing window ended at $\tau \le 0.20$.

### 2.2 Agronomic & Empirical Evidence
In Sri Lankan agrarian practice, chemical fertilizer is never applied entirely upfront:
* **Basal Application**: Applied at final tillage or sowing ($\tau \approx 0.05 - 0.20$). Contains TSP, Zinc, and a small fraction of Urea.
* **Top-Dressing Splits**: Applied in 2 to 3 split applications during vegetative, active tillering, and panicle initiation / flowering stages ($\tau \approx 0.20 - 0.75$).

Empirical audit of the processed survey dataset ([`Profit Folder/COC folder/data/processed/coc_model_ready.csv`](file:///D:/Aswanna/Profit%20Folder/COC%20folder/data/processed/coc_model_ready.csv)) confirms the actual cost breakdown:
* **Paddy** ($N = 269$ survey records): **Basal share = 26.4%**, **Top-dressing share = 73.6%** of total fertilizer cost.
* **Maize** ($N = 5$ detailed records): **Basal share = 15.4%**, **Top-dressing share = 84.6%** of total fertilizer cost.

### 2.3 The Calibrated Mapping Fix
In [`ml/src/build_config.py`](file:///D:/Aswanna/ml/src/build_config.py) and [`ml/src/build_phasing_priors.py`](file:///D:/Aswanna/ml/src/build_phasing_priors.py):
* Explicit basal operations (e.g. `"Basal application"`, `"Organic manure"`, `"Compost"`) map 100% to stage `fertilizer_basal` ($[0.05, 0.25]$).
* General `"Fertilizer Application"` rows are decomposed according to regional research splits:
  - **Paddy**: 30% basal (`fertilizer_basal`), 70% top-dressing (`crop_care`)
  - **Maize**: 20% basal (`fertilizer_basal`), 80% top-dressing (`crop_care`)
  - **Tomato**: 30% basal (`fertilizer_basal`), 70% top-dressing (`crop_care`)
  - **Green Chilli**: 25% basal (`fertilizer_basal`), 75% top-dressing (`crop_care`)

**Result**: At $\tau = 0.20$, fertilizer $P_{50}$ is **$0.18 - 0.30$** (matching basal), reaches **$0.64 - 0.70$** at $\tau = 0.50$, and finishes at **$1.00$** at $\tau = 0.80$ (matching the final panicle top-dressing).

---

## 3. Unresolved Material Split Audit & The Separate 'Unresolved' Bucket

### 3.1 Why 'Other' Was Reaching $0.85 - 0.98$ at $\tau = 0.20$
Investigation revealed that early operations like `"Levelling & broadcasting"` (seed paddy broadcasting) and `"Digging holes & seeding"` (seed dibbling) were matching keywords like `"level"` and `"digging holes"` in `land_preparation`. Because `land_preparation` material was previously mapped to `"other"`, and unclassified materials were dumped into `"other"`, seed costs and land prep materials were polluting the `"other"` category at $\tau \le 0.20$.

### 3.2 Unresolved Cost Share Audit

| Crop | Total Survey Cost (Rs) | Unresolved Material Cost (Rs) | Unresolved Share of Total Cost | Typical Operations Included |
| :--- | :---: | :---: | :---: | :--- |
| **Paddy** | Rs 39,111,965.37 | Rs 462,320.00 | **1.18%** | Bund plastering mud, soil amendments, unidentified nursery inputs. |
| **Maize** | Rs 3,964,281.93 | Rs 67,544.00 | **1.70%** | Unspecified furrow additives, pre-sowing soil treatments. |
| **Tomato** | Rs 10,095,253.57 | Rs 838,308.00 | **8.30%** | Trellis staking sticks, wooden support poles, binding twine. |
| **Green Chilli**| Rs 5,872,350.36 | Rs 78,691.00 | **1.34%** | Nursery shading materials, unclassified bed treatments. |

### 3.3 Isolation of the 'Unresolved' Bucket
1. Material costs with ambiguous attribution are placed in a dedicated, isolated bucket: **`unresolved_bucket`**.
2. **`unresolved` is strictly excluded from the 8 canonical SO3 categories**.
3. **`other`** now strictly contains genuine post-harvest and packaging expenditures (gunny bags, packing twines, transport freight, storage fees), correctly incurring zero cost until harvest ($\tau \ge 0.65 - 0.80$).

---

## 4. Metadata Classification: Status of All Category/Crop Pairs

In accordance with Section 4 and Section 5 of the audit specification, every crop-category curve in [`ml/artifacts/phasing_priors_v0.json`](file:///D:/Aswanna/ml/artifacts/phasing_priors_v0.json) is explicitly tagged:

| Crop | Category | Data Status | Learned / Derived / Placeholder |
| :--- | :--- | :---: | :--- |
| **All Crops** | `seed` | `learned from survey data` | **Learned** (anchored to planting/nursery operations). |
| **All Crops** | `fertilizer` | `learned from survey data` | **Learned** (decomposed into basal + crop-care top dressings). |
| **All Crops** | `agrochemical` | `learned from survey data` | **Learned** (anchored to weedicide, insecticide, and fungicide sprays). |
| **All Crops** | `labour` | `learned from survey data` | **Learned** (accumulated across all 5 cultivation stages). |
| **All Crops** | `machinery` | `learned from survey data` | **Learned** (tractor tillage, combine harvesting, thresher rentals). |
| **All Crops** | `fuel` | `derived from machinery` | **Derived** (fixed 70/30 machinery/fuel split from SO1 integration; not independently learned). |
| **All Crops** | `irrigation` | `no data - placeholder` | **Placeholder** (insufficient standalone water fee line-items in raw surveys). |
| **All Crops** | `other` | `learned from survey data` | **Learned** (strictly post-harvest bags, packing, transport). |
| **All Crops** | `unresolved` | `unresolved material split`| **Isolated Bucket** (tracked separately; excluded from canonical 8 categories). |

---

## 5. Green Chilli Harvest & Multi-Picking Dynamics

* **Harvest Row Count**: Green chilli survey records contain **22 harvest operation rows** across **17 distinct survey sheets** (100% of chilli sheets include harvest operations).
* **Multi-Picking Reality**: Green chilli is a perennial/extended indeterminate crop where fresh pods are harvested in multiple staggered pickings every 7–10 days over 2 months.
* **Continuous Progression Fix**: Rather than an instantaneous step-function where $P_{50}$ jumps to 1.0 at $\tau = 0.80$, the updated Monte Carlo simulation models harvest expenditure as accumulating progressively across the harvest window $[0.60, 1.00]$.
* **Result**: At $\tau = 0.80$, Green Chilli labour reaches **$0.8393$** and machinery/fuel reaches **$0.9091$**, eliminating artificial premature completion.

---

## 6. Sensitivity Analysis: Window Shifts ($\pm 20\%$)

To test prior stability against stage timing uncertainty, the simulation was re-run with all timing windows shifted by $-20\%$ and $+20\%$. The table below reports the **maximum knot divergence** ($\Delta_{\max} = \max_k |P_{50, \text{shifted}} - P_{50, \text{baseline}}|$) recorded across all knots:

| Crop | Category | Max Knot Change ($\Delta_{\max}$) | Worst Sensitivity Scenario |
| :--- | :--- | :---: | :--- |
| **Paddy** | `seed` | $0.2981$ | `shift_plus_20` |
| | `fertilizer` | $0.3020$ | `shift_minus_20` |
| | `agrochemical` | $0.4315$ | `shift_minus_20` |
| | `labour` | $0.3146$ | `shift_minus_20` |
| | `machinery` | $0.3765$ | `shift_minus_20` |
| | `fuel` | $0.3765$ | `shift_minus_20` |
| | `irrigation` | $0.4000$ | `shift_minus_20` |
| | `other` | $1.0000$ | `shift_minus_20` (harvest milestone shift) |
| **Maize** | `seed` | $0.3373$ | `shift_plus_20` |
| | `fertilizer` | $0.3363$ | `shift_minus_20` |
| | `agrochemical` | $0.4203$ | `shift_minus_20` |
| | `labour` | $0.2767$ | `shift_minus_20` |
| | `machinery` | $0.2405$ | `shift_minus_20` |
| | `fuel` | $0.2405$ | `shift_minus_20` |
| | `irrigation` | $0.4000$ | `shift_minus_20` |
| | `other` | $1.0000$ | `shift_minus_20` |
| **Tomato** | `seed` | $0.3473$ | `shift_plus_20` |
| | `fertilizer` | $0.3284$ | `shift_minus_20` |
| | `agrochemical` | $0.4692$ | `shift_minus_20` |
| | `labour` | $0.1997$ | `shift_minus_20` |
| | `machinery` | $0.1643$ | `shift_minus_20` |
| | `fuel` | $0.1643$ | `shift_minus_20` |
| | `irrigation` | $0.0000$ | `shift_minus_20` |
| | `other` | $0.7328$ | `shift_minus_20` |
| **Green Chilli**| `seed` | $0.3793$ | `shift_plus_20` |
| | `fertilizer` | $0.3566$ | `shift_minus_20` |
| | `agrochemical` | $0.4755$ | `shift_minus_20` |
| | `labour` | $0.2809$ | `shift_minus_20` |
| | `machinery` | $0.1933$ | `shift_minus_20` |
| | `fuel` | $0.1933$ | `shift_minus_20` |
| | `irrigation` | $0.4000$ | `shift_minus_20` |
| | `other` | $0.5397$ | `shift_minus_20` |

---

## 7. Calibrated Comparison Table (Prior P50 vs. Placeholder)

$$\text{Divergence} = P_{50} - \text{Placeholder}$$

| Crop | Category | $\tau = 0.20$ (Prior vs PH) | Divergence | $\tau = 0.50$ (Prior vs PH) | Divergence | $\tau = 0.80$ (Prior vs PH) | Divergence |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Paddy** | `seed` | $1.0000$ vs $0.7400$ | $+0.2600$ | $1.0000$ vs $0.9167$ | $+0.0833$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `fertilizer` | $0.3000$ vs $0.7400$ | $-0.4400$ | $0.6980$ vs $0.9167$ | $-0.2187$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `agrochemical` | $0.0000$ vs $0.7400$ | $-0.7400$ | $0.5685$ vs $0.9167$ | $-0.3482$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `labour` | $0.4444$ vs $0.2000$ | $+0.2444$ | $0.5870$ vs $0.5000$ | $+0.0870$ | $0.6854$ vs $0.8000$ | $-0.1146$ |
| | `machinery` | $0.4673$ vs $0.2000$ | $+0.2673$ | $0.5575$ vs $0.5000$ | $+0.0575$ | $0.6235$ vs $0.8000$ | $-0.1765$ |
| | `fuel` | $0.4673$ vs $0.2000$ | $+0.2673$ | $0.5575$ vs $0.5000$ | $+0.0575$ | $0.6235$ vs $0.8000$ | $-0.1765$ |
| | `irrigation` | $0.0000$ vs $0.2000$ | $-0.2000$ | $0.5000$ vs $0.5000$ | $0.0000$ | $1.0000$ vs $0.8000$ | $+0.2000$ |
| | `other` | $0.0000$ vs $0.2000$ | $-0.2000$ | $0.0000$ vs $0.5000$ | $-0.5000$ | $0.0000$ vs $0.8000$ | $-0.8000$ |
| **Maize** | `seed` | $1.0000$ vs $0.7400$ | $+0.2600$ | $1.0000$ vs $0.9167$ | $+0.0833$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `fertilizer` | $0.2000$ vs $0.7400$ | $-0.5400$ | $0.6637$ vs $0.9167$ | $-0.2530$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `agrochemical` | $0.0000$ vs $0.7400$ | $-0.7400$ | $0.5797$ vs $0.9167$ | $-0.3370$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `labour` | $0.2851$ vs $0.2000$ | $+0.0851$ | $0.5461$ vs $0.5000$ | $+0.0461$ | $0.7233$ vs $0.8000$ | $-0.0767$ |
| | `machinery` | $0.5874$ vs $0.2000$ | $+0.3874$ | $0.6986$ vs $0.5000$ | $+0.1986$ | $0.7595$ vs $0.8000$ | $-0.0405$ |
| | `fuel` | $0.5874$ vs $0.2000$ | $+0.3874$ | $0.6986$ vs $0.5000$ | $+0.1986$ | $0.7595$ vs $0.8000$ | $-0.0405$ |
| | `irrigation` | $0.0000$ vs $0.2000$ | $-0.2000$ | $0.5000$ vs $0.5000$ | $0.0000$ | $1.0000$ vs $0.8000$ | $+0.2000$ |
| | `other` | $0.0000$ vs $0.2000$ | $-0.2000$ | $0.0000$ vs $0.5000$ | $-0.5000$ | $0.0000$ vs $0.8000$ | $-0.8000$ |
| **Tomato** | `seed` | $0.6832$ vs $0.7400$ | $-0.0568$ | $1.0000$ vs $0.9167$ | $+0.0833$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `fertilizer` | $0.2126$ vs $0.7400$ | $-0.5274$ | $0.6716$ vs $0.9167$ | $-0.2451$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `agrochemical` | $0.0000$ vs $0.7400$ | $-0.7400$ | $0.5308$ vs $0.9167$ | $-0.3859$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `labour` | $0.2825$ vs $0.2000$ | $+0.0825$ | $0.5654$ vs $0.5000$ | $+0.0654$ | $0.8566$ vs $0.8000$ | $+0.0566$ |
| | `machinery` | $0.4824$ vs $0.2000$ | $+0.2824$ | $0.6903$ vs $0.5000$ | $+0.1903$ | $0.8897$ vs $0.8000$ | $+0.0897$ |
| | `fuel` | $0.4824$ vs $0.2000$ | $+0.2824$ | $0.6903$ vs $0.5000$ | $+0.1903$ | $0.8897$ vs $0.8000$ | $+0.0897$ |
| | `irrigation` | $0.2000$ vs $0.2000$ | $0.0000$ | $0.5000$ vs $0.5000$ | $0.0000$ | $0.8000$ vs $0.8000$ | $0.0000$ |
| | `other` | $0.0000$ vs $0.2000$ | $-0.2000$ | $0.0000$ vs $0.5000$ | $-0.5000$ | $0.4369$ vs $0.8000$ | $-0.3631$ |
| **Green Chilli**| `seed` | $0.7254$ vs $0.7400$ | $-0.0146$ | $1.0000$ vs $0.9167$ | $+0.0833$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `fertilizer` | $0.1796$ vs $0.7400$ | $-0.5604$ | $0.6434$ vs $0.9167$ | $-0.2733$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `agrochemical` | $0.0000$ vs $0.7400$ | $-0.7400$ | $0.5245$ vs $0.9167$ | $-0.3922$ | $1.0000$ vs $0.9667$ | $+0.0333$ |
| | `labour` | $0.2542$ vs $0.2000$ | $+0.0542$ | $0.5028$ vs $0.5000$ | $+0.0028$ | $0.8393$ vs $0.8000$ | $+0.0393$ |
| | `machinery` | $0.3704$ vs $0.2000$ | $+0.1704$ | $0.6171$ vs $0.5000$ | $+0.1171$ | $0.9091$ vs $0.8000$ | $+0.1091$ |
| | `fuel` | $0.3704$ vs $0.2000$ | $+0.1704$ | $0.6171$ vs $0.5000$ | $+0.1171$ | $0.9091$ vs $0.8000$ | $+0.1091$ |
| | `irrigation` | $0.0000$ vs $0.2000$ | $-0.2000$ | $0.5000$ vs $0.5000$ | $0.0000$ | $1.0000$ vs $0.8000$ | $+0.2000$ |
| | `other` | $0.0000$ vs $0.2000$ | $-0.2000$ | $0.0000$ vs $0.5000$ | $-0.5000$ | $0.8000$ vs $0.8000$ | $0.0000$ |

---

## 8. Verification & Test Suite

The test suite in [`ml/tests/test_phasing_priors.py`](file:///D:/Aswanna/ml/tests/test_phasing_priors.py) verifies:
1. Exact row counts on the 2 hand-checked raw workbooks.
2. Boundary conditions and strict monotonicity for all canonical categories across all crops.
3. Separation of the `unresolved_bucket` from canonical categories.
4. Correct setting of metadata flags (`fuel` derived from machinery, `irrigation` placeholder, global uncertainty interpretation).
5. Determinism: identical random seeds produce identical floating-point output arrays.
