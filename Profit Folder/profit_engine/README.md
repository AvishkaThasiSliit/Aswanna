# Aswenna (අස්වැන්න) — Profit & Advisory Engine Documentation
## Mathematical Formulations, Dual-Tier Yield Scaling & Marketing Channel Optimization

> For full architectural and econometric documentation, see the root [README.md](../README.md).

---

## 1. Quick Reference: Core Equations

### A. Dual-Tier Yield & Scale Cost Adjustment
$$\text{Cost/ac}(Y, A) = C_{\text{base}} \times \left[ (1 - \alpha) + \alpha \cdot \left(\frac{Y}{Y_{\text{bench}}}\right)^\eta \right] \times \left(\frac{A}{1.0}\right)^\epsilon$$

- $C_{\text{base}}$: ExtraTrees Champion predicted base cost per acre (LKR)
- $\alpha = 0.30$: Variable harvest/handling cost share (Department of Agriculture)
- $1 - \alpha = 0.70$: Fixed pre-harvest area-based cost share
- $\eta = 0.85$: Harvest labor elasticity
- $\epsilon = -0.06$: Farm size scale elasticity
- $Y$: Realized / expected yield (kg/acre)
- $Y_{\text{bench}}$: Historical crop median benchmark yield (kg/acre)
- $A$: Farm acreage

$$\text{Total Cost}_{\text{Economic}} = \text{Cost/ac}(Y, A) \times A$$
$$\text{Cost per kg produced} = \frac{\text{Total Cost}_{\text{Economic}}}{Y \times A}$$

---

### B. Leafy Greens Border Cash Flow
$$\text{Bunches per cycle} = A_{\text{perches}} \times 35.0$$
$$\text{Total Bunches Season} = \text{Bunches per cycle} \times 4$$
$$\text{Gross Revenue}_{\text{Leafy}} = \text{Total Bunches} \times P_{\text{bunch}}$$
$$\text{Input Cost}_{\text{Leafy}} = A_{\text{perches}} \times 800.0\text{ LKR}$$
$$\text{Net Income}_{\text{Leafy}} = \text{Gross Revenue}_{\text{Leafy}} - \text{Input Cost}_{\text{Leafy}}$$
$$\Pi_{\text{Household}} = \Pi_{\text{Main Crop}} + \text{Net Income}_{\text{Leafy}}$$

---

### C. Selling Channel Comparison & Break-Even Logistics
- **Channel A: Sell to Collector at Farm Gate**:
  $$\text{Gross Revenue}_A = Y_{\text{total}} \times P_{\text{farm\_gate}}$$
  $$\text{Logistics Deduction} = 0, \quad \text{Spoilage Loss} = 0$$
  $$\Pi_A = \text{Gross Revenue}_A - \text{Total Cost}$$

- **Channel B: Transport to Dedicated Economic Centre**:
  $$\text{Deliverable Yield} = Y_{\text{total}} \times (1 - L_{\text{post\_harvest}})$$
  $$\text{Gross Revenue}_B = \text{Deliverable Yield} \times P_{\text{retail}}$$
  $$\text{Trips} = \max\left(1, \left\lceil \frac{Y_{\text{total}}}{\text{Payload}} \right\rceil\right)$$
  $$\text{Total Distance} = \text{Trips} \times 2 \times D_{\text{one\_way}}$$
  $$\text{Logistics Deduction}_B = \left(\frac{\text{Total Distance}}{\text{FE}} \times P_{\text{fuel}}\right) + (\text{Total Distance} \times 8.0) + (\text{Trips} \times 600.0)$$
  $$\Pi_B = \text{Gross Revenue}_B - \text{Logistics Deduction}_B - \text{Total Cost}$$

- **AI Decision & Max Allowable Freight**:
  $$\Delta \Pi = \Pi_B - \Pi_A$$
  $$\text{Max Allowable Freight} = \frac{\text{Gross Revenue}_B - \text{Gross Revenue}_A}{Y_{\text{total}}} \quad (\text{LKR/kg})$$

---

### D. On-Farm Cost vs. Total Outlay & Hydrological Regime
1. **Cost Scope Difference**:
   - **Cost Engine (Tab 2)**: Computes on-farm cultivation production cost only ($\text{LKR } 545,461$).
   - **Profit Engine (Tab 1 — Channel B)**: Computes Total Economic Outlay = $\text{On-Farm Cost } (\text{LKR } 545,461) + \text{Logistics Freight } (\text{LKR } 15,070) = \mathbf{\text{LKR } 560,531}$.
   - **Profit Engine (Tab 1 — Channel A)**: Logistics is zero, matching $\mathbf{\text{LKR } 545,461}$.
2. **Irrigation Regime**:
   Both Tab 1 and Tab 2 support active selection between **`Irrigated`**, **`Rainfed`**, and **`Unspecified`**, driving the ExtraTrees hydrological feature weights.
