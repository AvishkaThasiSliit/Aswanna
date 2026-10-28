import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from '../utils/formatters.js';

describe('formatCurrency', () => {
  it('formats English correctly', () => {
    expect(formatCurrency(145600, 'en')).toBe('Rs. 145,600');
  });

  it('formats Sinhala correctly', () => {
    expect(formatCurrency(145600, 'si')).toBe('රු. 145,600');
  });

  it('rounds decimals to integer', () => {
    expect(formatCurrency(145600.75, 'en')).toBe('Rs. 145,601');
  });

  it('returns zero string for null', () => {
    expect(formatCurrency(null, 'en')).toBe('Rs. 0');
  });

  it('returns zero string for NaN', () => {
    expect(formatCurrency(NaN, 'si')).toBe('රු. 0');
  });

  it('defaults to English prefix when lang omitted', () => {
    expect(formatCurrency(1000)).toBe('Rs. 1,000');
  });
});

describe('formatDate', () => {
  it('formats an ISO string as YYYY/MM/DD', () => {
    expect(formatDate('2026-04-01')).toBe('2026/04/01');
  });

  it('formats a Date object', () => {
    expect(formatDate(new Date('2026-12-31'))).toBe('2026/12/31');
  });

  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });

  it('returns dash for invalid string', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });
});
