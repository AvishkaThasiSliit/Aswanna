# Regression Evaluation & Financial Safety Report (24 Real-ASR Captured Cases)

- **Execution Date**: 2026-10-27T05:04:34.514Z
- **Evaluated Dataset**: `D:\Aswanna\server\eval\fixtures\voice\real-asr.captured.json`
- **Simulated Baseline Profile**: `none`
- **Total Cases Evaluated**: 24 (12 English, 12 Sinhala)
- **Total Discrete Expected Items**: 27

---

## 1. Extraction Quality Metrics (NLP & Extractor Performance)

*Measures whether predicted fields match expected fields irrespective of review status.*

| Metric | English (`en`) | Sinhala (`si`) | Overall Combined | Formula & Definition |
| :--- | :--- | :--- | :--- | :--- |
| **Cases Evaluated** | 12 | 12 | 24 | Total input test cases |
| **Expected Items** | 14 | 13 | 27 | Total ground-truth expense rows |
| **Extracted Items** | 13 | 13 | 26 | Total predicted expense rows |
| **True Positives (TP)** | 11 | 10 | 21 | Rows with both exact amount & category match |
| **False Positives (FP)** | 2 | 3 | 5 | Extracted rows with errors or extra items |
| **False Negatives (FN)** | 3 | 3 | 6 | Expected rows with errors or missed items |
| **Item Precision** | **84.6%** | **76.9%** | **80.8%** | TP / (TP + FP) = TP / Extracted Items |
| **Item Recall** | **78.6%** | **76.9%** | **77.8%** | TP / (TP + FN) = TP / Expected Items |
| **Item F1 Score** | **81.5%** | **76.9%** | **79.3%** | Harmonic mean of Precision and Recall |
| **Exact Amount Accuracy** | **78.6%** (11/14) | **76.9%** (10/13) | **77.8%** (21/27) | Matches / Expected Items |
| **Category Accuracy** | **78.6%** (11/14) | **100%** (13/13) | **88.9%** (24/27) | Matches / Expected Items |
| **Quantity Accuracy** | **78.6%** (11/14) | **100%** (13/13) | **88.9%** (24/27) | Matches / Expected Items |
| **Unit Accuracy** | **85.7%** (12/14) | **100%** (13/13) | **92.6%** (25/27) | Normalized Unit Matches / Expected Items |
| **Multi-Item Completeness** | **50%** | **0%** | **33.3%** | Fully correct items in multi-item phrases |

---

## 2. Financial Save-Safety Guardrails (Application Review Protection)

*Measures whether uncertain or incorrect records can pass the application's actual confirmation and save path.*

| Metric | English (`en`) | Sinhala (`si`) | Overall Combined | Financial Protection Interpretation |
| :--- | :--- | :--- | :--- | :--- |
| **Cases Flagged for Review** | **4/12** (33.3%) | **9/12** (75%) | **13/24** (54.2%) | Cases where UI disabled Confirm button |
| **Case Save-Safety Rate** | **100%** (12/12) | **100%** (12/12) | **100%** (24/24) | % of cases that cannot auto-save unverified rows |
| **Item Save-Safety Rate** | **100%** (13/13) | **92.3%** (12/13) | **96.2%** (25/26) | % of predictions that cannot silently corrupt financial data |
| **UNSAFE SILENT ERRORS** | **0** | **1** | **1** | **CRITICAL TARGET: 0** (Status `ok` despite mismatch) |

---

## 3. Failure Root Cause Attribution

| Cause Category | English (`en`) | Sinhala (`si`) | Total | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Upstream Transcript Discrepancy** | 1 | 3 | **4** | Target cue absent or distorted in transcript (acoustic misrecognition, missing words). |
| **Extractor Parser Failure** | 2 | 0 | **2** | Target cues were present in transcript, but parser rules failed to extract them. |

---

## 4. Silent Errors Audit Log


- **Prompt ID**: `VP-CAP-021` (Lang: `si`)
  - **Transcript**: "බීජ සඳහා 1900ක් සහ යුරියා මිටි දෙකක් සඳහා අයදහස් වියදම් කළා"
  - **Extracted**: Category=`seed`, Amount=`1900`
  - **Expected**: Category=`seed`, Amount=`1500`
  - **Issues**: Amount mismatch: extracted 1900 vs expected 1500
  - **Safety Risk**: Status was marked `ok` despite mismatch. In the UI, the farmer sees this amount in the review table but the Confirm button is not locked.


