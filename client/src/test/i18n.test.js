import { describe, it, expect } from 'vitest';
import en from '../i18n/locales/en.json';
import si from '../i18n/locales/si.json';
import i18n from '../i18n/i18n.js';

function getLeafKeys(obj, prefix = '') {
  return Object.keys(obj).flatMap((k) => {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      return getLeafKeys(obj[k], fullKey);
    }
    return [fullKey];
  });
}

describe('Translation Parity (en, si)', () => {
  const enKeys = getLeafKeys(en).sort();
  const siKeys = getLeafKeys(si).sort();

  it('contains exactly matching key sets across English and Sinhala', () => {
    expect(siKeys).toEqual(enKeys);
  });

  it('has no empty translation values in English or Sinhala', () => {
    for (const key of enKeys) {
      const getVal = (dict, path) => path.split('.').reduce((acc, part) => acc?.[part], dict);
      expect(getVal(en, key), `Empty en key: ${key}`).toBeTruthy();
      expect(getVal(si, key), `Empty si key: ${key}`).toBeTruthy();
    }
  });

  it('initializes i18n with English and Sinhala language bundles', () => {
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
    expect(i18n.hasResourceBundle('si', 'translation')).toBe(true);
  });
});
