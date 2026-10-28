/**
 * Format currency as integer rupees with language prefix.
 * English: "Rs. 145,600"
 * Sinhala: "රු. 145,600"
 * @param {number} amount
 * @param {string} lang - 'en' | 'si'
 * @returns {string}
 */
export function formatCurrency(amount, lang = 'en') {
  if (amount == null || isNaN(amount)) {
    return lang === 'si' ? 'රු. 0' : 'Rs. 0';
  }
  const formattedNum = Math.round(amount).toLocaleString('en-US');
  return lang === 'si' ? `රු. ${formattedNum}` : `Rs. ${formattedNum}`;
}

/**
 * Format Date object or ISO date string as YYYY/MM/DD
 * @param {Date|string} dateInput
 * @returns {string}
 */
export function formatDate(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}
