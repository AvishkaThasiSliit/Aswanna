# Crop Recommendation & Ranking Engine Specification

This document details the multi-criteria ranking algorithm, configuration values, and the mathematical formula used in the **Aswanna Crop Recommendation System** (`shared/ranking.js` and `/crop-recommendation`).

---

## 1. Configuration Values (`recommendationConfig.js`)

Located in [`shared/config/recommendationConfig.js`](file:///d:/Aswanna/shared/config/recommendationConfig.js):

| Parameter | Value | Description |
| :--- | :--- | :--- |
| `k` | **3** | Shrinkage prior pseudo-observation weight (governs strength of Bayesian pull towards prior) |
| `priorError` | **0.15** ($15\%$) | Global prior baseline error percentage used for cold-start crops ($n=0$) and shrinkage regularizer |
| `penalty` | **2.0** | Penalty multiplier applied to historical prediction error on cost efficiency |

---

## 2. Core Mathematical Formulas

For each candidate crop $c$ with predicted cost $C$, expected yield $Y$ (from `shared/config/cropYields.js`), and $n$ historical prediction error percentages $[e_1, e_2, \dots, e_n]$:

1. **Cost Efficiency (Nominal Cost per Unit Yield)**:
   $$\text{costEfficiency} = \frac{C}{Y} \quad (\text{in LKR / kg})$$

2. **Historical Mean Error**:
   $$\text{meanError} = \begin{cases} \frac{1}{n} \sum_{i=1}^n e_i & \text{if } n > 0 \\ 0 & \text{if } n = 0 \end{cases}$$

3. **Empirical Bayesian Shrunk Error**:
   $$\text{shrunkError} = \frac{n \cdot \text{meanError} + k \cdot \text{priorError}}{n + k}$$
   *When $n = 0$ (cold start), $\text{shrunkError} = \text{priorError} = 0.15$.*

4. **Prediction Reliability Metric**:
   $$\text{reliability} = \max(0, 1 - \text{shrunkError})$$

5. **Accuracy-Weighted Penalized Score**:
   $$\text{score} = \text{costEfficiency} \times (1 + \text{penalty} \times \text{shrunkError})$$
   *Lower score indicates higher ranking (lower penalized cost per kg).*

---

## 3. Seeded Historical Data (Kurunegala / Yala)

From [`server/scripts/seed.js`](file:///d:/Aswanna/server/scripts/seed.js):

- **Tomato**:
  - Predicted total cost: $C = 245,000 \text{ LKR}$
  - Benchmark yield: $Y = 3,500 \text{ kg/acre}$
  - Past seasons error history: $[0.45, 0.43, 0.47]$ ($n = 3$)
- **Maize**:
  - Predicted total cost: $C = 162,000 \text{ LKR}$
  - Benchmark yield: $Y = 1,800 \text{ kg/acre}$
  - Past seasons error history: $[0.02, 0.02, 0.02]$ ($n = 3$)

---

## 4. Hand-Computed Worked Examples

### 4.1. Tomato
1. **Cost Efficiency**:
   $$\text{costEfficiency} = \frac{245,000}{3,500} = \mathbf{70.00 \text{ LKR/kg}}$$
2. **Mean Error**:
   $$\text{meanError} = \frac{0.45 + 0.43 + 0.47}{3} = \frac{1.35}{3} = \mathbf{0.4500 \ (45.0\%)}$$
3. **Shrunk Error**:
   $$\text{shrunkError} = \frac{3 \times 0.45 + 3 \times 0.15}{3 + 3} = \frac{1.35 + 0.45}{6} = \frac{1.80}{6} = \mathbf{0.3000 \ (30.0\%)}$$
4. **Reliability**:
   $$\text{reliability} = 1 - 0.3000 = \mathbf{0.7000 \ (70.0\%)}$$
5. **Accuracy-Weighted Score**:
   $$\text{score} = 70.00 \times (1 + 2.0 \times 0.30) = 70.00 \times (1 + 0.60) = 70.00 \times 1.60 = \mathbf{112.0000}$$

---

### 4.2. Maize
1. **Cost Efficiency**:
   $$\text{costEfficiency} = \frac{162,000}{1,800} = \mathbf{90.00 \text{ LKR/kg}}$$
2. **Mean Error**:
   $$\text{meanError} = \frac{0.02 + 0.02 + 0.02}{3} = \frac{0.06}{3} = \mathbf{0.0200 \ (2.0\%)}$$
3. **Shrunk Error**:
   $$\text{shrunkError} = \frac{3 \times 0.02 + 3 \times 0.15}{3 + 3} = \frac{0.06 + 0.45}{6} = \frac{0.51}{6} = \mathbf{0.0850 \ (8.5\%)}$$
4. **Reliability**:
   $$\text{reliability} = 1 - 0.0850 = \mathbf{0.9150 \ (91.5\%)}$$
5. **Accuracy-Weighted Score**:
   $$\text{score} = 90.00 \times (1 + 2.0 \times 0.0850) = 90.00 \times (1 + 0.17) = 90.00 \times 1.17 = \mathbf{105.3000}$$

---

## 5. Comparison: Cost-Only Rank vs. Accuracy-Weighted Rank

| Crop | Cost Efficiency | Cost-Only Rank | $n$ | Shrunk Error | Reliability | Score | Weighted Rank |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Maize** | $90.00 \text{ LKR/kg}$ | **#2** | 3 | $8.5\%$ | $91.5\%$ | **$105.30$** | **#1 (Recommended)** |
| **Tomato** | $70.00 \text{ LKR/kg}$ | **#1** | 3 | $30.0\%$ | $70.0\%$ | **$112.00$** | **#2** |

### Verification with `/crop-recommendation` Display
The hand-computed numbers match the values displayed by `/crop-recommendation` and returned by `GET /api/crop-recommendation?district=Kurunegala&season=Yala`:
- **Maize**: Ranked **#1**, Reliability **91.5%** ($3$ past seasons), Cost per Unit **90 LKR/kg**, Adjusted from **#2 to #1**.
- **Tomato**: Ranked **#2**, Reliability **70.0%** ($3$ past seasons), Cost per Unit **70 LKR/kg**, Adjusted from **#1 to #2**.

*Conclusion: Both the seed data and ranking implementation match without discrepancy.*

---

## 6. Known Limitations & Domain Assumptions

1. **SO1 Predicts Cost, Not Yield**:
   - The SO1 machine learning service (`so1-service`) predicts solely the nominal cost of cultivation per acre (LKR/acre) and its 80% prediction interval.
   - It does **not** predict crop yield. Expected yields ($\text{kg/acre}$) remain configured as static benchmark constants in [`shared/config/cropYields.js`](file:///d:/Aswanna/shared/config/cropYields.js). Cost efficiency ($\text{LKR/kg}$) is derived by dividing predicted cost by expected yield.

2. **Chilli Observed in One Region Only**:
   - In the Department of Agriculture (DoA) historical survey dataset (`coc_model_ready.csv`), Green Chilli records exist exclusively for Anuradhapura.
   - When evaluating Green Chilli in other districts (e.g. Galle, Kandy, Ampara), SO1 strictly returns HTTP 422 unless national extrapolation is permitted. The recommendation engine surfaces these predictions with `dataQuality: 'extrapolated'` and an explicit badge.

3. **Bayesian Shrinkage Parameters are Placeholders**:
   - The shrinkage weight $k = 3$, prior baseline error $\text{priorError} = 0.15$ ($15\%$), and penalty multiplier $\text{penalty} = 2.0$ are domain placeholders.
   - They require empirical calibration with DoA extension specialists once multi-season tracked cycle error data becomes available.

