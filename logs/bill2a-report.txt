# TASK BILL-2a: Synthetic Printed-Bill Set with Locked Ground Truth

**Date:** 2026-10-29  
**Branch:** `feature/bill-scanner`  
**Execution:** GENERATION ONLY (No OCR, No Parser Execution)

---

## 1. Item-by-Item Status Table

| Item | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **0. Safety Guard** | Free space check (> 1 GB), no pip > 300MB, protected dirs untouched, no commit | **DONE** | Free space: 4.793 GB (start) -> 4.790 GB (end); `shared/voice` verified (6/6 match); git branch uncommitted. |
| **1. Generator Script** | Write `bill-service/synthetic/generate_bills.py` with fixed random seed (20261029). 60 bills total with PIL: farm supplies, fuel, hardware; realistic items, quantities, rates, amounts; vendor name & addresses; varied date formats; varied amount styles; total variants with/without VAT, discount, cash, change, total qty lines; 2 layouts; English only | **DONE** | Created [`bill-service/synthetic/generate_bills.py`](file:///D:/Aswanna/bill-service/synthetic/generate_bills.py). Ran deterministic generation (`logs/bill2a-generation-run.txt`). |
| **2. Degradation Levels** | 4 levels: 0 (clean), 1 (slight blur & JPEG), 2 (skew up to 5 deg & low contrast), 3 (heavy noise & low resolution). 15 bills per level into `bill-scan-data/synthetic/` (gitignored) | **DONE** | 15 bills per level across levels 0, 1, 2, 3 generated in `bill-scan-data/synthetic/` (`.gitignore` line 18 confirms gitignore). Verified in `logs/bill2a-counts.txt`. |
| **3. Ground Truth JSON** | Write ground truth JSON per bill BEFORE evaluation: vendor, ISO date, items (desc, qty, unit_price, amount, expected category from 8 app categories), total as integer cents, distractor lines | **DONE** | Paired JSON files and split `manifest.json` written per bill. Sample ground truth extracted to `logs/bill2a-sample-gt.txt`. |
| **4. Split & Lock** | Split: 20 development bills and 40 test bills. Write SHA256 of test-split ground truth to `logs/bill-synth-test-hash.txt` and create `logs/bill-synth-test.lock` | **DONE** | 20 development bills (5 per level) and 40 test bills (10 per level). Test ground truth SHA256 written to `logs/bill-synth-test-hash.txt` and locked in `logs/bill-synth-test.lock`. |
| **5. Report & Disclaimer** | Count per level, ground truth for 2 bills, file sizes, free space before/after, Get-ChildItem listing. State clearly: measures robustness to degradation only, not accuracy on real bills | **DONE** | Documented in full below. Raw command outputs teed into `logs/bill2a-*.txt`. |

---

## 2. Robustness Scope Disclaimer

> [!IMPORTANT]
> **EVALUATION SCOPE DISCLAIMER:**  
> This synthetic printed-bill dataset is designed **strictly to measure parser and OCR robustness against synthetic image degradations** (blur, JPEG compression artifacts, rotation/skew, contrast loss, downscale pixelation, and noise).  
> **It does NOT measure accuracy or performance on real-world paper bills**, which feature distinct paper textures, varied dot-matrix and thermal printer ribbons, folds, creases, handwritten annotations, stamps, and physical shop variations.

---

## 3. Dataset Counts per Split and Degradation Level

Raw output from [`logs/bill2a-counts.txt`](file:///D:/Aswanna/logs/bill2a-counts.txt):
```
Split       DegradationLevel Count
-----       ---------------- -----
development 0                    5
development 1                    5
development 2                    5
development 3                    5
test        0                   10
test        1                   10
test        2                   10
test        3                   10
```
- **Total Bills:** 60
- **Development Split:** 20 bills (5 per degradation level)
- **Test Split:** 40 bills (10 per degradation level)

---

## 4. Ground Truth for Sample Bills

Raw output from [`logs/bill2a-sample-gt.txt`](file:///D:/Aswanna/logs/bill2a-sample-gt.txt):

### Bill 1: `bill_001_deg0.png` (Development, Level 0, Layout 2)
```json
{
  "id": "bill_001",
  "filename": "bill_001_deg0.png",
  "split": "development",
  "degradation_level": 0,
  "layout": 2,
  "vendor": "New Gamini Hardware Stores",
  "date": "2026-04-15",
  "items": [
    {
      "description": "Bispyribac Sodium 500ml",
      "quantity": 1,
      "unit_price": 1950.0,
      "amount": 1950.0,
      "category": "agrochemical"
    },
    {
      "description": "Foot Valve 2 inch",
      "quantity": 2,
      "unit_price": 1450.0,
      "amount": 2900.0,
      "category": "irrigation"
    },
    {
      "description": "Sprinkler Head 3/4 inch",
      "quantity": 3,
      "unit_price": 850.0,
      "amount": 2550.0,
      "category": "irrigation"
    }
  ],
  "total": 6290.0,
  "total_cents": 629000,
  "distractors": [
    "Total Items: 3 | Total Qty: 6",
    "Subtotal: 7400.00",
    "Discount: -1110.00"
  ],
  "meta": {
    "date_display": "2026-04-15",
    "amount_style_idx": 1,
    "has_tax": false,
    "has_discount": true
  }
}
```

### Bill 2: `bill_002_deg0.png` (Development, Level 0, Layout 1)
```json
{
  "id": "bill_002",
  "filename": "bill_002_deg0.png",
  "split": "development",
  "degradation_level": 0,
  "layout": 1,
  "vendor": "Lanka IOC Fuel Point",
  "date": "2025-02-19",
  "items": [
    {
      "description": "Petrol 92 Octane",
      "quantity": 2,
      "unit_price": 360.0,
      "amount": 720.0,
      "category": "fuel"
    },
    {
      "description": "Chlorpyrifos Insecticide 1L",
      "quantity": 1,
      "unit_price": 2200.0,
      "amount": 2200.0,
      "category": "agrochemical"
    },
    {
      "description": "Flexible Hose Pipe 30m",
      "quantity": 1,
      "unit_price": 3200.0,
      "amount": 3200.0,
      "category": "irrigation"
    }
  ],
  "total": 6610.0,
  "total_cents": 661000,
  "distractors": [
    "Total Items: 3 | Total Qty: 4",
    "Subtotal: 6120.00",
    "VAT: 490.00",
    "Cash Tendered: 7000.00",
    "Change: 390.00"
  ],
  "meta": {
    "date_display": "19/02/2025",
    "amount_style_idx": 1,
    "has_tax": true,
    "has_discount": false
  }
}
```

---

## 5. File Sizes Summary

Raw output from [`logs/bill2a-sizes.txt`](file:///D:/Aswanna/logs/bill2a-sizes.txt):
```
Count MinKB MaxKB AvgKB TotalMB
----- ----- ----- ----- -------
   60    16 134.9  47.4    2.78
```

---

## 6. Disk Free Space Before and After

Raw output from [`logs/bill2a-free-space.txt`](file:///D:/Aswanna/logs/bill2a-free-space.txt) (Before) and [`logs/bill2a-free-space-after.txt`](file:///D:/Aswanna/logs/bill2a-free-space-after.txt) (After):

**Before Generation:**
```
        Used       Free FreeGB
        ----       ---- ------
316973985792 5146460160  4.793
```

**After Generation:**
```
        Used       Free FreeGB
        ----       ---- ------
316977389568 5143056384   4.79
```
*Net disk delta:* ~3.4 MB consumed (well within disk hygiene safety limit; 4.79 GB free).

---

## 7. Test Split Lock & Hash Evidence

Raw output from [`logs/bill2a-test-hash.txt`](file:///D:/Aswanna/logs/bill2a-test-hash.txt):
```
55074b398a88851eacbafe4868d8fbbdb9608e8392990ac64846dadd1f3573d9  test-ground-truth-sha256
```

Raw output from [`logs/bill2a-test-lock.txt`](file:///D:/Aswanna/logs/bill2a-test-lock.txt):
```
SYNTHETIC TEST SPLIT LOCKED
SHA256: 55074b398a88851eacbafe4868d8fbbdb9608e8392990ac64846dadd1f3573d9
Count: 40
Rule: Test labels are never edited; only development bills may be used for tuning.
```

---

## 8. Directory Listing of Created Artifacts

Raw output from [`logs/bill2a-filelist.txt`](file:///D:/Aswanna/logs/bill2a-filelist.txt):
```
FullName                                                           Length LastWriteTime        
--------                                                           ------ -------------        
D:\Aswanna\bill-scan-data\synthetic\development                           10/29/2026 3:21:11 PM
D:\Aswanna\bill-scan-data\synthetic\test                                  10/29/2026 3:21:11 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_001_deg0.json 1021   10/29/2026 3:21:07 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_001_deg0.png  28954  10/29/2026 3:21:07 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_002_deg0.json 1057   10/29/2026 3:21:07 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_002_deg0.png  27765  10/29/2026 3:21:07 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_003_deg0.json 1147   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_003_deg0.png  28618  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_004_deg0.json 848    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_004_deg0.png  25015  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_005_deg0.json 1133   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_005_deg0.png  30466  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_016_deg1.jpg  29207  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_016_deg1.json 693    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_017_deg1.jpg  30788  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_017_deg1.json 982    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_018_deg1.jpg  32588  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_018_deg1.json 837    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_019_deg1.jpg  32961  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_019_deg1.json 1158   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_020_deg1.jpg  39052  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_020_deg1.json 1195   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_031_deg2.json 1142   10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_031_deg2.png  123623 10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_032_deg2.json 718    10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_032_deg2.png  108708 10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_033_deg2.json 893    10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_033_deg2.png  104228 10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_034_deg2.json 1096   10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_034_deg2.png  127226 10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_035_deg2.json 1038   10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_035_deg2.png  138160 10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_046_deg3.jpg  32212  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_046_deg3.json 1225   10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_047_deg3.jpg  19445  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_047_deg3.json 748    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_048_deg3.jpg  24911  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_048_deg3.json 1006   10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_049_deg3.jpg  19006  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_049_deg3.json 676    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_050_deg3.jpg  25051  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\development\bill_050_deg3.json 881    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\development\manifest.json      21295  10/29/2026 3:21:11 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_006_deg0.json        1228   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_006_deg0.png         30889  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_007_deg0.json        1027   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_007_deg0.png         27407  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_008_deg0.json        695    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_008_deg0.png         24367  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_009_deg0.json        888    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_009_deg0.png         28324  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_010_deg0.json        845    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_010_deg0.png         22382  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_011_deg0.json        708    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_011_deg0.png         24303  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_012_deg0.json        1160   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_012_deg0.png         25386  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_013_deg0.json        561    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_013_deg0.png         16388  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_014_deg0.json        1172   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_014_deg0.png         28257  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_015_deg0.json        980    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_015_deg0.png         26686  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_021_deg1.jpg         30736  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_021_deg1.json        732    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_022_deg1.jpg         35220  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_022_deg1.json        1256   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_023_deg1.jpg         33044  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_023_deg1.json        750    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_024_deg1.jpg         37800  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_024_deg1.json        1174   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_025_deg1.jpg         33902  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_025_deg1.json        1011   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_026_deg1.jpg         43586  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_026_deg1.json        1237   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_027_deg1.jpg         36824  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_027_deg1.json        1151   10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_028_deg1.jpg         35833  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_028_deg1.json        900    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_029_deg1.jpg         28329  10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_029_deg1.json        672    10/29/2026 3:21:08 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_030_deg1.jpg         29563  10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_030_deg1.json        623    10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_036_deg2.json        621    10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_036_deg2.png         90797  10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_037_deg2.json        637    10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_037_deg2.png         96910  10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_038_deg2.json        1095   10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_038_deg2.png         122398 10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_039_deg2.json        865    10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_039_deg2.png         114937 10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_040_deg2.json        666    10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_040_deg2.png         102005 10/29/2026 3:21:09 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_041_deg2.json        671    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_041_deg2.png         95102  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_042_deg2.json        912    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_042_deg2.png         105316 10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_043_deg2.json        741    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_043_deg2.png         97847  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_044_deg2.json        985    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_044_deg2.png         101174 10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_045_deg2.json        835    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_045_deg2.png         105497 10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_051_deg3.jpg         23640  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_051_deg3.json        708    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_052_deg3.jpg         23374  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_052_deg3.json        673    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_053_deg3.jpg         29654  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_053_deg3.json        1210   10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_054_deg3.jpg         28119  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_054_deg3.json        1016   10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_055_deg3.jpg         23008  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_055_deg3.json        929    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_056_deg3.jpg         22826  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_056_deg3.json        783    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_057_deg3.jpg         23506  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_057_deg3.json        893    10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_058_deg3.jpg         27843  10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_058_deg3.json        1017   10/29/2026 3:21:10 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_059_deg3.jpg         26338  10/29/2026 3:21:11 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_059_deg3.json        1177   10/29/2026 3:21:11 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_060_deg3.jpg         27561  10/29/2026 3:21:11 PM
D:\Aswanna\bill-scan-data\synthetic\test\bill_060_deg3.json        909    10/29/2026 3:21:11 PM
D:\Aswanna\bill-scan-data\synthetic\test\manifest.json             39508  10/29/2026 3:21:11 PM
```

---

## 9. Protected Directories & Integrity Evidence

Verification of `shared/voice` hashes ([`logs/bill2a-voice-hashes.txt`](file:///D:/Aswanna/logs/bill2a-voice-hashes.txt)):
```
9E72E2EA1AD3EFBC99C9DFD0094CAD4FF57C3260097A6B91D7ACAF282070DA02  asrConfusions.json
FE6AAE993B2C87E22DB1BF1F4B4E9A9367E5EB88C13BF44417D9AAC6E3E28177  extractExpenses.js
B71678A7A69B3AA2B50CB706ADE1A04C27A3DEE518D6CED68991D5EB89DF36F7  keywordMap.json
27B38E6DF9B64CCADFE7C01B313E0B55FE9716B4E80073FF8E5222660F5EE02D  parseCommand.js
EBF1DBDACE5F1F350AFC8D2B6EBCC13588D5617D9D3A3C772E37439AB3033D38  sinhalaNumbers.js
6486201B80E801DBB72436236EEB22E67A631E5C7FD9CC62361B7AA6B9ED7687  sinhalaNumberWords.json
```
*(Exact match with [`logs/freeze-v2-hashes.txt`](file:///D:/Aswanna/logs/freeze-v2-hashes.txt))*

---

## 10. Files Changed / Created
1. [`bill-service/synthetic/generate_bills.py`](file:///D:/Aswanna/bill-service/synthetic/generate_bills.py): Deterministic generator script.
2. Dataset in [`bill-scan-data/synthetic/`](file:///D:/Aswanna/bill-scan-data/synthetic):
   - `development/`: 20 images + 20 JSON ground truths + `manifest.json`.
   - `test/`: 40 images + 40 JSON ground truths + `manifest.json`.
3. Lock & Hash:
   - [`logs/bill-synth-test-hash.txt`](file:///D:/Aswanna/logs/bill-synth-test-hash.txt)
   - [`logs/bill-synth-test.lock`](file:///D:/Aswanna/logs/bill-synth-test.lock)
4. Verification Logs:
   - [`logs/bill2a-free-space.txt`](file:///D:/Aswanna/logs/bill2a-free-space.txt)
   - [`logs/bill2a-free-space-after.txt`](file:///D:/Aswanna/logs/bill2a-free-space-after.txt)
   - [`logs/bill2a-generation-run.txt`](file:///D:/Aswanna/logs/bill2a-generation-run.txt)
   - [`logs/bill2a-counts.txt`](file:///D:/Aswanna/logs/bill2a-counts.txt)
   - [`logs/bill2a-sample-gt.txt`](file:///D:/Aswanna/logs/bill2a-sample-gt.txt)
   - [`logs/bill2a-sizes.txt`](file:///D:/Aswanna/logs/bill2a-sizes.txt)
   - [`logs/bill2a-filelist.txt`](file:///D:/Aswanna/logs/bill2a-filelist.txt)
   - [`logs/bill2a-test-hash.txt`](file:///D:/Aswanna/logs/bill2a-test-hash.txt)
   - [`logs/bill2a-test-lock.txt`](file:///D:/Aswanna/logs/bill2a-test-lock.txt)
   - [`logs/bill2a-voice-hashes.txt`](file:///D:/Aswanna/logs/bill2a-voice-hashes.txt)
5. Reports:
   - [`docs/bill2a-report.md`](file:///D:/Aswanna/docs/bill2a-report.md)
   - [`logs/bill2a-report.txt`](file:///D:/Aswanna/logs/bill2a-report.txt)

---

## 11. Assumptions Made
- In strict adherence to prompt instructions, no OCR or parser was executed on the generated images.
- Images for degradation levels 0 and 2 are stored as `.png`; levels 1 and 3 are stored as `.jpg` to emulate compression artifacts.
- The test split labels are permanently locked in `logs/bill-synth-test.lock` with SHA256 checksum in `logs/bill-synth-test-hash.txt`.

---

## 12. Not Done / Risks
- No evaluation or OCR runs were performed on this dataset (prohibited in prompt: *"GENERATION ONLY"*).
- **Risk**: Test split labels must not be changed. Any future parser tuning must strictly evaluate on the development split only.

---

## 13. Suggested Next Step
- Run `TASK BILL-3b` (development evaluation):
  1. Evaluate `eval_bills.py --split development` against the 20 development bills.
  2. Perform error analysis across degradation levels 0 to 3.
