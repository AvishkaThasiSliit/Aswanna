/**
 * Deterministic Voice / Text Command Parser for Pending Expense List
 * 
 * Pure function, zero I/O.
 * Interprets follow-up commands against the in-memory PENDING list only.
 * 
 * Intents:
 * - 'add': adds new expense item(s) (reusing extractExpenses)
 * - 'correct': corrects a field (amount, quantity, unit, category, description) on targeted row(s)
 * - 'remove': removes targeted row(s)
 * - 'query': answers questions on pending list (total, category_total, count)
 * - 'unknown': unrecognized command or notice about saved records
 */

import { z } from 'zod';
import { extractExpenses, CANONICAL_CATEGORIES, sumTotals } from './extractExpenses.js';
import keywordMap from './keywordMap.json' with { type: 'json' };

// Zod schema for command parser output
export const commandResultSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('add'),
    items: z.array(z.any()),
    warnings: z.array(z.string()).optional()
  }),
  z.object({
    intent: z.literal('correct'),
    targetCandidates: z.array(z.string()),
    field: z.enum(['amount', 'quantity', 'unit', 'category', 'description']),
    newValue: z.union([z.number(), z.string()]),
    status: z.enum(['ready', 'needs_choice']),
    targetWord: z.string().optional()
  }),
  z.object({
    intent: z.literal('remove'),
    targetCandidates: z.array(z.string()),
    status: z.enum(['ready', 'needs_choice']),
    targetWord: z.string().optional()
  }),
  z.object({
    intent: z.literal('query'),
    kind: z.enum(['total', 'category_total', 'count']),
    category: z.string().optional()
  }),
  z.object({
    intent: z.literal('unknown'),
    reason: z.string().optional(),
    message: z.string().optional()
  })
]);

// Build fast term-to-category lookup from keywordMap.json
const TERM_TO_CATEGORY = {};
for (const [category, termList] of Object.entries(keywordMap)) {
  if (Array.isArray(termList)) {
    for (const item of termList) {
      if (item && item.term) {
        TERM_TO_CATEGORY[item.term.toLowerCase()] = category;
      }
    }
  }
}

// Saved record indicators (referring to records already in DB/tracker)
const SAVED_RECORD_PATTERNS = [
  /\b(saved\s+record|saved\s+expense|saved\s+entry|in\s+(the\s+)?database|in\s+(the\s+)?tracker|in\s+ledger|already\s+saved|yesterday'?s\s+saved|last\s+week'?s\s+saved)\b/i,
  /(දැනටමත්\s+සේව්|සේව්\s+කරපු|ට්‍රැකර්|ඩේටාබේස්)/
];

