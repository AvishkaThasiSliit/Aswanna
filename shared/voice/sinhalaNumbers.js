/**
 * Deterministic Sinhala Number Parser
 * 
 * Pure functions for parsing Sinhala number words and suffixed digits into integers.
 * Used by extractExpenses when lang is 'si' or text contains Sinhala script.
 * 
 * Interim safety policy (Task V5.3):
 * Until shared/voice/sinhalaNumberWords.json is reviewed by a native speaker,
 * any amount parsed from Sinhala number WORDS gets status 'needs_review' with
 * reason 'amount_from_words_verify', displayed in the review table with the
 * large Rs. amount and the 'Accept amount' tap.
 * Digit amounts (including suffixed digits like 8500ක්) are unaffected and can be 'ok'.
 * 
 * Needs native-speaker review.
 */

import sinhalaWordsData from './sinhalaNumberWords.json' with { type: 'json' };

// Build word lookup dictionary
const WORD_DICT = new Map();
for (const item of sinhalaWordsData.words) {
  WORD_DICT.set(item.word, item.value);
}

// Common clitics/suffixes in spoken Sinhala for numerals:
// -කට (dative indefinite: e.g. දහසකට, දෙකකට, පන්සීයකට)
// -ට (dative: e.g. 6800ට, දහසට)
// -ක් (indefinite marker: e.g. 8500ක්, දහසක්, දෙකක්, එකක්, විස්සක්)
// -යක් (indefinite geminated marker: e.g. පන්සියයක්, දෙසියයක්, සියයක්)
// -යි (copula / predicative: e.g. පන්දාහයි, දාහයි)
// -ද (question particle)
function stripClitic(word) {
  if (WORD_DICT.has(word)) return word;
  if (word === 'එකට') return word; // Prevent "for it" from reducing to 1

  if (word.endsWith('කට')) {
    const base = word.slice(0, -2);
    if (WORD_DICT.has(base)) return base;
    // Alternative base without trailing vowel reduction
    if (WORD_DICT.has(base + 'ය')) return base + 'ය';
  }
  if (word.endsWith('යක්')) {
    const base = word.slice(0, -2);
    if (WORD_DICT.has(base)) return base;
    if (WORD_DICT.has(base + 'ය')) return base + 'ය';
  }
  if (word.endsWith('ට')) {
    const base = word.slice(0, -1);
    if (WORD_DICT.has(base)) return base;
    if (WORD_DICT.has(base + 'ය')) return base + 'ය';
  }
  if (word.endsWith('ක්')) {
    const base = word.slice(0, -1);
    if (WORD_DICT.has(base)) return base;
    if (WORD_DICT.has(base + 'ය')) return base + 'ය';
  }
  if (word.endsWith('යි')) {
    const base = word.slice(0, -1);
    if (WORD_DICT.has(base)) return base;
    if (WORD_DICT.has(base + 'ය')) return base + 'ය';
  }
  return word;
}

/**
 * Checks if a token is a known Sinhala number word.
 */
export function isSinhalaNumberWord(token) {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim();
  if (WORD_DICT.has(clean)) return true;
  const stripped = stripClitic(clean);
  return WORD_DICT.has(stripped);
}

/**
 * Parse an array of Sinhala number word tokens into an integer.
 * If any word cannot be resolved with certainty, returns null.
 * 
 * @param {string[]} tokens - Array of words
 * @returns {number|null} Parsed integer or null
 */
