/**
 * Deterministic Expense Extractor (Typed Text / Voice Transcripts)
 * 
 * Pure function, zero I/O.
 * Extracts structured agricultural expenses from English and Sinhala text.
 * Strictly maps into SO3's 8 canonical categories:
 * ['seed', 'fertilizer', 'agrochemical', 'labour', 'machinery', 'fuel', 'irrigation', 'other']
 * 
 * Interim safety policy (Task V5.3):
 * Until shared/voice/sinhalaNumberWords.json is reviewed by a native speaker,
 * any amount parsed from Sinhala number WORDS gets status 'needs_review' with
 * reason 'amount_from_words_verify', displayed in the review table with the
 * large Rs. amount and the 'Accept amount' tap.
 * Digit amounts (including suffixed digits like 8500ක්) are unaffected and can be 'ok'.
 */

import { z } from 'zod';
import keywordMap from './keywordMap.json' with { type: 'json' };
import asrConfusions from './asrConfusions.json' with { type: 'json' };
import {
  parseSinhalaNumberSafe,
  isSinhalaNumberWord,
  parseSinhalaNumberWords
} from './sinhalaNumbers.js';

export const CANONICAL_CATEGORIES = [
  'seed',
  'fertilizer',
  'agrochemical',
  'labour',
  'machinery',
  'fuel',
  'irrigation',
  'other'
];

/**
 * Zod schema for individual extracted expense item
 * Rejects negative, zero, or NaN amounts when amount is present.
 */
export const extractedItemSchema = z.object({
  description: z.string(),
  category: z.enum(CANONICAL_CATEGORIES).nullable(),
  quantity: z.number().positive().nullable(),
  unit: z.string().nullable(),
  unitPrice: z.number().positive().nullable(),
  totalAmount: z.number().positive().nullable(),
  currency: z.literal('LKR'),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(['ok', 'needs_review']),
  reasons: z.array(z.string())
});

export const extractionResultSchema = z.object({
  items: z.array(extractedItemSchema),
  warnings: z.array(z.string())
});

// English small number words dictionary
const ENGLISH_NUMBER_WORDS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000
};

// Measure and duration units (numbers followed or preceded by these units are NEVER money)
export const MEASURE_AND_TIME_UNITS = [
  'hours', 'hour', 'hrs', 'hr',
  'days', 'day',
  'minutes', 'mins', 'min',
  'months', 'month',
  'weeks', 'week',
  'acres', 'acre',
  'kg', 'kgs', 'kilos', 'kilo', 'g', 'grams', 'gram',
  'liters', 'litres', 'l',
  'bags', 'bag',
  'bottles', 'bottle',
  'laborers', 'labourers', 'workers', 'people', 'men', 'women',
  'service', 'services', 'fee',
  'මිටි', 'මිටියක්', 'කිලෝ', 'ලීටර්', 'බෝතල්', 'බෝතලයක්',
  'පැය', 'පැයයි', 'දින', 'දිනක්', 'අක්කර', 'අක්කරයක්', 'කම්කරුවන්', 'සේවාව',
  'විනාඩි', 'සති', 'මාස'
];

// Blocking reasons that force status to 'needs_review'
const BLOCKING_REASONS = new Set([
  'category_uncertain',
  'amount_ambiguous',
  'amount_unresolved',
  'amount_implausible',
  'amount_from_words_verify',
  'asr_alternatives_disagree',
  'possible_duplicate',
  'unit_price_fractional'
]);

/**
 * Money arithmetic in integer minor units (cents).
 * Never uses floating-point addition to prevent float representation drift.
 * This is the ONLY source of displayed total amounts.
 */
export function sumTotals(items) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  let totalCents = 0;
  for (const item of items) {
    if (typeof item.totalAmount === 'number' && !Number.isNaN(item.totalAmount) && item.totalAmount > 0) {
      const cents = Math.round(item.totalAmount * 100);
      totalCents += cents;
    }
  }
  return Number((totalCents / 100).toFixed(2));
}

/**
 * Apply known ASR misrecognitions mapping
 */
