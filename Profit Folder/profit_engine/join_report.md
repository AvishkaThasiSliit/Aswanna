# Audit & Join Report: Agricultural Cost and Price Harmonization for Farmer Profit Module

**Module**: Farmer Profit Engine (`profit_engine`)  
**Project**: IT4010 / Agricultural Decision Support System  
**Date**: October 2026  
**Input Datasets**:
- `COC folder/data/processed/coc_master_v2.csv` (658 rows, 48 attributes, per-acre farm-gate costs, yields, and prices)
- `Price folder/etl/_output/master_prices_long.csv` (56,608 rows, weekly retail prices 2017–2026, 48 weeks/year)
- `Price folder/etl/_output/vegetables_wide.csv` (464 rows, 32 vegetable products across 48 weeks/year)
- `Price folder/etl/_output/product_name_map.csv` (124 product mappings)

---

## 1. Executive Summary & Verification of `coc_master_v2.csv`

### 1.1 Row Count Verification: Disk Truth vs. `README.md`
A comparison was conducted between the dataset files on disk, [`COC folder/README.md`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/COC%20folder/README.md), and [`COC folder/DATA_DICTIONARY.md`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/COC%20folder/DATA_DICTIONARY.md).

| File Name | Disk Row Count | Disk Column Count | README Stated Count | DATA DICTIONARY Count | Status / Explanation |
|:---|:---:|:---:|:---:|:---:|:---|
| **`coc_master.csv`** | **658** | 46 | 1,061 rows, 48 cols | 658 rows, 46 cols | **Discrepancy in README**: README line 32 & 56 cites 1,061 rows from an initial parsing estimate. The true harmonized count is 658. |
| **`coc_master_v2.csv`** | **658** | 48 | Not row-counted | 658 rows, 48 cols | **Verified**: Exactly 658 rows. Adds CBSL exchange rate `USD_LKR_Rate` and `Total_Cost_Incl_Imputed_USD`. |
| **`coc_features.csv`** | **658** | 55 | Not row-counted | 658 rows, 55 cols | **Verified**: 658 rows before deduplication. Adds time-series lags and expense ratios. |
| **`coc_features_dedup.csv`** | **642** | 55 | 1,021 Clean Records | 642 rows, 55 cols | **Discrepancy in README**: Dedup dropped exactly 16 placeholder rows (658 - 16 = 642). README cited 1,021 (1,061 - 40). |
| **`coc_model_ready.csv`** | **641** | 55 | 641 rows, 23 crops | 641 rows, 23 crops | **Verified**: README and disk truth match at 641 rows. Dropped 1 Low sample size row (`Beetroot`). |
| **`parse_report.csv`** | **708** | 7 | N/A | 708 worksheets | **Verified**: Exactly 658 `SUCCESS` worksheets parsed from raw DOA reports. |

### 1.2 Which File the Cost Model Trained On
The machine learning pipeline in [`COC folder/scripts/train_evaluate_pipeline.py`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/COC%20folder/scripts/train_evaluate_pipeline.py) trained the serialized model artifact (`models/best_model_pipeline.pkl`) on:
$$\mathbf{coc\_model\_ready.csv} \quad (641 \text{ rows, } 23 \text{ crops, } 25 \text{ districts})$$

**Lineage**:
1. Raw DOA survey spreadsheets (2014–2025) parsed by `consolidate_coc.py` $\rightarrow$ `coc_master.csv` (**658 rows**).
2. CBSL annual exchange rates appended by `add_exchange_rate.py` $\rightarrow$ `coc_master_v2.csv` (**658 rows**).
3. Lags and expense composition ratios built by `build_features.py` $\rightarrow$ `coc_features.csv` (**658 rows**).
4. Cross-season placeholder records audited and purged by `deduplicate_and_engineer.py` $\rightarrow$ `coc_features_dedup.csv` (**642 rows**, 16 duplicates dropped).
5. Filtered to High and Medium sample size tiers by `train_evaluate_pipeline.py` $\rightarrow$ `coc_model_ready.csv` (**641 rows**, 1 Low-tier Beetroot row excluded).
6. Winning `ExtraTrees` pipeline (Champion, LOSO MAE Rs 22,822.02, $R^2 = 0.9329$) fitted on `coc_model_ready.csv` and serialized as `models/best_model_pipeline.pkl`.

---

## 2. Row-by-Row Mathematical Consistency Audit of `coc_master_v2.csv`

