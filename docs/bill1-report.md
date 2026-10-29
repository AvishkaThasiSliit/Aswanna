# Task BILL-1: Bill Scanner Foundation Report (Engine Check & Specification)

**Date**: 2026-10-29  
**Repository**: `D:\Aswanna`  
**Status**: STOPPED AT STEP 1 (Tesseract engine missing on system; awaiting user installation)

---

## 1. Disk Free Space Guard

- **Current Free Space on D:**: `1,804,537,856` bytes (1.80 GB / ~1.68 GiB)
- **Constraint**: Minimum 1.0 GB free (Constraint met).

---

## 2. Step 0: Specification Completed (`docs/bill-scan-spec.md`)

Specification written to [`docs/bill-scan-spec.md`](file:///d:/Aswanna/docs/bill-scan-spec.md):
- **Scope**: Printed receipts and invoices only (fertilizer, seeds, agro-chemicals, fuel, tractor hire, equipment rental). Handwriting is explicitly defined as a non-goal.
- **Output Schema**: Compatible with the voice extractor schema (`category`, `quantity`, `amount`, `description`, `date`, `status`, `reasons`, `source: "bill"`, `rawText`, `confidence`).
- **Privacy & Security**:
  - In-memory processing by default (`io.BytesIO`).
  - No image files written to disk unless `BILL_KEEP_IMAGES=on` (default: `off`).
  - Strict upload body limit: 5 MB.
  - Magic byte validation: PNG (`89 50 4E 47`) and JPEG (`FF D8 FF`) only.
  - EXIF metadata stripped in memory upon ingest.
  - 100% offline localhost execution (`127.0.0.1`); zero external/cloud calls.
- **Feature Flag**: `BILL_SCAN=off` by default.
- **Evaluation Plan**:
  - **Primary Metric**: Count of wrong totals presented without a review flag (silent errors; zero-tolerance objective).
  - **Secondary Metric**: Correct-total rate on ground-truth printed bills.
  - No invented target numbers prior to empirical testing.

---

## 3. Step 1: Engine Check Results

### Command Execution
```powershell
where.exe tesseract
# Output: INFO: Could not find files for the given pattern(s).

tesseract --version
# Output: tesseract : The term 'tesseract' is not recognized as the name of a cmdlet, function, script file, or operable program.
```

### Installation Paths Checked
- `C:\Program Files\Tesseract-OCR\tesseract.exe`: Not found (`False`)
- `C:\Program Files (x86)\Tesseract-OCR\tesseract.exe`: Not found (`False`)
- `C:\Users\EBAY\AppData\Local\Tesseract-OCR\tesseract.exe`: Not found (`False`)
- `C:\tools\tesseract\tesseract.exe`: Not found (`False`)
- Entire `D:\` drive: No tesseract binaries found.

### Result
Per explicit task instruction:
> *"If Tesseract is missing, STOP this step and tell me exactly what to install; do not install system software yourself. Use pytesseract (small) as the wrapper."*

Step 1 is stopped. System software was not installed autonomously.

---

## 4. Required Installation Instructions for User

To install Tesseract OCR on this Windows system:

### Option A (Recommended via Windows Package Manager / winget)
Open PowerShell (as Administrator or regular user) and run:
```powershell
winget install UB-Mannheim.TesseractOCR
```
*Note*: This installs Tesseract 5.4.0 to `C:\Program Files\Tesseract-OCR` and configures the binary path.

### Option B (Manual Windows Installer)
1. Download the installer from UB-Mannheim:
   `https://github.com/UB-Mannheim/tesseract/wiki` (e.g. `tesseract-ocr-w64-setup-5.4.0.20240606.exe`).
2. Run the installer and choose the default path:
   `C:\Program Files\Tesseract-OCR`.
3. Under "Additional language data (download)", optionally select **Sinhala** (`sin`) if Sinhala OCR is desired.
4. Check the box to add Tesseract to the system `PATH`.

### Verification Command After Installation
After installing, restart the shell or verify in PowerShell:
```powershell
tesseract --version
tesseract --list-langs
```

---

## 5. Repository Cleanliness & Verification

- **Git Ignore**: Added `bill-scan-data/` and `bill-service/.venv/` to root `.gitignore`.
- **Shared Voice Invariance**: All 6 files in `shared/voice` verified against `logs/freeze-v2-hashes.txt` (100% byte match).
- **No Commits**: `git status` shows only untracked docs/logs and gitignore updates.