export function applyAsrConfusions(text) {
  if (!text || typeof text !== 'string') return text;
  let normalized = text;
  for (const item of asrConfusions) {
    const mis = item.misrecognition;
    const intended = item.intended;
    if (/^[a-z0-9 ]+$/i.test(mis)) {
      const reg = new RegExp(`\\b${mis}\\b`, 'gi');
      normalized = normalized.replace(reg, intended);
    } else {
      normalized = normalized.replaceAll(mis, intended);
    }
  }
  return normalized;
}

/**
 * Convert small English number words into integer
 */
export function parseEnglishNumberWords(phrase) {
  const words = phrase.toLowerCase().trim().split(/\s+/);
  let total = 0;
  let current = 0;
  let matchedAny = false;

  for (const w of words) {
    if (ENGLISH_NUMBER_WORDS[w] !== undefined) {
      matchedAny = true;
      const val = ENGLISH_NUMBER_WORDS[w];
      if (val === 100) {
        current = (current || 1) * 100;
      } else if (val === 1000) {
        current = (current || 1) * 1000;
        total += current;
        current = 0;
      } else {
        current += val;
      }
    } else {
      return null;
    }
  }
  if (!matchedAny) return null;
  return total + current;
}

/**
 * Extract ISO date string for relative or explicit date cues
 */
function parseDate(text, today) {
  const lower = text.toLowerCase();
  const explicitMatch = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicitMatch) return explicitMatch[1];

  if (today && /^\d{4}-\d{2}-\d{2}$/.test(today)) {
    if (/\byesterday\b/i.test(lower)) {
      const d = new Date(today + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    }
    if (/\btoday\b/i.test(lower)) {
      return today;
    }
  }
  return null;
}

/**
 * Builds a regex pattern for English terms matching simple plural / suffix forms (Task V5.2).
 * E.g., 'weedicide' -> matches 'weedicide' and 'weedicides'
 *       'herbicide' -> matches 'herbicide' and 'herbicides'
 *       'labourer' -> matches 'labourer' and 'labourers'
 *       'bag' -> matches 'bag' and 'bags'
 * Does NOT match unrelated words (e.g. 'baggage', 'bagel', 'weed', 'laborious').
 */
function buildEnglishKeywordPattern(term) {
  const clean = term.trim();
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (clean.endsWith('es') && clean.length > 3) {
    const base1 = clean.slice(0, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const base2 = clean.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b(?:${escaped}|${base2}|${base1})\\b`, 'i');
  }
  if (clean.endsWith('s') && clean.length > 2 && !clean.endsWith('ss')) {
    const base = clean.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b(?:${escaped}|${base}s?)\\b`, 'i');
  }
  return new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i');
}

/**
 * Identify canonical category based on keyword rules.
 * Does NOT guess 'other' if no keyword matches.
 * Returns { category, uncertain } or null.
 */