A row-by-row audit was performed against the 658 rows of `coc_master_v2.csv` across three accounting identities:
1. $\text{Gross\_Income} = \text{Average\_Yield\_kg\_ac} \times \text{Price\_of\_Produce}$
2. $\text{Profit\_Incl\_Imputed} = \text{Gross\_Income} - \text{Total\_Cost\_Incl\_Imputed}$
3. $\text{Profit\_Excl\_Imputed} = \text{Gross\_Income} - \text{Total\_Cost\_Excl\_Imputed}$

### 2.1 Gross Income Failures ($\text{Gross} \neq \text{Yield} \times \text{Price}$)
Using a numerical tolerance of $> 1.0\text{ LKR}$, **9 rows** exhibit arithmetic discrepancies. Two represent substantial primary accounting errors, one is a severe survey anomaly (zero recorded yield), and the remainder reflect minor rounding differences in raw DOA survey sheets:

| CSV Index | Crop | District | Season & Year | Recorded Yield (kg/ac) | Farm Price (Rs/kg) | Calculated Gross (Rs) | Recorded Gross (Rs) | Discrepancy (Rs) | Root Cause & Workbook Source |
|:---:|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|
| **60** | Paddy | Gampaha | Yala 2015 | 1,488.2 | 32.19 | 47,899.3 | 47,889.0 | -10.3 | Minor rounding in `Copy of 15Y COC-DC-Paddy Final Sheet.xlsx` (14.Gampaha) |
| **98** | Paddy | Gampaha | Maha 2015-16 | 0.0 | 34.80 | 0.0 | 53,905.0 | +53,905.0 | **Severe Anomaly**: Crop failure / survey table header had 0.0 yield recorded, but income was transcribed from project baseline (`Copy of 15-16MCOC-DC-Paddy Final Sheet.xlsx`). |
| **404** | Paddy | Kurunegala | Maha 2021-22 | 623.0 | 83.00 | 51,709.0 | 48,158.3 | -3,550.7 | **Major Discrepancy**: Price was Rs 77.30 in unrounded survey notes; recorded price was rounded to 83.00 (`Paddy final sheet.xlsx` -> Kuru Rf). |
| **564** | Big Onion | Matale | Yala 2024 | 9,976.0 | 237.00 | 2,364,312.0 | 2,364,401.0 | +89.0 | Minor rounding discrepancy in raw sheet (`Sheet28`). |
| **570** | Manioc | Gampaha | Yala 2024 | 4,231.0 | 88.00 | 372,328.0 | 372,291.0 | -37.0 | Minor rounding discrepancy in raw sheet (`Sheet34`). |
| **571** | Potato | Badulla | Yala 2024 | 4,447.0 | 199.00 | 884,953.0 | 883,654.0 | -1,299.0 | Unrounded price in raw survey was 198.71 Rs/kg (`Sheet35`). |
| **573** | Sweet Potato | Matale | Yala 2024 | 7,796.0 | 64.00 | 498,944.0 | 498,963.0 | +19.0 | Minor rounding discrepancy in raw sheet (`Sheet37`). |
| **638** | Paddy | Whole Island | Yala 2025 | 1,195.0 | 127.00 | 151,765.0 | 152,173.0 | +408.0 | **Known Primary Error**: Unrounded farm price was 127.34 Rs/kg (`COC 2025 Yala.xlsx` -> Sheet19). |
| **643** | Big Onion | Matale | Yala 2025 | 9,209.0 | 110.00 | 1,012,990.0 | 1,012,543.0 | -447.0 | **Known Primary Error**: Recorded gross income does not match $9,209 \times 110$ (`COC 2025 Yala.xlsx` -> Sheet25). |

### 2.2 Profit (Including Imputed) Failures ($\text{Profit} \neq \text{Gross} - \text{Total Cost}$)
Using a tolerance of $> 1.0\text{ LKR}$, there are **EXACTLY 9 mismatches** in `Profit_Incl_Imputed`, confirming the known data audit baseline:

