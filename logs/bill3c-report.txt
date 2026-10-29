# TASK BILL-3c: Development Evaluation & Error Analysis Report

**Date:** 2026-10-29  
**Branch:** `feature/bill-scanner`  
**Execution:** BILL-3b items 1, 4, 5, and 6 on `bill-scan-data/synthetic` (Development Split Only)

---

## 1. Item-by-Item Status Table

| Item | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **0. Safety Guard** | Free space check (> 1 GB), no pip > 300MB, protected dirs untouched, no commit | **DONE** | Free space: 4.789 GB (start) -> 4.789 GB (end); `shared/voice` verified against `freeze-v2-hashes.txt` (6/6 match); git branch uncommitted. |
| **1. Dataset Listing** | `Get-ChildItem` listing of `bill-scan-data` with counts per split and level, naming development ground-truth file | **DONE** | 60 bills total (20 dev, 40 test; 5 and 10 per level 0, 1, 2, 3). Dev ground-truth file named: `bill-scan-data/synthetic/development/manifest.json`. Logged in `logs/bill3c-counts.txt` and `logs/bill3c-dev-gt-file.txt`. |
| **4. Service Dry Run** | Start service on 127.0.0.1 with random token, send 3 development bills (levels 0, 2, 3) as raw bodies, side-by-side OCR vs parsed JSON vs GT, latency table for all 20 development bills, stop service | **DONE** | Executed via `dry_run_service.py` with `httpx.Client`. 3 bills printed side-by-side. 20-bill latency table generated (Mean: 906.4 ms). Logged in `logs/bill3c-service-dryrun.txt`. |
| **5. Run Evaluation** | Run `eval_bills.py --split development`, summary table (silent total errors first, Wilson 95% CIs, by level and overall), per-item JSON path | **DONE** | Executed `eval_bills.py --split development`. 0 silent total errors (0.0%, 95% CI [0.0%, 16.1%]). Detailed JSON at `logs/bill-eval-development.json`. Logged in `logs/bill3c-eval-development.txt`. |
| **6. Error Analysis** | Read-only error analysis for every wrong, flagged or missing total, showing OCR text around true total and naming failing stage | **DONE** | 14 non-correct totals analyzed (13 wrong_flagged, 1 no_value, 0 silent errors). Diagnosed stages: OCR misread (5), Wrong line (8), Grounding/Keyword missed (1). Logged in `logs/bill3c-error-analysis.txt`. |

---

## 2. Dataset Listing & Ground-Truth Manifest (Item 1)