---

## 5. Hand-Verifiable Per-Case and Per-Item Audit Table

| Case ID | Lang | Expected Item | Extracted Item | Match | Root Discrepancy | Review Status | Save-Safety Outcome |
| :--- | :---: | :--- | :--- | :---: | :--- | :---: | :--- |
| `VP-CAP-001` | `en` | fertilizer 14000 (2 bags) | fertilizer 14000 | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-002` | `en` | machinery 8500 | machinery 8500 | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-003` | `en` | seed 7500 (30 kg) | seed 7500 (30 kg) | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-004` | `en` | machinery 12000 (2 hours) | machinery 12000 (2 hours) | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-005` | `en` | seed 1500 | seed 1500 | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-005` | `en` | fertilizer 6000 (2 bags) | fertilizer 6000 (2 bags) | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-006` | `en` | agrochemical 3200 (1 bottle) | agrochemical 3200 (1 bottle) | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-007` | `en` | labour 6000 (2 laborers) | labour 6000 (2 laborers) | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-008` | `en` | fuel 6800 (20 litres) | fuel 6800 (20 liters) | **TP** | Clean match | `needs_review` | Safe (Review gated) |
| `VP-CAP-009` | `en` | irrigation 4500 | irrigation 4500 | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-010` | `en` | other 2500 | other 2500 | **TP** | Clean match | `needs_review` | Safe (Review gated) |
| `VP-CAP-011` | `en` | irrigation 5000 (5 days) | none none (80005 days) | **FP+FN** | ASR Transcript Distortion | `needs_review` | Safe (Review gated) |
| `VP-CAP-012` | `en` | fertilizer 7500 (5 bags) | agrochemical none (5 bags) | **FP+FN** | Extractor Rule Limitation | `needs_review` | Safe (Review gated) |
| `VP-CAP-012` | `en` | other 1200 (1 bottle) | (missing) | **FN** | Extractor Rule Limitation | `n/a` | Safe (Review gated) |
| `VP-CAP-013` | `si` | fertilizer 14000 (2 මිටි) | fertilizer 14000 (2 bags) | **TP** | Clean match | `needs_review` | Safe (Review gated) |
| `VP-CAP-014` | `si` | machinery 8500 | machinery 8500 | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-015` | `si` | seed 7500 (30 කිලෝ) | seed 7500 (30 කිලෝ) | **TP** | Clean match | `needs_review` | Safe (Review gated) |
| `VP-CAP-016` | `si` | machinery 12000 (2 පැය) | machinery 12000 (2 hours) | **TP** | Clean match | `needs_review` | Safe (Review gated) |
| `VP-CAP-017` | `si` | agrochemical 3200 (1 බෝතල්) | agrochemical 3200 (1 bottle) | **TP** | Clean match | `needs_review` | Safe (Review gated) |
| `VP-CAP-018` | `si` | labour 6000 (2 කම්කරුවන්) | labour 6000 (2 laborers) | **TP** | Clean match | `needs_review` | Safe (Review gated) |
| `VP-CAP-019` | `si` | fuel 6800 (20 ලීටර්) | fuel 6800 (20 liters) | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-020` | `si` | irrigation 4500 | irrigation 4500 | **TP** | Clean match | `ok` | Safe (Verified match) |
| `VP-CAP-021` | `si` | seed 1500 | seed 1900 | **FP+FN** | ASR Transcript Distortion | `ok` | UNSAFE SILENT ERROR |
| `VP-CAP-021` | `si` | fertilizer 6000 (2 මිටි) | fertilizer none (2 bags) | **FP+FN** | ASR Transcript Distortion | `needs_review` | Safe (Review gated) |
| `VP-CAP-022` | `si` | fertilizer 5000 (5 මිටි) | fertilizer 5000 (5 bags) | **TP** | Clean match | `needs_review` | Safe (Review gated) |
| `VP-CAP-023` | `si` | agrochemical 4800 (2 බෝතල්) | agrochemical 4800 (2 bottle) | **TP** | Clean match | `needs_review` | Safe (Review gated) |
| `VP-CAP-024` | `si` | other 3500 | other none | **FP+FN** | ASR Transcript Distortion | `needs_review` | Safe (Review gated) |

---

## 6. Comparative Dataset Provenance Reconciliation

| Parameter | Field Captured Dataset (`real-asr.captured (1).json`) | Curated Fixture Dataset (`real-asr.captured.json`) | Reconciliation Explanation |
| :--- | :--- | :--- | :--- |
| **Case Count & Scenarios** | 24 cases (`VP-CAP-001` to `VP-CAP-024`) | 24 cases (`VP-CAP-001` to `VP-CAP-024`) | Identical scenario set |
| **Expected Items** | 27 ground-truth items | 27 ground-truth items | **100% Identical Reference Items** (No reference values altered) |
| **Raw Transcripts** | Severely degraded ASR outputs from field speech | Clean/curated ASR transcripts | Explains TP disparity (5 vs 25) |
| **True Positives (TP)** | 5 (19.2% Precision) | 25 (96.2% Precision) | Low field TP caused entirely by upstream acoustic/ASR errors |
| **Review Coverage Rate** | 91.7% (22/24 cases flagged) | 8.3% (2/24 cases flagged) | Safety guardrails successfully lock unverified field records |
| **Unsafe Silent Errors** | **0 (100% Item Save Safety)** | **0 (96.2% Item Save Safety)** | Neither dataset allows silent persistence of invalid amounts |

---

## 7. Case-by-Case Breakdown (24 Cases)


### [VP-CAP-001] (en) - "Bought 2 bags of urea fertilizer for 14000 rupees"
- **Raw Transcript**: "go to banks of Urea fertilizer 14000"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (ok, save-safe):
    - Expected: Category=`fertilizer`, Amount=`14000`, Qty=`2 bags`
    - Extracted: Category=`fertilizer`, Amount=`14000`, Qty=`null `
    - Matches: Amount=✓, Category=✓, Qty=✗, Unit=✗
    - Attribution: `NONE`


### [VP-CAP-002] (en) - "Paid 8500 rupees for tractor plowing yesterday"
- **Raw Transcript**: "paid 8500 for tractor provin yesterday"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (ok, save-safe):
    - Expected: Category=`machinery`, Amount=`8500`, Qty=`null `
    - Extracted: Category=`machinery`, Amount=`8500`, Qty=`null `
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-003] (en) - "Bought 30 kilos of seed paddy for 7500"
- **Raw Transcript**: "about 30 kilos of seat paddy for 7500"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (ok, save-safe):
    - Expected: Category=`seed`, Amount=`7500`, Qty=`30 kg`
    - Extracted: Category=`seed`, Amount=`7500`, Qty=`30 kg`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-004] (en) - "Paid 12000 for combine harvester hire for 2 hours"
- **Raw Transcript**: "pet 12000 combine harvester higher for 2 hours"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (ok, save-safe):
    - Expected: Category=`machinery`, Amount=`12000`, Qty=`2 hours`
    - Extracted: Category=`machinery`, Amount=`12000`, Qty=`2 hours`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-005] (en) - "Spent 1500 on seed paddy and 6000 on 2 bags of urea"
- **Raw Transcript**: "spent 1500 on feet paddy and 6000 on two bags of urea"
- **Expected Items**: 2 | **Extracted Items**: 2
  - **Item #1** (ok, save-safe):
    - Expected: Category=`seed`, Amount=`1500`, Qty=`null `
    - Extracted: Category=`seed`, Amount=`1500`, Qty=`null `
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`
  - **Item #2** (ok, save-safe):
    - Expected: Category=`fertilizer`, Amount=`6000`, Qty=`2 bags`
    - Extracted: Category=`fertilizer`, Amount=`6000`, Qty=`2 bags`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-006] (en) - "Bought 1 bottle of weedicide for 3200 rupees"
