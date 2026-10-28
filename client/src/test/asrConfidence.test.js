import { describe, it, expect, vi } from 'vitest';
import { applyAsrConfidence, DEFAULT_ASR_THRESHOLDS } from '../lib/asrConfidence.js';

describe('applyAsrConfidence pure function (TASK W1)', () => {
  const sampleItems = [
    {
      description: 'urea 2 bags',
      category: 'fertilizer',
      totalAmount: 14000,
      status: 'ok',
      reasons: []
    },
    {
      description: 'tractor hire',
      category: 'machinery',
      totalAmount: 8500,
      status: 'ok',
      reasons: []
    }
  ];

  it('preserves items when confidence is good (mean avg_logprob >= -1.0, max no_speech <= 0.6)', () => {
    const segments = [
      { text: 'urea 2 bags', avg_logprob: -0.35, no_speech_prob: 0.05 },
      { text: 'tractor hire', avg_logprob: -0.42, no_speech_prob: 0.10 }
    ];

    const result = applyAsrConfidence(sampleItems, segments);

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('ok');
    expect(result[0].reasons).toEqual([]);
    expect(result[1].status).toBe('ok');
    expect(result[1].reasons).toEqual([]);
  });

  it('flags all rows with asr_low_confidence and needs_review when mean avg_logprob is below threshold', () => {
    const poorLogprobSegments = [
      { text: 'urea 2 bags', avg_logprob: -1.45, no_speech_prob: 0.08 },
      { text: 'tractor hire', avg_logprob: -1.20, no_speech_prob: 0.12 }
    ];

    const result = applyAsrConfidence(sampleItems, poorLogprobSegments);

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('needs_review');
    expect(result[0].reasons).toContain('asr_low_confidence');
    expect(result[1].status).toBe('needs_review');
    expect(result[1].reasons).toContain('asr_low_confidence');
  });

  it('flags all rows when max no_speech_prob exceeds threshold', () => {
    const highNoSpeechSegments = [
      { text: 'urea 2 bags', avg_logprob: -0.25, no_speech_prob: 0.15 },
      { text: 'tractor hire', avg_logprob: -0.30, no_speech_prob: 0.78 }
    ];

    const result = applyAsrConfidence(sampleItems, highNoSpeechSegments);

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('needs_review');
    expect(result[0].reasons).toContain('asr_low_confidence');
    expect(result[1].status).toBe('needs_review');
    expect(result[1].reasons).toContain('asr_low_confidence');
  });

  it('changes nothing when segments are missing or empty', () => {
    const resultNull = applyAsrConfidence(sampleItems, null);
    expect(resultNull[0].status).toBe('ok');
    expect(resultNull[0].reasons).toEqual([]);

    const resultEmpty = applyAsrConfidence(sampleItems, []);
    expect(resultEmpty[0].status).toBe('ok');
    expect(resultEmpty[0].reasons).toEqual([]);
  });

  it('verifies that confirm remains blocked when asr_low_confidence is present until accepted', () => {
    const flaggedItems = applyAsrConfidence(sampleItems, [
      { text: 'muffled speech', avg_logprob: -2.1, no_speech_prob: 0.85 }
    ]);

    // Simulated check from VoiceExpenseEntry.hasNeedsReview
    const hasNeedsReview = flaggedItems.some(item => {
      const totalNum = Number(item.totalAmount);
      const isTotalValid = !isNaN(totalNum) && totalNum > 0;
      const isCatValid = Boolean(item.category);
      return item.status === 'needs_review' || !isTotalValid || !isCatValid;
    });

    expect(hasNeedsReview).toBe(true);

    // Simulated farmer tap 'Accept' (handleOverrideRow): clears 'asr_low_confidence'
    const acceptedItems = flaggedItems.map(item => {
      const remainingReasons = item.reasons.filter(r => r !== 'asr_low_confidence');
      return {
        ...item,
        reasons: remainingReasons,
        status: remainingReasons.length === 0 ? 'ok' : 'needs_review'
      };
    });

    const hasNeedsReviewAfterAccept = acceptedItems.some(item => item.status === 'needs_review');
    expect(hasNeedsReviewAfterAccept).toBe(false);
  });
});