| CSV Index | Crop | District | Season & Year | Recorded Gross (Rs) | Total Cost Incl (Rs) | Calculated Profit (Rs) | Recorded Profit (Rs) | Discrepancy (Rs) | Diagnosis & Root Cause |
|:---:|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|
| **60** | Paddy | Gampaha | Yala 2015 | 47,889.0 | 39,305.0 | 8,584.0 | 8,597.0 | +13.0 | Rounding cascade from Gross Income mismatch (`14.Gampaha`). |
| **284** | Black Gram | Anuradhapura | Maha 2018-19 | 29,526.0 | 35,533.0 | -6,007.0 | -3,007.0 | +3,000.0 | **Typo in DOA Report**: Family labor imputed deduction was understated by exactly Rs 3,000 (`Final sheet.xlsx`). |
| **300** | Potato | Nuwara Eliya | Maha 2018-19 | 812,820.0 | 420,238.0 | 392,582.0 | 372,901.0 | -19,681.0 | **Transcription Error**: Seed potato cost adjustment omitted from subtotal in survey sheet (`Potato-N'eliya`). |
| **475** | Paddy | Kalutara | Yala 2023 | 85,884.0 | 109,508.0 | -23,624.0 | +23,624.0 | **+47,248.0** | **Sign Inversion**: Farm incurred an economic net loss of Rs -23,624, but raw report recorded it as a positive number (`Sheet17`). |
| **476** | Paddy | Kandy | Yala 2023 | 101,332.0 | 127,774.0 | -26,442.0 | +26,442.0 | **+52,884.0** | **Sign Inversion**: Net economic loss of Rs -26,442 was entered without minus sign (`Sheet19`). |
| **479** | Paddy | Whole Island | Yala 2023 | 106,392.0 | 110,386.0 | -3,994.0 | +3,994.0 | **+7,988.0** | **Sign Inversion**: Island average economic loss of Rs -3,994 was entered without minus sign (`Sheet22`). |
| **547** | Paddy | Kurunegala | Yala 2024 | 194,670.0 | 118,678.0 | 75,992.0 | 76,033.0 | +41.0 | Minor rounding error in land rent imputation (`Sheet9`). |
| **580** | Paddy | Ampara (East) | Maha 2024-25 | 259,982.0 | 122,264.0 | 137,718.0 | 122,263.0 | -15,455.0 | **Duplicate Transcription**: Total Cost (122,264) was accidentally re-typed into the Net Profit cell (`Sheet4`). |
| **643** | Big Onion | Matale | Yala 2025 | 1,012,543.0 | 584,744.0 | 427,799.0 | 428,246.0 | +447.0 | Cascaded directly from Row 643's Gross Income mismatch ($1,012,543 - 584,744 = 427,799$, but report used unrounded gross $1,012,990 - 584,744 = 428,246$). |

---

## 3. Crop Mapping System (`crop_map.csv`)

The mapping between COC crops and price-engine products was established with strict evidentiary standards. Every mapping is explicitly tagged as **`CONFIRMED`**, **`NEEDS_REVIEW`**, or **`DROP_NO_PRICE_SERIES`**.

The complete mapping is saved in [`profit_engine/crop_map.csv`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/crop_map.csv).

### 3.1 Vegetable Pilot Candidates (10 Crops)

| COC Crop Name | Price Engine Product Name | Category | Unit | Sinhala Name | Status | Agronomic & Botanical Notes |
|:---|:---|:---|:---:|:---|:---:|:---|
| **Brinjal** | `Brinjal` | lowland vegetables | 1kg | Wambatu (වම්බටු) | **CONFIRMED** | Direct 1:1 match. *Solanum melongena*. Standard retail eggplant/brinjal. |
| **Carrot** | `Carrot` | upcountry vegetables | 1kg | Carrot (කැරට්) | **CONFIRMED** | Direct 1:1 match. *Daucus carota*. Cool-climate temperate root vegetable. |
| **Tomato** | `Tomatoe No1.` | upcountry vegetables | 1kg | Thakkali (තක්කාලි) | **CONFIRMED** | Direct match. *Solanum lycopersicum*. Grade 1 table tomatoes. |
| **Green Chilli** | `Green Chillies` | lowland vegetables | 1kg | Amu Miris (අමු මිරිස්) | **CONFIRMED** | Direct 1:1 match. *Capsicum annuum*. Plural in bulletin. |
| **Capsicum** | `Cap Chillies` | lowland vegetables | 1kg | Malu Miris (මාළු මිරිස්) | **CONFIRMED** | Direct match. *Capsicum annuum var. grossum*. Bulletin standard abbreviation. |
| **Bitter Gourd** | `Bitter Guard` | lowland vegetables | 1kg | Karavila (කරවිල) | **CONFIRMED** | Direct match. *Momordica charantia*. Phonetic spelling variation in bulletin. |
| **Beetroot** | `Beet Root` | upcountry vegetables | 1kg | Beetroot (බීට්රූට්) | **CONFIRMED** | Direct match. *Beta vulgaris*. Spaced as two words in bulletin. |
| **Cabbage** | `Cabbagge Seed` | upcountry vegetables | 1kg | Gowa (ගෝවා) | **NEEDS_REVIEW** | **Proposed Match**: Bulletin lists `Cabbagge Seed 1kg`, an entrenched clerical typo for seed-grown fresh head cabbage (*Brassica oleracea*). Unit is 1kg fresh weight. Flagged for explicit user confirmation. |
| **Pumpkin** | `Red Pumpkin` | lowland vegetables | 1kg | Vattakka (වට්ටක්කා) | **NEEDS_REVIEW** | **Proposed Match**: DOA surveys yellow/orange pumpkin (*Cucurbita moschata* = Red Pumpkin / Vattakka). Bulletin distinguishes `Red Pumpkin` from `Ash Pumpkin` (Alu Puhul, *Benincasa hispida*). Propose `Red Pumpkin`. Flagged to confirm whether Red Pumpkin alone or average of Red/Ash is preferred. |
| **Pole Bean** | `Beans Green` | upcountry vegetables | 1kg | Bodi / Bonchi (බෝංචි) | **NEEDS_REVIEW** | **Proposed Match**: DOA surveys Pole Bean (*Phaseolus vulgaris* on stakes in Badulla & Matale). Bulletin lists `Beans Green`, `Beans Butter`, and `Long Beans` (Mee Karal). Propose `Beans Green` as the primary upcountry agronomic proxy. Flagged for confirmation. |

