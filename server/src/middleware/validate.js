/**
 * Central schema validation middleware for API endpoints.
 * Rejects unknown fields, enforces max body sizes and string lengths,
 * rejects HTML in text fields, strips control characters, and returns
 * structured 422 errors: { error: { code: 'VALIDATION_ERROR', message, fields: { path: [{code, message, key}] }, warnings: [...] } }.
 */

import { AppError } from '../utils/errors.js';
import { VALIDATION_LIMITS } from '../../../shared/config/validationLimits.js';
import {
  detectHtml,
  stripControlChars,
  sinhalaDigitsToAscii,
  validateField,
} from '../../../shared/validation/index.js';

/**
 * Recursively inspect and sanitize payload:
 * - Rejects HTML in any string
 * - Strips control characters
 * - Enforces max string length
 */
export function sanitizeAndCheckSecurity(obj, path = '', errors = {}) {
  if (obj == null) return obj;

  if (typeof obj === 'string') {
    if (detectHtml(obj)) {
      if (!errors[path]) errors[path] = [];
      errors[path].push({
        code: 'HTML_DETECTED',
        key: 'validation.errors.htmlDetected',
        message: 'HTML tags or scripts are not allowed',
      });
    }

    if (obj.length > VALIDATION_LIMITS.global.maxStringLength) {
      if (!errors[path]) errors[path] = [];
      errors[path].push({
        code: 'MAX_LENGTH',
        key: 'validation.errors.maxLength',
        message: `Field cannot exceed ${VALIDATION_LIMITS.global.maxStringLength} characters`,
      });
    }

    return stripControlChars(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item, idx) => sanitizeAndCheckSecurity(item, path ? `${path}.${idx}` : String(idx), errors));
  }

  if (typeof obj === 'object') {
    const clean = {};
    for (const [key, val] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;
      clean[key] = sanitizeAndCheckSecurity(val, fieldPath, errors);
    }
    return clean;
  }

  return obj;
}

/**
 * Validate request body against schema.
 */
export function validateBody(schema, { strict = true, allowedExtraKeys = [] } = {}) {
  return (req, res, next) => {
    const body = req.body || {};
    const fieldErrors = {};
    const warnings = [];

    // 1. Security scan and control character strip
    const sanitizedBody = sanitizeAndCheckSecurity(body, '', fieldErrors);
    req.body = sanitizedBody;

    // 2. Strict schema check: reject unknown fields
    if (strict && schema) {
      const allowedKeys = new Set(schema.map((f) => f.key.split('.')[0]));
      allowedKeys.add('_id');
      allowedKeys.add('id');
      allowedKeys.add('clientRequestId');
      allowedKeys.add('cycleId');
      allowedKeys.add('farmerId');
      allowedKeys.add('landId');
      allowedExtraKeys.forEach((k) => allowedKeys.add(k));

      for (const key of Object.keys(sanitizedBody)) {
        if (!allowedKeys.has(key)) {
          const errObj = {
            code: 'UNKNOWN_FIELD',
            key: 'validation.errors.unknownField',
            message: `Unknown field '${key}' is not allowed`,
          };
          if (!fieldErrors[key]) fieldErrors[key] = [];
          fieldErrors[key].push(errObj);
          if (!fieldErrors['_root']) fieldErrors['_root'] = [];
          fieldErrors['_root'].push(errObj);
        }
      }
    }

    // 3. Schema field rules validation
    if (schema) {
      for (const field of schema) {
        if (field.computed) continue;
        const val = getPath(sanitizedBody, field.key);
        const resVal = validateField(field, val, sanitizedBody);

        if (resVal.errors.length > 0) {
          if (!fieldErrors[field.key]) fieldErrors[field.key] = [];
          fieldErrors[field.key].push(...resVal.errors);
        }
        if (resVal.warnings.length > 0) {
          warnings.push(...resVal.warnings.map((w) => ({ ...w, path: field.key })));
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields: fieldErrors,
          warnings,
        },
      });
    }

    req.warnings = warnings;
    next();
  };
}

function getPath(obj, path) {
  if (!obj) return undefined;
  if (obj[path] !== undefined) return obj[path];
  const parts = path.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr == null) return undefined;
    curr = curr[p];
  }
  return curr;
}
