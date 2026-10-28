/**
 * @file shared/receipt/schema.js
 * Contract and validation schema for the Aswanna SO3 Receipt Reader draft output.
 * 
 * Rules:
 * 1. Extraction result is strictly a DRAFT.
 * 2. Never auto-creates an Expense.
 * 3. All monetary values are integer LKR (rounded/floored, never fractional cents).
 * 4. categoryTag must be strictly one of CATEGORY_TAGS; unknown or invalid maps to null (never invent a category).
 * 5. Phase 1 scope: printed receipts, English + Sinhala only. No Tamil.
 * 6. Single image per request.
 * 7. Optional per-item bbox as normalized floats [x, y, w, h] in 0-1.
 * 8. Optional receipt-level discount and tax (integer LKR). Validation: sum(lineTotals) - discount + tax vs printedTotal.
 *    Never allocate adjustments across lines silently.
 */

import { CATEGORY_TAGS } from '../categoryMap.js';

export { CATEGORY_TAGS };

export const RECEIPT_SCHEMA_VERSION = '1.0.0';

/**
 * Storage and file upload constraints for receipt images
 */
export const RECEIPT_UPLOAD_LIMITS = Object.freeze({
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  ALLOWED_MIME_TYPES: Object.freeze([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic'
  ]),
  DEFAULT_RETENTION_DAYS: 7,
  MIN_RETENTION_DAYS: 1,
  MAX_RETENTION_DAYS: 90
});

/**
 * Standard error and warning flag codes emitted during extraction/validation
 */
export const RECEIPT_FLAG_CODES = Object.freeze({
  TOTAL_MISMATCH: 'TOTAL_MISMATCH',
  LINE_CALCULATION_MISMATCH: 'LINE_CALCULATION_MISMATCH',
  UNKNOWN_CATEGORY: 'UNKNOWN_CATEGORY',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  DATE_IN_FUTURE: 'DATE_IN_FUTURE',
  DATE_UNPARSEABLE: 'DATE_UNPARSEABLE',
  MISSING_LINE_ITEMS: 'MISSING_LINE_ITEMS',
  SUSPICIOUS_AMOUNT: 'SUSPICIOUS_AMOUNT',
  INVALID_BBOX: 'INVALID_BBOX'
});

/**
 * Supported document language codes detected by the OCR/VLM in Phase 1.
 * English + Sinhala only. Tamil is not in Phase 1.
 */
export const RECEIPT_LANGUAGES = Object.freeze(['si', 'en', 'mixed', 'unknown']);

/**
 * Helper to ensure a monetary value is an integer LKR, or null.
 * Rejects negative numbers or unparseable inputs.
 *
 * @param {any} val
 * @returns {number|null}
 */