### 3.2 Field Crops, Pulses, Onions, Potatoes & Rice

| COC Crop Name | Price Engine Product Name | Category | Unit | Sinhala Name | Status | Agronomic & Commercial Rationale |
|:---|:---|:---|:---:|:---|:---:|:---|
| **Potato** | `Local Potatoes` | potatoes | 1kg | Ala (අල) | **CONFIRMED** | DOA surveys domestic potato farmers in Badulla/Nuwara Eliya. Matches `Local Potatoes` (bulletin also tracks `Imported Potatoes`). Held outside vegetable pilot. |
| **Big Onion** | `B.Onions Local` | onions | 1kg | Loku Lunu (ලොකු ලූණු) | **CONFIRMED** | DOA surveys domestic big onion farmers in Matale/Anuradhapura. Matches `B.Onions Local`. Note: Yala 2018 bulletin has missing weeks. Held outside vegetable pilot. |
| **Red Onion** | `Red Onions Average` | onions | 1kg | Rathu Lunu (රතු ලූණු) | **CONFIRMED** | Direct match for domestic shallots / red onions. Held outside vegetable pilot. |
| **Cowpea** | `Cowpea Whole Average` | flour & pulses | 1kg | Mae Ata (කවුපි) | **CONFIRMED** | Direct match for dry cowpea grain (*Vigna unguiculata*). Note: Maha 2018-19 has missing bulletin weeks. Held outside vegetable pilot. |
| **Green Gram** | `Green Gram Average` | flour & pulses | 1kg | Mun Ata (මුං ඇට) | **CONFIRMED** | Direct match for dry mung beans (*Vigna radiata*). Note: Maha 2018-19 has missing bulletin weeks. Held outside vegetable pilot. |
| **Paddy** | `Nadu White / Samba / Raw Red` | rice | 1kg | Vee (වී) $\rightarrow$ Sahal (සහල්) | **NEEDS_REVIEW** | **STRUCTURAL MISMATCH**: Farm-gate paddy is unhusked raw grain ($1\text{ kg paddy} \approx 0.68\text{ kg milled rice}$). Retail bulletins track milled polished table rice across 14 varieties. Requires milling recovery ratio and variety selection. Cannot be joined silently. |
| **Black Gram** | `None` | N/A | N/A | Undu / Ulundu (උඳු) | **DROP_NO_PRICE_SERIES** | *Vigna mungo* (Black Gram / Ulundu) is **not tracked** in CBSL retail bulletins. |
| **Maize** | `None` | N/A | N/A | Bada Iringu (බඩ ඉරිඟු) | **DROP_NO_PRICE_SERIES** | Feed grain; no retail series in bulletin. |
| **Gingelly** | `None` | N/A | N/A | Thala (තල) | **DROP_NO_PRICE_SERIES** | Sesame; no retail series in bulletin. |
| **Manioc** | `None` | N/A | N/A | Manyokka (මඤ්ඤොක්කා) | **DROP_NO_PRICE_SERIES** | Cassava; no retail series in bulletin. |
| **Soybean** | `None` | N/A | N/A | Soya (සෝයා) | **DROP_NO_PRICE_SERIES** | Soybean; no retail series in bulletin. |
| **Sweet Potato**| `None` | N/A | N/A | Bathala (බතල) | **DROP_NO_PRICE_SERIES** | Sweet potato; no retail series in bulletin. |
| **Groundnut** | `None` | N/A | N/A | Rata Kaju (රටකජු) | **DROP_NO_PRICE_SERIES** | Peanut; no retail series in bulletin. |
| **Kurakkan** | `None` | N/A | N/A | Kurakkan (කුරක්කන්) | **DROP_NO_PRICE_SERIES** | Finger millet; no retail series in bulletin. |

