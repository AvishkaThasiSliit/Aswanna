/**
 * Shared validators and rule checkers for Aswanna.
 * Provides consistent validation across client forms, API routes, and Mongoose models.
 */

import {
  sinhalaDigitsToAscii,
  normalizePhone,
  stripThousandsSeparators,
  trim,
} from './normalizers.js';
import { VALIDATION_LIMITS } from '../config/validationLimits.js';

/**
 * Check if text contains HTML tags, script elements, or javascript: pseudo-protocols.
 */
export function detectHtml(str) {
  if (typeof str !== 'string') return false;
  const htmlRegex = /<\s*(\/)?\s*[a-zA-Z][^>]*>|<\s*script[\s\S]*?>|javascript:\s*|data:\s*text\/html/i;
  return htmlRegex.test(str);
}

/**
 * Leap year check.
 */
export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Validate Sri Lankan National Identity Card (NIC).
 * Supports Old NIC (9 digits + V/X) and New NIC (12 digits).
 * Cross-validates birth year if dateOfBirth is supplied.
 * Validates days of year part (001-366 for male, 501-866 for female).
 */
export function validateNIC(nic, dateOfBirth = null) {
  const errors = [];
  const warnings = [];

  if (!nic || typeof nic !== 'string' || !nic.trim()) {
    return { isValid: true, errors, warnings };
  }

  const clean = sinhalaDigitsToAscii(nic.trim()).toUpperCase();

  // Pattern check
  const isOld = VALIDATION_LIMITS.farmer.nic.oldPattern.test(clean);
  const isNew = VALIDATION_LIMITS.farmer.nic.newPattern.test(clean);

  if (!isOld && !isNew) {
    errors.push({
      code: 'NIC_FORMAT',
      key: 'validation.errors.nicFormat',
      message: 'NIC must be 9 digits followed by V/X or 12 digits',
    });
    return { isValid: false, errors, warnings };
  }

  let year;
  let dayOfYear;

  if (isOld) {
    year = 1900 + parseInt(clean.slice(0, 2), 10);
    dayOfYear = parseInt(clean.slice(2, 5), 10);
  } else {
    year = parseInt(clean.slice(0, 4), 10);
    dayOfYear = parseInt(clean.slice(4, 7), 10);
  }

  // Days of year validation: 1-366 (male), 501-866 (female)
  const isMale = dayOfYear >= 1 && dayOfYear <= 366;
  const isFemale = dayOfYear >= 501 && dayOfYear <= 866;
  if (!isMale && !isFemale) {
    errors.push({
      code: 'NIC_DAY_RANGE',
      key: 'validation.errors.nicDayRange',
      message: 'NIC day of year component is outside valid range (001-366 or 501-866)',
    });
  }

  // Cross-field birth year check against dateOfBirth
  if (dateOfBirth) {
    const dobDate = new Date(dateOfBirth);
    if (!isNaN(dobDate.getTime())) {
      const dobYear = dobDate.getUTCFullYear();
      if (dobYear !== year) {
        errors.push({
          code: 'NIC_DOB_MISMATCH',
          key: 'validation.errors.nicDobMismatch',
          message: `NIC birth year (${year}) does not match date of birth year (${dobYear})`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    parsed: { year, isFemale: !isMale },
  };
}

/**
 * Validate Sri Lanka telephone number.
 * Must be 10 digits starting with 0 after normalization.
 */
export function validatePhone(phone) {
  const errors = [];
  const warnings = [];

  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return { isValid: true, errors, warnings };
  }

  const normalized = normalizePhone(phone);
  if (!VALIDATION_LIMITS.farmer.phone.pattern.test(normalized)) {
    errors.push({
      code: 'PHONE_FORMAT',
      key: 'validation.errors.phoneFormat',
      message: 'Phone must be a 10-digit Sri Lankan number (e.g. 0712345678)',
    });
    return { isValid: false, errors, warnings };
  }

  return { isValid: true, errors, warnings, normalized };
}

/**
 * Validate Calendar Date.
 * Checks format, valid calendar day (rejects 31 June, 30 Feb, leap violations), and future checks.
 */
export function validateDate(dateVal, { notInFuture = false, minDate = null, maxDate = null, cycleStartDate = null } = {}) {
  const errors = [];
  const warnings = [];

  if (!dateVal) {
    return { isValid: true, errors, warnings };
  }

  const str = typeof dateVal === 'string' ? dateVal.split('T')[0].trim() : '';
  const parts = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) {
    errors.push({
      code: 'DATE_FORMAT',
      key: 'validation.errors.dateFormat',
      message: 'Date must be in YYYY-MM-DD format',
    });
    return { isValid: false, errors, warnings };
  }

  const year = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10);
  const day = parseInt(parts[3], 10);

  if (month < 1 || month > 12) {
    errors.push({
      code: 'DATE_INVALID_CALENDAR',
      key: 'validation.errors.dateInvalidCalendar',
      message: 'Month must be between 1 and 12',
    });
    return { isValid: false, errors, warnings };
  }

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  const maxDays = daysInMonth[month - 1];
  if (day < 1 || day > maxDays) {
    errors.push({
      code: 'DATE_INVALID_CALENDAR',
      key: 'validation.errors.dateInvalidCalendar',
      message: `Invalid calendar date: day ${day} does not exist in month ${month} of year ${year}`,
    });
    return { isValid: false, errors, warnings };
  }

  const d = new Date(Date.UTC(year, month - 1, day));

  if (notInFuture) {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
    if (d > todayUTC) {
      errors.push({
        code: 'DATE_IN_FUTURE',
        key: 'validation.errors.dateInFuture',
        message: 'Date cannot be in the future',
      });
    }
  }

  if (cycleStartDate) {
    const cycleStart = new Date(cycleStartDate);
    if (!isNaN(cycleStart.getTime())) {
      const startDay = new Date(Date.UTC(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth(), cycleStart.getUTCDate()));
      if (d < startDay) {
        errors.push({
          code: 'DATE_BEFORE_CYCLE',
          key: 'validation.errors.dateBeforeCycle',
          message: 'Date cannot be before cultivation cycle start date',
        });
      }
    }
  }

  if (minDate) {
    const minD = new Date(minDate);
    if (d < minD) {
      errors.push({
        code: 'DATE_TOO_EARLY',
        key: 'validation.errors.dateTooEarly',
        message: `Date cannot be earlier than ${minDate}`,
      });
    }
  }

  if (maxDate) {
    const maxD = new Date(maxDate);
    if (d > maxD) {
      errors.push({
        code: 'DATE_TOO_LATE',
        key: 'validation.errors.dateTooLate',
        message: `Date cannot be later than ${maxDate}`,
      });
    }
  }

  return { isValid: errors.length === 0, errors, warnings, date: d };
}

/**
 * Validate integer rupees (non-negative whole number).
 */
export function validateIntegerRupees(val, { min = 0, max = 100000000, required = false } = {}) {
  const errors = [];
  const warnings = [];

  if (val === '' || val == null) {
    if (required) {
      errors.push({ code: 'REQUIRED', key: 'validation.errors.required', message: 'This field is required' });
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  const clean = typeof val === 'string' ? stripThousandsSeparators(sinhalaDigitsToAscii(val.trim())) : val;
  const num = Number(clean);

  if (isNaN(num)) {
    errors.push({ code: 'NUMERIC_REQUIRED', key: 'validation.errors.numericRequired', message: 'Value must be a valid number' });
    return { isValid: false, errors, warnings };
  }

  if (!Number.isInteger(num)) {
    errors.push({ code: 'INTEGER_REQUIRED', key: 'validation.errors.integerRequired', message: 'Amount must be whole rupees (integer)' });
  }

  if (num < min) {
    errors.push({ code: 'MIN_VALUE', key: 'validation.errors.minValue', message: `Amount must be at least ${min} rupees` });
  }

  if (num > max) {
    errors.push({ code: 'MAX_VALUE', key: 'validation.errors.maxValue', message: `Amount cannot exceed ${max} rupees` });
  }

  return { isValid: errors.length === 0, errors, warnings, value: num };
}

/**
 * Validate quantity (positive or non-negative number, optional step).
 */
export function validateQuantity(val, { min = 0, max = 1000000, step = null, integer = false, required = false } = {}) {
  const errors = [];
  const warnings = [];

  if (val === '' || val == null) {
    if (required) {
      errors.push({ code: 'REQUIRED', key: 'validation.errors.required', message: 'This field is required' });
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  const clean = typeof val === 'string' ? stripThousandsSeparators(sinhalaDigitsToAscii(val.trim())) : val;
  const num = Number(clean);

  if (isNaN(num)) {
    errors.push({ code: 'NUMERIC_REQUIRED', key: 'validation.errors.numericRequired', message: 'Value must be a valid number' });
    return { isValid: false, errors, warnings };
  }

  if (integer && !Number.isInteger(num)) {
    errors.push({ code: 'INTEGER_REQUIRED', key: 'validation.errors.integerRequired', message: 'Quantity must be an integer' });
  }

  if (num < min) {
    errors.push({ code: 'MIN_VALUE', key: 'validation.errors.minValue', message: `Quantity must be at least ${min}` });
  }

  if (num > max) {
    errors.push({ code: 'MAX_VALUE', key: 'validation.errors.maxValue', message: `Quantity cannot exceed ${max}` });
  }

  if (step != null && step > 0) {
    const factor = Math.round(1 / step);
    const scaled = Math.round(num * factor);
    if (Math.abs(num - scaled / factor) > 0.0001) {
      errors.push({ code: 'STEP_INVALID', key: 'validation.errors.stepInvalid', message: `Quantity must be in steps of ${step}` });
    }
  }

  return { isValid: errors.length === 0, errors, warnings, value: num };
}

/**
 * Validate Land Code format.
 */
export function validateLandCode(val) {
  const errors = [];
  const warnings = [];

  if (!val || typeof val !== 'string' || !val.trim()) {
    errors.push({ code: 'REQUIRED', key: 'validation.errors.required', message: 'Land code is required' });
    return { isValid: false, errors, warnings };
  }

  const clean = val.trim();
  if (clean.length > VALIDATION_LIMITS.land.landCode.max) {
    errors.push({
      code: 'MAX_LENGTH',
      key: 'validation.errors.maxLength',
      message: `Land code cannot exceed ${VALIDATION_LIMITS.land.landCode.max} characters`,
    });
  }

  if (!VALIDATION_LIMITS.land.landCode.pattern.test(clean)) {
    errors.push({
      code: 'LAND_CODE_FORMAT',
      key: 'validation.errors.landCodeFormat',
      message: 'Land code must contain only letters, numbers, hyphens, and slashes',
    });
  }

  return { isValid: errors.length === 0, errors, warnings, clean };
}

/**
 * Validate generic text field (length, no HTML).
 */
export function validateText(val, { minLength = 0, maxLength = VALIDATION_LIMITS.global.maxStringLength, required = false } = {}) {
  const errors = [];
  const warnings = [];

  if (val == null || (typeof val === 'string' && !val.trim())) {
    if (required) {
      errors.push({ code: 'REQUIRED', key: 'validation.errors.required', message: 'This field is required' });
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  if (typeof val !== 'string') {
    errors.push({ code: 'STRING_REQUIRED', key: 'validation.errors.stringRequired', message: 'Field must be text' });
    return { isValid: false, errors, warnings };
  }

  if (detectHtml(val)) {
    errors.push({ code: 'HTML_DETECTED', key: 'validation.errors.htmlDetected', message: 'HTML and script tags are not allowed' });
  }

  const trimmed = val.trim();
  if (minLength > 0 && trimmed.length < minLength) {
    errors.push({ code: 'MIN_LENGTH', key: 'validation.errors.minLength', message: `Text must be at least ${minLength} characters` });
  }

  if (maxLength > 0 && trimmed.length > maxLength) {
    errors.push({ code: 'MAX_LENGTH', key: 'validation.errors.maxLength', message: `Text cannot exceed ${maxLength} characters` });
  }

  return { isValid: errors.length === 0, errors, warnings, clean: trimmed };
}

/**
 * Validate single field against its schema definition.
 */
export function validateField(fieldDef, value, allValues = {}, context = {}) {
  const errors = [];
  const warnings = [];

  if (!fieldDef) return { isValid: true, errors, warnings };

  const rules = fieldDef.rules || {};
  const isRequired = fieldDef.required || rules.required;

  // Handle requiredIf condition
  let conditionRequired = isRequired;
  if (rules.requiredIf) {
    const { field, equals, notEquals } = rules.requiredIf;
    const targetVal = allValues[field];
    if (equals !== undefined && targetVal === equals) {
      conditionRequired = true;
    }
    if (notEquals !== undefined && targetVal !== notEquals) {
      conditionRequired = true;
    }
  }

  // Handle requiredUnless condition
  if (fieldDef.requiredUnless) {
    const [targetField, targetVal] = Object.entries(fieldDef.requiredUnless)[0] || [];
    if (allValues[targetField] === targetVal) {
      conditionRequired = false;
    }
  }

  const isEmpty = value === '' || value == null || (typeof value === 'string' && !value.trim());

  if (isEmpty) {
    if (conditionRequired) {
      errors.push({
        code: 'REQUIRED',
        key: 'validation.errors.required',
        message: `${fieldDef.labelEn || fieldDef.key} is required`,
      });
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  // HTML tag rejection on any text input
  if (typeof value === 'string' && detectHtml(value)) {
    errors.push({
      code: 'HTML_DETECTED',
      key: 'validation.errors.htmlDetected',
      message: 'HTML tags or scripts are not allowed',
    });
  }

  // Min and max string length
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      errors.push({
        code: 'MIN_LENGTH',
        key: 'validation.errors.minLength',
        message: `Value must be at least ${rules.minLength} characters`,
      });
    }
    const maxLen = rules.maxLength || (fieldDef.type === 'text' ? VALIDATION_LIMITS.global.maxStringLength : null);
    if (maxLen && value.length > maxLen) {
      errors.push({
        code: 'MAX_LENGTH',
        key: 'validation.errors.maxLength',
        message: `Value cannot exceed ${maxLen} characters`,
      });
    }
  }

  // Specific types
  if (fieldDef.key === 'nic') {
    const dob = allValues.dateOfBirth || context.dateOfBirth;
    const res = validateNIC(value, dob);
    errors.push(...res.errors);
    warnings.push(...res.warnings);
  } else if (fieldDef.key === 'phone') {
    const res = validatePhone(value);
    errors.push(...res.errors);
    warnings.push(...res.warnings);
  } else if (fieldDef.key === 'landCode') {
    const res = validateLandCode(value);
    errors.push(...res.errors);
    warnings.push(...res.warnings);
  } else if (fieldDef.type === 'date' || rules.type === 'date') {
    const res = validateDate(value, {
      notInFuture: rules.notInFuture,
      minDate: rules.minDate,
      maxDate: rules.maxDate,
      cycleStartDate: context.cycleStartDate,
    });
    res.errors.forEach(err => {
      if (err.code === 'DATE_IN_FUTURE' && fieldDef.key === 'dateOfBirth') {
        err.key = 'validation.errors.dateOfBirthInFuture';
        err.message = 'Date of birth cannot be in the future';
      }
    });
    errors.push(...res.errors);
    warnings.push(...res.warnings);
  } else if (fieldDef.type === 'number' || rules.type === 'number') {
    let effectiveMax = rules.max;
    if (rules.maxCurrentYear) {
      effectiveMax = new Date().getFullYear();
    }
    if (rules.integer || rules.rupees) {
      const res = validateIntegerRupees(value, {
        min: rules.min ?? 0,
        max: effectiveMax ?? 100000000,
        required: conditionRequired,
      });
      errors.push(...res.errors);
      warnings.push(...res.warnings);
    } else {
      const res = validateQuantity(value, {
        min: rules.min ?? 0,
        max: effectiveMax ?? 1000000,
        step: rules.step,
        integer: rules.integer,
        required: conditionRequired,
      });
      errors.push(...res.errors);
      warnings.push(...res.warnings);
    }
  } else if (fieldDef.type === 'select' || fieldDef.options) {
    const options = fieldDef.options || [];
    if (options.length > 0 && !options.includes(value)) {
      errors.push({
        code: 'ENUM_INVALID',
        key: 'validation.errors.enumInvalid',
        message: `Value '${value}' is not a valid option`,
      });
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

function getVal(obj, path) {
  if (!obj) return undefined;
  if (obj[path] !== undefined) return obj[path];
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Validate an entire entity object against its schema.
 * Rejects unknown fields if strict is true.
 */
export function validateEntity(schema, data = {}, { strict = true, context = {}, allowedExtraKeys = [] } = {}) {
  const fields = {};
  const warnings = [];
  let hasErrors = false;

  const validKeySet = new Set(schema.map((f) => f.key));
  schema.forEach((f) => {
    if (f.key && f.key.includes('.')) {
      validKeySet.add(f.key.split('.')[0]);
    }
  });
  allowedExtraKeys.forEach((k) => validKeySet.add(k));

  // 1. Strict schema: reject unknown top-level fields
  if (strict) {
    for (const key of Object.keys(data)) {
      if (!validKeySet.has(key) && !key.startsWith('_') && key !== 'clientRequestId' && key !== 'id') {
        const errObj = {
          code: 'UNKNOWN_FIELD',
          key: 'validation.errors.unknownField',
          message: `Unknown field '${key}' is not allowed`,
        };
        if (!fields[key]) fields[key] = [];
        fields[key].push(errObj);
        if (!fields['_root']) fields['_root'] = [];
        fields['_root'].push(errObj);
        hasErrors = true;
      }
    }
  }

  // 2. Validate all schema fields
  for (const field of schema) {
    if (field.computed) continue;
    const val = getVal(data, field.key);
    const res = validateField(field, val, data, context);

    if (res.errors.length > 0) {
      if (!fields[field.key]) fields[field.key] = [];
      fields[field.key].push(...res.errors);
      hasErrors = true;
    }
    if (res.warnings.length > 0) {
      warnings.push(...res.warnings.map((w) => ({ ...w, path: field.key })));
    }
  }

  return {
    isValid: !hasErrors,
    errors: fields,
    warnings,
  };
}
