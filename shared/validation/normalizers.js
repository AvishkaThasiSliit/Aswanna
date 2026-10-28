/**
 * Shared input normalizers for Aswanna.
 * Normalizes input text, digits, telephone numbers, and numbers across client, API, and models.
 */

/**
 * Trim leading and trailing whitespace.
 */
export function trim(val) {
  if (typeof val !== 'string') return val;
  return val.trim();
}

/**
 * Strip ASCII control characters while strictly preserving:
 * - \t (tab / 0x09)
 * - \n (linefeed / 0x0A)
 * - \r (carriage return / 0x0D)
 * - All Unicode combining characters & joiners (including U+200D ZWJ and U+200C ZWNJ)
 */
export function stripControlChars(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Normalize Unicode to NFC form while guaranteeing U+200D (ZWJ) and U+200C (ZWNJ)
 * remain preserved for correct Sinhala conjunct rendering (e.g., ක්‍ය, ප්‍ර, ර්‍).
 */
export function normalizeNFC(val) {
  if (typeof val !== 'string') return val;
  // Node / V8 normalize('NFC') preserves U+200D and U+200C
  return val.normalize('NFC');
}

/**
 * Convert Sinhala digits (෦..෯ / U+0DE6..U+0DEF) to ASCII digits (0..9).
 */
export function sinhalaDigitsToAscii(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/[\u0DE6-\u0DEF]/g, (ch) => String(ch.charCodeAt(0) - 0x0DE6));
}

/**
 * Strip thousands separators (commas) from numeric strings.
 * e.g. "1,250,000.50" -> "1250000.50"
 */
export function stripThousandsSeparators(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/,/g, '');
}

/**
 * Collapse consecutive non-newline whitespace into single space.
 * If preserveNewlines is true, preserves newlines (for addresses, notes).
 */
export function collapseWhitespace(val, preserveNewlines = true) {
  if (typeof val !== 'string') return val;
  if (preserveNewlines) {
    return val
      .split('\n')
      .map((line) => line.replace(/[^\S\r\n]+/g, ' ').trim())
      .join('\n')
      .trim();
  }
  return val.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize Sri Lankan phone numbers:
 * - Converts Sinhala digits to ASCII
 * - Strips punctuation, dashes, spaces, parentheses
 * - Converts +94 / 0094 / 94 prefix to 0xxxxxxxxx
 */
export function normalizePhone(val) {
  if (typeof val !== 'string') return val;
  let cleaned = sinhalaDigitsToAscii(val);
  cleaned = cleaned.replace(/[\s\-\(\)\.]+/g, '').trim();
  if (cleaned.startsWith('+94')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('0094')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('94') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * General string normalization pipeline:
 * 1. Convert Sinhala digits to ASCII (if numeric or enabled)
 * 2. NFC normalize
 * 3. Strip control characters
 * 4. Collapse whitespace and trim
 */
export function normalizeString(val, { preserveNewlines = true, convertDigits = false } = {}) {
  if (typeof val !== 'string') return val;
  let result = val;
  if (convertDigits) {
    result = sinhalaDigitsToAscii(result);
  }
  result = normalizeNFC(result);
  result = stripControlChars(result);
  result = collapseWhitespace(result, preserveNewlines);
  return result;
}

/**
 * Normalize numeric input string:
 * 1. Convert Sinhala digits to ASCII
 * 2. Strip commas / thousands separators
 * 3. Strip whitespace
 */
export function normalizeNumericInput(val) {
  if (val == null) return '';
  if (typeof val === 'number') return String(val);
  let str = String(val);
  str = sinhalaDigitsToAscii(str);
  str = stripThousandsSeparators(str);
  return str.trim();
}