### 3.3 Sinhala-to-English Agricultural Naming Harmonization
Several commodities use Sinhala or anglicized Sinhala terminology in the source bulletins:
- **Bandakka (බණ්ඩක්කා)**: Lady's Finger / Okra (*Abelmoschus esculentus*). Present in retail price bulletins under lowland vegetables (`Bandakka 1kg`), but **absent** from DOA COC cost surveys.
- **Vattakka (වට්ටක්කා) vs. Alu Puhul (අළු පුහුල්)**: In Sri Lanka, "Pumpkin" in DOA surveys is Vattakka (Red Pumpkin, *Cucurbita moschata*). Alu Puhul is Ash Pumpkin / Wax Gourd (*Benincasa hispida*).
- **Bonchi / Bodi (බෝංචි)**: Green beans cultivated on trellises (*Phaseolus vulgaris*) are surveyed in DOA as "Pole Bean", matching `Beans Green`. Lowland yardlong bean (*Vigna unguiculata sesquipedalis*) is known as *Mee Karal* and listed as `Long Beans`.
- **Karavila (කරවිල)**: Bitter Gourd (*Momordica charantia*), transliterated as `Bitter Guard`.
- **Wambatu (වම්බටු)**: Brinjal / Eggplant (*Solanum melongena*).
- **Malu Miris (මාළු මිරිස්)**: Capsicum / Bell pepper, listed as `Cap Chillies`.
- **Amu Miris (අමු මිරිස්)**: Green Chilli, listed as `Green Chillies`.

---

## 4. Crop Calendar & Harvest Window Assumptions (`crop_calendar.csv`)

The calendar table establishes the temporal alignment between cultivation cost cycles and weekly retail price indices.

The output is saved in [`profit_engine/crop_calendar.csv`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/crop_calendar.csv).

### 4.1 Configurable Seasonal Harvest Window Assumptions
Sri Lanka's 48-week price index (12 months $\times$ 4 weeks/month) aligns with official SEPC cultivation calendars under two primary monsoon regimes:

1. **Maha Season (Major Monsoon Cycle)**:
   - **Planting**: October–November of `Year_Start`.
   - **Harvest Window**: **January–March of `Year_Start + 1`** (Months 1, 2, 3).
   - **48-Week Index Range**: **Weeks 1 to 12** (12 consecutive weeks).
   - **Global Week Index**: $\text{start} = (\text{Year\_Start} + 1 - 2017) \times 48 + 1$, $\text{end} = (\text{Year\_Start} + 1 - 2017) \times 48 + 12$.

2. **Yala Season (Minor Monsoon Cycle)**:
   - **Planting**: April–May of `Year_Start`.
   - **Harvest Window**: **August–September of `Year_Start`** (Months 8, 9).
   - **48-Week Index Range**: **Weeks 29 to 36** (8 consecutive weeks).
   - **Global Week Index**: $\text{start} = (\text{Year\_Start} - 2017) \times 48 + 29$, $\text{end} = (\text{Year\_Start} - 2017) \times 48 + 36$.

### 4.2 Crop Duration Input Flagging
Per the strict rule: *"crop duration in weeks per crop as an input table I will fill (do NOT invent values; leave blank and flag)"*:
- In `crop_calendar.csv`, the column `crop_duration_weeks` is left **completely blank (`""`)** across all 48 crop-season combinations.
- Every entry is explicitly tagged:
  $$\text{duration\_status} = \mathbf{"FLAGGED\_PENDING\_USER\_INPUT"}$$
- No synthetic, interpolated, or guessed crop durations have been injected.

---

## 5. Join Execution & Detailed Accounting

The pilot join was executed joining each COC row (2017+) to the exact unweighted average retail price over its seasonal harvest window.

