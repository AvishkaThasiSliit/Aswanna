import { CATEGORY_TAGS } from '../../../shared/categoryMap.js';

/**
 * Safely converts an amount to integer rupees using Banker's / half-up integer rounding.
 * Checks if fractional rupees were present.
 *
 * @param {number|string|null|undefined} amountVal
 * @returns {{ integerAmount: number, wasRounded: boolean }}
 */
export function roundToStoredRupees(amountVal) {
  if (amountVal == null || amountVal === '') {
    return { integerAmount: 0, wasRounded: false };
  }

  const num = Number(amountVal);
  if (isNaN(num)) {
    return { integerAmount: 0, wasRounded: false };
  }

  // Multiply by 100 to check cents
  const cents = Math.round(num * 100);
  const intRupees = Math.round(num);

  // If cents % 100 !== 0, there was a fractional rupee (cents)
  const wasRounded = (cents % 100 !== 0);

  return {
    integerAmount: intRupees,
    wasRounded
  };
}

/**
 * Maps the bill-service JSON into the canonical item shape expected by VoiceExpenseEntry's review table.
 * ALWAYS returns exactly ONE row from bill-level fields (total, date, vendor).
 *
 * App's 8 categories:
 * ['seed', 'fertilizer', 'agrochemical', 'labour', 'machinery', 'fuel', 'irrigation', 'other']
 *
 * @param {object} billServiceOutput The raw response from bill-service
 * @param {string} [fallbackDate] ISO date string fallback
 * @returns {Array<object>} Array containing exactly one item object ready for review table
 */
export function mapBillServiceToReviewItems(billServiceOutput, fallbackDate) {
  if (!billServiceOutput || typeof billServiceOutput !== 'object') {
    return [];
  }

  const todayISO = fallbackDate || new Date().toISOString().split('T')[0];
  const billDate = billServiceOutput.date || todayISO;
  const vendor = (billServiceOutput.vendor || '').trim();
  const description = vendor || 'Scanned bill';

  // Carry all bill-level reasons through
  const reasons = Array.isArray(billServiceOutput.reasons) ? [...billServiceOutput.reasons] : [];

  // 1. Category: single category all parsed items agree on, else "other" with reason category_unsure
  const rawItems = Array.isArray(billServiceOutput.items) ? billServiceOutput.items : [];
  let category = 'other';

  if (rawItems.length > 0) {
    const itemCats = rawItems.map(it => (it.category || '').toLowerCase().trim());
    const firstCat = itemCats[0];
    const allAgree = CATEGORY_TAGS.includes(firstCat) && itemCats.every(c => c === firstCat);
    if (allAgree) {
      category = firstCat;
    } else {
      category = 'other';
      if (!reasons.includes('category_unsure')) {
        reasons.push('category_unsure');
      }
    }
  } else {
    category = 'other';
    if (!reasons.includes('category_unsure')) {
      reasons.push('category_unsure');
    }
  }

  // 2. Total & Amount: if total is null -> one row, no amount, reason total_missing.
  // If rounding to integer rupees changes the value -> reason amount_rounded.
  let totalAmount = '';
  let unitPrice = '';

  if (billServiceOutput.total == null || billServiceOutput.total === '') {
    totalAmount = '';
    unitPrice = '';
    if (!reasons.includes('total_missing')) {
      reasons.push('total_missing');
    }
  } else {
    const { integerAmount, wasRounded } = roundToStoredRupees(billServiceOutput.total);
    if (wasRounded && !reasons.includes('amount_rounded')) {
      reasons.push('amount_rounded');
    }
    totalAmount = integerAmount;
    unitPrice = integerAmount;
  }

  // 3. Status determination: needs_review if any reasons, or missing total or category
  const billStatus = billServiceOutput.status || 'ok';
  let status = billStatus;
  if (reasons.length > 0 || totalAmount === '' || totalAmount === 0 || !category) {
    status = 'needs_review';
  }

  return [
    {
      id: `bill-item-${Date.now()}-0`,
      description,
      category,
      quantity: 1,
      unit: '',
      unitPrice,
      totalAmount,
      currency: 'LKR',
      dateISO: billDate,
      status,
      reasons,
      source: 'bill'
    }
  ];
}