export function toIntegerLkr(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

/**
 * Normalizes a category tag.
 * MUST be one of the 8 existing CATEGORY_TAGS.
 * Any unknown or unrecognized string maps strictly to null. NEVER invent categories.
 *
 * @param {any} tag
 * @returns {string|null}
 */
export function normalizeCategoryTag(tag) {
  if (typeof tag !== 'string') return null;
  const cleaned = tag.trim().toLowerCase();
  if (CATEGORY_TAGS.includes(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Validates optional bounding box [x, y, w, h] where values are floats in [0, 1].
 *
 * @param {any} bbox
 * @returns {number[]|null}
 */
export function validateBBox(bbox) {
  if (!bbox) return null;
  if (!Array.isArray(bbox) || bbox.length !== 4) return null;
  const isValid = bbox.every(
    (coord) => typeof coord === 'number' && !Number.isNaN(coord) && coord >= 0.0 && coord <= 1.0
  );
  if (!isValid) return null;
  return bbox.map((coord) => Math.round(coord * 10000) / 10000);
}

/**
 * Sanitizes and validates a single extracted line item.
 *
 * @param {any} item
 * @param {number} index
 * @param {Array} flags
 * @returns {object}
 */
export function sanitizeReceiptItem(item, index, flags = []) {
  if (!item || typeof item !== 'object') {
    flags.push({
      code: 'INVALID_ITEM',
      field: `items[${index}]`,
      message: `Item at index ${index} is not an object`
    });
    return {
      description: 'Unknown item',
      quantity: null,
      unit: null,
      unitPrice: null,
      lineTotal: null,
      categoryTag: null,
      confidence: 0.0,
      bbox: null
    };
  }

  const rawDescription = typeof item.description === 'string' ? item.description.trim() : '';
  const description = rawDescription || 'Unlabeled Item';

  const quantity = (item.quantity !== null && item.quantity !== undefined && !Number.isNaN(Number(item.quantity)) && Number(item.quantity) >= 0)
    ? Number(item.quantity)
    : null;

  const unit = typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim().toLowerCase() : null;

  const unitPrice = toIntegerLkr(item.unitPrice);
  const lineTotal = toIntegerLkr(item.lineTotal);

  // Strictly normalize categoryTag against CATEGORY_TAGS (unknown -> null)
  let categoryTag = null;
  if (item.categoryTag) {
    categoryTag = normalizeCategoryTag(item.categoryTag);
    if (!categoryTag) {
      flags.push({
        code: RECEIPT_FLAG_CODES.UNKNOWN_CATEGORY,
        field: `items[${index}].categoryTag`,
        message: `Unknown category "${item.categoryTag}" mapped to null. Must be reviewed by officer.`
      });
    }
  }

  // Confidence bounding [0.0, 1.0]
  let confidence = typeof item.confidence === 'number' && !Number.isNaN(item.confidence)
    ? Math.max(0.0, Math.min(1.0, item.confidence))
    : 0.5;

  if (confidence < 0.6) {
    flags.push({
      code: RECEIPT_FLAG_CODES.LOW_CONFIDENCE,
      field: `items[${index}]`,
      message: `Low OCR/extraction confidence (${(confidence * 100).toFixed(0)}%) on item: "${description}"`
    });
  }

  // Cross-check arithmetic if quantity, unitPrice, and lineTotal are all present
  if (quantity !== null && unitPrice !== null && lineTotal !== null && quantity > 0 && unitPrice > 0) {
    const expected = Math.round(quantity * unitPrice);
    // Allow slight rounding tolerance (within 2 LKR) due to packaging/tax rounding
    if (Math.abs(expected - lineTotal) > 2) {
      flags.push({
        code: RECEIPT_FLAG_CODES.LINE_CALCULATION_MISMATCH,
        field: `items[${index}].lineTotal`,
        message: `Line total (${lineTotal}) does not match quantity (${quantity}) * unitPrice (${unitPrice}) = ${expected}`
      });
    }
  }

  // Optional bounding box [x, y, w, h] normalized in [0, 1]
  let bbox = null;
  if (item.bbox !== undefined && item.bbox !== null) {
    bbox = validateBBox(item.bbox);
    if (!bbox) {
      flags.push({
        code: RECEIPT_FLAG_CODES.INVALID_BBOX,
        field: `items[${index}].bbox`,
        message: `Bounding box for item "${description}" must be an array of 4 normalized floats [x,y,w,h] between 0 and 1.`
      });
    }
  }

  return {
    description,
    quantity,
    unit,
    unitPrice,
    lineTotal,
    categoryTag,
    confidence,
    bbox
  };
}

/**
 * Validates and normalizes the full AI extraction output payload.
 * Enforces:
 * - schemaVersion tracking
 * - Integer LKR money representation
 * - Strict categoryTag enumeration (unknown -> null)
 * - Optional receipt-level discount and tax (never allocated across lines silently)
 * - Computed sum aggregation & discrepancy detection:
 *     computedTotal = sum(lineTotals) - discount + tax vs printedTotal
 * - Date validation
 * - Flag array generation
 *
 * @param {any} raw
 * @returns {{ isValid: boolean, data: object, errors: string[] }}
 */
export function validateReceiptExtraction(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      data: null,
      errors: ['Extraction payload must be a non-null object']
    };
  }

  const flags = Array.isArray(raw.flags)
    ? raw.flags.filter(f => f && typeof f.code === 'string' && typeof f.message === 'string')
    : [];

  const schemaVersion = typeof raw.schemaVersion === 'string' && raw.schemaVersion.trim()
    ? raw.schemaVersion.trim()
    : RECEIPT_SCHEMA_VERSION;

  // 1. Document Date
  let documentDate = null;
  if (raw.documentDate) {
    const parsedDate = new Date(raw.documentDate);
    if (Number.isNaN(parsedDate.getTime())) {
      flags.push({
        code: RECEIPT_FLAG_CODES.DATE_UNPARSEABLE,
        field: 'documentDate',
        message: `Date "${raw.documentDate}" could not be parsed`
      });
    } else {
      // Check not in future
      const now = new Date();
      if (parsedDate > now) {
        flags.push({
          code: RECEIPT_FLAG_CODES.DATE_IN_FUTURE,
          field: 'documentDate',
          message: `Receipt date ${raw.documentDate} is in the future`
        });
      }
      // Store standard YYYY-MM-DD
      documentDate = parsedDate.toISOString().split('T')[0];
    }
  }

  // 2. Supplier
  const supplier = typeof raw.supplier === 'string' && raw.supplier.trim()
    ? raw.supplier.trim()
    : null;

  // 3. Language (Phase 1: si, en, mixed, unknown only)
  let language = 'unknown';
  if (typeof raw.language === 'string') {
    const langClean = raw.language.trim().toLowerCase();
    if (RECEIPT_LANGUAGES.includes(langClean)) {
      language = langClean;
    } else if (langClean === 'ta') {
      language = 'unknown';
      flags.push({
        code: 'UNSUPPORTED_LANGUAGE',
        field: 'language',
        message: 'Tamil language extraction is outside Phase 1 scope. Treated as unknown.'
      });
    }
  }

  // 4. Line Items
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems.map((item, idx) => sanitizeReceiptItem(item, idx, flags));

  if (items.length === 0) {
    flags.push({
      code: RECEIPT_FLAG_CODES.MISSING_LINE_ITEMS,
      field: 'items',
      message: 'No line items could be detected from the receipt image'
    });
  }

  // 5. Optional Receipt-Level Adjustments (Integer LKR)
  // NEVER allocated across lines silently. Stored strictly at receipt level.
  const discount = toIntegerLkr(raw.discount);
  const tax = toIntegerLkr(raw.tax);

  // 6. Totals (Integer LKR)
  const printedTotal = toIntegerLkr(raw.printedTotal);

  // Compute total from line items that have lineTotal
  const lineItemsSum = items.reduce((acc, it) => acc + (it.lineTotal != null ? it.lineTotal : 0), 0);
  
  // Validation formula: sum(lineTotals) - discount + tax
  const effectiveDiscount = discount || 0;
  const effectiveTax = tax || 0;
  const calculatedNet = items.length > 0 ? (lineItemsSum - effectiveDiscount + effectiveTax) : null;
  const computedTotal = calculatedNet !== null ? Math.max(0, calculatedNet) : null;

  // Check discrepancies between printed and computed total
  if (printedTotal !== null && computedTotal !== null && printedTotal !== computedTotal) {
    flags.push({
      code: RECEIPT_FLAG_CODES.TOTAL_MISMATCH,
      field: 'printedTotal',
      message: `Printed total (${printedTotal} LKR) does not match computed total (${computedTotal} LKR) [sum(lines)=${lineItemsSum} - discount=${effectiveDiscount} + tax=${effectiveTax}]. Difference: ${Math.abs(printedTotal - computedTotal)} LKR.`
    });
  }

  // 7. Overall Confidence [0.0, 1.0]
  let overallConfidence = typeof raw.overallConfidence === 'number' && !Number.isNaN(raw.overallConfidence)
    ? Math.max(0.0, Math.min(1.0, raw.overallConfidence))
    : (items.length > 0 ? items.reduce((acc, it) => acc + it.confidence, 0) / items.length : 0.0);

  overallConfidence = Math.round(overallConfidence * 100) / 100;

  if (overallConfidence < 0.6) {
    flags.push({
      code: RECEIPT_FLAG_CODES.LOW_CONFIDENCE,
      field: 'overallConfidence',
      message: `Overall receipt extraction confidence is low (${(overallConfidence * 100).toFixed(0)}%). Officer must review all fields carefully.`
    });
  }

  const sanitizedData = {
    schemaVersion,
    documentDate,
    supplier,
    language,
    items,
    discount,
    tax,
    printedTotal,
    computedTotal,
    flags,
    overallConfidence
  };

  return {
    isValid: errors.length === 0,
    data: sanitizedData,
    errors
  };
}