The joined dataset is saved in [`profit_engine/joined_cost_price.csv`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/joined_cost_price.csv).

### 5.1 The Pilot Sample ($n = 99$)
> [!IMPORTANT]
> **Pilot Sample Statement**: The joined dataset `joined_cost_price.csv` contains **$n = 99$ rows**, representing a **pilot calibration sample** covering the 10 core vegetable crops surveyed by the Department of Agriculture between 2017 and 2025. It serves as a proof-of-concept module for farm-gate-to-retail price transmission, margin decomposition, and spread modeling. It is **not** a census of Sri Lankan agriculture. Broadening the sample requires: (1) resolving the paddy-to-milled-rice conversion factor, (2) formalizing onion and potato proxy blends, and (3) obtaining wholesale/retail series for the 8 omitted field crops.

### 5.2 Rows Joined per Crop, District, and Year

#### Rows Joined per Crop
| Crop | Rows Joined ($n=99$) | Mapped Retail Product | Mapping Status | Observed Weeks / Window | Data Completeness |
|:---|:---:|:---|:---:|:---:|:---:|
| **Tomato** | 19 | `Tomatoe No1.` | CONFIRMED | 12 (Maha) / 8 (Yala) | 100.0% |
| **Pole Bean** | 17 | `Beans Green` | NEEDS_REVIEW | 12 (Maha) / 8 (Yala) | 100.0% |
| **Carrot** | 13 | `Carrot` | CONFIRMED | 12 (Maha) / 8 (Yala) | 100.0% |
| **Green Chilli** | 12 | `Green Chillies` | CONFIRMED | 12 (Maha) / 8 (Yala) | 100.0% |
| **Brinjal** | 12 | `Brinjal` | CONFIRMED | 12 (Maha) / 8 (Yala) | 100.0% |
| **Cabbage** | 11 | `Cabbagge Seed` | NEEDS_REVIEW | 12 (Maha) / 8 (Yala) | 100.0% |
| **Pumpkin** | 5 | `Red Pumpkin` | NEEDS_REVIEW | 12 (Maha) / 8 (Yala) | 100.0% |
| **Capsicum** | 5 | `Cap Chillies` | CONFIRMED | 12 (Maha) / 8 (Yala) | 100.0% |
| **Bitter Gourd**| 4 | `Bitter Guard` | CONFIRMED | 12 (Maha) / 8 (Yala) | 100.0% |
| **Beetroot** | 1 | `Beet Root` | CONFIRMED | 12 (Maha) / 8 (Yala) | 100.0% |
| **Total Pilot**| **99** | — | — | — | **100.0% (Zero Interpolation)** |

#### Rows Joined per District
| District | Rows Joined | Predominant Crops | Agro-Ecological Region |
|:---|:---:|:---|:---|
| **Badulla** | 28 | Pole Bean (12), Tomato (11), Capsicum (5) | Upcountry / Midcountry Intermediate |
| **Nuwara Eliya** | 25 | Carrot (13), Cabbage (11), Beetroot (1) | Upcountry Wet Zone (Highlands) |
| **Anuradhapura** | 22 | Green Chilli (12), Brinjal (5), Pumpkin (5) | Dry Zone Lowlands (North Central) |
| **Hambantota** | 11 | Brinjal (7), Bitter Gourd (4) | Dry Zone Lowlands (Southern) |
| **Kandy** | 8 | Tomato (8) | Midcountry Wet Zone (Central) |
| **Matale** | 5 | Pole Bean (5) | Midcountry Intermediate Zone |
| **Total** | **99** | — | — |

#### Cross-Tabulation: Crop $\times$ Year of Cultivation Start (`Year_Start`)
| Crop | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | Total Joined |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Beetroot** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | **1** |
| **Bitter Gourd** | 1 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | **4** |
| **Brinjal** | 2 | 2 | 1 | 0 | 1 | 1 | 2 | 2 | 1 | **12** |
| **Cabbage** | 2 | 2 | 1 | 0 | 1 | 0 | 2 | 2 | 1 | **11** |
| **Capsicum** | 1 | 1 | 0 | 0 | 1 | 0 | 1 | 1 | 0 | **5** |
| **Carrot** | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 2 | 1 | **13** |
| **Green Chilli** | 2 | 2 | 1 | 0 | 1 | 1 | 2 | 2 | 1 | **12** |
| **Pole Bean** | 3 | 3 | 1 | 0 | 2 | 1 | 3 | 3 | 1 | **17** |
| **Pumpkin** | 1 | 1 | 0 | 0 | 1 | 0 | 1 | 1 | 0 | **5** |
| **Tomato** | 3 | 3 | 2 | 1 | 1 | 1 | 3 | 3 | 2 | **19** |
| **Total** | **17** | **17** | **8** | **2** | **9** | **6** | **16** | **16** | **8** | **99** |

