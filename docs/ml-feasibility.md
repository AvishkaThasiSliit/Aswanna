# Machine Learning Feasibility Audit: Time-Stamped Cultivation Data & Phasing Curves

**Document Scope**: SO3 Real-Time Expense Tracking & Phasing Curve Feasibility  
**Status**: Formal Audit / Specification  
**Date**: October 2026  
**Auditor**: Senior Software & ML Engineer  

---

## Executive Summary

This feasibility audit investigates the availability of **real time-stamped cultivation cost data** across the Aswanna repository, the Department of Agriculture (DoA) Cost of Cultivation (COC) historical archives, and SO3's operational schemas.

The objective is to determine whether real empirical data currently exists to train:
1. **Learned Phasing Curves**: Dynamic, category-specific cumulative spend trajectories ($S_c(t) / S_c(T)$ vs. normalized cycle progress $\tau = t / T$).
2. **End-of-Cycle Overspend Forecasters**: Early-warning predictive models that forecast final cycle cost variance and overspend risk from partial mid-cycle expense trajectories.

### Key Audit Findings
* **COC Raw Survey Data**: 33 Department of Agriculture Excel workbooks (19 seasons, 2014–2025, 658 raw / 641 cleaned records). **Zero time-stamped operation data exists in these files.** All tables record seasonal per-acre aggregates. The 9 occurrences of the word "Date" across all 33 files are purely administrative submission dates of the survey reports themselves.
* **Real Cycle-Level Time Series in Repo/Docs**: **`NONE`**. No photographed booklet transcriptions, farmer diaries, or daily expense logs exist in the repository or documentation.
* **Active Cycle Records Today**: **0 real cycles**. Only 1 synthetic demo cycle exists in `server/scripts/seed.js` (28 hand-crafted test entries) and 10 synthetic 100-day evaluation fixtures in `server/eval/fixtures/*.json`.
* **Current Phasing Implementation**: Hard-coded piecewise-linear interpolation in [`shared/phasing.js`](file:///d:/Aswanna/shared/phasing.js#L21-L35). Tightly coupled to variance calculation, tiered alerts, and offline evaluation harnesses. Modifying these curves without updating fixtures and reference engines immediately breaks evaluation parity.

---

## 1. Audit of Department of Agriculture COC Data Archives

### 1.1 Processed Datasets

Located at [`Profit Folder/COC folder/data/processed`](file:///d:/Aswanna/Profit%20Folder/COC%20folder/data/processed):

| File Name | Row Count | Total Columns | Contains Operation/Stage Timing? |
| :--- | :--- | :--- | :--- |
| `coc_model_ready.csv` | **641** | 54 | **NO**. Macro-seasonal aggregates only. |
| `coc_master.csv` | **658** | 46 | **NO**. Macro-seasonal aggregates only. |
| `coc_features.csv` | **658** | 55 | **NO**. Macro-seasonal aggregates only. |
| `coc_features_dedup.csv` | **641** | 55 | **NO**. Macro-seasonal aggregates only. |

#### Header Quotations

* **`coc_model_ready.csv` Header**:
  ```csv
  Season,Year_Start,Year_End,Year_Range,Crop,District,Irrigation_Type,Field_Size_Basis,Labour_Cost,Machinery_Cost,Material_Cost,Total_Cost_Incl_Imputed,Total_Cost_Excl_Imputed,Seed_Unit,Seed_Quantity,Seed_Unit_Price,Labour_Wage_Rate,Hired_Labour_Days,Family_Labour_Days,Total_Labour_Days,Fertilizer_Urea_Price,Fertilizer_Urea_Qty,Fertilizer_TSP_Price,Fertilizer_TSP_Qty,Fertilizer_MOP_Price,Fertilizer_MOP_Qty,Fertilizer_Basal_TSP_Price,Fertilizer_Basal_TSP_Qty,Fertilizer_Basal_Urea_Price,Fertilizer_Basal_Urea_Qty,Fertilizer_Basal_MOP_Price,Fertilizer_Basal_MOP_Qty,Fertilizer_Top_Urea_Price,Fertilizer_Top_Urea_Qty,Fertilizer_Top_MOP_Price,Fertilizer_Top_MOP_Qty,Average_Yield_kg_ac,Price_of_Produce,Gross_Income,Profit_Incl_Imputed,Profit_Excl_Imputed,Per_Unit_Cost_Incl_Imputed,Per_Unit_Cost_Excl_Imputed,Remarks,Source_File,Source_Sheet,USD_LKR_Rate,Total_Cost_Incl_Imputed_USD,Prev_Season_Total_Cost_Incl_Imputed,Prev_Season_Year,Cost_Pct_Change_From_Prev_Season,Fertilizer_Cost_Pct_of_Total,Labour_Cost_Pct_of_Total,Machinery_Cost_Pct_of_Total,Crop_Sample_Size_Category
  ```

* **`coc_master.csv` Header**:
  ```csv
  Season,Year_Start,Year_End,Year_Range,Crop,District,Irrigation_Type,Field_Size_Basis,Labour_Cost,Machinery_Cost,Material_Cost,Total_Cost_Incl_Imputed,Total_Cost_Excl_Imputed,Seed_Unit,Seed_Quantity,Seed_Unit_Price,Labour_Wage_Rate,Hired_Labour_Days,Family_Labour_Days,Total_Labour_Days,Fertilizer_Urea_Price,Fertilizer_Urea_Qty,Fertilizer_TSP_Price,Fertilizer_TSP_Qty,Fertilizer_MOP_Price,Fertilizer_MOP_Qty,Fertilizer_Basal_TSP_Price,Fertilizer_Basal_TSP_Qty,Fertilizer_Basal_Urea_Price,Fertilizer_Basal_Urea_Qty,Fertilizer_Basal_MOP_Price,Fertilizer_Basal_MOP_Qty,Fertilizer_Top_Urea_Price,Fertilizer_Top_Urea_Qty,Fertilizer_Top_MOP_Price,Fertilizer_Top_MOP_Qty,Average_Yield_kg_ac,Price_of_Produce,Gross_Income,Profit_Incl_Imputed,Profit_Excl_Imputed,Per_Unit_Cost_Incl_Imputed,Per_Unit_Cost_Excl_Imputed,Remarks,Source_File,Source_Sheet
  ```

### 1.2 Raw Survey Spreadsheets

Located at [`Profit Folder/COC folder/data/raw_surveys`](file:///d:/Aswanna/Profit%20Folder/COC%20folder/data/raw_surveys):
* Total files: **33 Excel workbooks (.xlsx)** spanning seasons from `2014-15 Maha` through `2025 Yala`.
* Structure: Each sheet represents a crop/district combination (e.g. `Paddy - Polonnaruwa - Irrigated`).
* Operations recorded: The sheets itemize agrarian operations as rows in the "Operation" table:
  * *Land preparation*: `General Land Preparation`, `1st Plough with 4wt`, `2nd Plough with 2wt`, `Plastering Bunds`, `Levelling & broadcasting`
  * *Crop establishment*: `All nursery preparation`, `Transplanting`, `Sowing`
  * *Crop management*: `Pre weedicide application`, `Fertilizer Application`, `Weed control with weedicides`, `Weeding & Earthing Up`, `Pest & Disease Control`
  * *Harvesting & processing*: `Harvesting & drawing`, `Processing with 4wt thresher`
* Column definitions in raw sheets:
  `Operation | No Report | Total Lab | Family Labour | Wage Rate | Labour Cost | Machinery & Equipm't Cost | Material Cost | Total Cost Rs/ac | %`

#### Timing Column Audit
A regex scan across all XML strings in all 33 raw survey workbooks for `date|month|week|day of|sowing date|harvest date|planting date|duration|timing|calendar|schedule` produced only **9 matching cells across all 33 workbooks**:
1. `2016 Yala/OFC/Final sheets-2016 y.xlsx`: `'Date: 03/07/2017'` (Report submission date)
2. `2017-18 Maha/OFC/Final Sheets 2017-18 m.xlsx`: `'Date: 2018 /05/10'` (Report submission date)
3. `2017-18 Maha/Paddy/Final Sheets.xlsx`: `'Date - 2018/07/19'` & `'Date - 2018/07/25'` (Officer sign-off dates)
4. `2018 Yala/Paddy 2018 y/Final sheets.xlsx`: `'Date - 2019/01/16'` & `'Date - 2018/12/12'` (Officer sign-off dates)
5. `2018-19 Maha/Paddy/Final sheets.xlsx`: `'Date 03/10/2019'` (Officer sign-off date)
6. `2019 Yala/Paddy/Final tables 2019y.xlsx`: `'Submitted Date - 2020/03/12'` (Submission date)
7. `2022-23 maha/Paddy/2022- 23 maha Paddy finals.xlsx`: `'Submitted Date'` (Header label)

**Conclusion**: Department of Agriculture COC surveys record **zero temporal timestamps**. They represent post-harvest seasonal recall surveys conducted with sample farmers, capturing only aggregate seasonal totals per operation per acre.

### 1.3 Research Experiments Directory
Located at [`Profit Folder/COC folder/research_experiments`](file:///d:/Aswanna/Profit%20Folder/COC%20folder/research_experiments):
* In [`research_experiments/src/data.py`](file:///d:/Aswanna/Profit%20Folder/COC%20folder/research_experiments/src/data.py#L41-L45):
  ```python
  # 3. Calendar date mapping for Prophet and Time-Series models
  # Yala -> May 1st, Maha -> Oct 1st
  df["calendar_date"] = pd.to_datetime(
      df["Year_Start"].astype(str) + np.where(df["Season"] == "Yala", "-05-01", "-10-01")
  )
  ```
* Time series in `research_experiments` are macro-seasonal steps ($t = \text{Season}_k$, twice per year). There is no intra-cycle daily or weekly tracking.

---

## 2. Time-Stamped Data in SO3's Operational Schema

SO3's database architecture contains all necessary structural fields to compute cumulative daily spending per category once real farmers begin recording transactions.

### 2.1 Database Models & Key Fields

1. **`Expense` Model** ([`server/src/models/Expense.js`](file:///d:/Aswanna/server/src/models/Expense.js#L46-L70)):
   * `entryDate` (`Date`, required): The actual calendar date the expenditure occurred. Indexed with `{ cycleId: 1, entryDate: -1 }`.
   * `cycleId` (`ObjectId`, ref: `'Cycle'`, required): Scopes the transaction to a specific cultivation episode.
   * `activityCode` (`ObjectId`, ref: `'ActivityCode'`): Links to agronomic phase and operation (e.g., `PH-01` land prep, `PH-04` basal fertilizer, `PH-10` harvesting).
   * `dayStatus` (`'worked' | 'no_work'`): Tracks non-working weather/rest days.
   * `inputs` (`Array<{ categoryTag, quantity, unit, cost }>`): Captures itemized input costs tagged with `CATEGORY_TAGS` (`seed`, `fertilizer`, `agrochemical`, `irrigation`, `other`).
   * `machinery.cost` (`Number`): Expenditures for tractor, rotavator, or equipment hire/fuel. Mapped to `machinery`.
   * `labour.cost` (`Number`): `(familyLabour + hiredLabour) * dailyWage`. Mapped to `labour`.
   * `other.amount` (`Number`): Miscellaneous expenses. Mapped to `other`.
   * `totalAmount` (`Number`): Integer sum of all line items for that day.

2. **`Cycle` Model** ([`server/src/models/Cycle.js`](file:///d:/Aswanna/server/src/models/Cycle.js#L2-L21)):
   * `startDate` (`Date`): Day 0 of the cycle.
   * `endDate` (`Date`): Target or actual harvest completion date.
   * `crop`, `season`, `district`, `extentValue`, `extentUnit`: Agronomic and geographical dimensions.

### 2.2 Derivation of Cumulative Spend Trajectories
Given an active cycle with $N$ expense documents:
1. **Day of Cycle ($t$)**:
   $$\text{dayOfCycle} = \max\left(1, \left\lfloor \frac{\text{entryDate} - \text{startDate}}{86,400,000 \text{ ms}} \right\rfloor\right)$$
2. **Cycle Progress Ratio ($\tau$)**:
   $$\tau = \frac{\text{dayOfCycle}}{\text{cycleLength}} \in [0, 1]$$
   where $\text{cycleLength} = \lfloor (\text{endDate} - \text{startDate}) / 86,400,000 \rfloor$.
3. **Cumulative Spend by Category ($S_c(t)$)**:
   $$S_c(t) = \sum_{e \in \text{Expenses}, \, e.\text{entryDate} \le t} \text{Cost}_c(e)$$
4. **Normalized Cumulative Spend Fraction ($F_c(t)$)**:
   $$F_c(t) = \frac{S_c(t)}{S_c(T)} \in [0, 1]$$

---

## 3. Real Cycle-Level Time Series in Repo or Docs

* **State**: **`NONE`**
* Evidence:
  * No OCR or manual transcriptions of physical farmer record booklets exist.
  * No receipt transaction streams exist; [`docs/receipt-reader-design.md`](file:///d:/Aswanna/docs/receipt-reader-design.md#L230-L233) describes an auxiliary OCR pipeline that auto-purges raw images after 7 days without creating persistent longitudinal datasets.
  * In [`docs/open-questions.md`](file:///d:/Aswanna/docs/open-questions.md#L243), item **Q-03** (*"Handwritten annotation transcription"*) remains marked `In Review` with the field team.

---

## 4. Current Counts & Statistical Requirements for Learned Curves

### 4.1 Existing Data Counts Today
* **Real cycles with daily or monthly time-stamped spend**: **0**.
* **Synthetic demo cycles**: **1** ([`server/scripts/seed.js`](file:///d:/Aswanna/server/scripts/seed.js#L113-L155), Sunil Perera, 28 expenses across April–May 2026).
* **Synthetic evaluation fixtures**: **10** ([`server/eval/fixtures/*.json`](file:///d:/Aswanna/server/eval/fixtures/on_track.json#L1-L4), 100-day cycles with 8–10 expenses each).

### 4.2 Minimum Sample Size Requirements (Rules of Thumb)

To replace deterministic piecewise-linear heuristics with learned statistical or ML curves, the following sample thresholds are required:

| Target Model | Minimum Cycles per Crop/Season/Regime | Justification & Statistical Reasoning |
| :--- | :--- | :--- |
| **Parametric Phasing Curve** (Beta CDF / Logistic) | **$N \ge 30$** | **Central Limit Theorem & Outlier Robustness**: Estimating 2–3 curve parameters $(\alpha, \beta)$ requires reliable mean spend fraction estimates across 10 temporal deciles ($\tau \in \{0.1, 0.2, \dots, 1.0\}$). With $N < 30$, individual bulk purchasing anomalies skew the trajectory. |
| **Quantile Envelopes** ($P_{10}, P_{50}, P_{90}$) | **$N \ge 50 - 100$** | **Empirical Quantile Precision**: Non-parametric percentile estimation requires $\approx 100$ observations to keep standard error of $P_{10}$ and $P_{90}$ below $5\%$ spend variance. |
| **ML Overspend Forecaster** (GBDT / LSTM) | **$N \ge 200 - 500$** | **Cross-Season Generalizability**: Supervised models predicting final overspend from day-30 trajectories need exposure to multiple climatic regimes (drought vs. flood) to prevent memorizing single-season price shocks. |

---

## 5. Existing Phasing Curves & Coupling Analysis

### 5.1 Definition & Functional Form
Phasing curves are defined in [`shared/phasing.js`](file:///d:/Aswanna/shared/phasing.js#L21-L47):
* **Functional Form**: Piecewise-linear interpolation between fixed coordinate breakpoints $[(t_0, c_0), (t_1, c_1), \dots, (1.0, 1.0)]$ with clamping to $[0, 1]$.
* **Breakpoints**:
  * `front_loaded`: $(0, 0) \to (0.15, 0.70) \to (0.40, 0.90) \to (1.00, 1.00)$.
    * At 15% cycle elapsed $\to$ 70% cumulative spend expected.
    * At 40% cycle elapsed $\to$ 90% cumulative spend expected.
    * Applied to: `seed`, `fertilizer`, `agrochemical`.
  * `linear`: $(0, 0) \to (1.00, 1.00)$ (uniform slope $1.0$).
    * Applied to: `labour`, `machinery`, `fuel`, `irrigation`, `other`.

### 5.2 Usages Across Codebase
1. [`shared/variance.js`](file:///d:/Aswanna/shared/variance.js#L20-L21,L102): Calculates `expectedToDate = expected * phasingFor(cat, dayOfCycle, cycleLength)`.
2. [`server/src/services/alertService.js`](file:///d:/Aswanna/server/src/services/alertService.js): Evaluates category overspend relative to `expectedToDate` and triggers `attention` or `significant` alert records.
3. [`server/src/routes/variance.js`](file:///d:/Aswanna/server/src/routes/variance.js): Exposes real-time variance calculations to the client.
4. [`server/eval/referenceEngine.js`](file:///d:/Aswanna/server/eval/referenceEngine.js#L74-L85): Contains an independent mirror `refPhasingFor` used to verify SO3's calculations.
5. [`server/eval/evaluate.js`](file:///d:/Aswanna/server/eval/evaluate.js#L42): Evaluates agreement between production and reference engines across all test scenarios.
6. [`server/eval/fixtures/*.json`](file:///d:/Aswanna/server/eval/fixtures/on_track.json#L33-L113): All 10 evaluation fixtures contain hand-computed `expectedToDate` values derived directly from the `0.70` and `0.90` breakpoints.
7. [`server/tests/phase3.test.js`](file:///d:/Aswanna/server/tests/phase3.test.js#L38-L42): Unit test asserting exact values:
   `expect(phasingFor('seed', 18, 120)).toBeCloseTo(0.70, 2);`
8. [`server/tests/evalHarness.test.js`](file:///d:/Aswanna/server/tests/evalHarness.test.js#L240-L260): Tests monotonicity and bounds of `refPhasingFor`.
9. [`client/src/pages/BudgetOverview.jsx`](file:///d:/Aswanna/client/src/pages/BudgetOverview.jsx): Renders category-level progress bars and variance status tiles.

### 5.3 What Breaks If Curves Change?
* **Evaluation Harness Failure**: `npm run evaluate` immediately fails 100% agreement target because fixture expectations in `server/eval/fixtures/*.json` assume the current breakpoint constants.
* **Unit Test Failures**: `server/tests/phase3.test.js` fails on lines 39–42.
* **Alert Timing Instability**: Modifying curves alters `expectedToDate`, shifting alert dates earlier or later for active farmers.
* **Reference Engine Desynchronization**: If `shared/phasing.js` is changed without synchronizing `server/eval/referenceEngine.js`, the verification harness flags regression errors.

---

## 6. Recommendations & Implementation Roadmap

### 6.1 (a) Real Data That Can Be Used Now
While daily time series are absent, existing real datasets can anchor phasing models:
1. **Raw Survey Operation Costs**: The 33 raw Excel workbooks record empirical per-acre costs for sequential operations (e.g., Land Prep vs. Planting vs. Harvesting). While dates are missing, the **proportional cost weight of each operation** is known.
2. **DoA Agronomic Crop Calendars**: Department of Agriculture published technical guidelines define standard days-after-sowing (DAS) windows for major operations (e.g., Paddy 105-day cycle: Basal at DAS 0–5, 1st top dressing at DAS 21, 2nd top dressing at DAS 45, harvest at DAS 95–105).
3. **Hybrid Anchoring**: Combining DoA calendar operation windows (temporal bounds) with raw survey operation expenditure proportions (cost weights) yields an empirically grounded baseline far superior to arbitrary linear or front-loaded heuristics.

### 6.2 (b) Independent Synthetic Simulator
To develop learned curves and overspend forecasters prior to full field deployment, build a **discrete-event synthetic farm simulator** independent of `shared/phasing.js`:
* Do **not** generate curves by sampling from existing breakpoint formulas.
* Model the farm as a stochastic state machine where daily expense events are drawn from independent agrarian processes:

#### 5 Realistic Non-Modelled Agronomic & Economic Effects:
1. **Bulk Pre-Purchasing vs. Liquidity Delays**:
   * *High-liquidity farmers*: Purchase 100% of seed, basal fertilizer, and fuel in a massive lump-sum at Day -5 to Day 2.
   * *Cash-constrained farmers*: Buy weekly on store credit, causing fertilizer spend to lag 10–14 days behind optimal agronomic windows.
2. **Weather & Monsoon Shocks**:
   * *Delayed monsoon*: Postpones land preparation and transplanting by 14–21 days; all subsequent phase curves translate rightward.
   * *Intense unseasonal rainfall*: Washes away applied top-dressing, triggering emergency secondary fertilizer purchases (cost spike at mid-cycle).
3. **Split Fertilizer Top-Dressing Pulses**:
   * Fertilizer expenditure is discrete, occurring in 2–3 sharp pulses (basal, tillering, panicle initiation). It is never a smooth continuous curve.
4. **Labor Scarcity & Harvest Wage Surges**:
   * Competition during regional harvesting windows causes daily agricultural wages to spike by 30–50%, creating sudden non-linear end-of-cycle labor cost increases.
5. **Early Emergency Harvest or Partial Crop Failure**:
   * Pest outbreaks or terminal drought prompt emergency early harvest (cycle ends at Day 80 instead of 105), truncating harvesting costs and eliminating final processing/transport expenses.

### 6.3 (c) Standardized Training Pipeline Schema

Any training pipeline for learned phasing or overspend prediction must accept a standardized, format-agnostic tabular schema:

```json
{
  "cycle_id": "CYC-2026-0891",
  "crop": "Paddy",
  "district": "Anuradhapura",
  "season": "Maha",
  "irrigation_type": "Irrigated",
  "extent_acres": 1.0,
  "cycle_length_days": 105,
  "actual_final_total_cost": 143523,
  "events": [
    {
      "day_of_cycle": 1,
      "date": "2026-10-15",
      "progress_ratio": 0.0095,
      "category": "machinery",
      "activity_code": "PH-01",
      "stage": "land_preparation",
      "amount": 10000,
      "cumulative_category_amount": 10000,
      "cumulative_total_amount": 10000,
      "category_spend_fraction": 0.39,
      "total_spend_fraction": 0.07,
      "weather_delay_flag": false
    },
    {
      "day_of_cycle": 14,
      "date": "2026-10-28",
      "progress_ratio": 0.1333,
      "category": "seed",
      "activity_code": "PH-03",
      "stage": "sowing",
      "amount": 9500,
      "cumulative_category_amount": 9500,
      "cumulative_total_amount": 28500,
      "category_spend_fraction": 0.70,
      "total_spend_fraction": 0.198,
      "weather_delay_flag": false
    }
  ]
}
```

---

## 7. Open Questions for System Leadership

1. **Physical Booklet Digitalization Strategy**:
   * What is the timeline and budget for sampling, collecting, and transcribing handwritten farmer record books from Agrarian Service Centers across target districts?
   * Who will supervise data entry verification to eliminate transcription errors?
2. **Parametric vs. Black-Box Phasing Curves**:
   * Does the Department of Agriculture require phasing curves to remain mathematically interpretable (e.g., parameter-fitted Beta CDF or generalized logistic curves with published coefficients), or will black-box machine learning models (e.g., Gradient Boosted Quantile Regressors / Temporal Fusion Transformers) be legally and institutionally acceptable for government subsidy auditing?
3. **Alert Policy on Learned Bands**:
   * When phasing curves transition from fixed lines to probabilistic quantile bands ($P_{10} - P_{90}$), should overspend alerts trigger on deviations from the **mean**, or only when an active cycle breaches the **$P_{90}$ empirical envelope**?
4. **Handling Multi-Crop & Communal Machinery**:
   * On family holdings with shared tractors or bulk-purchased fertilizer sacks split between Paddy and Vegetables, what is the protocol for disaggregating shared multi-cycle capital expenditures?
