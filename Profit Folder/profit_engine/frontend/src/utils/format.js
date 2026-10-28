/**
 * Number & Currency Formatting Utilities
 */

export function formatLKR(amount, withPrefix = true) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
  const formatted = Math.round(amount).toLocaleString('en-US');
  return withPrefix ? `LKR ${formatted}` : formatted;
}

export function formatCurrencyDecimals(amount, decimals = 2) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatKg(kg) {
  if (kg === null || kg === undefined || isNaN(kg)) return '0 kg';
  return `${Math.round(kg).toLocaleString('en-US')} kg`;
}

export function formatPct(val, decimals = 1) {
  if (val === null || val === undefined || isNaN(val)) return '0.0%';
  return `${Number(val).toFixed(decimals)}%`;
}

export function formatAcreage(val) {
  if (!val || isNaN(val)) return '1.0 ac';
  return `${Number(val).toFixed(2).replace(/\.?0+$/, '')} ac`;
}