---

### 5.3 Complete Log of Dropped Rows (Total COC: 658 Rows)

Every single unjoined row is accounted for below without ambiguity:

```
Total COC Master v2 Records: 658 rows
├── Pre-2017 Records Dropped: 171 rows (Price bulletin data commences Jan 2017)
│   ├── 2014-15 Maha: 24 rows
│   ├── 2015 Yala & 2015-16 Maha: 73 rows
│   └── 2016 Yala & 2016-17 Maha: 74 rows
└── 2017+ Records Evaluated: 487 rows
    ├── Joined in Vegetable Pilot (n=99): 99 rows
    └── Dropped / Held Outside Pilot: 388 rows
        ├── Category A: Paddy / Rice (Held for Milling Ratio & Variety Confirmation): 234 rows
        ├── Category B: Onions & Potatoes (Available, Confirmed, Held Outside Pilot): 53 rows
        ├── Category C: Pulses (Partially Available, Held Outside Pilot): 31 rows
        └── Category D: Field Crops & Tubers (Zero Retail Price Series in Bulletin): 70 rows
```

#### Detailed Breakdown of 2017+ Dropped Rows (388 Rows)

| Crop | Rows Dropped (2017+) | Disposition | Exact Agronomic & Econometric Reason for Drop |
|:---|:---:|:---:|:---|
| **Paddy** | 234 | **HOLD_PENDING_REVIEW** | **Raw Unhusked Paddy vs Milled Retail Rice Mismatch**: COC records farm-gate raw paddy costs ($1\text{ ac basis}$); retail bulletins track polished milled table rice across 14 distinct varieties (`Nadu White`, `Samba`, `Raw Red`, etc.). Joining directly requires: (1) establishing a standard milling recovery factor ($\sim 68\%$), (2) selecting the specific rice variety, and (3) factoring in the miller/wholesaler conversion spread. |
| **Potato** | 26 | **HOLD_PENDING_REVIEW** | Domestic tuber crop; mapped to `Local Potatoes` (**CONFIRMED** in `crop_map.csv`), but held outside the $n=99$ fresh vegetable pilot sample. |
| **Red Onion** | 20 | **HOLD_PENDING_REVIEW** | Allium / condiment crop; mapped to `Red Onions Average` (**CONFIRMED** in `crop_map.csv`), but held outside the $n=99$ fresh vegetable pilot sample. |
| **Big Onion** | 7 | **HOLD_PENDING_REVIEW** | Allium / condiment crop; mapped to `B.Onions Local` (**CONFIRMED** in `crop_map.csv`), but held outside the vegetable pilot. Furthermore, Yala 2018 local big onion retail prices are missing in the bulletin, which would violate the zero-interpolation rule. |
| **Cowpea** | 12 | **HOLD_PENDING_REVIEW** | Dry grain pulse; mapped to `Cowpea Whole Average` (**CONFIRMED** in `crop_map.csv`), but held outside vegetable pilot. Maha 2018-19 has missing bulletin entries. |
| **Green Gram** | 5 | **HOLD_PENDING_REVIEW** | Dry grain pulse; mapped to `Green Gram Average` (**CONFIRMED** in `crop_map.csv`), but held outside vegetable pilot. Maha 2018-19 has missing bulletin entries. |
| **Black Gram** | 14 | **DROP_NO_PRICE_SERIES** | *Vigna mungo* (Undu/Ulundu). No retail price series published in CBSL weekly bulletins. |
| **Maize** | 27 | **DROP_NO_PRICE_SERIES** | Coarse feed grain / industrial crop. No retail consumer price series in bulletins. |
| **Gingelly** | 12 | **DROP_NO_PRICE_SERIES** | Sesame oilseed. No retail consumer price series in bulletins. |
| **Manioc** | 8 | **DROP_NO_PRICE_SERIES** | Root/tuber crop (Cassava). No retail price series in bulletins. |
| **Soybean** | 7 | **DROP_NO_PRICE_SERIES** | Industrial legume. No retail price series in bulletins. |
| **Sweet Potato**| 7 | **DROP_NO_PRICE_SERIES** | Root/tuber crop. No retail price series in bulletins. |
| **Groundnut** | 5 | **DROP_NO_PRICE_SERIES** | Legume / nut crop. No retail price series in bulletins. |
| **Kurakkan** | 4 | **DROP_NO_PRICE_SERIES** | Finger millet coarse grain. No retail price series in bulletins. |
| **Total Dropped**| **388** | — | **100% of non-pilot records accounted for.** |

