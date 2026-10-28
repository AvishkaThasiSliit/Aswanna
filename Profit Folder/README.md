# Aswenna (අස්වැන්න): Agricultural Decision Support System (DSS)
## Unified Cultivation Cost, Harvest Price Forecasting, and Profit Optimization Engine

> **IT4010 Research Project — Comprehensive Mathematical & Econometric Documentation**  
> *Sri Lanka Cost of Cultivation (DOA) & Wholesale Vegetable Price Forecasting (CBSL/HARTI)*

---

## 1. System Overview & Research Architecture

The **Aswenna Agricultural Decision Support System** resolves the critical decision-making dilemmas faced by Sri Lankan smallholder farmers at planting time:
1. **How much will cultivation actually cost?** (Predicting leak-free costs per acre and total outlay).
2. **How does cultivation cost scale when field size (acreage) or expected yield varies?**
3. **What wholesale price will be realized at harvest time 4–12 weeks later?**
4. **Should the farmer sell at the farm gate to a collector or transport to a Dedicated Economic Centre?**
5. **How can rapid leafy green border crops provide liquidity to finance seasonal expenses?**

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                               ASWENNA MULTI-ENGINE ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         ▼                                      ▼                                      ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│  Cultivation Cost Predictor  │ │   Vegetable Price Forecaster │ │   Farmer Advisory & Routing  │
│  (ExtraTrees Champion Model) │ │   (Multi-Model Time Series)  │ │   (Dual-Tier Production DSS) │
│  - 23 DOA Crops              │ │   - 32 CBSL/HARTI Vegetables │ │   - Dual-Channel Comparison  │
│  - Conformal 80% Bands       │ │   - Horizons: 1, 4, 8, 12 wks│ │   - Transport Freight Matrix │
│  - SHAP Driver Attributions  │ │   - AutoARIMA/CatBoost/Trans │ │   - Leafy Green Cash Flow    │
└──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘
```

---

## 2. Research Methodology: Why NOT Retrain ML with Yield as an Input?

### The Methodological Flaw: Planning-Time Data Leakage
- **Decision Horizon**: Cultivation planning occurs **before planting** (during budgeting, nursery preparation, and agricultural credit application).
- **Unknown Future Outcome**: Realized harvest yield ($Y$) is determined months later by weather events, monsoonal rainfall, pest infestation, and harvest-stage conditions.
- **Data Leakage Risk**: If a machine learning model used `Yield (kg)` as a training feature to predict cultivation cost, the model could **not** be used at planning time without future leakage or endogeneity bias.

### The Econometric Solution: Dual-Tier Production Modeling
Rather than retraining a leaky model, the system uses the accepted **DOA agricultural production economics decomposition**:
1. **Pre-Harvest Fixed / Area-Based Cost Component ($\sim 70\%$)**: Land preparation, tractor ploughing, nursery bed establishment, seed sowing, basal fertilizer, canal maintenance, and spraying depend on **field size (acreage $A$)**, not harvest volume.
2. **Harvest & Post-Harvest Variable Cost Component ($\sim 30\%$)**: Crop picking labor, bagging, hauling, crate handling, and transport freight scale directly with **yield volume ($Y$)**.

---

## 3. Mathematical Formulations

### 3.1. Dual-Tier Yield and Farm Size Scaling Function

Let $C_{\text{base}}$ be the leak-free base cultivation cost per acre predicted by the ExtraTrees Champion Regressor at planning time:

$$C_{\text{base}} = \exp\left(\hat{y}_{\log}\right) - 1$$

When the farmer specifies an expected yield $Y$ ($\text{kg/acre}$) and a field size $A$ ($\text{acres}$), the adjusted cultivation cost per acre is:

$$\text{Cost/ac}(Y, A) = C_{\text{base}} \times \left[ (1 - \alpha) + \alpha \cdot \left(\frac{Y}{Y_{\text{bench}}}\right)^\eta \right] \times \left(\frac{A}{A_0}\right)^\epsilon$$

#### Parameter Definitions:
| Parameter | Symbol | Value | Empirical Source / Agronomic Justification |
|:---|:---:|:---:|:---|
| **Base Planning Cost** | $C_{\text{base}}$ | Model output | ExtraTrees champion model prediction (LOSO MAE Rs 22,822, $R^2 = 0.9329$) |
| **Harvest Cost Share** | $\alpha$ | $0.30$ ($30\%$) | DOA Socio-Economics & Planning Centre (SEPC) harvest labor cost share |
| **Pre-Harvest Cost Share** | $1 - \alpha$ | $0.70$ ($70\%$) | Fixed area-based operations (land prep, basal inputs, planting, weeding) |
| **Benchmark Yield** | $Y_{\text{bench}}$ | Crop median | Historical median yield from DOA Cost of Cultivation surveys ($\text{kg/acre}$) |
| **Harvest Elasticity** | $\eta$ | $0.85$ | Sub-linear labor scaling (economies of scale during bulk picking & bagging) |
| **Reference Acreage** | $A_0$ | $1.0\text{ acre}$ | Normalizing baseline field size |
| **Scale Elasticity** | $\epsilon$ | $-0.06$ | Smallholder overhead efficiency vs. medium-holding tractor mobilization |

#### Derived Production Totals:
- **Total Harvest Volume ($\text{kg}$)**:
  $$\text{Total Harvest} = Y \times A$$

- **Full Economic Cultivation Cost ($\text{LKR}$)**:
  $$\text{Total Cost}_{\text{Economic}} = \text{Cost/ac}(Y, A) \times A$$

- **Out-of-Pocket Cash Cultivation Cost ($\text{LKR}$)**:
  $$\text{Total Cost}_{\text{Cash}} = \text{Total Cost}_{\text{Economic}} \times R_{\text{cash}}$$
  *(where $R_{\text{cash}} = \frac{\text{Total Cost Excl. Imputed}}{\text{Total Cost Incl. Imputed}}$ is the crop-specific cash ratio from DOA data, median $\approx 0.72 - 0.80$)*.

- **Unit Production Floor Cost ($\text{LKR/kg}$)**:
  $$\text{Cost per kg produced} = \frac{\text{Total Cost}_{\text{Economic}}}{\text{Total Harvest}} = \frac{\text{Cost/ac}(Y, A)}{Y}$$

---

### 3.2. Leafy Greens (Border Crop) Income Diversification Model

Smallholder farmers often face a 3–4 month cash-flow drought while waiting for the main vegetable harvest. Border cultivation of short-cycle leafy greens (Gotukola, Mukunuwenna, Kankun) generates continuous liquidity.

Let $A_{\text{perches}}$ be the allocated border land area ($1\text{ acre} = 160\text{ perches}$), with a 21–28 day harvesting cycle ($4\text{ harvests}$ across a 4-month season):

#### 1. Bunch Yield & Harvest Output:
$$\text{Bunches per cycle} = A_{\text{perches}} \times 35.0\text{ bunches/perch}$$
$$\text{Total Bunches Season} = \text{Bunches per cycle} \times 4$$

#### 2. Financial Metrics:
$$\text{Gross Revenue}_{\text{Leafy}} = \text{Total Bunches Season} \times P_{\text{bunch}}$$
$$\text{Input & Cultivation Cost}_{\text{Leafy}} = A_{\text{perches}} \times 800.0\text{ LKR/perch}$$
$$\text{Net Income}_{\text{Leafy}} = \text{Gross Revenue}_{\text{Leafy}} - \text{Input & Cultivation Cost}_{\text{Leafy}}$$

#### 3. Household Total Income Addition:
$$\Pi_{\text{Household}}^{\text{Economic}} = \Pi_{\text{Main Crop}}^{\text{Economic}} + \text{Net Income}_{\text{Leafy}}$$
$$\Pi_{\text{Household}}^{\text{Cash}} = \Pi_{\text{Main Crop}}^{\text{Cash}} + \text{Net Income}_{\text{Leafy}}$$

*Example*: Cultivating $5.0\text{ perches}$ of Gotukola ($P_{\text{bunch}} = \text{Rs } 61.83$):
- Bunches per cycle: $5.0 \times 35 = 175\text{ bunches}$
- Total Bunches: $175 \times 4 = 700\text{ bunches}$
- Gross Revenue: $700 \times \text{Rs } 61.83 = \text{Rs } 43,284$
- Input Cost: $5 \times 800 = \text{Rs } 4,000$
- **Net Leafy Profit**: $\mathbf{\text{Rs } 39,284}$ (added directly to total household profit).

---

### 3.3. Selling Channel Comparison & Scenario Analysis Engine

The system evaluates two distinct post-harvest marketing scenarios:

#### Channel A: Sell to Collector at Farm Gate (Zero Logistics)
The farmer sells the entire harvest directly at the farm gate:
$$\text{Gross Revenue}_A = \text{Total Harvest} \times P_{\text{farm\_gate}}$$
$$\text{Logistics Deduction}_A = 0$$
$$\text{Post-Harvest Spoilage Loss}_A = 0\%$$

$$\Pi_A^{\text{Economic}} = \text{Gross Revenue}_A - \text{Total Cost}_{\text{Economic}}$$
$$\Pi_A^{\text{Cash}} = \text{Gross Revenue}_A - \text{Total Cost}_{\text{Cash}}$$
$$\text{Margin}_A = \left(\frac{\Pi_A}{\text{Gross Revenue}_A}\right) \times 100\%$$

---

#### Channel B: Transport to Dedicated Economic Centre (Wholesale Market)
The farmer transports produce to an Economic Centre (e.g., Keppetipola, Dambulla, Meegoda):

1. **In-Transit / Sorting Loss ($L_{\text{loss}}$)**:
   $$\text{Deliverable Harvest Volume} = \text{Total Harvest} \times \left(1 - \frac{L_{\text{loss}}}{100}\right)$$
   $$\text{Gross Nominal Revenue}_B = \text{Deliverable Harvest Volume} \times P_{\text{retail}}$$

2. **Fleet Transport & Logistics Deduction**:
   Let vehicle payload be $\text{Payload}$ ($\text{kg}$), one-way distance be $D$ ($\text{km}$), fuel economy be $\text{FE}$ ($\text{km/L}$), and fuel price be $P_{\text{fuel}}$ ($\text{Rs/L}$):

   $$\text{Trips} = \max\left(1, \left\lceil \frac{\text{Total Harvest}}{\text{Payload}} \right\rceil\right)$$
   $$\text{Total Travel Distance (km)} = \text{Trips} \times (2 \times D)$$
   $$\text{Fuel Consumed (L)} = \frac{\text{Total Travel Distance}}{\text{FE}}$$
   $$\text{Fuel Cost (LKR)} = \text{Fuel Consumed} \times P_{\text{fuel}}$$
   $$\text{Vehicle Maintenance Wear (LKR)} = \text{Total Travel Distance} \times 8.00\text{ LKR/km}$$
   $$\text{Market Gate / Unloading Fees (LKR)} = \text{Trips} \times 600.00\text{ LKR}$$
   
   $$\text{Total Logistics Deduction}_B = \text{Fuel Cost} + \text{Vehicle Maintenance Wear} + \text{Market Gate Fees}$$

3. **Net Profit at Market**:
   $$\Pi_B^{\text{Economic}} = \text{Gross Nominal Revenue}_B - \text{Total Logistics Deduction}_B - \text{Total Cost}_{\text{Economic}}$$
   $$\Pi_B^{\text{Cash}} = \text{Gross Nominal Revenue}_B - \text{Total Logistics Deduction}_B - \text{Total Cost}_{\text{Cash}}$$
   $$\text{Margin}_B = \left(\frac{\Pi_B}{\text{Gross Nominal Revenue}_B}\right) \times 100\%$$

---

### 3.4. AI Decision Rule & Threshold Analysis

The automated decision engine determines the optimal commercial route:

$$\Delta \Pi = \Pi_B^{\text{Economic}} - \Pi_A^{\text{Economic}}$$

$$\text{Optimal Selling Decision} = \begin{cases} 
\mathbf{\text{Dedicated Economic Centre}}, & \text{if } \Delta \Pi > 0 \\ 
\mathbf{\text{Farm-Gate Collector}}, & \text{if } \Delta \Pi \le 0 
\end{cases}$$

#### Break-Even Logistics Threshold (Max Allowable Freight):
The maximum freight rate per kilogram before market transport becomes unprofitable:

$$\text{Freight}_{\max} = \frac{\text{Gross Nominal Revenue}_B - \text{Gross Revenue}_A}{\text{Total Harvest}} \quad (\text{LKR/kg})$$

If commercial third-party transport charges exceed $\text{Freight}_{\max}$, the farmer is mathematically advised to sell at the farm gate.

---

## 4. Empirical Worked Reference Example

### Scenario: 1.0 Acre Tomato in Badulla (Maha Season 2025)

```
[INPUT PARAMETERS]
Crop: Tomato | District: Badulla | Season: Maha | Acreage: 1.0 ac
Expected Yield: 8,000 kg/ac (DOA Benchmark: 7,388 kg/ac)
Vehicle: DIMO Batta HT2 (Payload: 1,000 kg, Fuel Economy: 17.0 km/L Diesel)
Destination: Keppetipola Dedicated Economic Centre (One-way distance: 35.0 km)
Prices: Diesel = Rs 315/L | Farm-Gate Collector = Rs 90.30/kg | Retail Forecast = Rs 448.45/kg
Loss: 8.0% post-harvest sorting loss
Side Crop: 5.0 perches Gotukola
```

### Calculated Results:

| Metric | Channel A (Collector) | Channel B (Economic Centre) | Difference / Advantage |
|:---|:---:|:---:|:---:|
| **Sold / Deliverable Volume** | $8,000\text{ kg}$ | $7,360\text{ kg}$ | $-640\text{ kg}$ (sorting loss) |
| **Selling Price** | $\text{Rs } 90.30\text{ /kg}$ | $\text{Rs } 448.45\text{ /kg}$ | $+\text{Rs } 358.15\text{ /kg}$ |
| **Gross Produce Revenue** | $\text{Rs } 722,400$ | $\text{Rs } 3,300,592$ | $+\text{Rs } 2,578,192$ |
| **Vehicle Round Trips** | $0\text{ trips}$ | $8\text{ trips}$ | $8\text{ trips via Dimo Batta}$ |
| **Fuel Consumed** | $0.0\text{ L}$ | $32.9\text{ L Diesel}$ | $\text{Rs } 10,376\text{ fuel expense}$ |
| **Total Logistics Cost** | $\mathbf{\text{Rs } 0}$ | $\mathbf{\text{Rs } 19,656}$ | $-\text{Rs } 19,656$ |
| **On-Farm Economic Cost** | $\text{Rs } 556,914$ | $\text{Rs } 556,914$ | Identical yield-adjusted base |
| **Main Crop Net Profit** | $\mathbf{\text{Rs } 165,486}$ | $\mathbf{\text{Rs } 2,724,022}$ | $\mathbf{+\text{Rs } 2,558,536\text{ (+1546\%)}}$ |
| **Gotukola Side Profit** | $+\text{Rs } 39,284$ | $+\text{Rs } 39,284$ | $5\text{ perches diversification}$ |
| **Total Household Profit** | $\mathbf{\text{Rs } 204,770}$ | $\mathbf{\text{Rs } 2,763,306}$ | $\mathbf{+\text{Rs } 2,558,536}$ |
| **AI Recommendation** | — | **TRANSPORT TO KEPPETIPOLA** | Max Allowable Freight: $\text{Rs } 322.27\text{ /kg}$ |

---

## 4.1. Reconciliation: Why Total Cost in Profit Engine Exceeds the Cost Estimator

Researchers and farmers frequently observe a numerical difference between the Standalone Cost Estimator and the Combined Farmer Profit Engine (e.g. for Tomato: **LKR 545,461** vs. **LKR 560,531**):

### 1. Scope of Measurement:
- **Standalone Cultivation Cost Engine (Tab 2)** measures strictly **On-Farm Production Cost**:
  $$\text{Cost}_{\text{On-Farm}} = \text{Labour} + \text{Materials} + \text{Machinery} = \mathbf{\text{LKR } 545,461}$$
- **Combined Profit Advisory Engine (Tab 1 — Economic Centre Scenario)** measures **Total Economic Outlay**:
  $$\text{Total Outlay} = \text{Cost}_{\text{On-Farm}} + \text{Logistics Transport Freight}$$
  $$\text{Total Outlay} = \text{LKR } 545,461 + \text{LKR } 15,070 = \mathbf{\text{LKR } 560,531}$$
  where **LKR 15,070** accounts for DIMO Batta round trips (560 km total, fuel consumption of 32.9L Diesel @ Rs 360/L, vehicle wear, and Keppetipola Economic Centre gate fees).
- When the farmer toggles to **Channel A (Farm-Gate Collector)**, transport logistics is zero, and total cost in the Profit Engine drops back to the identical **LKR 545,461**.

### 2. Influence of Irrigation Regime (`Irrigated` vs `Rainfed`):
The ExtraTrees champion model uses `Irrigation_Type` as an active input feature:
- **Irrigated Crops**: Incur additional expenses for diesel water pump fuel, lift-irrigation electricity, tube-well operation, and canal desilting/maintenance labor.
- **Rainfed Crops**: Free water source but higher manual weeding, bund drainage labor, and variable yield risks.
- Both Tab 1 (Profit Engine) and Tab 2 (Cost Estimator) provide dynamic selection between **`Irrigated`**, **`Rainfed`**, and **`Unspecified`**, allowing farmers to evaluate hydrological cost differences in real time.

---

## 5. Verified Agronomic Constraints (DOA Crop-District Matrix)

To eliminate unfeasible predictions (e.g. growing highland potatoes in dry-zone Anuradhapura), the engine enforces verified Department of Agriculture agronomic zones:

| Crop | Verified Agronomic Districts in Model |
|:---|:---|
| **Potato** | `Badulla`, `Nuwara Eliya` |
| **Cabbage** | `Nuwara Eliya` |
| **Carrot** | `Nuwara Eliya` |
| **Tomato** | `Badulla`, `Kandy` |
| **Capsicum** | `Badulla` |
| **Pole Bean** | `Badulla`, `Matale` |
| **Big Onion** | `Matale` |
| **Red Onion** | `Jaffna`, `Puttalam`, `Trincomalee` |
| **Maize** | `Ampara`, `Anuradhapura`, `Badulla`, `Mahaweli System H`, `Monaragala` |
| **Paddy** | `Ampara`, `Anuradhapura`, `Batticaloa`, `Gampaha`, `Hambantota`, `Kalutara`, `Kandy`, `Kurunegala`, `Polonnaruwa`, `Trincomalee`, `Whole Island` |

---

## 5.1. Transport Logistics Fleet & Interactive 3D Sketchfab Models

Step 5 of the Farmer Profit Calculator provides real-time 3D orbit inspection of the farmer's transport fleet using WebGL Sketchfab embeds with instant switching to a 2.5D schematic blueprint:

| Vehicle | Fuel Type | Economy | Max Payload | 3D Model Asset | Author Attribution |
|:---|:---:|:---:|:---:|:---|:---|
| **DIMO Batta HT2** | Diesel | 17.0 km/L | 1,000 kg | Vehicle - lorry | [happs](https://sketchfab.com/happs) |
| **DIMO Batti** | Diesel | 22.0 km/L | 600 kg | TATA ACE MODEL | [ppetrickshiv](https://sketchfab.com/ppetrickshiv) |
| **Tata Ace Gold** | Diesel | 17.0 km/L | 1,000 kg | TATA ACE MODEL | [ppetrickshiv](https://sketchfab.com/ppetrickshiv) |
| **Suzuki Carry** | Petrol | 17.5 km/L | 650 kg | Tamilnadu Lorry | [Car Simulator 2-Preview](https://sketchfab.com/playmode280513) |
| **Mahindra Bolero** | Diesel | 11.5 km/L | 1,750 kg | Tamilnadu Lorry | [Car Simulator 2-Preview](https://sketchfab.com/playmode280513) |
| **Shared Commercial Lorry** | Diesel | 5.0 km/L | 8,000 kg | Tamilnadu Lorry | [Car Simulator 2-Preview](https://sketchfab.com/playmode280513) |
| **Bajaj RE 4S (Petrol)** | Petrol | 27.5 km/L | 300 kg | Tuk Tuk Rikshaw | [alnmathew](https://sketchfab.com/alnmathew) |
| **Bajaj RE (Diesel)** | Diesel | 27.5 km/L | 350 kg | Tuk Tuk | [3DForge](https://sketchfab.com/Afrayolu) |
| **Bajaj CT100 Motorbike** | Petrol | 72.5 km/L | 50 kg | Bajaj CT 100 | [Bhavik Suthar](https://sketchfab.com/Bhavik_Suthar) |

- **Features**: 360° interactive orbit, fuel tank and cargo bed inspection HUDs, fuel rate calculations, and live attribution links compliant with Creative Commons BY.

---

## 6. API Endpoints Quick Reference

| Endpoint | Method | Description |
|:---|:---:|:---|
| `/api/cost/predict` | `POST` | Standalone Cultivation Cost engine for all 23 crops with yield and acreage scaling. |
| `/api/price/forecast` | `GET` | Multi-horizon forecast (1, 4, 8, 12 wks) for all 32 CBSL/HARTI vegetables. |
| `/api/advisory-predict` | `POST` | Unified Farmer Advisory engine combining cost, price, logistics, leafy greens, and dual-channel scenarios. |
| `/health` | `GET` | Health status and ML model loader verification. |
| `/api/metadata` | `GET` | Metadata catalogs (crops, districts, vehicles, economic centres, leafy varieties). |

---

## 7. Citation in Research Report

If citing this methodology in your IT4010 final thesis:

```bibtex
@misc{aswenna2026dss,
  title={Aswenna: A Dual-Tier Agronomic Decision Support System for Cost of Cultivation and Market Channel Selection in Sri Lanka},
  author={IT4010 Research Team},
  year={2026},
  institution={Sri Lanka Department of Agriculture and Central Bank of Sri Lanka Data Collaboration}
}
```