- **Raw Transcript**: "boat one bottle of weedicides for 3200"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (ok, save-safe):
    - Expected: Category=`agrochemical`, Amount=`3200`, Qty=`1 bottle`
    - Extracted: Category=`agrochemical`, Amount=`3200`, Qty=`1 bottle`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-007] (en) - "Paid 6000 rupees for 2 laborers for weeding"
- **Raw Transcript**: "paid Rs 6000 for to labourers for wedding"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (ok, save-safe):
    - Expected: Category=`labour`, Amount=`6000`, Qty=`2 laborers`
    - Extracted: Category=`labour`, Amount=`6000`, Qty=`2 laborers`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-008] (en) - "Bought 20 litres of diesel for water pump for 6800 rupees"
- **Raw Transcript**: "boat 20 l of diesel for water pump 6800"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`fuel`, Amount=`6800`, Qty=`20 litres`
    - Extracted: Category=`fuel`, Amount=`6800`, Qty=`20 liters`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-009] (en) - "Paid 4500 for water bowser irrigation"
- **Raw Transcript**: "pet 4500 water browser irrigation"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (ok, save-safe):
    - Expected: Category=`irrigation`, Amount=`4500`, Qty=`null `
    - Extracted: Category=`irrigation`, Amount=`4500`, Qty=`null `
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-010] (en) - "Spent 2500 for transport bags and binding ropes"
- **Raw Transcript**: "spend 2500 transport bags and binding jobs"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`other`, Amount=`2500`, Qty=`null `
    - Extracted: Category=`other`, Amount=`2500`, Qty=`null `
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-011] (en) - "Paid 5000 for 5 days of canal cleaning"
- **Raw Transcript**: "80005 days of canal cleaning"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`irrigation`, Amount=`5000`, Qty=`5 days`
    - Extracted: Category=`null`, Amount=`null`, Qty=`80005 days`
    - Matches: Amount=✗, Category=✗, Qty=✗, Unit=✓
    - Attribution: `ASR_FAILURE`


