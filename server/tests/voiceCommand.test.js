/**
 * Unit Tests for Pure Voice Follow-Up Command Parser (TASK V3)
 * shared/voice/parseCommand.js
 */

import { parseCommand, commandResultSchema } from '../../shared/voice/parseCommand.js';

describe('Deterministic Command Parser (parseCommand)', () => {
  const sampleRows = [
    { id: 'row-1', description: 'urea 2 bags', category: 'fertilizer', totalAmount: 6000, quantity: 2, unit: 'bags', dateISO: '2026-10-25' },
    { id: 'row-2', description: 'tractor hire 4 hours', category: 'machinery', totalAmount: 4000, quantity: 4, unit: 'hours', dateISO: '2026-10-25' },
    { id: 'row-3', description: 'seed paddy', category: 'seed', totalAmount: 1500, dateISO: '2026-10-25' }
  ];

  test('ambiguity never modifies a row: two urea rows returns status needs_choice', () => {
    const twoUreaRows = [
      { id: 'u1', description: 'urea morning', category: 'fertilizer', totalAmount: 3000, dateISO: '2026-10-25' },
      { id: 'u2', description: 'urea evening', category: 'fertilizer', totalAmount: 4000, dateISO: '2026-10-25' }
    ];

    const result = parseCommand('Change urea to 5000', twoUreaRows);

    expect(result.intent).toBe('correct');
    expect(result.status).toBe('needs_choice');
    expect(result.targetCandidates).toEqual(['u1', 'u2']);
    expect(result.newValue).toBe(5000);
  });

  test('no target words returns all candidates with status needs_choice (never guesses)', () => {
    const result = parseCommand('Change the quantity to 25', sampleRows);

    expect(result.intent).toBe('correct');
    expect(result.status).toBe('needs_choice');
    expect(result.field).toBe('quantity');
    expect(result.newValue).toBe(25);
    expect(result.targetCandidates).toEqual(['row-1', 'row-2', 'row-3']);
  });

  test('non-existent target item returns empty candidates with status needs_choice', () => {
    const result = parseCommand('Remove pesticide', sampleRows);

    expect(result.intent).toBe('remove');
    expect(result.status).toBe('needs_choice');
    expect(result.targetCandidates).toEqual([]);
  });

  test('unique target resolution succeeds with status ready', () => {
    const result = parseCommand('Change tractor to 5500', sampleRows);

    expect(result.intent).toBe('correct');
    expect(result.status).toBe('ready');
    expect(result.targetCandidates).toEqual(['row-2']);
    expect(result.field).toBe('amount');
    expect(result.newValue).toBe(5500);
  });

  test('quantity correction parses numeric value and targets single row', () => {
    const result = parseCommand('Change tractor quantity to 6', sampleRows);

    expect(result.intent).toBe('correct');
    expect(result.status).toBe('ready');
    expect(result.targetCandidates).toEqual(['row-2']);
    expect(result.field).toBe('quantity');
    expect(result.newValue).toBe(6);
  });

  test('category correction parses canonical category', () => {
    const result = parseCommand('Change category of tractor to other', sampleRows);

    expect(result.intent).toBe('correct');
    expect(result.status).toBe('ready');
    expect(result.targetCandidates).toEqual(['row-2']);
    expect(result.field).toBe('category');
    expect(result.newValue).toBe('other');
  });

  test('queries do not mutate rows and return correct query kinds', () => {
    const totalQuery = parseCommand('What is the total?', sampleRows);
    expect(totalQuery.intent).toBe('query');
    expect(totalQuery.kind).toBe('total');

    const catQuery = parseCommand('How much on fertilizer?', sampleRows);
    expect(catQuery.intent).toBe('query');
    expect(catQuery.kind).toBe('category_total');
    expect(catQuery.category).toBe('fertilizer');

    const countQuery = parseCommand('How many expenses?', sampleRows);
    expect(countQuery.intent).toBe('query');
    expect(countQuery.kind).toBe('count');
  });

  test('add intent extracts expense items cleanly', () => {
    const result = parseCommand('Add 1200 for diesel', sampleRows);

    expect(result.intent).toBe('add');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('fuel');
    expect(result.items[0].totalAmount).toBe(1200);
    expect(result.items[0].status).toBe('ok');
  });

  test('add without amount flags needs_review with amount_unresolved', () => {
    const result = parseCommand('Add weedicide', sampleRows);

    expect(result.intent).toBe('add');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('agrochemical');
    expect(result.items[0].totalAmount).toBeNull();
    expect(result.items[0].status).toBe('needs_review');
    expect(result.items[0].reasons).toContain('amount_unresolved');
  });

  test('duplicate warning: identical description, amount and date gets possible_duplicate reason', () => {
    // Add identical row to row-3: 'seed paddy', amount 1500, date 2026-10-25
    const result = parseCommand('1500 on seed paddy', sampleRows, { today: '2026-10-25' });

    expect(result.intent).toBe('add');
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.reasons).toContain('possible_duplicate');
    expect(item.status).toBe('needs_review');
  });

  test('saved record reference returns notice and does not mutate', () => {
    const result = parseCommand('Edit yesterday\'s saved expense in tracker', sampleRows);

    expect(result.intent).toBe('unknown');
    expect(result.reason).toBe('saved_record_reference');
    expect(result.message).toMatch(/saved records are edited in the daily cost tracker/i);
  });

  test('Zod schema validation passes for all returns', () => {
    const res = parseCommand('Total spend?', sampleRows);
    expect(() => commandResultSchema.parse(res)).not.toThrow();
  });
});
