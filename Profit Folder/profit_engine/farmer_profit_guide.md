# Farmer Profit, Logistics & Market Routing Architecture

**Module**: Farmer Decision Support System (`profit_engine`)  
**Target Audience**: Sri Lankan Smallholder Farmers, Agrarian Extension Officers, Agritech Developers  
**Author**: Research Pair Programming Team  

---

## 1. Executive Summary

A recurring financial trap for Sri Lankan farmers is selling to predatory farm-gate collectors who claim that transporting produce to an Economic Centre is "too expensive and risky." 

With the vehicle fleet specifications and Economic Centre network integrated into [`profit_engine/farmer_advisory_engine.py`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/farmer_advisory_engine.py), the system can calculate:
1. **The Exact Floor Price (Rs/kg)**: The absolute minimum price below which the farmer is operating at a loss.
2. **The Exact Fuel & Logistics Deduction**: Litres of diesel/petrol, vehicle trips, and road fuel expenses deducted directly from gross market revenue.
3. **The Multi-Market Routing Comparison**: Comparing selling at the local district hub vs. Dambulla national terminal vs. Colombo consumer markets.
4. **The Leafy Green Side Cash Flow**: Weekly/bi-weekly liquidity from border crops to survive the 3-4 month gestation period of the main crop.

---

## 2. Vehicles Fleet & Fuel Standards in Sri Lanka

The engine incorporates the fleet models utilized across Sri Lankan farming districts (saved in [`profit_engine/vehicles.csv`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/vehicles.csv)):