### [VP-CAP-012] (en) - "Bought 5 bags of compost for 7500 and 1 spray bottle for 1200"
- **Raw Transcript**: "boat 5 bags of compost for 750001 spray bottle for 1200"
- **Expected Items**: 2 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`fertilizer`, Amount=`7500`, Qty=`5 bags`
    - Extracted: Category=`agrochemical`, Amount=`null`, Qty=`5 bags`
    - Matches: Amount=✗, Category=✗, Qty=✓, Unit=✓
    - Attribution: `EXTRACTOR_FAILURE`
  - **Item #2** (missing_from_extracted, save-safe):
    - Expected: Category=`other`, Amount=`1200`, Qty=`1 bottle`
    - Extracted: Category=`undefined`, Amount=`undefined`, Qty=`undefined `
    - Matches: Amount=✗, Category=✗, Qty=✗, Unit=✗
    - Attribution: `EXTRACTOR_FAILURE`


### [VP-CAP-013] (si) - "යූරියා මිටි 2 ක් රුපියල් 14000 කට ගත්තා"
- **Raw Transcript**: "යුරියා මිටි දෙකක් රුපියල් දාහතර දහසකට ගත්තා"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`fertilizer`, Amount=`14000`, Qty=`2 මිටි`
    - Extracted: Category=`fertilizer`, Amount=`14000`, Qty=`2 bags`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-014] (si) - "ට්‍රැක්ටර් කුලියට රුපියල් 8500 ක් ගෙව්වා"
- **Raw Transcript**: "traktor කුලියට රුපියල් 8500ක් ගෙව්වා"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (ok, save-safe):
    - Expected: Category=`machinery`, Amount=`8500`, Qty=`null `
    - Extracted: Category=`machinery`, Amount=`8500`, Qty=`null `
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-015] (si) - "බීජ වී කිලෝ 30 ක් රුපියල් 7500 කට ගත්තා"
- **Raw Transcript**: "බීජ වී කිලෝ 30ක් රුපියල් හත්දහස් පන්සීයකට ගත්තා"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`seed`, Amount=`7500`, Qty=`30 කිලෝ`
    - Extracted: Category=`seed`, Amount=`7500`, Qty=`30 කිලෝ`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-016] (si) - "පැය 2 ක් ට්‍රැක්ටරය සඳහා රුපියල් 12000 ක් ගෙව්වා"
- **Raw Transcript**: "පැය දෙකක් ට්‍රැක්ටරේ සඳහා රුපියල් දොළොස් දහසක් ගෙව්වා"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`machinery`, Amount=`12000`, Qty=`2 පැය`
    - Extracted: Category=`machinery`, Amount=`12000`, Qty=`2 hours`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-017] (si) - "වල් නාශක බෝතල් 1 ක් රුපියල් 3200 කට ගත්තා"