Raw output from [`logs/bill3c-counts.txt`](file:///D:/Aswanna/logs/bill3c-counts.txt):
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

Raw output from [`logs/bill3c-dev-gt-file.txt`](file:///D:/Aswanna/logs/bill3c-dev-gt-file.txt):
```
FullName                                                      Length LastWriteTime        
--------                                                      ------ -------------        
D:\Aswanna\bill-scan-data\synthetic\development\manifest.json  21295 10/29/2026 3:21:11 PM
```

- **Development Ground-Truth Manifest File:** [`bill-scan-data/synthetic/development/manifest.json`](file:///D:/Aswanna/bill-scan-data/synthetic/development/manifest.json) (along with individual paired per-bill annotations `bill_XXX_degY.json`).

---

## 3. Service Dry Run on 3 Development Bills (Item 4)

Service started on `http://127.0.0.1:8011` with bearer token auth.

### A. Level 0: `bill_001_deg0` (Clean, Layout 2)
```
>>> BILL: bill_001_deg0 (Degradation Level 0) <<<
--------------------------------------------------------------------------------
RAW OCR TEXT:
NEW GAMINI HARDWARE STORES
33 Hospital Road, Tambuttegama
Tel: 025-2276550
Date: 2026-04-15 || Bill No: INV-2026-1001
Bispyribac Sodium 500ml
1 @ 1,950.00 each || Rs.1,950.00
Foot Valve 2 inch
2 @ 1,450.00 each || Rs.2,900.00
Sprinkler Head 3/4 inch
3 @ 850.00 each || Rs.2,550.00
Total Items: 3 | Total Qty: 6
Subtotal || Rs.7,400.00
Discount (Less) || -Rs.1,110.00
TOTAL || Rs.6,290.00
THANK YOU! PLEASE COME AGAIN
----------------------------------------
PARSED JSON:
{
  "source": "bill",
  "vendor": null,
  "date": "2026-04-15",
  "total": 6290.0,
  "items": [
    {
      "category": "agrochemical",
      "quantity": 1.0,
      "amount": 1950.0,
      "description": "Bispyribac Sodium 500ml 1 @ 1,950.00 each ||",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified"
      ],
      "source": "bill"
    },
    {
      "category": "irrigation",
      "quantity": 2.0,
      "amount": 2900.0,
      "description": "Foot Valve 2 inch 2 @ 1,450.00 each ||",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified"
      ],
      "source": "bill"
    },
    {
      "category": "irrigation",
      "quantity": 3.0,
      "amount": 2550.0,
      "description": "Sprinkler Head 3/4 inch 3 @ 850.00 each ||",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified"
      ],
      "source": "bill"
    }
  ],
  "status": "ok",
  "reasons": [],
  "rawText": "NEW GAMINI HARDWARE STORES\n33 Hospital Road, Tambuttegama\nTel: 025-2276550\nDate: 2026-04-15 || Bill No: INV-2026-1001\nBispyribac Sodium 500ml\n1 @ 1,950.00 each || Rs.1,950.00\nFoot Valve 2 inch\n2 @ 1,450.00 each || Rs.2,900.00\nSprinkler Head 3/4 inch\n3 @ 850.00 each || Rs.2,550.00\nTotal Items: 3 | Total Qty: 6\nSubtotal || Rs.7,400.00\nDiscount (Less) || -Rs.1,110.00\nTOTAL || Rs.6,290.00\nTHANK YOU! PLEASE COME AGAIN",
  "confidence": 0.95
}
----------------------------------------
GROUND TRUTH:
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

---

### B. Level 2: `bill_031_deg2` (Skewed & Contrast Reduced, Layout 2)
```
>>> BILL: bill_031_deg2 (Degradation Level 2) <<<
--------------------------------------------------------------------------------
RAW OCR TEXT:
DAMBULLA AGRI INPUTS CENTER
88 Market Road, Dambulla
Tel: 066-2284990
Date: 26.01.2025 || Bill No: INV-2025-1031
Foot Valve 2 inch
3 @ 1,450.00 each || Rs 4 350
Pump Repair Labour Charge
3 @ 1,500.00 each || Rs 4 500
Petrol 92 Octane
3 @ 360.00 each || Rs 1 080
Water Pump V-Belt B-42
2 @ 1,100.09 each Rs 2 2@
NET TOTAL Rs 12 139
Cash Tendered Rs 12 See
Change Rs 370
THANK YOU! PLEASE COME AGAIN
----------------------------------------
PARSED JSON:
{
  "source": "bill",
  "vendor": null,
  "date": "2025-01-26",
  "total": 12139.0,
  "items": [
    {
      "category": "irrigation",
      "quantity": 3.0,
      "amount": 4350.0,
      "description": "Foot Valve 2 inch 3 @ 1,450.00 each ||",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified"
      ],
      "source": "bill"
    },
    {
      "category": "labour",
      "quantity": 3.0,
      "amount": 4500.0,
      "description": "Pump Repair Labour Charge 3 @ 1,500.00 each ||",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified"
      ],
      "source": "bill"
    },
    {
      "category": "fuel",
      "quantity": 3.0,
      "amount": 1080.0,
      "description": "Petrol 92 Octane 3 @ 360.00 each ||",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified"
      ],
      "source": "bill"
    },
    {
      "category": "other",
      "quantity": 2.0,
      "amount": 2.0,
      "description": "Water Pump V-Belt B-42 2 @ 1,100.09 each",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified",
        "category_unsure"
      ],
      "source": "bill"
    }
  ],
  "status": "needs_review",
  "reasons": [
    "category_unsure",
    "sum_mismatch"
  ],
  "rawText": "DAMBULLA AGRI INPUTS CENTER\n88 Market Road, Dambulla\nTel: 066-2284990\nDate: 26.01.2025 || Bill No: INV-2025-1031\nFoot Valve 2 inch\n3 @ 1,450.00 each || Rs 4 350\nPump Repair Labour Charge\n3 @ 1,500.00 each || Rs 4 500\nPetrol 92 Octane\n3 @ 360.00 each || Rs 1 080\nWater Pump V-Belt B-42\n2 @ 1,100.09 each Rs 2 2@\nNET TOTAL Rs 12 139\nCash Tendered Rs 12 See\nChange Rs 370\nTHANK YOU! PLEASE COME AGAIN",
  "confidence": 0.87
}
----------------------------------------
GROUND TRUTH:
{
  "id": "bill_031",
  "filename": "bill_031_deg2.png",
  "split": "development",
  "degradation_level": 2,
  "layout": 2,
  "vendor": "Dambulla Agri Inputs Center",
  "date": "2025-01-26",
  "items": [
    {
      "description": "Foot Valve 2 inch",
      "quantity": 3,
      "unit_price": 1450.0,
      "amount": 4350.0,
      "category": "irrigation"
    },
    {
      "description": "Pump Repair Labour Charge",
      "quantity": 3,
      "unit_price": 1500.0,
      "amount": 4500.0,
      "category": "labour"
    },
    {
      "description": "Petrol 92 Octane",
      "quantity": 3,
      "unit_price": 360.0,
      "amount": 1080.0,
      "category": "fuel"
    },
    {
      "description": "Water Pump V-Belt B-42",
      "quantity": 2,
      "unit_price": 1100.0,
      "amount": 2200.0,
      "category": "machinery"
    }
  ],
  "total": 12130.0,
  "total_cents": 1213000,
  "distractors": [
    "Cash Tendered: 12500.00",
    "Change: 370.00"
  ],
  "meta": {
    "date_display": "26.01.2025",
    "amount_style_idx": 3,
    "has_tax": false,
    "has_discount": false
  }
}
```

---

### C. Level 3: `bill_046_deg3` (Heavy Noise & Low Resolution, Layout 1)
```
>>> BILL: bill_046_deg3 (Degradation Level 3) <<<
--------------------------------------------------------------------------------
RAW OCR TEXT:
DAMBULLA AGRI INPUTS CENTER
88 Porket Ased, Destulle
Tel: @66-z7e4900 Date: 2075-05-05 Bill No: IMV- 2825-1646
Ttem Seacriptisn Qty Rate daount
eee ess hE EN 5d EEE TT ST ere eee Engine O11 47 2h 1 2,858,008 || LER 1,850.00
Sprinkler Head 3/4 4.. i x 650.00 || LER B50.06
MOP Fertilizer Seaug 3x 4,800.09 || LER 14,400.00
Tine Sulphate leg 1  858.00 || LER 850.00
Total ttema: 4 | Total Gey: & Subtotal LER 17,958.00
VAT (8%) LER 1,436.00
TOTAL LKR 19,386.68
Caih lendered UCR 19, $oo.0ar
Change LER 114.
THe YT! PLEASE COME AGADN
----------------------------------------
PARSED JSON:
{
  "source": "bill",
  "vendor": "DAMBULLA AGRI INPUTS CENTER",
  "date": null,
  "total": 19386.0,
  "items": [
    {
      "category": "other",
      "quantity": null,
      "amount": 1646.0,
      "description": "Tel: @66-Z784900 Date: 2025-05-85 Bill Ne: IMV- 2825-",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified",
        "category_unsure"
      ],
      "source": "bill"
    },
    {
      "category": "other",
      "quantity": null,
      "amount": 1850.0,
      "description": "Engine G11 47 ah 1\u00bb 1,858,008 || LER",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified",
        "category_unsure"
      ],
      "source": "bill"
    },
    {
      "category": "other",
      "quantity": null,
      "amount": 50.0,
      "description": "Sprinkler Head 3/4 1.. i x 6 || LER B",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified",
        "category_unsure"
      ],
      "source": "bill"
    },
    {
      "category": "fertilizer",
      "quantity": 3.0,
      "amount": 14400200.0,
      "description": "MOF Fertilizer Sekg 3x 4,800.00 || LER",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified"
      ],
      "source": "bill"
    },
    {
      "category": "other",
      "quantity": null,
      "amount": 850.0,
      "description": "Tine Sulphate kg 1 \u00ab 858.00 ||",
      "date": null,
      "status": "needs_review",
      "reasons": [
        "line_item_unverified",
        "category_unsure"
      ],
      "source": "bill"
    }
  ],
  "status": "needs_review",
  "reasons": [
    "category_unsure",
    "sum_mismatch"
  ],
  "rawText": "DAMBULLA AGRI INPUTS CENTER\n88 Market Ased, Dantulle\nTel: @66-Z784900 Date: 2025-05-85 Bill Ne: IMV- 2825-1646\nTtes Sescriptisn Qty Rate demcurtt\nEngine G11 47 ah 1\u00bb 1,858,008 || LER 1,850.00\nSprinkler Head 3/4 1.. i x 650.00 || LER B50.00\nMOF Fertilizer Sekg 3x 4,800.00 || LER 14,400,200\nTine Sulphate kg 1 \u00ab 858.00 || LKR 850.00\nTotal ttema: 4 | Total Gey: &\nSubtotal LKR 17 ,558ae\nVAT (8) LKA 1,436.88\nTOTAL LKR 19,386.00\nCaih Tendered LCR am, Soeeeh\nChange LER L140\nTHeAR TH)! PLEASE COME MGATW",
  "confidence": 0.56
}
----------------------------------------
GROUND TRUTH:
{
  "id": "bill_046",
  "filename": "bill_046_deg3.jpg",
  "split": "development",
  "degradation_level": 3,
  "layout": 1,
  "vendor": "Dambulla Agri Inputs Center",
  "date": "2025-05-05",
  "items": [
    {
      "description": "Engine Oil 4T 1L",
      "quantity": 1,
      "unit_price": 1850.0,
      "amount": 1850.0,
      "category": "fuel"
    },
    {
      "description": "Sprinkler Head 3/4 inch",
      "quantity": 1,
      "unit_price": 850.0,
      "amount": 850.0,
      "category": "irrigation"
    },
    {
      "description": "MOP Fertilizer 50kg",
      "quantity": 3,
      "unit_price": 4800.0,
      "amount": 14400.0,
      "category": "fertilizer"
    },
    {
      "description": "Zinc Sulphate 1kg",
      "quantity": 1,
      "unit_price": 850.0,
      "amount": 850.0,
      "category": "fertilizer"
    }
  ],
  "total": 19386.0,
  "total_cents": 1938600,
  "distractors": [
    "Total Items: 4 | Total Qty: 6",
    "Subtotal: 17950.00",
    "VAT: 1436.00",
    "Cash Tendered: 19500.00",
    "Change: 114.00"
  ],
  "meta": {
    "date_display": "2025-05-05",
    "amount_style_idx": 4,
    "has_tax": true,
    "has_discount": false
  }
}
```

---

## 4. Latency Table for All 20 Development Bills

Raw output from [`logs/bill3c-service-dryrun.txt`](file:///D:/Aswanna/logs/bill3c-service-dryrun.txt):
```
Bill ID              Level    Format   Size (KB)    HTTP Status    Latency (ms)
--------------------------------------------------------------------------------
bill_001_deg0        0        PNG      28.3         200            977.0       
bill_002_deg0        0        PNG      27.1         200            971.6       
bill_003_deg0        0        PNG      27.9         200            852.8       
bill_004_deg0        0        PNG      24.4         200            850.8       
bill_005_deg0        0        PNG      29.8         200            1018.4      
bill_016_deg1        1        JPG      28.5         200            730.0       
bill_017_deg1        1        JPG      30.1         200            1004.3      
bill_018_deg1        1        JPG      31.8         200            775.6       
bill_019_deg1        1        JPG      32.2         200            901.7       
bill_020_deg1        1        JPG      38.1         200            1089.3      
bill_031_deg2        2        PNG      120.7        200            904.6       
bill_032_deg2        2        PNG      106.2        200            856.0       
bill_033_deg2        2        PNG      101.8        200            718.2       
bill_034_deg2        2        PNG      124.2        200            726.2       
bill_035_deg2        2        PNG      134.9        200            908.2       
bill_046_deg3        3        JPG      31.5         200            1173.1      
bill_047_deg3        3        JPG      19.0         200            917.4       
bill_048_deg3        3        JPG      24.3         200            840.8       
bill_049_deg3        3        JPG      18.6         200            1002.1      
bill_050_deg3        3        JPG      24.5         200            909.9       
--------------------------------------------------------------------------------
Summary: Min = 718.2 ms | Max = 1173.1 ms | Mean = 906.4 ms over 20 bills
```

---

## 5. Development Split Evaluation Summary (Item 5)

Command:
```powershell
$env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"; .\.venv\Scripts\python.exe eval\eval_bills.py --split development
```

Raw output from [`logs/bill3c-eval-development.txt`](file:///D:/Aswanna/logs/bill3c-eval-development.txt):
```
[OUTPUT] Written detailed evaluation JSON to: D:\Aswanna\logs\bill-eval-development.json