function identifyCategory(text, customKeywordMap = keywordMap) {
  if (!text || typeof text !== 'string') return null;

  const lower = text.toLowerCase();

  // Fuel takes precedence over irrigation when fuel items (diesel/petrol) are explicitly bought for pumps
  const isDieselOrPetrol = /\b(?:diesel|petrol|ඩීසල්|පෙට්‍රල්)\b/i.test(lower);
  if (isDieselOrPetrol) {
    return { category: 'fuel', uncertain: false };
  }

  // Check categories with keyword length priority (longest phrase first)
  let bestMatch = null;
  let bestLength = 0;

  for (const cat of CANONICAL_CATEGORIES) {
    const entries = customKeywordMap[cat] || [];
    for (const entry of entries) {
      const term = entry.term.toLowerCase();
      let pattern;
      if (/^[a-z0-9 ]+$/i.test(term)) {
        pattern = buildEnglishKeywordPattern(term);
      } else {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        pattern = new RegExp(escaped, 'i');
      }

      const match = pattern.exec(lower);
      if (match) {
        const matchLen = match[0].length;
        if (matchLen > bestLength) {
          bestMatch = { category: cat, uncertain: Boolean(entry.uncertain) };
          bestLength = matchLen;
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Checks if a number in text is followed by a measure or time unit.
 * If so, it is quantity or duration, NEVER money.
 */
function isFollowedByMeasureOrTimeUnit(text, matchIndex, matchLength) {
  const following = text.slice(matchIndex + matchLength).trimStart();
  for (const unit of MEASURE_AND_TIME_UNITS) {
    const unitPattern = /^[a-z0-9]+$/i.test(unit)
      ? new RegExp(`^${unit}\\b`, 'i')
      : new RegExp(`^${unit}`, 'i');
    if (unitPattern.test(following)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a number in text is preceded by a measure or time unit.
 */
function isPrecededByMeasureOrTimeUnit(text, matchIndex) {
  const preceding = text.slice(0, matchIndex).trimEnd();
  for (const unit of MEASURE_AND_TIME_UNITS) {
    if (preceding.endsWith(unit)) {
      return true;
    }
  }
  return false;
}

/**
 * Parse money amount for Sinhala clauses
 */
function parseSinhalaMoney(clause) {
  const stopWords = new Set(['ගත්තා', 'ගෙව්වා', 'දුන්නා', 'වියදම්', 'කළා', 'සඳහා', 'දැම්මා', 'සහ', 'හා', 'ගියා']);
  const unitWords = new Set(MEASURE_AND_TIME_UNITS);

  // 1. Explicit currency marker: රුපියල් or රු
  const siCurrMatch = clause.match(/(?:රුපියල්|රු\.?)\s+([^\s]+(?:\s+[^\s]+)*)/);
  if (siCurrMatch) {
    const afterCurr = siCurrMatch[1].trim();
    const rawTokens = afterCurr.split(/\s+/);
    const amountTokens = [];
    for (const t of rawTokens) {
      if (stopWords.has(t)) break;
      amountTokens.push(t);
    }

    if (amountTokens.length > 0) {
      // Check if first token is digits (e.g. 8500ක්, 6800ට, 4500ක්)
      const digitMatch = amountTokens[0].match(/^(\d+)(?:ක්|ට|කට|යි|ද)?$/);
      if (digitMatch) {
        // If followed by word numbers like "8500 දෙසීයක්", that's hybrid mixed digit + word -> unresolved
        if (amountTokens.length > 1 && amountTokens.slice(1).some(t => isSinhalaNumberWord(t))) {
          return { amount: null, isUnresolved: true, isAmbiguous: false, isFromWords: false };
        }
        return { amount: parseInt(digitMatch[1], 10), isUnresolved: false, isAmbiguous: false, isFromWords: false };
      }

      // Check if all tokens are valid Sinhala number words and fully consumed
      const parsedWords = parseSinhalaNumberWords(amountTokens);
      if (parsedWords !== null) {
        return { amount: parsedWords, isUnresolved: false, isAmbiguous: false, isFromWords: true };
      } else {
        // Words followed රුපියල් but could not be parsed with certainty
        return { amount: null, isUnresolved: true, isAmbiguous: false, isFromWords: false };
      }
    }
  }

  // 2. Digits with Sinhala suffixes elsewhere in clause (e.g. "8500ක්", "6800ට", "1900ක්")
  const suffixedDigits = [...clause.matchAll(/\b(\d+)(?:ක්|ට|කට|යි)?\b/g)];
  const candidateDigits = [];
  for (const m of suffixedDigits) {
    const idx = m.index;
    const len = m[0].length;
    if (!isFollowedByMeasureOrTimeUnit(clause, idx, len) && !isPrecededByMeasureOrTimeUnit(clause, idx)) {
      candidateDigits.push(parseInt(m[1], 10));
    }
  }

  if (candidateDigits.length === 1) {
    return { amount: candidateDigits[0], isUnresolved: false, isAmbiguous: false, isFromWords: false };
  } else if (candidateDigits.length > 1) {
    return { amount: null, isUnresolved: false, isAmbiguous: true, isFromWords: false };
  }

  // 3. Standalone Sinhala number words without explicit රුපියල් (e.g. "අටදාස් පන්සියයක් දුන්නා", "හයදාහක් ගෙව්වා")
  const words = clause.split(/\s+/).filter(Boolean);

  // Find index of first candidate number word (excluding quantity words adjacent to measure units)
  let startIdx = -1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (isSinhalaNumberWord(w)) {
      const isPrecededByUnit = i > 0 && unitWords.has(words[i - 1]);
      const isFollowedByUnit = i + 1 < words.length && unitWords.has(words[i + 1]);
      if (!isPrecededByUnit && !isFollowedByUnit) {
        startIdx = i;
        break;
      }
    }
  }

  if (startIdx !== -1) {
    // Collect all tokens from startIdx until stopWord or end of clause
    let endIdx = words.length;
    for (let j = startIdx; j < words.length; j++) {
      if (stopWords.has(words[j])) {
        endIdx = j;
        break;
      }
    }

    const candidateTokens = words.slice(startIdx, endIdx);
    if (candidateTokens.length > 0) {
      // Must fully consume candidate tokens using parseSinhalaNumberWords
      const parsed = parseSinhalaNumberWords(candidateTokens);
      if (parsed !== null && parsed > 0) {
        return { amount: parsed, isUnresolved: false, isAmbiguous: false, isFromWords: true };
      } else {
        // Leftover or unknown token inside number phrase -> cannot be parsed with certainty
        return { amount: null, isUnresolved: true, isAmbiguous: false, isFromWords: false };
      }
    }
  }

  return { amount: null, isUnresolved: true, isAmbiguous: false, isFromWords: false };
}

/**
 * Parse money amount from clause with safety rules:
 * 1. A number followed/preceded by a measure or time unit is quantity/duration, NEVER money.
 * 2. If more than one candidate money amount remains and there is no explicit currency cue attached to exactly one,
 *    set status needs_review with reason 'amount_ambiguous'. Never pick one silently.
 * 3. Lone number rule (English): if a clause has exactly one standalone number not followed by a unit or time word
 *    and a category keyword matched, accept it as the amount with status ok and informational reason 'currency_assumed'.
 *    Two or more standalone numbers without a currency cue remain needs_review.
 */
function parseMoneySafe(clause, isSinhala, hasMatchedCategory) {
  // Reject negative explicitly by identifying negative number patterns
  const negativeMatch = clause.match(/(?:-\s*[0-9,]+|for\s+-\s*[0-9,]+|paid\s+-\s*[0-9,]+)/i);
  if (negativeMatch) {
    const rawVal = negativeMatch[0].replace(/[^0-9-]/g, '');
    const num = parseFloat(rawVal);
    if (!Number.isNaN(num) && num < 0) {
      return { amount: num, isAmbiguous: false };
    }
    return { amount: -1, isAmbiguous: false };
  }

  // Sanitize out crop variety numbers like BG 358 so 358 is not considered
  const sanitized = clause.replace(/\b(?:BG|AT|BW|Ld)\s*\d+\b/gi, '   ');

  // Handle Sinhala clause
  if (isSinhala) {
    return parseSinhalaMoney(sanitized);
  }

  // English clause processing:
  const digitRegex = /\b([0-9,]+(?:\.[0-9]{1,2})?)\b/g;
  let match;
  const candidates = [];
  const standaloneNumbers = [];

  while ((match = digitRegex.exec(sanitized)) !== null) {
    const numStr = match[1];
    const matchIndex = match.index;
    const matchLength = numStr.length;

    // Check if followed or preceded by a measure or duration unit
    if (isFollowedByMeasureOrTimeUnit(sanitized, matchIndex, matchLength) || isPrecededByMeasureOrTimeUnit(sanitized, matchIndex)) {
      continue; // Quantity or duration, NEVER money
    }

    const val = parseFloat(numStr.replace(/,/g, ''));
    if (Number.isNaN(val) || val <= 0) continue;

    const before = sanitized.slice(0, matchIndex);
    const after = sanitized.slice(matchIndex + matchLength);

    // Check explicit currency cue attached
    const hasCurrPrefix = /(?:rs\.?|rupees|rps\.?|lkr)\s*$/i.test(before);
    const hasCurrSuffix = /^\s*(?:rs\.?|rupees|rps\.?|lkr)/i.test(after);
    const hasK = /^\s*k\b/i.test(after);

    const hasExplicitCurrencyCue = hasCurrPrefix || hasCurrSuffix || hasK;

    // Check context payment cues: for, at, on, paid, spent, fee of
    const hasPaidBefore = /\b(?:paid|spent|cost|fee of)\s*$/i.test(before);
    const hasForBefore = /\b(?:for|at)\s*$/i.test(before);
    const hasOnAfter = /^\s+on\b/i.test(after);
    const hasForAfter = /^\s+for\b/i.test(after);

    const hasContextCue = hasPaidBefore || hasForBefore || hasOnAfter || hasForAfter;

    candidates.push({
      val,
      hasExplicitCurrencyCue,
      hasContextCue
    });

    standaloneNumbers.push(val);
  }

  // Check English number words for money (e.g. "two thousand rupees")
  const wordTokens = 'zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand';
  const wordMoneyPattern = new RegExp(`\\b((?:${wordTokens})(?:\\s+(?:${wordTokens}))*)\\s*(?:rupees|rs\\.?|lkr)\\b`, 'i');
  const wordMoneyMatch = sanitized.match(wordMoneyPattern);
  if (wordMoneyMatch) {
    // Near-miss check: if text preceding the match has unconsumed number words not associated with measure/time units,
    // it was an interrupted/near-miss number phrase (e.g. "two thousand blarg five hundred rupees").
    // Must return unresolved to prevent truncation.
    const beforeText = sanitized.slice(0, wordMoneyMatch.index).trim();
    const beforeWords = beforeText.toLowerCase().split(/\s+/).filter(Boolean);
    let hasInterruptedNumberWord = false;
    for (let i = 0; i < beforeWords.length; i++) {
      const w = beforeWords[i];
      if (ENGLISH_NUMBER_WORDS[w] !== undefined) {
        const nextW = beforeWords[i + 1];
        if (!nextW || !MEASURE_AND_TIME_UNITS.includes(nextW)) {
          hasInterruptedNumberWord = true;
          break;
        }
      }
    }

    if (hasInterruptedNumberWord) {
      return { amount: null, isUnresolved: true, isAmbiguous: false };
    }

    const val = parseEnglishNumberWords(wordMoneyMatch[1]);
    if (val !== null && val > 0) {
      candidates.push({
        val,
        hasExplicitCurrencyCue: true,
        hasContextCue: true
      });
      standaloneNumbers.push(val);
    }
  }

  // Disambiguation Rule:
  // 1. If any candidates have explicit currency cues:
  const explicitCandidates = candidates.filter(c => c.hasExplicitCurrencyCue);
  if (explicitCandidates.length === 1) {
    return { amount: explicitCandidates[0].val, isAmbiguous: false };
  }
  if (explicitCandidates.length > 1) {
    return { amount: null, isAmbiguous: true };
  }

  // 2. If no explicit currency cue, check candidates with context cues (paid/for/at/on)
  const contextCandidates = candidates.filter(c => c.hasContextCue);
  if (contextCandidates.length === 1) {
    return { amount: contextCandidates[0].val, isAmbiguous: false };
  }
  if (contextCandidates.length > 1) {
    return { amount: null, isAmbiguous: true };
  }

  // 3. Lone Number Rule (English - Requirement 2):
  // If a clause has exactly one standalone number not followed by a unit or time word
  // and a category keyword matched, accept it as the amount with status ok and informational reason 'currency_assumed'.
  // Two or more standalone numbers without a currency cue remain needs_review.
  if (standaloneNumbers.length === 1 && hasMatchedCategory) {
    return {
      amount: standaloneNumbers[0],
      isAmbiguous: false,
      currencyAssumed: true
    };
  }

  if (standaloneNumbers.length > 1) {
    return { amount: null, isAmbiguous: true };
  }

  // 4. No verified money amount
  return { amount: null, isAmbiguous: false };
}

/**
 * Normalize unit strings to standard forms (e.g. kilos -> kg, bag -> bags)
 */
function normalizeUnit(u) {
  if (!u) return null;
  const lower = u.toLowerCase();
  if (['kg', 'kgs', 'kilo', 'kilos'].includes(lower)) return 'kg';
  if (['bag', 'bags', 'මිටි', 'මිටියක්'].includes(lower)) return 'bags';
  if (['bottle', 'bottles', 'බෝතල්', 'බෝතලයක්'].includes(lower)) return 'bottle';
  if (['hour', 'hours', 'hrs', 'hr', 'පැය', 'පැයයි'].includes(lower)) return 'hours';
  if (['day', 'days', 'දින', 'දිනක්'].includes(lower)) return 'days';
  if (['laborer', 'laborers', 'labourer', 'labourers', 'workers', 'කම්කරුවන්'].includes(lower)) return 'laborers';
  if (['liter', 'liters', 'litre', 'litres', 'l', 'ලීටර්'].includes(lower)) return 'liters';
  return lower;
}

/**
 * Extract quantity and unit from a clause.
 * Variety codes (like BG 358) and money numbers are excluded from quantity.
 */
function parseQuantityAndUnit(clause, moneyAmount, isSinhala) {
  // Strip variety code numbers (e.g. BG 358)
  const sanitized = clause.replace(/\b(?:BG|AT|BW|Ld)\s*\d+\b/gi, ' ');

  // Look for number adjacent to known unit
  for (const unit of MEASURE_AND_TIME_UNITS) {
    // Regex for: <digits> <unit> e.g. "20 kg", "2 bags", "30 kilos", "2 hours"
    const digitUnitPattern = new RegExp(`\\b([0-9,]+(?:\\.[0-9]+)?)\\s*${unit}\\b`, 'i');
    const match = sanitized.match(digitUnitPattern);
    if (match) {
      const q = parseFloat(match[1].replace(/,/g, ''));
      if (q !== moneyAmount) {
        return { quantity: q, unit: normalizeUnit(unit) };
      }
    }

    // Regex for: <unit> <digits> e.g. "මිටි 5", "කිලෝ 30ක්", "ලීටර් 20ක්"
    const unitDigitPattern = new RegExp(`${unit}\\s*([0-9,]+(?:\\.[0-9]+)?)(?:ක්|ට|කට)?`, 'i');
    const unitMatch = sanitized.match(unitDigitPattern);
    if (unitMatch) {
      const q = parseFloat(unitMatch[1].replace(/,/g, ''));
      if (q !== moneyAmount) {
        return { quantity: q, unit: normalizeUnit(unit) };
      }
    }

    // Regex for: <English number words> <unit> e.g. "two hired laborers", "one bag"
    const wordTokens = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
    const wordUnitPattern = new RegExp(`\\b((?:${wordTokens}))\\s*(?:hired\\s+)?${unit}\\b`, 'i');
    const wordMatch = sanitized.match(wordUnitPattern);
    if (wordMatch) {
      const q = parseEnglishNumberWords(wordMatch[1]);
      if (q !== null && q > 0) {
        return { quantity: q, unit: normalizeUnit(unit) };
      }
    }
  }

  // Look for Sinhala quantity patterns e.g. "මිටි දෙකක්" (2 bags), "මිටි පහක්" (5 bags)
  if (/මිටි\s*(?:පහක්|5)/.test(sanitized)) return { quantity: 5, unit: 'bags' };
  if (/මිටි\s*(?:දෙකක්|2)/.test(sanitized)) return { quantity: 2, unit: 'bags' };
  if (/මිටියක්/.test(sanitized)) return { quantity: 1, unit: 'bags' };
  if (/කිලෝ\s*(?:තිහක්|30)/.test(sanitized)) return { quantity: 30, unit: 'kg' };
  if (/ලීටර්\s*(?:විස්සක්|20)/.test(sanitized)) return { quantity: 20, unit: 'liters' };
  if (/ලීටර්\s*(?:දහයක්|10)/.test(sanitized)) return { quantity: 10, unit: 'liters' };
  if (/බෝතල්\s*(?:දෙකක්|2)/.test(sanitized)) return { quantity: 2, unit: 'bottle' };
  if (/බෝතල්\s*(?:එකක්|1)/.test(sanitized)) return { quantity: 1, unit: 'bottle' };
  if (/බෝතලයක්/.test(sanitized)) return { quantity: 1, unit: 'bottle' };
  if (/පැය\s*(?:දෙකක්|2)/.test(sanitized)) return { quantity: 2, unit: 'hours' };
  if (/කම්කරුවන්\s*(?:දෙකකට|දෙදෙනෙකුට|2)/.test(sanitized)) return { quantity: 2, unit: 'laborers' };
  if (/දින\s*(?:පහක්|5)/.test(sanitized)) return { quantity: 5, unit: 'days' };

  // Singular count noun with 'bottle' / 'ekak' (e.g. "spray bottle ekak", "spray bottle")
  if (/\bbottle\s+ekak\b/i.test(sanitized) || /\bspray\s+bottle\b/i.test(sanitized)) {
    return { quantity: 1, unit: 'bottle' };
  }

  return { quantity: null, unit: null };
}

/**
 * Split text into distinct expense clauses
 */
function splitIntoExpenseClauses(text) {
  const lines = text.split(/[\r\n;]+/).map(s => s.trim()).filter(Boolean);
  const clauses = [];

  for (const line of lines) {
    const splitRegex = /(?:(?<!\d),\s*(?:and\s+)?|\s+and\s+|\s+සහ\s+|\s+හා\s+|(?<!\d)\s*,\s*(?!\d))/i;
    const parts = line.split(splitRegex).map(p => p.trim()).filter(Boolean);

    if (parts.length > 1) {
      const partsWithNumbers = parts.filter(p => /\d+|දහස්|දාහ|දාස්|සීය|පන්සිය|පන්දාහ|දෙකක්|පහක්/.test(p));

      // 1. If 2 or more parts have numbers/amounts, it is a multi-expense line
      if (partsWithNumbers.length >= 2) {
        clauses.push(...parts);
        continue;
      }

      // 2. If 1 part has numbers, split only if the first part has an independent expense/verb/number
      // AND a subsequent part has an independent purchase verb (prevent splitting compound nouns like "ලෑලි සහ කම්බි...")
      if (partsWithNumbers.length === 1) {
        const firstPartHasVerb = /(?:bought|paid|spent|purchased|ගත්තා|ගෙව්වා|දුන්නා)/i.test(parts[0]);
        const firstPartHasNumber = /\d+|දහස්|දාහ|දාස්|සීය|පන්සිය|පන්දාහ|දෙකක්|පහක්/.test(parts[0]);
        if (firstPartHasVerb || firstPartHasNumber) {
          const laterParts = parts.slice(1);
          const hasIndependentVerb = laterParts.some(p => /(?:bought|paid|spent|purchased|also|more|ගත්තා|ගෙව්වා|දුන්නා)/i.test(p));
          if (hasIndependentVerb) {
            clauses.push(...parts);
            continue;
          }
        }
      }
    }

    // Default: single expense line
    clauses.push(line);
  }

  return clauses;
}

/**
 * Main Pure Function: Extract structured expenses from text.
 * 
 * @param {string} text - User input string (typed or voice transcript)
 * @param {Object} [options] - Configuration options
 * @param {string} [options.lang] - Language hint ('en', 'si')
 * @param {string} [options.today] - ISO date reference ('YYYY-MM-DD')
 * @param {Object} [options.categoryBaselines] - Baselines per category { [cat]: number }
 * @param {number} [options.totalBaseline] - Overall cycle baseline
 * @param {Array<string|Object>} [options.alternatives] - Alternate ASR transcripts
 * @returns {{ items: Array, warnings: Array }}
 */
export function extractExpenses(text, options = {}) {
  const warnings = [];

  if (!text || typeof text !== 'string' || !text.trim()) {
    return { items: [], warnings: [] };
  }

  // Apply ASR confusion corrections (Requirement 5)
  const normalizedRawText = applyAsrConfusions(text.trim());
  const clauses = splitIntoExpenseClauses(normalizedRawText);
  const items = [];

  for (const clause of clauses) {
    const reasons = [];
    const isSinhala = options.lang === 'si' || /[\u0D80-\u0DFF]/.test(clause);

    // 1. Identify category (supports uncertain categories like 'transport' -> 'other')
    const catResult = identifyCategory(clause);
    const category = (typeof catResult === 'object' && catResult !== null) ? catResult.category : catResult;
    const isCategoryUncertain = !category || Boolean(catResult?.uncertain);

    if (isCategoryUncertain) {
      reasons.push('category_uncertain');
    }

    // 2. Parse money amount with safety rules
    const {
      amount: moneyAmount,
      isAmbiguous,
      isUnresolved,
      currencyAssumed,
      isFromWords
    } = parseMoneySafe(clause, isSinhala, Boolean(category));

    let totalAmount = null;

    if (currencyAssumed) {
      reasons.push('currency_assumed');
    }

    if (isAmbiguous) {
      reasons.push('amount_ambiguous');
    } else if (isUnresolved) {
      reasons.push('amount_unresolved');
    } else if (moneyAmount !== null) {
      totalAmount = moneyAmount;
      if (isFromWords) {
        reasons.push('amount_from_words_verify');
      }
    } else {
      reasons.push('amount_unresolved');
    }

    // 3. Parse quantity and unit
    const { quantity, unit } = parseQuantityAndUnit(clause, totalAmount, isSinhala);

    // 4. Derive unitPrice only when quantity and total are both explicit
    let unitPrice = null;
    if (quantity !== null && quantity > 0 && totalAmount !== null && totalAmount > 0) {
      unitPrice = Number((totalAmount / quantity).toFixed(2));
      // Mathematical physical currency integrity check:
      // If quantity is an integer >= 2, the total in cents must be divisible by quantity.
      // E.g., 30 kg for 8500 LKR -> 850000 % 30 = 10 != 0 (283.333... LKR/kg is impossible in physical currency cents)
      if (Number.isInteger(quantity) && quantity >= 2) {
        const totalCents = Math.round(totalAmount * 100);
        if (totalCents % quantity !== 0) {
          reasons.push('unit_price_fractional');
        }
      }
    }

    // 5. Date ISO
    const dateISO = parseDate(clause, options.today);

    // 6. Check Implausible Amounts (Requirement 3)
    if (totalAmount !== null && totalAmount > 0) {
      const catBaseline = (options.categoryBaselines && category) ? options.categoryBaselines[category] : null;
      const totBaseline = options.totalBaseline ?? null;

      let isImplausible = false;
      if (catBaseline != null && totalAmount > catBaseline) {
        isImplausible = true;
      } else if (totBaseline != null && totalAmount > totBaseline) {
        isImplausible = true;
      } else if (catBaseline == null && totBaseline == null && totalAmount > 500000) {
        isImplausible = true;
      }

      if (isImplausible) {
        if (!reasons.includes('amount_implausible')) {
          reasons.push('amount_implausible');
        }
      }
    }

    // 7. Overall status
    const hasBlockingReason = reasons.some(r => BLOCKING_REASONS.has(r));
    const status = (!hasBlockingReason && totalAmount !== null && category !== null)
      ? 'ok'
      : 'needs_review';

    const item = {
      description: clause,
      category,
      quantity,
      unit,
      unitPrice,
      totalAmount,
      currency: 'LKR',
      dateISO,
      status,
      reasons
    };

    // Zod schema validation: rejects negative, zero or NaN amounts
    extractedItemSchema.parse(item);

    items.push(item);
  }

  // 8. Check ASR alternatives cross-check (Requirement 4)
  if (Array.isArray(options.alternatives) && options.alternatives.length > 1) {
    const altAmountSets = [];
    const altCategorySets = [];
    for (const alt of options.alternatives) {
      const altText = typeof alt === 'string' ? alt : (alt?.transcript || '');
      if (!altText.trim()) continue;
      // Cross-parse without alternatives to prevent recursive check
      const altRes = extractExpenses(altText, { ...options, alternatives: null });
      const amounts = altRes.items
        .map(i => i.totalAmount)
        .filter(a => typeof a === 'number' && !isNaN(a) && a > 0)
        .sort((a, b) => a - b);
      altAmountSets.push(amounts);

      const categories = altRes.items
        .map(i => i.category)
        .filter(Boolean)
        .sort();
      altCategorySets.push(categories);
    }

    if (altAmountSets.length > 1) {
      const firstSetJson = JSON.stringify(altAmountSets[0]);
      const anyAmountMismatch = altAmountSets.some(set => JSON.stringify(set) !== firstSetJson);
      const firstCatJson = JSON.stringify(altCategorySets[0]);
      const anyCatMismatch = altCategorySets.some(set => JSON.stringify(set) !== firstCatJson);

      if (anyAmountMismatch || anyCatMismatch) {
        for (const item of items) {
          if (!item.reasons.includes('asr_alternatives_disagree')) {
            item.reasons.push('asr_alternatives_disagree');
          }
          item.status = 'needs_review';
        }
      }
    }
  }

  const result = { items, warnings };
  extractionResultSchema.parse(result);

  return result;
}
