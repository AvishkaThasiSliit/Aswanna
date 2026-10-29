# Aswanna Bill Scanner Specification (Foundation)

**Document**: `docs/bill-scan-spec.md`  
**Module**: `bill-service`  
**Feature Flag**: `BILL_SCAN=off` (default)  
**Status**: DRAFT / SPECIFICATION

---

## 1. Scope & Goals

### 1.1 In Scope
- **Printed Bills and Invoices Only**: Machine-printed retail, wholesale, and distributor receipts commonly encountered in Sri Lankan agriculture:
  - Fertilizer purchases (Agrarian Services centres, private dealers).
  - Seed and planting material receipts.
  - Agro-chemical and pesticide invoices.
  - Fuel receipts (diesel, petrol for two-wheel/four-wheel tractors).
  - Equipment rental and machinery hire receipts.
  - Hardware and irrigation supplies invoices.
- **Languages**: English receipt templates and numerals; Sinhala printed text where font glyphs and language packs are present.

### 1.2 Explicit Non-Goals
- **Handwritten Notes and Chits**: Handwritten text, pocket notebooks, and scribbled slips are **strictly out of scope** for this engine. The engine must flag unstructured or low-confidence text as `needs_review` rather than attempting unconstrained handwriting transcription.
- **Full Form Field Extraction**: Extracting complex multi-column tax breakdowns, multi-page ledger sheets, or complex table structures is not a target. The target is extracting agricultural transaction records: vendor, date, line items, and payable total.

---

## 2. Output Schema

The output schema is designed to integrate seamlessly with the existing Aswanna expense ingest pipeline and shares the canonical structure used by the voice extractor, tagged with source `"bill"`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "BillExtractionResult",
  "type": "object",
  "required": ["source", "vendor", "date", "total", "items", "status", "reasons"],
  "properties": {
    "source": {
      "type": "string",
      "enum": ["bill"]
    },
    "vendor": {
      "type": ["string", "null"],
      "description": "Store or merchant name extracted from the header lines"
    },
    "date": {
      "type": ["string", "null"],
      "format": "date",
      "description": "ISO-8601 date (YYYY-MM-DD), parsed with Sri Lanka DD/MM default"
    },
    "total": {
      "type": ["number", "null"],
      "description": "Total payable amount in Sri Lankan Rupees (LKR), computed from integer cents"
    },
    "items": {
      "type": "array",
      "description": "Line items extracted from the bill body",
      "items": {
        "type": "object",
        "required": ["category", "quantity", "amount", "description", "date", "status", "reasons", "source"],
        "properties": {
          "category": {
            "type": "string",
            "enum": ["fertilizer", "seeds", "fuel", "labor", "transport", "machinery", "chemicals", "other"]
          },
          "quantity": {
            "type": ["number", "null"]
          },
          "amount": {
            "type": "number",
            "description": "Item expenditure in LKR (integer cents / 100)"
          },
          "description": {
            "type": "string"
          },
          "date": {
            "type": ["string", "null"],
            "format": "date"
          },
          "status": {
            "type": "string",
            "enum": ["ok", "needs_review"]
          },
          "reasons": {
            "type": "array",
            "items": { "type": "string" }
          },
          "source": {
            "type": "string",
            "enum": ["bill"]
          }
        }
      }
    },
    "status": {
      "type": "string",
      "enum": ["ok", "needs_review"]
    },
    "reasons": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Machine-readable warnings (e.g. ambiguous_date, sum_mismatch, ocr_digit_confusion, largest_amount_fallback)"
    },
    "rawText": {
      "type": "string",
      "description": "Unmodified OCR character stream for debugging and audit"
    },
    "confidence": {
      "type": ["number", "null"],
      "description": "Mean word confidence score reported by the OCR engine (0.0 to 1.0)"
    }
  }
}
```

---

## 3. Privacy, Storage & Security Rules

1. **Zero Cloud Calls**: OCR processing is 100% offline and strictly runs locally on `127.0.0.1`. No image data or metadata is ever transmitted over the network or to external cloud APIs.
2. **In-Memory Ingest**:
   - Upload payloads are buffered in memory (`io.BytesIO`).
   - Images are **never written to disk** by default.
   - Diagnostic disk persistence is guarded by `BILL_KEEP_IMAGES=on` (default: `off`).
3. **EXIF Stripping**:
   - All EXIF metadata, GPS coordinates, device identifiers, and timestamp tags are stripped in memory upon ingest prior to OCR processing.
4. **MIME & Magic Byte Verification**:
   - Uploads are capped at a maximum body size of **5 MB**.
   - Content-Type headers are untrusted; files are validated strictly by magic byte signatures:
     - PNG: `\x89PNG\r\n\x1a\n` (`89 50 4E 47 0D 0A 1A 0A`)
     - JPEG: `\xFF\xD8\xFF` (`FF D8 FF`)
5. **Git Safeguards**:
   - Raw receipt images, scanned fixtures, and temporary datasets must **never** be committed to Git.
   - `bill-scan-data/` and `bill-service/.venv` are enforced in root `.gitignore`.
6. **Internal Token Authentication**:
   - The standalone service requires `BILL_INTERNAL_TOKEN`.
   - The token has **no hardcoded default**; the service raises an exception and refuses to bind if unset.

---

## 4. Feature Flag & Gating

- **Configuration Flag**: `BILL_SCAN=off` by default.
- When `BILL_SCAN=off`:
  - Bill scanning endpoints return `404 Not Found` or are unmounted.
  - Client interface components remain hidden.
- When `BILL_SCAN=on`:
  - Accessible only under non-production environments unless explicitly enabled by administrative configuration.

---

## 5. Evaluation Plan & Success Metrics

The evaluation protocol is defined **in advance of model training or real dataset collection** to prevent metric gaming.

### 5.1 Primary Success Metric
1. **Silent Error Count (Zero Tolerance Objective)**:
   - **Definition**: The number of incorrect total amounts presented to the user with `status: "ok"` (i.e. without a `needs_review` flag).
   - In financial bookkeeping, presenting a wrong total without warning is a critical failure that corrupts cycle financial balances.
   - If the engine is uncertain or encounters ambiguous text, it must flag the item with `status: "needs_review"`.

### 5.2 Secondary Success Metric
2. **Correct-Total Rate**:
   - **Definition**: The percentage of test bills where the extracted total matches ground truth down to the exact cent, with no human intervention needed.
   - Measured on a held-out test set of verified physical receipts.

*(Target threshold numbers are deliberately not invented prior to empirical baseline evaluation on real test fixtures).*