==========================================================================================
ASWANNA BILL SCANNER EVALUATION SUMMARY (Split: development)
==========================================================================================
Level      N      Silent Tot Errs (95% CI)   Correct Tot (95% CI)     Vendor Exact
------------------------------------------------------------------------------------------
Level 0    5      0 (0.0%, [0.0%, 43.5%])    2 (40.0%, [11.8%, 76.9%]) 0/5         
Level 1    5      0 (0.0%, [0.0%, 43.5%])    2 (40.0%, [11.8%, 76.9%]) 1/5         
Level 2    5      0 (0.0%, [0.0%, 43.5%])    1 (20.0%, [3.6%, 62.5%]) 0/5         
Level 3    5      0 (0.0%, [0.0%, 43.5%])    1 (20.0%, [3.6%, 62.5%]) 4/5         
------------------------------------------------------------------------------------------
OVERALL    20     0 (0.0%, [0.0%, 16.1%])    6 (30.0%, [14.5%, 51.9%]) 5/20        
==========================================================================================
```

- **Per-item Detailed JSON Path:** [`logs/bill-eval-development.json`](file:///D:/Aswanna/logs/bill-eval-development.json)
- **Primary Safety Metric (Silent Total Errors):** **0.0%** (0 / 20, 95% Wilson CI: `[0.0%, 16.1%]`). Every erroneous or missing total was flagged with review status, completely eliminating ungrounded silent errors.

---

## 6. Read-Only Error Analysis for Non-Correct Totals (Item 6)

Raw output from [`logs/bill3c-error-analysis.txt`](file:///D:/Aswanna/logs/bill3c-error-analysis.txt):
Across the 20 development bills:
- **Correct Total:** 6 bills (30.0%)
- **Wrong Flagged Total:** 13 bills (65.0%)
- **No Value Total:** 1 bill (5.0%)
- **Silent Errors:** 0 bills (0.0%)

### Summary of Failure Diagnoses
1. **OCR Misread (5 bills):**
   - Under degradation levels 2 (skew/contrast) and 3 (noise/low-res), Tesseract misrecognizes characters in total lines (e.g. `12130` read as `12 139` in `bill_031`, `4698.00` read as `, 698.00` in `bill_032`, `30470` read as `30,47@.99` in `bill_035`, `4550` read as `4,558, 08` in `bill_047`, `30150` read as `36,158.88` in `bill_048`).
   - The parser correctly flags all these via `ocr_digit_confusion`, `sum_mismatch`, and `needs_review`.
2. **Wrong Line Picked (8 bills):**
   - For bills with both `Subtotal`, `Discount`, `VAT`, and `Total`/`BALANCE DUE`, or where OCR concatenated the phone number (`Tel: 025-2245001`), the parser's fallback or subtotal parsing picked the telephone line (`2245001.0` in `bill_003`, `bill_016`, `bill_018`, `bill_020`, `bill_034`) or subtotal (`26200.0` in `bill_005`).
   - In all 8 cases, the line-item sum mismatch trigger flagged the output as `needs_review`, preventing silent acceptance.
3. **Grounding / Keyword Missed (1 bill):**
   - In `bill_049_deg3`, heavy noise distorted the balance due line (`LER 1,958,.8@`), and because grounding strictly verifies whole number digit tokens, the ungrounded candidate was rejected and returned as `null` with `total_not_in_ocr_text`.

---

## 7. Protected Directories & Integrity Verification

Verification of `shared/voice` hashes ([`logs/bill3c-voice-hashes.txt`](file:///D:/Aswanna/logs/bill3c-voice-hashes.txt)):
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

## 8. Disk Free Space Before and After

- **Before Run:** 4.789 GB free (`316,977,946,624` bytes used) ([`logs/bill3c-free-space.txt`](file:///D:/Aswanna/logs/bill3c-free-space.txt))
- **After Run:** 4.789 GB free (`316,978,049,024` bytes used) ([`logs/bill3c-free-space-after.txt`](file:///D:/Aswanna/logs/bill3c-free-space-after.txt))
- **Delta:** < 0.1 MB

---

## 9. Files Changed / Created
1. [`bill-service/eval/eval_bills.py`](file:///D:/Aswanna/bill-service/eval/eval_bills.py): Added support for `bill-scan-data/synthetic/<split>` path and manifest structure. Parser logic was **not** changed.
2. [`bill-service/eval/dry_run_service.py`](file:///D:/Aswanna/bill-service/eval/dry_run_service.py): Service runner script for side-by-side inspection and latency measurement.
3. [`bill-service/eval/error_analysis.py`](file:///D:/Aswanna/bill-service/eval/error_analysis.py): Read-only diagnosis script for non-correct totals.
4. Evaluation Results:
   - [`logs/bill-eval-development.json`](file:///D:/Aswanna/logs/bill-eval-development.json)
5. Verification Logs:
   - [`logs/bill3c-free-space.txt`](file:///D:/Aswanna/logs/bill3c-free-space.txt)
   - [`logs/bill3c-free-space-after.txt`](file:///D:/Aswanna/logs/bill3c-free-space-after.txt)
   - [`logs/bill3c-counts.txt`](file:///D:/Aswanna/logs/bill3c-counts.txt)
   - [`logs/bill3c-dev-gt-file.txt`](file:///D:/Aswanna/logs/bill3c-dev-gt-file.txt)
   - [`logs/bill3c-service-dryrun.txt`](file:///D:/Aswanna/logs/bill3c-service-dryrun.txt)
   - [`logs/bill3c-eval-development.txt`](file:///D:/Aswanna/logs/bill3c-eval-development.txt)
   - [`logs/bill3c-error-analysis.txt`](file:///D:/Aswanna/logs/bill3c-error-analysis.txt)
   - [`logs/bill3c-voice-hashes.txt`](file:///D:/Aswanna/logs/bill3c-voice-hashes.txt)
6. Reports:
   - [`docs/bill3c-report.md`](file:///D:/Aswanna/docs/bill3c-report.md)
   - [`logs/bill3c-report.txt`](file:///D:/Aswanna/logs/bill3c-report.txt)

---

## 10. Assumptions Made
- The test split and test lock remained untouched throughout this task.
- Parser code was strictly untouched; only test harness paths in `eval_bills.py` were adjusted to recognize the `bill-scan-data/synthetic` directory.

---

## 11. Not Done / Risks
- No changes to `parse_bill.py` were made (prompt: *"do not change the parser"*).
- **Risk**: Phone numbers in header lines can sometimes be picked up by fallback heuristic when keywords are degraded. Tuning the candidate total exclusion list to filter out digits immediately following `Tel:` will address this on the development split.

---

## 12. Suggested Next Step
- Undertake parser tuning on the development split to improve total accuracy (e.g., exclude header phone number digits from candidate total fallbacks, improve multi-line `BALANCE DUE` matching) without ever touching or evaluating on the locked test split.