---

## 6. Audit of Leafy Greens in COC vs. Price Engine

Per Requirement 5: *"Confirm there are NO leafy-green rows in COC and list the 8 leafy crops with no cost data."*

### 6.1 Confirmation of Zero Leafy Green Rows in COC
An exhaustive scan across all 658 rows of `coc_master_v2.csv` confirmed:
$$\mathbf{Total \text{ } Leafy \text{ } Green \text{ } Records \text{ } in \text{ } COC} = \mathbf{0}$$
The Department of Agriculture's SEPC cost-of-cultivation surveys exclusively cover major field crops, commercial highland vegetables, and potato/onion staples. Commercial leafy green cultivation—predominantly practiced on small peri-urban intensive beds under short rotations (3–5 weeks)—has **never been surveyed** in the annual COC reports.

### 6.2 The 8 Leafy Crops with Retail Prices but No Cost Data

All 8 leafy crops tracked under the `leafy vegetables` category in `master_prices_long.csv` and `vegetables_wide.csv` possess continuous weekly retail price series (2017–2026), but have **zero cost data**:

| # | Crop Name in Price Engine | Botanical Name | Sinhala Name | English Common Name | Price Bulletin Unit | 2017–2026 Price Trend (Avg LKR) | COC Cost Records |
|:---:|:---|:---|:---|:---|:---:|:---:|:---:|
| 1 | **Gotukola** | *Centella asiatica* | ගොටුකොළ | Asiatic Pennywort / Gotu Kola | Bunch | Rs 30 – 120 / bunch | **0** |
| 2 | **Kankun** | *Ipomoea aquatica* | කංකුං | Water Spinach / River Spinach | Bunch | Rs 25 – 110 / bunch | **0** |
| 3 | **Kathurumurunga**| *Sesbania grandiflora* | කතුරුමුරුංගා | Hummingbird Tree Leaves / Agati | Bunch | Rs 35 – 130 / bunch | **0** |
| 4 | **Kohila Leaves** | *Lasia spinosa* (foliage) | කොහිල කොළ | Kohila Greens | Bunch | Rs 30 – 120 / bunch | **0** |
| 5 | **Mukunuwenna** | *Alternanthera sessilis* | මුකුණුවැන්න | Sessile Joyweed | Bunch | Rs 25 – 105 / bunch | **0** |
| 6 | **Nivithi** | *Basella alba* | නිවිති | Ceylon Spinach / Malabar Spinach | 500g | Rs 45 – 180 / 500g | **0** |
| 7 | **Sarana** | *Trianthema portulacastrum* | සාරණ | Horse Purslane / Sarana | Bunch | Rs 25 – 100 / bunch | **0** |
| 8 | **Thampala** | *Amaranthus viridis* | තම්පලා | Green Amaranth / Chinese Spinach | Bunch | Rs 30 – 115 / bunch | **0** |

---

## 7. Deliverables & Artifact Index

All generated files reside strictly in [`profit_engine/`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/):

1. **[`crop_map.csv`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/crop_map.csv)**: Full canonical dictionary mapping 24 COC crops + reference products to price-engine entities with units, botanical/Sinhala names, confidence tiers, and `CONFIRMED` / `NEEDS_REVIEW` tags.
2. **[`crop_calendar.csv`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/crop_calendar.csv)**: Configurable seasonal harvest windows (Maha Weeks 1–12; Yala Weeks 29–36 in 48-week calendar) across 24 crops, with crop durations uninvented and flagged as `FLAGGED_PENDING_USER_INPUT`.
3. **[`joined_cost_price.csv`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/joined_cost_price.csv)**: Clean, leak-free pilot dataset ($n = 99$) joining 2017+ vegetable COC records to harvest-window average retail prices with farm-to-retail spreads and implied profits.
4. **[`audit_coc.py`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/audit_coc.py)**: Standalone Python script auditing COC mathematical integrity row-by-row.
5. **[`build_profit_engine.py`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/build_profit_engine.py)**: Reproducible end-to-end Python pipeline building all tables and verifying data constraints.
6. **[`join_report.md`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/join_report.md)**: This comprehensive audit and join document.