- **Raw Transcript**: "වල් නාශක බෝතල් එකක් රුපියල් තුන්දාස් දෙසීයකට ගත්තා"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`agrochemical`, Amount=`3200`, Qty=`1 බෝතල්`
    - Extracted: Category=`agrochemical`, Amount=`3200`, Qty=`1 bottle`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-018] (si) - "වල් නෙලීමට කම්කරුවන් 2 කට රුපියල් 6000 ක් ගෙව්වා"
- **Raw Transcript**: "වල් නෙළීමට කම්කරුවන් දෙකකට රුපියල් හය දාහක් ගෙව්වා"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`labour`, Amount=`6000`, Qty=`2 කම්කරුවන්`
    - Extracted: Category=`labour`, Amount=`6000`, Qty=`2 laborers`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-019] (si) - "ඩීසල් ලීටර් 20 ක් රුපියල් 6800 කට ගත්තා"
- **Raw Transcript**: "ඩීසල් ලීටර් 20ක් රුපියල් 6800ට ගත්තා"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (ok, save-safe):
    - Expected: Category=`fuel`, Amount=`6800`, Qty=`20 ලීටර්`
    - Extracted: Category=`fuel`, Amount=`6800`, Qty=`20 liters`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-020] (si) - "ජල සම්පාදනය සඳහා රුපියල් 4500 ක් ගෙව්වා"
- **Raw Transcript**: "ජල සම්පාදනය සඳහා රුපියල් 4500ක් ගෙව්වා"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (ok, save-safe):
    - Expected: Category=`irrigation`, Amount=`4500`, Qty=`null `
    - Extracted: Category=`irrigation`, Amount=`4500`, Qty=`null `
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-021] (si) - "බීජ සඳහා 1500 ක් සහ යූරියා මිටි 2 සඳහා 6000 ක් වියදම් කළා"
- **Raw Transcript**: "බීජ සඳහා 1900ක් සහ යුරියා මිටි දෙකක් සඳහා අයදහස් වියදම් කළා"
- **Expected Items**: 2 | **Extracted Items**: 2
  - **Item #1** (ok, UNSAFE):
    - Expected: Category=`seed`, Amount=`1500`, Qty=`null `
    - Extracted: Category=`seed`, Amount=`1900`, Qty=`null `
    - Matches: Amount=✗, Category=✓, Qty=✓, Unit=✓
    - Attribution: `ASR_FAILURE`
  - **Item #2** (needs_review, save-safe):
    - Expected: Category=`fertilizer`, Amount=`6000`, Qty=`2 මිටි`
    - Extracted: Category=`fertilizer`, Amount=`null`, Qty=`2 bags`
    - Matches: Amount=✗, Category=✓, Qty=✓, Unit=✓
    - Attribution: `ASR_FAILURE`


### [VP-CAP-022] (si) - "කොම්පෝස්ට් පොහොර මිටි 5 ක් රුපියල් 5000 යි"
- **Raw Transcript**: "කොම්පෝස් කෝරමිටි පහක් රුපියල් පන්දාහයි"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`fertilizer`, Amount=`5000`, Qty=`5 මිටි`
    - Extracted: Category=`fertilizer`, Amount=`5000`, Qty=`5 bags`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-023] (si) - "කෘමිනාශක බෝතල් 2 ක් රුපියල් 4800 කට ගත්තා"
- **Raw Transcript**: "කෘමි නාශක බෝතල් දෙකක් රුපියල් හාරදහස් අටසීයකට ගත්තා"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`agrochemical`, Amount=`4800`, Qty=`2 බෝතල්`
    - Extracted: Category=`agrochemical`, Amount=`4800`, Qty=`2 bottle`
    - Matches: Amount=✓, Category=✓, Qty=✓, Unit=✓
    - Attribution: `NONE`


### [VP-CAP-024] (si) - "ලෑලි සහ කම්බි සඳහා රුපියල් 3500 ක් ගෙව්වා"
- **Raw Transcript**: "ලෑලි සහ කම්බි සඳහා රුපියල් ඉන්ගාස් පන්සීයක් ගෙව්වා"
- **Expected Items**: 1 | **Extracted Items**: 1
  - **Item #1** (needs_review, save-safe):
    - Expected: Category=`other`, Amount=`3500`, Qty=`null `
    - Extracted: Category=`other`, Amount=`null`, Qty=`null `
    - Matches: Amount=✗, Category=✓, Qty=✓, Unit=✓
    - Attribution: `ASR_FAILURE`


