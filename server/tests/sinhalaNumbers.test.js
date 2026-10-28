/**
 * Unit tests for Sinhala Number Parser (TASK V5)
 * shared/voice/sinhalaNumbers.js
 */

import {
  parseSinhalaNumberWords,
  parseSinhalaNumberSafe,
  isSinhalaNumberWord
} from '../../shared/voice/sinhalaNumbers.js';

describe('Sinhala Number Parser (TASK V5)', () => {
  describe('Forms observed in captured speech data', () => {
    test('parses compound multiplier: දාහතර දහසකට -> 14000', () => {
      const val = parseSinhalaNumberWords(['දාහතර', 'දහසකට']);
      expect(val).toBe(14000);
    });

    test('parses pre-composed thousand + hundred: හත්දහස් පන්සීයකට -> 7500', () => {
      const val = parseSinhalaNumberWords(['හත්දහස්', 'පන්සීයකට']);
      expect(val).toBe(7500);
    });

    test('parses multiplier with compound teen: දොළොස් දහසක් -> 12000', () => {
      const val = parseSinhalaNumberWords(['දොළොස්', 'දහසක්']);
      expect(val).toBe(12000);
    });

    test('parses pre-composed thousand + hundred: තුන්දාස් දෙසීයකට -> 3200', () => {
      const val = parseSinhalaNumberWords(['තුන්දාස්', 'දෙසීයකට']);
      expect(val).toBe(3200);
    });

    test('parses unit + thousand multiplier: හය දාහක් -> 6000', () => {
      const val = parseSinhalaNumberWords(['හය', 'දාහක්']);
      expect(val).toBe(6000);
    });

    test('parses compound thousand with predicative suffix: පන්දාහයි -> 5000', () => {
      const val = parseSinhalaNumberWords(['පන්දාහයි']);
      expect(val).toBe(5000);
    });

    test('parses thousand + hundred: හාරදහස් අටසීයකට -> 4800', () => {
      const val = parseSinhalaNumberWords(['හාරදහස්', 'අටසීයකට']);
      expect(val).toBe(4800);
    });

    test('parses short-vowel hundred and compound phrases: පන්සියයක්, අටදාස් පන්සියයක්, දෙදහස් පන්සියයක්', () => {
      expect(parseSinhalaNumberWords(['පන්සියයක්'])).toBe(500);
      expect(parseSinhalaNumberWords(['අටදාස්', 'පන්සියයක්'])).toBe(8500);
      expect(parseSinhalaNumberWords(['දෙදහස්', 'පන්සියයක්'])).toBe(2500);
      expect(parseSinhalaNumberWords(['හාරදාස්', 'පන්සියයක්'])).toBe(4500);
    });

    test('parses quantity words: එකක්, දෙකක්, දෙකකට, පහක්, විස්සක්', () => {
      expect(parseSinhalaNumberWords(['එකක්'])).toBe(1);
      expect(parseSinhalaNumberWords(['දෙකක්'])).toBe(2);
      expect(parseSinhalaNumberWords(['දෙකකට'])).toBe(2);
      expect(parseSinhalaNumberWords(['පහක්'])).toBe(5);
      expect(parseSinhalaNumberWords(['විස්සක්'])).toBe(20);
    });

    test('parses digits with Sinhala suffixes: 8500ක්, 6800ට, 30ක්', () => {
      expect(parseSinhalaNumberSafe('8500ක්')).toEqual({ value: 8500, reason: null });
      expect(parseSinhalaNumberSafe('6800ට')).toEqual({ value: 6800, reason: null });
      expect(parseSinhalaNumberSafe('30ක්')).toEqual({ value: 30, reason: null });
    });
  });

  describe('Invalid, unknown, and ambiguous inputs returning null', () => {
    test('returns null with amount_unresolved for unknown word: ඉන්ගාස් පන්සීයක්', () => {
      const res = parseSinhalaNumberWords(['ඉන්ගාස්', 'පන්සීයක්']);
      expect(res).toBeNull();

      const safeRes = parseSinhalaNumberSafe('ඉන්ගාස් පන්සීයක්');
      expect(safeRes).toEqual({ value: null, reason: 'amount_unresolved' });
    });

    test('returns null with amount_unresolved for unknown word: අයදහස්', () => {
      const res = parseSinhalaNumberWords(['අයදහස්']);
      expect(res).toBeNull();

      const safeRes = parseSinhalaNumberSafe('අයදහස්');
      expect(safeRes).toEqual({ value: null, reason: 'amount_unresolved' });
    });

    test('returns null with amount_unresolved for hybrid mixed digit + word amounts', () => {
      const safeRes = parseSinhalaNumberSafe('5000ක් දෙසීයක්');
      expect(safeRes).toEqual({ value: null, reason: 'amount_unresolved' });
    });

    test('returns null for empty or non-string input', () => {
      expect(parseSinhalaNumberWords([])).toBeNull();
      expect(parseSinhalaNumberSafe('')).toEqual({ value: null, reason: 'amount_unresolved' });
      expect(parseSinhalaNumberSafe(null)).toEqual({ value: null, reason: 'amount_unresolved' });
    });
  });

  describe('isSinhalaNumberWord helper', () => {
    test('recognizes valid words with and without inflections', () => {
      expect(isSinhalaNumberWord('දහස')).toBe(true);
      expect(isSinhalaNumberWord('දහසකට')).toBe(true);
      expect(isSinhalaNumberWord('පන්දාහයි')).toBe(true);
      expect(isSinhalaNumberWord('පන්සියයක්')).toBe(true);
      expect(isSinhalaNumberWord('දෙකක්')).toBe(true);
      expect(isSinhalaNumberWord('කුලියට')).toBe(false);
      expect(isSinhalaNumberWord('ට්‍රැක්ටර්')).toBe(false);
      expect(isSinhalaNumberWord('එකට')).toBe(false);
    });
  });
});