| Vehicle Model | Fuel Type | Practical Economy | Engine Payload | Typical Agronomic Use Case |
|:---|:---:|:---:|:---:|:---|
| **DIMO Batti / Tata Ace Zip** | Auto Diesel | 20–24 km/L (avg 22.0) | 600 kg (0.6 t) | Fresh vegetables, fruits, short-to-medium runs |
| **DIMO Batta HT2** | Auto Diesel | 15–19 km/L (avg 17.0) | 1,000 kg (1.0 t) | Vegetables, paddy bags, sacks (Sri Lanka's 1-ton rural workhorse) |
| **Tata Ace Gold Diesel** | Auto Diesel | 15–19 km/L (avg 17.0) | 1,000 kg (1.0 t) | Produce crates, onions, grain bags |
| **Suzuki Carry** | Petrol (92) | 15–20 km/L (avg 17.5) | 650 kg (0.65 t) | Mini-truck for light vegetable harvests |
| **Mahindra Bolero Pik-Up** | Auto Diesel | 10–13 km/L (avg 11.5) | 1,750 kg (1.75 t) | Heavy long-distance bulk hauling (upcountry to Dambulla/Colombo) |
| **Bajaj RE 4S Three-Wheeler** | Petrol (92) | 25–30 km/L (avg 27.5) | 300 kg (0.3 t) | Smallholder micro-harvests (10–15 vegetable sacks) |
| **Bajaj RE Diesel Three-Wheeler** | Auto Diesel | 25–30 km/L (avg 27.5) | 350 kg (0.35 t) | Heavier smallholder produce, hilly terrain |
| **Bajaj CT100 / CT100 ES** | Petrol (92) | 65–80 km/L (avg 72.5) | 50 kg (0.05 t) | Farmer + 1–2 gunny bags/crates, local market link |
| **Shared Commercial Lorry** | Auto Diesel | 4–6 km/L (avg 5.0) | 8,000 kg (8.0 t) | Shared freight per kg / per crate on long-haul routes |

*Current Fuel Defaults (Configurable)*: **Auto Diesel: Rs 315.00 / L** | **Petrol 92: Rs 360.00 / L**.

---

## 3. Dedicated Economic Centres Network & District Routing Matrix

The engine maps 14 national and regional trading hubs (saved in [`profit_engine/economic_centres.csv`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/economic_centres.csv) and [`profit_engine/district_distances.csv`](file:///c:/Users/MSI/Desktop/Research/Profit%20Folder/profit_engine/district_distances.csv)):

```
Agrarian Districts               Economic Centre Terminals
┌──────────────────────┐        ┌────────────────────────────────────────────────────────┐
│ Badulla              │ ──22km─> Keppetipola Economic Centre (Primary Upcountry Hub)   │
│                      │ ─135km─> Dambulla Dedicated Economic Centre (National Terminal) │
│                      │ ─195km─> Meegoda Economic Centre (Colombo Wholesale Terminal)   │
├──────────────────────┤        ├────────────────────────────────────────────────────────┤
│ Nuwara Eliya         │ ──12km─> Nuwara Eliya Economic Centre (Highland Specialized)   │
│                      │ ──28km─> Keppetipola Economic Centre                           │
├──────────────────────┤        ├────────────────────────────────────────────────────────┤
│ Anuradhapura         │ ──26km─> Thambuttegama Economic Centre (Dry Zone Lowland Hub)  │
│                      │ ──64km─> Dambulla Dedicated Economic Centre                    │
├──────────────────────┤        ├────────────────────────────────────────────────────────┤
│ Matale               │ ──30km─> Dambulla Dedicated Economic Centre                    │
├──────────────────────┤        ├────────────────────────────────────────────────────────┤
│ Kandy                │ ──14km─> Kandehandiya Economic Centre (Central Hub)            │
│                      │ ──24km─> Kurunduwatta Economic Centre (Gampola Sub-Hub)        │
├──────────────────────┤        ├────────────────────────────────────────────────────────┤
│ Hambantota / Ratnap. │ ──52km─> Embilipitiya Economic Centre (Southern Walawe Hub)    │
├──────────────────────┤        ├────────────────────────────────────────────────────────┤
│ Gampaha              │ ──16km─> Veyangoda Economic Centre (Rail/Road Distribution)    │
│                      │ ──18km─> Welisara Economic Centre (Western Consumer Hub)       │
├──────────────────────┤        ├────────────────────────────────────────────────────────┤
│ Colombo / Kalutara   │ ──10km─> Narahenpita / Rathmalana / Piliyandala Urban Centres  │
│                      │ ──22km─> Meegoda Economic Centre                               │
├──────────────────────┤        ├────────────────────────────────────────────────────────┤
│ Ampara               │ ──16km─> Ampara Economic Centre (Eastern Agricultural Hub)     │
└──────────────────────┘        └────────────────────────────────────────────────────────┘
```

---

## 4. Logistics, Yield Variation & Fuel Deduction Mathematical Engine

### Step 0: Dual-Tier Yield and Farm Size Cost Adjustment
Before harvest logistics, the on-farm cultivation cost per acre dynamically scales with realized/expected yield $Y$ (kg/acre) and field size $A$ (acres):
$$\text{Cost/ac}(Y, A) = C_{\text{base}} \times \left[ (1 - \alpha) + \alpha \cdot \left(\frac{Y}{Y_{\text{bench}}}\right)^\eta \right] \times \left(\frac{A}{1.0}\right)^\epsilon$$
- $C_{\text{base}}$: Base planning cost per acre predicted leak-free by ExtraTrees champion model.
- $\alpha = 0.30$: DOA empirical harvesting labor share ($30\%$).
- $\eta = 0.85$: Harvest labor elasticity.
- $\epsilon = -0.06$: Farm size scale elasticity.
- $\text{Total Production Cost} = \text{Cost/ac}(Y, A) \times A$.
- $\text{Total Harvest Volume} = Y \times A$.
- $\text{Cost per kg produced} = \frac{\text{Total Production Cost}}{\text{Total Harvest Volume}}$.

### Step 1: Payload Capacity & Round Trips Required
$$\text{Trips} = \max\left(1, \left\lceil \frac{Y_{\text{total}}}{P} \right\rceil\right)$$
*Example*: A 7,614 kg Tomato harvest in a 1,000 kg DIMO Batta requires $\lceil 7,614 / 1,000 \rceil = \mathbf{8\text{ round trips}}$. (In commercial reality, tomatoes are harvested in 3–4 pickings over 3 weeks, meaning 2 trips per harvest picking).

### Step 2: Total Kilometers & Fuel Consumed
$$\text{Total Distance (km)} = \text{Trips} \times (2 \times D)$$
$$\text{Fuel Consumed (Litres)} = \frac{\text{Total Distance (km)}}{\text{Practical Fuel Economy (km/L)}}$$
$$\text{Fuel Rupee Cost (Rs)} = \text{Fuel Consumed (L)} \times \text{Fuel Price (Rs/L)}$$

### Step 3: Terminal & Vehicle Handling Expenses
$$\text{Total Logistics Cost (Rs)} = \text{Fuel Rupee Cost} + (\text{Total km} \times \text{Wear Allowance}) + (\text{Trips} \times \text{Unloading/Gate Fee})$$
$$\text{Logistics Cost per kg (Rs/kg)} = \frac{\text{Total Logistics Cost (Rs)}}{Y\text{ (kg)}}$$

### Step 4: True Net Cash Profit Deduction
$$\text{Net Revenue at Market} = \text{Nominal Retail Revenue} \times (1 - \text{Sorting Loss } L) - \text{Total Logistics Cost}$$
$$\text{Net Farmer Profit} = \text{Net Revenue at Market} - \text{Cultivation Costs}$$

---

## 5. Multi-Market Empirical Case Study: Badulla Tomato Farmer

**Scenario**: 1.0 Acre Tomato in Badulla (Maha season).
- Harvest Yield: **7,614 kg**
- Cash Cultivation Cost: **Rs 290,500** (Cash break-even floor: **Rs 38.15 / kg**)
- Farm-Gate Collector Offer: **Rs 123.00 / kg**
- Retail Market Price: **Rs 295.31 / kg**
- Vehicle: **Mahindra Bolero Pik-Up** (Payload: 1,750 kg $\rightarrow$ 5 round trips)

```
Comparative Economic Balance Sheet:
========================================================================================================
Market Destination         Distance   Fuel Needed    Fuel Cost    Total Logistics   Net Econ Profit  Advantage vs Collector
--------------------------------------------------------------------------------------------------------
Farm-Gate Collector          0 km        0.0 L         Rs 0           Rs 0          Rs 418,275          Baseline
Keppetipola EC (Local)      22 km       19.1 L      Rs 6,026       Rs 10,786       Rs 1,489,174     +Rs 1,070,899 (+256%)
Dambulla Terminal (Central)135 km      117.4 L     Rs 36,978       Rs 50,778       Rs 1,449,182     +Rs 1,030,907 (+246%)
Meegoda Terminal (Colombo) 195 km      169.6 L     Rs 53,413       Rs 72,013       Rs 1,427,947     +Rs 1,009,672 (+241%)
========================================================================================================
```

### Strategic Farmer Insights:
1. **The Fuel Myth Dispelled**: The collector warns the farmer that driving to Keppetipola is "too costly." In reality, the entire 5 trips consume **only 19.1 Litres of Diesel (Rs 6,026)**, representing **less than 1%** of the farmer's gross revenue!
2. **The Local Advantage**: Keppetipola delivers the highest net return because fuel expenses are lowest (Rs 1.48/kg total logistics).
3. **Arbitrage Opportunity**: If prices in Colombo (Meegoda) or Dambulla exceed Keppetipola by more than Rs 8.50/kg, the farmer can afford the 195 km trip and pocket even higher net income!

---

## 6. Smallholder Three-Wheeler Micro-Logistics (0.25 Acre Case)

Many rural farmers own or rent a **Bajaj RE three-wheeler** rather than a truck:
- Acreage: **0.25 Acre Tomato** $\rightarrow$ Harvest: **1,819 kg**
- Vehicle: **Bajaj RE 4S Petrol Three-Wheeler** (Payload: 300 kg)
- Trips to Keppetipola (22 km): **7 round trips** (spread across the harvest month)
- Total Petrol Consumed: **11.2 Litres $\times$ Rs 360 = Rs 4,032**
- Collector Cash Profit: **Rs 154,319**
- Market Cash Profit: **Rs 414,044** (after deducting Rs 4,032 petrol, gate fees, and 8% sorting loss)
- **Net Gain**: For an investment of **Rs 4,000 in petrol**, the smallholder earns an extra **Rs 259,725**!

---

## 7. Recommended UI/UX and API Architecture

To show this to farmers in your web application:

### A. The 3-Step Farmer Interface
1. **Step 1: Farm Profile**:
   - Crop selector (e.g. Tomato, Cabbage, Chilli)
   - District & Season (Badulla, Maha)
   - Acreage slider (0.25 ac to 5.0 ac)
2. **Step 2: Logistics & Vehicle**:
   - Vehicle selector dropdown (DIMO Batta, Three-Wheeler, Mahindra Bolero, Motorbike)
   - Destination Economic Centre selector (defaults to nearest hub with pre-filled km, editable)
   - Fuel price indicator (pre-filled with current CBSL/CPC rates)
3. **Step 3: Dual-Channel Profit Dashboard**:
   - **Card A (Left)**: "Sell to Farm-Gate Collector"
     - Gross Cash: Rs 223,712
     - Net Profit: Rs 154,319
     - Tag: *Zero Transport Hassle*
   - **Card B (Right - Highlighted in Gold/Green)**: "Sell at Keppetipola Economic Centre"
     - Gross Value: Rs 494,400
     - Minus Fuel & Transport: **-Rs 6,200 (11.2 L Petrol)**
     - Minus Spoilage: -Rs 39,500
     - Net Profit in Hand: **Rs 414,044**
     - **Big Badge**: **"+Rs 259,725 MORE PROFIT (+168%)"**
   - **Bottom Card**: "Side Income from Gotukola (5 perches)"
     - Progress bar showing Rs 10,800 paid every 3 weeks (Total: Rs 39,284).

---

## 8. Quick Integration Snippet

```python
from profit_engine.farmer_advisory_engine import FarmerAdvisoryEngine

engine = FarmerAdvisoryEngine()

# Complete Advisory Call with Logistics
report = engine.evaluate_farm_portfolio(
    main_crop="Cabbage",
    district="Nuwara Eliya",
    season="Maha",
    main_acreage=0.5,
    vehicle_name="DIMO Batta HT2",
    target_economic_centre="Nuwara Eliya Economic Centre",
    leafy_crop="Kankun",
    leafy_perches=4.0
)

# Extract Logistics Breakdown
logistics = report["main_crop_analysis"]["channel_b_market"]["logistics_breakdown"]
print(f"Destination: {logistics['one_way_distance_km']} km to Nuwara Eliya EC")
print(f"Fuel Consumption: {logistics['fuel_litres_consumed']} L of {logistics['fuel_type']}")
print(f"Fuel Cost: Rs {logistics['total_fuel_cost_lkr']:,.2f}")
print(f"Net Economic Advantage: +Rs {report['main_crop_analysis']['decision_verdict']['profit_difference_lkr']:,.2f}")
```