export function parseSinhalaNumberWords(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;

  let total = 0;
  let current = 0;

  for (let i = 0; i < tokens.length; i++) {
    const rawToken = tokens[i];
    const token = rawToken.trim();
    if (!token) continue;

    let val = WORD_DICT.get(token);
    if (val === undefined) {
      const stripped = stripClitic(token);
      val = WORD_DICT.get(stripped);
    }

    if (val === undefined) {
      // Unrecognized word in number sequence -> cannot parse with certainty
      return null;
    }

    // Lakhs multiplier: ලක්ෂ, ලක්ෂය, ලක්ෂයක්, ලක්ෂේ
    const isLakhMultiplier = (val === 100000 && token.includes('ලක්ෂ'));

    // Thousands multipliers: දහස, දහස්, දහසක්, දාහ, දාහක්, දාහයි, දාස්
    const isThousandMultiplier = (val === 1000 && (
      token.includes('දහස') || token.includes('දහස්') || token.includes('දාහ') || token.includes('දාස්')
    ));

    // Hundreds multipliers: සීය, සීයක්, සියය, සිය
    const isHundredMultiplier = (val === 100 && (
      token.includes('සීය') || token.includes('සිය')
    ));

    if (isLakhMultiplier) {
      if (current === 0 && i + 1 < tokens.length) {
        // e.g. "ලක්ෂ දෙකක්", "ලක්ෂ පහක්"
        const nextRaw = tokens[i + 1].trim();
        let nextVal = WORD_DICT.get(nextRaw);
        if (nextVal === undefined) {
          nextVal = WORD_DICT.get(stripClitic(nextRaw));
        }
        if (nextVal !== undefined && nextVal >= 1 && nextVal < 100) {
          total += nextVal * 100000;
          i++;
          continue;
        }
      }
      current = (current === 0 ? 1 : current) * 100000;
      total += current;
      current = 0;
    } else if (isThousandMultiplier) {
      current = (current === 0 ? 1 : current) * 1000;
      total += current;
      current = 0;
    } else if (isHundredMultiplier) {
      current = (current === 0 ? 1 : current) * 100;
      total += current;
      current = 0;
    } else if (val >= 100000) {
      // Pre-composed compound lakh (e.g. දෙලක්ෂයක්, තුන්ලක්ෂයක්)
      total += val;
    } else if (val >= 1000) {
      // Pre-composed compound thousand (e.g. හත්දහස්, හාරදහස්, තුන්දාස්, පන්දාහ, හයදාහ, හයදාස්)
      if (current >= 10 && current < 100) {
        // Spoken compound: e.g. විසි (20) + පන්දාහක් (5000) = 25,000
        total += (current * 1000) + val;
        current = 0;
      } else {
        total += val;
      }
    } else if (val >= 100) {
      // Pre-composed compound hundred (e.g. දෙසීයක්, පන්සීයක්, අටසීයක්)
      total += val;
    } else {
      // Tens or units (1 to 99)
      current += val;
    }
  }

  const result = total + current;
  return result > 0 ? result : null;
}

/**
 * Extracts a numeric value from text that may be:
 * 1. Digits with Sinhala suffixes (e.g. '8500ක්', '6800ට', '30ක්')
 * 2. Sinhala number words (e.g. 'දාහතර දහසකට', 'හත්දහස් පන්සීයකට', 'දෙකක්')
 * 
 * Returns { value: number|null, reason: string|null }
 */
export function parseSinhalaNumberSafe(text) {
  if (!text || typeof text !== 'string') {
    return { value: null, reason: 'amount_unresolved' };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { value: null, reason: 'amount_unresolved' };
  }

  // 1. Check for digits with optional Sinhala suffixes: 8500ක්, 6800ට, 30ක්, 1900, etc.
  const suffixedDigitRegex = /\b(\d+)(?:ක්|ට|කට|යි|ද)?\b/g;
  const digitMatches = [...trimmed.matchAll(suffixedDigitRegex)];

  // Clean out common currency cues
  const cleanText = trimmed
    .replace(/(?:රුපියල්|රු\.?)/g, '')
    .trim();

  const words = cleanText.split(/\s+/).filter(Boolean);

  // Mixed digit + word amounts in one clause go to needs_review
  if (digitMatches.length > 0 && words.some(w => isSinhalaNumberWord(w))) {
    return { value: null, reason: 'amount_unresolved' };
  }

  // Pure digits case
  if (digitMatches.length === 1 && words.length <= 1) {
    const val = parseInt(digitMatches[0][1], 10);
    if (!isNaN(val) && val > 0) {
      return { value: val, reason: null };
    }
  }

  // Words case: check all words in phrase
  if (words.length > 0) {
    const val = parseSinhalaNumberWords(words);
    if (val !== null && val > 0) {
      return { value: val, reason: null };
    }
    return { value: null, reason: 'amount_unresolved' };
  }

  return { value: null, reason: 'amount_unresolved' };
}
