# SO1 Architectural Discovery & Integration Audit (Cost of Cultivation - COC)

**Auditor:** Antigravity Senior Engineering Pair  
**Target Component:** Teammate SO1 Cost of Cultivation Engine (`D:\Aswanna\Profit Folder\COC folder\`)  
**Scope:** SO3 Cost Tracking & Financial Intelligence Integration Audit  
**Note on Scope Boundaries:** Per path correction, the SO1 cost engine resides exclusively in `D:\Aswanna\Profit Folder\COC folder\`. Other directories in `Profit Folder` (`Price folder` for vegetable prices and `profit_engine` for multi-engine farmer advisory) are out-of-scope and strictly ignored.  
**Mode:** Strictly READ-ONLY on all SO1 sources (No code, datasets, or configurations modified or run)  
**Date:** 2026-10-20  

---

## Executive Summary

The teammate's SO1 component is a **machine learning cultivation cost prediction service** built on Sri Lanka Department of Agriculture (DoA) Socio Economics & Planning Centre (SEPC) historical survey data (2014–2025). The core ML engine uses an **ExtraTreesRegressor** (`extratrees_champion_v2`, LOSO MAE: Rs 22,822.02, R²: 0.9329) wrapped in a **FastAPI** REST interface.

Crucially for SO3, **SO1 does not natively predict the 8 fine-grained cost categories (`seed`, `fertilizer`, `agrochemical`, `labour`, `machinery`, `fuel`, `irrigation`, `other`) nor their category-level confidence intervals**. Instead, it predicts a single scalar value (**Total Cost per Acre in LKR**), and applies a post-hoc historical percentage breakdown into 7 illustrative sub-categories.

This document details the exact stack, interfaces, data schemas, discrepancies against SO3 contracts, merge risks, and our recommended architectural integration pattern.

---

## 1. Stack & Runtime Architecture

| Dimension | Specification | Evidence (File & Line) |
|:---|:---|:---|
| **Languages** | Python 3 (built/tested on Python 3.10–3.13; `cpython-313` bytecode present in `research_experiments/src/__pycache__/`); TypeScript/React for COC frontend | `COC folder\research_experiments\requirements.txt:1-2`<br>`COC folder\frontend\package.json:1-30` |
| **Frameworks** | **FastAPI** (REST API), **Uvicorn** (ASGI server), **scikit-learn** (Pipeline, ExtraTreesRegressor, TransformedTargetRegressor), **pandas**, **numpy**, **scipy**, **joblib**, **SHAP** (TreeExplainer) | `COC folder\prediction_api.py:24-27`<br>`COC folder\predict_with_intervals.py:20-25` |
| **Primary Entry Point** | **Cost Prediction API**: `COC folder/prediction_api.py` exposes `app = FastAPI(...)` and launches via `uvicorn.run("prediction_api:app", host="0.0.0.0", port=8000, reload=True)` | `COC folder\prediction_api.py:347-352, 850-852` |
| **How to Start** | Run via Uvicorn CLI or Python directly from `D:\Aswanna\Profit Folder\COC folder\`:<br>`uvicorn prediction_api:app --reload --port 8000`<br>Or:<br>`python prediction_api.py` | `COC folder\README_API.md:26`<br>`COC folder\prediction_api.py:850-852` |
| **Dependency Files** | 1. `COC folder\research_experiments\requirements.txt`<br>2. `COC folder\frontend\package.json`<br>3. `COC folder\README_API.md:14` specifies production API deps: `pip install fastapi uvicorn pydantic requests`<br>*(Note: Root `requirements.txt` in `COC folder/` root is **NOT FOUND**)* | `COC folder\research_experiments\requirements.txt:4-22`<br>`COC folder\README_API.md:14` |
| **Required Versions** | `numpy>=1.26.0`, `pandas>=2.2.0`, `scipy>=1.12.0`, `scikit-learn>=1.4.0`, `statsmodels>=0.14.0`, `prophet>=1.1.5`, `xgboost>=2.0.0`, `lightgbm>=4.3.0`, `catboost>=1.2.0`, `torch>=2.2.0`, `pytorch-tabnet>=4.1.0`, `optuna>=3.6.0`, `shap>=0.45.0`, `matplotlib>=3.8.0`, `seaborn>=0.13.0`, `pyyaml>=6.0`, `joblib>=1.3.0`, `ollama>=0.2.0`, `requests>=2.31.0` | `COC folder\research_experiments\requirements.txt:4-22` |

---

## 2. Component Size & Largest Files (Inside `COC folder`)

### Top 15 Largest Files Overall (Including Frontend Node Modules)
As determined by filesystem scan of `D:\Aswanna\Profit Folder\COC folder\`:

| Rank | Size (Bytes) | Relative Path | Category |
|:---:|:---|:---|:---|
| 1 | 20,808,704 | `COC folder\frontend\node_modules\@rolldown\binding-win32-x64-msvc\rolldown-binding.win32-x64-msvc.node` | Native Node binary |
| 2 | 13,831,680 | `COC folder\frontend\node_modules\@oxlint\binding-win32-x64-msvc\oxlint.win32-x64-msvc.node` | Native Node binary |
| 3 | 9,484,800 | `COC folder\frontend\node_modules\lightningcss-win32-x64-msvc\lightningcss.win32-x64-msvc.node` | Native Node binary |
| 4 | 9,144,216 | `COC folder\frontend\node_modules\typescript\lib\typescript.js` | JavaScript bundle |
| 5 | 7,305,850 | `COC folder\frontend\node_modules\lucide-react\dist\cjs\lucide-react.js.map` | Source map |
| 6 | 6,239,091 | `COC folder\frontend\node_modules\typescript\lib\_tsc.js` | TypeScript compiler |
| 7 | 4,501,254 | `COC folder\frontend\node_modules\tailwindcss\peers\index.js` | Tailwind asset |
| 8 | 2,940,220 | `COC folder\frontend\node_modules\recharts\umd\Recharts.js.map` | Charting map |
| 9 | 2,739,782 | `COC folder\frontend\node_modules\.vite\deps\recharts.js.map` | Vite cache map |
| 10 | 2,652,835 | `COC folder\frontend\node_modules\.vite\deps\lucide-react.js.map` | Vite cache map |
| 11 | 2,601,423 | `COC folder\frontend\node_modules\lucide-react\dynamic.d.ts` | Type definition |
| 12 | 2,601,423 | `COC folder\frontend\node_modules\lucide-react\dynamic.d.mts` | Type definition |
| 13 | 2,600,205 | `COC folder\frontend\node_modules\lucide-react\dynamicIconImports.d.ts` | Type definition |
| 14 | 2,600,205 | `COC folder\frontend\node_modules\lucide-react\dynamicIconImports.d.mts` | Type definition |
| 15 | 2,349,483 | `COC folder\frontend\node_modules\typescript\lib\lib.dom.d.ts` | Type definition |

### Top 15 Largest Domain, Dataset & ML Model Files (Excluding `node_modules` & `.git`)

| Rank | Size (Bytes) | Relative Path | Category |
|:---:|:---|:---|:---|
| 1 | 993,268 | `COC folder\frontend\dist\assets\index-BxNvLIgl.js` | Production frontend asset |
| 2 | 828,813 | `COC folder\data\raw_surveys\2020 Yala\Final sheet\Paddy\cheked final sheets 2020y .xlsx` | DoA Raw Survey Dataset |
| 3 | 677,129 | `COC folder\research_experiments\experiments\Shallow_ML\stacking_top3\stacking_top3_20261008_172400_86bb22\model.joblib` | Stacking Top3 Model |
| 4 | 675,785 | `COC folder\data\raw_surveys\2018-19 Maha\Paddy\Final sheets.xlsx` | DoA Raw Survey Dataset |
| 5 | 668,568 | `COC folder\research_experiments\experiments\Shallow_ML\stacking_top3\stacking_top3_20261008_172400_86bb22\fold_models\LOSO_2014.joblib` | LOSO Fold Model 2014 |
| 6 | 667,099 | `COC folder\research_experiments\experiments\Shallow_ML\stacking_top3\stacking_top3_20261008_172400_86bb22\fold_models\LOSO_2025.joblib` | LOSO Fold Model 2025 |
| 7 | 666,481 | `COC folder\research_experiments\experiments\Shallow_ML\stacking_top3\stacking_top3_20261008_172400_86bb22\fold_models\LOSO_2022.joblib` | LOSO Fold Model 2022 |
| 8 | 665,881 | `COC folder\figures\exchange_rate_check.png` | Analytical figure |
| 9 | 665,363 | `COC folder\research_experiments\experiments\Shallow_ML\stacking_top3\stacking_top3_20261008_172400_86bb22\fold_models\LOSO_2020.joblib` | LOSO Fold Model 2020 |
| 10 | 661,914 | `COC folder\research_experiments\experiments\Shallow_ML\extratrees\extratrees_20261008_172302_4dfc14\fold_models\LOSO_2021.joblib` | ExtraTrees Fold Model 2021 |
| 11 | 661,469 | `COC folder\research_experiments\experiments\Shallow_ML\stacking_top3\stacking_top3_20261008_172400_86bb22\fold_models\LOSO_2019.joblib` | LOSO Fold Model 2019 |
| 12 | 657,817 | `COC folder\research_experiments\experiments\Shallow_ML\extratrees\extratrees_20261008_172302_4dfc14\fold_models\LOSO_2020.joblib` | ExtraTrees Fold Model 2020 |
| 13 | **657,687** | **`COC folder\models\best_model_pipeline.pkl`** | **Production Champion Pipeline** |
| 14 | 656,566 | `COC folder\research_experiments\experiments\Shallow_ML\stacking_top3\stacking_top3_20261008_172400_86bb22\fold_models\LOSO_2021.joblib` | LOSO Fold Model 2021 |
| 15 | 653,878 | `COC folder\research_experiments\experiments\Shallow_ML\extratrees\extratrees_20261008_172302_4dfc14\model.joblib` | ExtraTrees Full Model |

---

## 3. Prediction Path & Contract Specification

### Python Function & REST Endpoint
- **Function**: `predict_with_interval(X_raw, confidence=0.80, top_n_drivers=3)` in `COC folder\predict_with_intervals.py:236-356`.
- **Endpoint**: `POST /predict` handled by `predict_cost(req: PredictionRequest)` in `COC folder\prediction_api.py:609-732`.

### Exact Inputs (`PredictionRequest` Schema in `COC folder\prediction_api.py:375-422`)

```python
class PredictionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    district: str             # e.g., "Nuwara Eliya" (must match ALL_DISTRICTS: 25 DoA districts + Colombo)
    crop: str                 # e.g., "Potato" (must match CROPS_SUPPORTED: 23 crops)
    season: str               # "Maha" | "Yala"
    irrigation_type: str      # "Irrigated" | "Rainfed" | "Unspecified"
    reference_year: Optional[int] = 2025    # Range: 2014 to 2030 (YEAR_MIN to YEAR_MAX + 5)
    usd_lkr_rate: Optional[float] = 300.73  # Range: 50.0 to 1000.0 (training range: [130.54, 326.63])
    prev_season_cost: Optional[float] = None # Prior cost in LKR (null allowed for cold start)
    allow_extrapolation: bool = False       # Permit crop-district combinations without history
```

> [!IMPORTANT]
> **Land Extent Input Is NOT FOUND in `COC folder/prediction_api.py`:**
> `PredictionRequest` does **not** accept `land_extent` or `acreage`. The ML pipeline exclusively predicts cost **per single acre** (fixed standard in DoA survey bulletins, `DATA_DICTIONARY.md:51`).

### Exact Output Contract & Real Execution Example
Concrete response payload captured from live model inference on Potato in Nuwara Eliya (`COC folder\reports\sample_response.json:1-67`):

```json
{
    "request_id": "8cf66204-4f1a-4a29-93c3-3bca424705b4",
    "timestamp": "2026-10-08T13:17:28.769845+00:00",
    "predicted_cost": 866962.2,
    "interval_low": 718041.9,
    "interval_high": 1046768.2,
    "low_confidence": false,
    "low_confidence_reason": null,
    "reference_note": "Model reference year is 2025 (latest available data). Predictions will refresh when 2026 data is ingested.",
    "top_drivers": [
        {
            "feature": "Crop",
            "contribution_pct": 39.4,
            "direction": "+"
        },
        {
            "feature": "Prev_Season_Total_Cost_Incl_Imputed",
            "contribution_pct": 27.0,
            "direction": "+"
        },
        {
            "feature": "USD_LKR_Rate",
            "contribution_pct": 15.8,
            "direction": "+"
        }
    ],
    "model_version": "extratrees_champion_v2",
    "reference_year": 2025,
    "prediction_target": "next_available_season",
    "warning": null,
    "cost_breakdown": {
        "Cultivation Labour": {
            "percent": 34.1,
            "estimated_cost": 295634
        },
        "Fertilizer": {
            "percent": 43.5,
            "estimated_cost": 377129
        },
        "Land Preparation": {
            "percent": 1.7,
            "estimated_cost": 14738
        },
        "Fuel & Machinery": {
            "percent": 1.3,
            "estimated_cost": 11271
        },
        "Seeds": {
            "percent": 12.4,
            "estimated_cost": 107503
        },
        "Mechanized Irrigation": {
            "percent": 0.8,
            "estimated_cost": 6936
        },
        "Agrochemicals & Other": {
            "percent": 6.2,
            "estimated_cost": 53752
        }
    },
    "breakdown_source": "historical_district_crop_ratio",
    "breakdown_note": "Component breakdown estimated from historical district-crop ratios. The total is the model's prediction; the split is illustrative.",
    "breakdown_alias_note": null,
    "lag_saturation_detected": true,
    "lag_saturation_threshold": 846226.49,
    "lag_saturation_note": "The provided prior season cost (Rs 865,823) exceeds the maximum value the model has seen for Potato in Nuwara Eliya (Rs 846,226). The model's prediction is capped at the top of its training range for this feature. To capture higher costs, the model requires retraining on newer data."
}
```

---

## 4. Gap Analysis: SO3 Needs vs. SO1 Capabilities

SO3 requires, per cultivation cycle, predicted cost for **8 categories**: `seed`, `fertilizer`, `agrochemical`, `labour`, `machinery`, `fuel`, `irrigation`, `other`, each as integer LKR `low`, `expected`, `high`, parameterized by `(crop, district, season, land extent)`.

### Field-by-Field Mapping Table

| SO3 Required Category | SO1 Output Field | Status | Evidence & Required Mapping Logic |
|:---|:---|:---:|:---|
| **`seed`** | `cost_breakdown["Seeds"]` | **Matches (Expected point only)** | `estimated_cost` gives point estimate. **`low`/`high` are MISSING**. |
| **`fertilizer`** | `cost_breakdown["Fertilizer"]` | **Matches (Expected point only)** | `estimated_cost` gives point estimate. **`low`/`high` are MISSING**. |
| **`agrochemical`** | `cost_breakdown["Agrochemicals & Other"]` | **Needs Mapping** | SO1 lumps agrochemicals and other miscellaneous materials together (`COC folder\prediction_api.py:288`). Must disaggregate via fixed heuristic or DoA ratio. |
| **`labour`** | `cost_breakdown["Cultivation Labour"]` | **Matches (Expected point only)** | `estimated_cost` gives point estimate. **`low`/`high` are MISSING**. |
| **`machinery`** | `cost_breakdown["Land Preparation"]` + part of `cost_breakdown["Fuel & Machinery"]` | **Needs Mapping** | SO1 splits machinery into Land Prep (45.6%), Fuel & Machinery (33.7%), and Irrigation (20.7%) (`COC folder\prediction_api.py:277-279`). |
| **`fuel`** | Part of `cost_breakdown["Fuel & Machinery"]` | **Needs Mapping** | SO1 does not isolate field fuel from machinery rental. |
| **`irrigation`** | `cost_breakdown["Mechanized Irrigation"]` | **Needs Mapping** | Represents pump/mechanized power only; gravity/canal irrigation not isolated. |
| **`other`** | Residual of `cost_breakdown["Agrochemicals & Other"]` | **Needs Mapping** | Bundled with agrochemicals. Default in SO3 mock is 0 (`server\src\routes\mockSo1.js:35`). |
| **Per-Category `low` / `high`** | **NOT FOUND** | **MISSING** | SO1 calculates intervals **only for the total cost** (`interval_low`, `interval_high` at 80% confidence, `COC folder\prediction_api.py:703-704`). Category-level intervals do not exist in SO1. |
| **Land Extent Scaling** | **NOT FOUND** in `COC folder/prediction_api.py` | **MISSING** | Output is strictly **per acre**. SO3 must convert cycle extent (`hectare`, `acre`, `rood`, `perch`) via `shared/units.js:1-15` (`convertToAcres`) and multiply. |

---

## 5. Units, Precision & Confidence

| Attribute | SO1 Implementation | Evidence (File & Line) |
|:---|:---|:---|
| **Currency** | Sri Lankan Rupee (**LKR** / Rs). Point cost and intervals are floats; `cost_breakdown` estimates are rounded integers. | `COC folder\DATA_DICTIONARY.md:52-56`<br>`COC folder\prediction_api.py:298` |
| **Land Area Basis** | Strictly **per acre** in core ML model and `COC folder/prediction_api.py`. | `COC folder\DATA_DICTIONARY.md:51`<br>`COC folder\predict_with_intervals.py:283` |
| **Interval Bounds** | Multiplicative log-space 80% prediction interval ($z=1.28$):<br>$\text{low} = \exp(\ln(1+\hat{y}) - z\sigma)$, $\text{high} = \exp(\ln(1+\hat{y}) + z\sigma)$.<br>Reported as `interval_low` and `interval_high` for **total cost only**. | `COC folder\predict_with_intervals.py:5-10, 263-264, 324-330` |
| **Confidence Flag** | `low_confidence: bool`. Flagged `true` when:<br>1. USD/LKR rate is outside training range $[130.54, 326.63]$ (triggers 1.5× interval widening).<br>2. Crop-district combination has no local history (extrapolating). | `COC folder\predict_with_intervals.py:305-321`<br>`COC folder\prediction_api.py:663-670` |
| **Saturation Flag** | `lag_saturation_detected: bool`. Flagged when user's `prev_season_cost` exceeds training maximum (e.g. Potato in Nuwara Eliya: Rs 846,226.49). | `COC folder\prediction_api.py:157-160, 683-698` |

---

## 6. Agronomic Coverage & Discrepancies vs. SO3

### Supported Crops (23 in SO1 vs. SO3)
- **SO1 (`COC folder\prediction_api.py:64-69`)**:
  `'Big Onion'`, `'Bitter Gourd'`, `'Black Gram'`, `'Brinjal'`, `'Cabbage'`, `'Capsicum'`, `'Carrot'`, `'Cowpea'`, `'Gingelly'`, `'Green Chilli'`, `'Green Gram'`, `'Groundnut'`, `'Kurakkan'`, `'Maize'`, `'Manioc'`, `'Paddy'`, `'Pole Bean'`, `'Potato'`, `'Pumpkin'`, `'Red Onion'`, `'Soybean'`, `'Sweet Potato'`, `'Tomato'`.
- **SO3 (`shared\config\cropYields.js:5-10`)**:
  `'Paddy'`, `'Maize'`, `'Tomato'`, `'Chili'`.
- **CRITICAL SPELLING MISMATCH**:
  - SO1 uses **`'Green Chilli'`** (with double 'l' and space).
  - SO3 uses **`'Chili'`** (single 'l', no 'Green').
  - An adapter translation is strictly mandatory to prevent HTTP 422 errors.

### Supported Districts (26 in SO1 vs. 25 in SO3)
- **SO3 (`shared\constants\districts.js:1-27`)**: Exactly the 25 administrative districts of Sri Lanka:
  `Ampara`, `Anuradhapura`, `Badulla`, `Batticaloa`, `Colombo`, `Galle`, `Gampaha`, `Hambantota`, `Jaffna`, `Kalutara`, `Kandy`, `Kegalle`, `Kilinochchi`, `Kurunegala`, `Mannar`, `Matale`, `Matara`, `Monaragala`, `Mullaitivu`, `Nuwara Eliya`, `Polonnaruwa`, `Puttalam`, `Ratnapura`, `Trincomalee`, `Vavuniya`.
- **SO1 (`COC folder\prediction_api.py:70-77`)**:
  Includes Agrarian Development Systems and sub-districts:
  `Ampara`, `Ampara (East)`, `Ampara (West)`, `Anuradhapura`, `Badulla`, `Batticaloa`, `Colombo`, `Gampaha`, `Hambantota`, `Jaffna`, `Kalutara`, `Kandy`, `Kurunegala`, `Mahaweli System B`, `Mahaweli System C`, `Mahaweli System H`, `Mannar`, `Matale`, `Monaragala`, `Nuwara Eliya`, `Polonnaruwa`, `Puttalam`, `Trincomalee`, `Udawalawa`, `Vavuniya`, `Whole Island`.
- **COVERAGE GAPS**:
  1. **Districts in SO3 with NO SO1 data**: `Galle`, `Kegalle`, `Kilinochchi`, `Matara`, `Mullaitivu`, `Ratnapura` (6 districts). If queried with `allow_extrapolation=False`, SO1 throws **HTTP 422**.
  2. **SO1 Custom Systems**: `Mahaweli System H`, `Ampara (East)`, etc., do not exist in SO3's district dropdown.

### Supported Seasons
- **SO1**: `['Maha', 'Yala']` (`COC folder\prediction_api.py:81`).
- **SO3**: `['Yala', 'Maha']` (`shared\formSchemas\cycle.js:36, 40`).
- **Status**: **Exact Match** (case-sensitive strings match perfectly).

---

## 7. Infrastructure Requirements & Input Handling

| Resource | Requirement Status | Evidence (File & Line) |
|:---|:---:|:---|
| **Database** | **NOT FOUND / None** | Runs 100% in-memory from serialized scikit-learn pipeline (`best_model_pipeline.pkl`) and CSVs (`coc_model_ready.csv`). No MongoDB, PostgreSQL, or SQLite required. |
| **API Keys** | **NOT FOUND / None** | Zero external API calls for cost prediction. (Natural language `/chat` optionally calls local Ollama `llama3.1:8b`, but `/predict` is self-contained). |
| **Internet Access** | **None** | Completely air-gapped and local offline execution. |
| **GPU / Hardware** | **None (CPU-only)** | Scikit-learn ExtraTrees tree inference executes on CPU in $< 10$ ms (`COC folder\data\processed\model_evaluation_full.csv:1`). |
| **Behaviour on Bad Input** | Strict validation | 1. Invalid crop/district/season: **HTTP 422** (`COC folder\prediction_api.py:424-457`).<br>2. Unexpected fields: **HTTP 422** (`extra="forbid"`, line 376).<br>3. Non-existent historical pair with `allow_extrapolation=False`: **HTTP 422** (`lines 625-629`).<br>4. Extreme currency rate: **HTTP 200** with `low_confidence=True` and 1.5× widened interval. |

---

## 8. Validation, Accuracy & Benchmarks

### Included Tests & Sample Payloads
- Live API integration test suite: `COC folder\scripts\test_api.py` (tests `/health`, `/metadata`, `/defaults`, Cases A/B/C/D, 422 error handlers).
- Research statistical test suite: `COC folder\research_experiments\src\statistical_tests.py`.
- Benchmark evaluation scripts: `COC folder\research_experiments\notebooks\01_baselines_and_statistical_models.ipynb`.
- Concrete output payload: `COC folder\reports\sample_response.json`.

### Reported Model Accuracy (Leave-One-Season-Year-Out - LOSO)
Evidence from master leaderboard (`COC folder\research_experiments\results\leaderboard_loso.md:1-20`) across 12 cultivation years (2014–2025, 641 verified records):

| Model | Family | LOSO MAE (Rs) | LOSO RMSE (Rs) | LOSO R² | LOSO MAPE (%) |
|:---|:---|:---:|:---:|:---:|:---:|
| **`extratrees` (Champion)** | Shallow ML | **22,822.02** | **48,614.94** | **0.9329** | **12.18%** |
| `catboost` | Shallow ML | 25,126.77 | 53,433.90 | 0.9189 | 12.94% |
| `randomforest` | Shallow ML | 25,180.13 | 55,962.42 | 0.9111 | 13.27% |
| `gradientboosting_tuned` | Shallow ML | 25,197.73 | 55,097.59 | 0.9138 | 13.18% |
| `linear_regression` | Shallow ML | 28,453.03 | 50,396.57 | 0.8898 | 14.87% |
| `tabnet` | Deep Learning | 38,106.28 | 83,012.96 | 0.8044 | 17.65% |
| `historical_mean` (Baseline) | Statistical | 83,813.94 | 121,261.31 | 0.5826 | 54.74% |
| `naive_carry_forward` | Statistical | 115,219.74 | 179,892.26 | 0.0813 | 97.94% |

---

## 9. Merge & Integration Risks

1. **Licence Risk**:
   - Project-level `LICENSE` or `LICENCE` file is **NOT FOUND** in `COC folder/`. IP/licensing must be clarified with teammate before formal release.
2. **Port Clashes**:
   - SO3 Node.js backend: `PORT 4000` (`server\src\config\env.js:4`).
   - SO1 FastAPI backend: `PORT 8000` (`COC folder\prediction_api.py:852`). No backend port collision.
   - **Frontend Collision**: COC frontend dev server uses `5173` or `3000`, conflicting with SO3's Vite client (`5173`). The COC frontend should **not** be launched in the SO3 production or development deployment.
   - **CORS Restriction**: `COC folder\prediction_api.py:357-368` allows origins `3000` and `5173`, but **omits `4000`**. Direct browser calls from port 4000 would be rejected; server-to-server calls bypass browser CORS.
3. **Hard-coded Paths & Secrets**:
   - NOT FOUND in `COC folder/*.py`. All Python scripts resolve paths dynamically using `Path(__file__).resolve().parent`.
   - No credentials or secrets stored in code.
4. **Naming Collision**:
   - Passing SO3's `'Chili'` crashes SO1 with HTTP 422.
5. **District Coverage Collision**:
   - 6 SO3 districts (`Galle`, `Kegalle`, `Kilinochchi`, `Matara`, `Mullaitivu`, `Ratnapura`) have no historical DoA survey rows. Calling `/predict` without `allow_extrapolation=True` triggers HTTP 422.

---

## 10. Recommended Integration Architecture

### Comparative Evaluation of Options

1. **Option (a): Separate HTTP Service Behind One Adapter File (RECOMMENDED)**
   - **Architecture**: Keep SO1 running as an isolated Python FastAPI microservice on `http://127.0.0.1:8000`. Create a single adapter file in SO3 (`server/src/adapters/so1Adapter.js`) replacing `mockSo1.js`.
   - **Rationale**:
     - Complete runtime isolation: Node.js (V8) and Python (ML/scikit-learn/joblib) do not interfere.
     - Resilience: If the SO1 Python process is down, uninstalled, or crashes, the adapter catches the connection error and gracefully falls back to the in-memory proposal baseline (`getMockSo1Predictions` in `server/src/routes/mockSo1.js`). The officer can continue financial tracking uninterrupted.
     - Consistent pattern: Exactly mirrors the architecture designed for the SO3 Receipt Reader (`ai-service` FastAPI + Node adapter).
2. **Option (b): Import as an In-Process Module (REJECTED)**
   - **Rationale**: Node.js cannot natively import Python `.py` or unpickle `.pkl` files without complex C++ bindings or spawning sub-processes via `child_process.spawn('python')`. Spawning Python on every request introduces 500–1200 ms latency, memory spikes, and fragile environment resolution on Windows.
3. **Option (c): Export Predictions to a Static Lookup Table (SECONDARY / FALLBACK ONLY)**
   - **Rationale**: While simple, a static table cannot handle continuous inputs (`USD_LKR_Rate`, `prev_season_cost`, `reference_year`), dynamic prediction interval bounds, or local SHAP explanations. However, exporting a pre-computed baseline matrix for the 23 crops across typical seasons is an ideal offline fallback for Option (a).

---

## Open Questions for Teammate (SO1 Lead)

1. **8-Category Breakdown Intervals**:
   The ML model predicts `Total_Cost_Incl_Imputed` with 80% prediction intervals (`interval_low`, `interval_high`), but the 7 sub-categories in `cost_breakdown` only provide point estimates (`estimated_cost`). For SO3 financial intelligence, should we:
   - Scale each category's `low`/`high` proportionally by the overall total interval ratio ($\frac{\text{interval\_low}}{\text{predicted\_cost}}$ and $\frac{\text{interval\_high}}{\text{predicted\_cost}}$)? Or
   - Do you plan to train multi-output / chained regressors for each individual category?
2. **Agrochemical vs. Other Disaggregation**:
   `cost_breakdown` outputs `"Agrochemicals & Other"` bundled together. SO3 has distinct category tags for `agrochemical` and `other`. What is the empirical split between pesticide/weedicide chemicals vs. miscellaneous costs (packing materials, bags, transport) in the DoA surveys?
3. **Fuel vs. Machinery Disaggregation**:
   `cost_breakdown` includes `"Land Preparation"` and `"Fuel & Machinery"`. Does "Fuel & Machinery" represent diesel fuel consumed, or does it include tractor rental fees? What formula should SO3 use to map to our separate `machinery` and `fuel` buckets?
4. **Unsupported Districts (`Galle`, `Matara`, `Ratnapura`, `Kegalle`, etc.)**:
   When an officer selects a wet-zone district that has no DoA survey record, calling `/predict` with `allow_extrapolation=False` raises an HTTP 422 error. Can we officially enable `allow_extrapolation: true` as standard policy, or should the adapter fall back to provincial agro-climatic clusters?
5. **Crop Nomenclature Standardization**:
   Can we standardize on canonical naming across the system? Specifically, SO3 uses `'Chili'`, whereas SO1 requires `'Green Chilli'`. Can SO1 add alias handling (e.g. `Pydantic` alias or normalizer) so both `'Chili'` and `'Green Chilli'` are accepted natively?
6. **Acreage Scaling**:
   `COC folder/prediction_api.py` outputs cost per acre only. Should SO3 apply linear scaling ($Total = CostPerAcre \times Acreage$), or do you plan to expose scale elasticity adjustments?
7. **Service Packaging**:
   Will `COC folder/prediction_api.py` be deployed via Docker or a standalone background service?