// Query indicator patterns
const QUERY_PATTERNS = [
  /\b(how\s+much|what('s|\s+is)\s+the\s+total|total\s+spend|total\s+spent|what\s+did\s+i\s+spend|how\s+many|count\s+(items|expenses|entries)|sum\s+of)\b/i,
  /(කීයද|එකතුව\s+කීයද|මුළු\s+එකතුව|වියදම්\s+කීයක්|ගණන\s+කීයද)/
];

// Remove indicator patterns
const REMOVE_PATTERNS = [
  /\b(remove|delete|drop|discard|clear\s+out)\b/i,
  /(අයින්\s+කරන්න|ඉවත්\s+කරන්න|මකන්න|කපන්න)/
];

// Explicit Add patterns
const ADD_PATTERNS = [
  /^(?:add|also\s+add)\b/i,
  /(එකතු\s+කරන්න|තව\s+දාන්න|^තව\s+)/
];

// Correction indicator patterns
const CORRECT_PATTERNS = [
  /\b(change|correct|fix|update|set|make\s+it|was\s+\d+\s+not|not\s+\d+\s+but)\b/i,
  /(වෙනස්\s+කරන්න|හදන්න|දාන්න|(?<!එකතු\s+)කරන්න)/
];

// Field extraction helpers
const FIELD_CATEGORY_WORDS = [
  'category', 'කාණ්ඩය'
];
const FIELD_QUANTITY_WORDS = [
  'quantity', 'qty', 'amount of', 'bags', 'kg', 'kilos', 'litres', 'liters', 'hours', 'ප්‍රමාණය', 'මිටි', 'කිලෝ', 'ලීටර්', 'පැය'
];
const FIELD_UNIT_WORDS = [
  'unit', 'ඒකකය'
];
const FIELD_AMOUNT_WORDS = [
  'amount', 'price', 'cost', 'rupees', 'rs', 'ගණන', 'මිල', 'වියදම', 'රුපියල්', 'රු'
];
const FIELD_DESC_WORDS = [
  'description', 'name', 'rename', 'විස්තරය', 'නම'
];

/**
 * Identify product/category keywords mentioned in the command text
 */
function extractTargetKeywords(text) {
  const lower = text.toLowerCase();
  const keywords = [];

  // 1. Check canonical categories
  for (const cat of CANONICAL_CATEGORIES) {
    if (new RegExp(`\\b${cat}\\b`, 'i').test(lower)) {
      keywords.push(cat);
    }
  }

  // 2. Check terms from TERM_TO_CATEGORY (sorted by length descending for greedy match)
  const terms = Object.keys(TERM_TO_CATEGORY).sort((a, b) => b.length - a.length);
  for (const term of terms) {
    if (term.length >= 3) {
      if (lower.includes(term)) {
        keywords.push(term);
      }
    }
  }

  return [...new Set(keywords)];
}

/**
 * Match target keywords against pending rows
 */
function resolveCandidates(targetKeywords, pendingRows, lowerText = '') {
  if (!Array.isArray(pendingRows) || pendingRows.length === 0) {
    return { candidates: [], targetWord: targetKeywords[0] || null };
  }

  // Check if any target keywords or description tokens match
  const matched = pendingRows.filter(row => {
    const desc = (row.description || '').toLowerCase();
    const cat = (row.category || '').toLowerCase();

    if (targetKeywords.length > 0) {
      const kwMatch = targetKeywords.some(kw => {
        // Direct category match
        if (cat === kw) return true;
        // Term mapped category match
        const mappedCat = TERM_TO_CATEGORY[kw];
        if (mappedCat && mappedCat === cat) return true;
        // Description substring match
        if (desc.includes(kw)) return true;
        return false;
      });
      if (kwMatch) return true;
    }

    // Check if any word from row description (>= 4 chars) appears in command text
    if (lowerText) {
      const descTokens = desc.split(/[\s,.-]+/).filter(w => w.length >= 4);
      if (descTokens.some(tok => lowerText.includes(tok))) {
        return true;
      }
    }

    return false;
  });

  if (targetKeywords.length === 0 && matched.length === 0) {
    // No target words found in command (e.g. "change the quantity to 25")
    // All pending rows are candidates requiring choice; NEVER guess!
    return {
      candidates: pendingRows.map(r => r.id),
      targetWord: null
    };
  }

  return {
    candidates: matched.map(r => r.id),
    targetWord: targetKeywords[0] || null
  };
}

/**
 * Parse numeric amount from text
 */
function parseNumberFromText(text) {
  // Handle "X not Y" or "not Y but X"
  const notMatch = text.match(/(\d[\d,]*)\s+(?:not|නැතුව)\s+(\d[\d,]*)/i);
  if (notMatch) {
    return Number(notMatch[1].replace(/,/g, ''));
  }
  const butMatch = text.match(/(?:not|නැතුව)\s+(\d[\d,]*)\s+(?:but|නමුත්)\s+(\d[\d,]*)/i);
  if (butMatch) {
    return Number(butMatch[2].replace(/,/g, ''));
  }

  // Standard numbers (e.g. "to 5000", "5000", "Rs 5000")
  const toMatch = text.match(/(?:to|make\s+it|set\s+to|කරන්න|ගණන)\s*(?:rs\.?|රු\.?)?\s*(\d[\d,]*)/i);
  if (toMatch) {
    return Number(toMatch[1].replace(/,/g, ''));
  }

  // Any stand-alone number
  const numMatch = text.match(/(?:rs\.?|රු\.?)?\s*(\d[\d,]*)/i);
  if (numMatch && numMatch[1]) {
    return Number(numMatch[1].replace(/,/g, ''));
  }

  return null;
}

/**
 * Main Pure Command Parser Function
 * 
 * @param {string} text - User command string
 * @param {Array} pendingRows - Current pending expense rows in state
 * @param {Object} options - { lang, today }
 * @returns {Object} Structured command result
 */
export function parseCommand(text, pendingRows = [], options = {}) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    const res = { intent: 'unknown', reason: 'empty_input' };
    return commandResultSchema.parse(res);
  }

  const lower = trimmed.toLowerCase();

  // 1. Saved Record Reference Guard
  for (const pat of SAVED_RECORD_PATTERNS) {
    if (pat.test(trimmed)) {
      const res = {
        intent: 'unknown',
        reason: 'saved_record_reference',
        message: 'Saved records are edited in the Daily Cost Tracker.'
      };
      return commandResultSchema.parse(res);
    }
  }

  // 2. Query Intent
  const isQuery = QUERY_PATTERNS.some(pat => pat.test(trimmed)) || lower.endsWith('?');
  if (isQuery && !lower.startsWith('change') && !lower.startsWith('remove') && !lower.startsWith('delete')) {
    // Determine query kind
    const targetKeywords = extractTargetKeywords(trimmed);
    let matchedCategory = null;
    for (const kw of targetKeywords) {
      if (CANONICAL_CATEGORIES.includes(kw)) {
        matchedCategory = kw;
        break;
      }
      const mappedCat = TERM_TO_CATEGORY[kw];
      if (mappedCat && CANONICAL_CATEGORIES.includes(mappedCat)) {
        matchedCategory = mappedCat;
        break;
      }
    }

    if (/\b(how\s+many|count|කීයක්|ගණන)\b/i.test(trimmed)) {
      const res = {
        intent: 'query',
        kind: 'count',
        category: matchedCategory || undefined
      };
      return commandResultSchema.parse(res);
    }

    if (matchedCategory) {
      const res = {
        intent: 'query',
        kind: 'category_total',
        category: matchedCategory
      };
      return commandResultSchema.parse(res);
    }

    const res = {
      intent: 'query',
      kind: 'total'
    };
    return commandResultSchema.parse(res);
  }

  // 3. Remove Intent
  const isRemove = REMOVE_PATTERNS.some(pat => pat.test(trimmed));
  if (isRemove && !lower.startsWith('add') && !lower.startsWith('spent')) {
    const targetKeywords = extractTargetKeywords(trimmed);
    const { candidates, targetWord } = resolveCandidates(targetKeywords, pendingRows, lower);

    const status = candidates.length === 1 ? 'ready' : 'needs_choice';
    const res = {
      intent: 'remove',
      targetCandidates: candidates,
      status,
      targetWord: targetWord || undefined
    };
    return commandResultSchema.parse(res);
  }

  // 4. Add Intent Check (Priority for explicit add markers)
  const isExplicitAdd = ADD_PATTERNS.some(pat => pat.test(trimmed));
  if (isExplicitAdd) {
    try {
      const addCleaned = trimmed.replace(/^(?:add|also\s+add|තව|එකතු\s+කරන්න)\s+/i, '').replace(/එකතු\s+කරන්න$/i, '').trim();
      const result = extractExpenses(addCleaned, {
        lang: options.lang,
        today: options.today,
        categoryBaselines: options.categoryBaselines,
        totalBaseline: options.totalBaseline,
        alternatives: options.alternatives
      });

      if (result.items && result.items.length > 0) {
        for (const item of result.items) {
          const itemDate = item.dateISO || options.today || '';
          const isDuplicate = pendingRows.some(row => {
            const descA = (row.description || '').trim().toLowerCase();
            const descB = (item.description || '').trim().toLowerCase();
            const descMatch = descA === descB || descA.includes(descB) || descB.includes(descA) ||
              (row.category && item.category && row.category === item.category);
            const sameAmount = (row.totalAmount != null && item.totalAmount != null)
              ? Number(row.totalAmount) === Number(item.totalAmount)
              : false;
            const rowDate = row.dateISO || options.today || '';
            const sameDate = itemDate === rowDate;
            return descMatch && sameAmount && sameDate;
          });

          if (isDuplicate) {
            if (!item.reasons.includes('possible_duplicate')) {
              item.reasons.push('possible_duplicate');
            }
            item.status = 'needs_review';
          }
        }

        const res = {
          intent: 'add',
          items: result.items,
          warnings: result.warnings || []
        };
        return commandResultSchema.parse(res);
      }
    } catch {}
  }

  // 5. Correct Intent
  const isCorrect = CORRECT_PATTERNS.some(pat => pat.test(trimmed));
  if (isCorrect && !lower.startsWith('spent') && !lower.startsWith('paid') && !lower.startsWith('bought')) {
    const targetKeywords = extractTargetKeywords(trimmed);
    const { candidates, targetWord } = resolveCandidates(targetKeywords, pendingRows, lower);

    // Determine field and new value
    let field = 'amount';
    let newValue = null;

    // Check category change
    for (const cat of CANONICAL_CATEGORIES) {
      if (new RegExp(`\\b(to|into|category)\\s+${cat}\\b`, 'i').test(lower) ||
          new RegExp(`කාණ්ඩය\\s+${cat}`, 'i').test(lower)) {
        field = 'category';
        newValue = cat;
        break;
      }
    }

    // Check quantity change
    if (!newValue && FIELD_QUANTITY_WORDS.some(w => lower.includes(w))) {
      const parsedNum = parseNumberFromText(trimmed);
      if (parsedNum !== null) {
        field = 'quantity';
        newValue = parsedNum;
      }
    }

    // Check unit change
    if (!newValue && FIELD_UNIT_WORDS.some(w => lower.includes(w))) {
      const unitMatch = lower.match(/(?:unit|ඒකකය)\s+(?:to|is|=)?\s*([a-z]+)/i);
      if (unitMatch) {
        field = 'unit';
        newValue = unitMatch[1];
      }
    }

    // Check description change
    if (!newValue && FIELD_DESC_WORDS.some(w => lower.includes(w))) {
      const descMatch = trimmed.match(/(?:description|rename|නම|විස්තරය)\s+(?:to|is|=)?\s*(.+)/i);
      if (descMatch) {
        field = 'description';
        newValue = descMatch[1].trim();
      }
    }

    // Default to amount
    if (!newValue) {
      const parsedNum = parseNumberFromText(trimmed);
      if (parsedNum !== null) {
        field = 'amount';
        newValue = parsedNum;
      }
    }

    if (newValue !== null) {
      const status = candidates.length === 1 ? 'ready' : 'needs_choice';
      const res = {
        intent: 'correct',
        targetCandidates: candidates,
        field,
        newValue,
        status,
        targetWord: targetWord || undefined
      };
      return commandResultSchema.parse(res);
    }
  }

  // 6. Generic Add fallback (expense phrase without explicit "add" keyword)
  try {
    const result = extractExpenses(trimmed, {
      lang: options.lang,
      today: options.today,
      categoryBaselines: options.categoryBaselines,
      totalBaseline: options.totalBaseline,
      alternatives: options.alternatives
    });

    if (result.items && result.items.length > 0) {
      // Duplicate detection against existing pendingRows (Requirement 5)
      for (const item of result.items) {
        const itemDate = item.dateISO || options.today || '';
        const isDuplicate = pendingRows.some(row => {
          const descA = (row.description || '').trim().toLowerCase();
          const descB = (item.description || '').trim().toLowerCase();
          const descMatch = descA === descB || descA.includes(descB) || descB.includes(descA) ||
            (row.category && item.category && row.category === item.category);
          const sameAmount = (row.totalAmount != null && item.totalAmount != null)
            ? Number(row.totalAmount) === Number(item.totalAmount)
            : false;
          const rowDate = row.dateISO || options.today || '';
          const sameDate = itemDate === rowDate;
          return descMatch && sameAmount && sameDate;
        });

        if (isDuplicate) {
          if (!item.reasons.includes('possible_duplicate')) {
            item.reasons.push('possible_duplicate');
          }
          item.status = 'needs_review';
        }
      }

      const res = {
        intent: 'add',
        items: result.items,
        warnings: result.warnings || []
      };
      return commandResultSchema.parse(res);
    }
  } catch (err) {
    // If extractExpenses fails, fall through to unknown
  }

  const res = {
    intent: 'unknown',
    reason: 'unrecognized_command'
  };
  return commandResultSchema.parse(res);
}
