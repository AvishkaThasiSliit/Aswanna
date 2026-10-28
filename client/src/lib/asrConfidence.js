/**
 * ASR Transcript-level Confidence Checker (TASK W1)
 *
 * Evaluates Whisper segment-level acoustic signals across the entire utterance.
 * If the transcript-level signal is poor, flags all extracted items with
 * 'asr_low_confidence' and transitions status to 'needs_review'.
 *
 * Thresholds:
 * - minAvgLogprob = -1.0
 *   Source: faster-whisper/transcribe.py (`log_prob_threshold = -1.0`)
 *   URL: https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py
 *   Classification: library defaults, NOT tuned.
 *
 * - maxNoSpeechProb = 0.6
 *   Source: faster-whisper/transcribe.py (`no_speech_threshold = 0.6`)
 *   URL: https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py
 *   Classification: library defaults, NOT tuned.
 */

export const DEFAULT_ASR_THRESHOLDS = Object.freeze({
  // library defaults, NOT tuned
  minAvgLogprob: -1.0,
  maxNoSpeechProb: 0.6
});

/**
 * Pure function to apply ASR transcript-level confidence check to extracted items.
 *
 * @param {Array<Object>} items - Array of extracted expense items
 * @param {Array<Object>} [segments] - Whisper transcription segments with avg_logprob and no_speech_prob
 * @param {Object} [options]
 * @param {number} [options.minAvgLogprob] - Threshold for mean avg_logprob across segments (default: -1.0)
 * @param {number} [options.maxNoSpeechProb] - Threshold for max no_speech_prob across segments (default: 0.6)
 * @returns {Array<Object>} - Mapped items with 'asr_low_confidence' appended if confidence is poor
 */
export function applyAsrConfidence(items, segments, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return Array.isArray(items) ? [] : [];
  }

  // Missing or empty segments changes nothing (Option A contract)
  if (!Array.isArray(segments) || segments.length === 0) {
    return items.map(item => ({ ...item, reasons: [...(item.reasons || [])] }));
  }

  const minAvgLogprob = typeof options.minAvgLogprob === 'number'
    ? options.minAvgLogprob
    : DEFAULT_ASR_THRESHOLDS.minAvgLogprob;

  const maxNoSpeechProb = typeof options.maxNoSpeechProb === 'number'
    ? options.maxNoSpeechProb
    : DEFAULT_ASR_THRESHOLDS.maxNoSpeechProb;

  // Transcript-level signal calculation
  let totalLogprob = 0;
  let maxNoSpeech = 0;
  let validSegmentCount = 0;

  for (const seg of segments) {
    if (seg && typeof seg === 'object') {
      const logprob = typeof seg.avg_logprob === 'number' ? seg.avg_logprob : 0;
      const noSpeech = typeof seg.no_speech_prob === 'number' ? seg.no_speech_prob : 0;
      totalLogprob += logprob;
      if (noSpeech > maxNoSpeech) {
        maxNoSpeech = noSpeech;
      }
      validSegmentCount++;
    }
  }

  if (validSegmentCount === 0) {
    return items.map(item => ({ ...item, reasons: [...(item.reasons || [])] }));
  }

  const meanAvgLogprob = totalLogprob / validSegmentCount;

  // Signal is poor if average log probability is below threshold OR no_speech probability exceeds threshold
  const isPoorConfidence = meanAvgLogprob < minAvgLogprob || maxNoSpeech > maxNoSpeechProb;

  // Log raw values for every transcription
  console.log('[ASR Confidence Check]', {
    meanAvgLogprob: Number(meanAvgLogprob.toFixed(4)),
    maxNoSpeechProb: Number(maxNoSpeech.toFixed(4)),
    minAvgLogprobThreshold: minAvgLogprob,
    maxNoSpeechThreshold: maxNoSpeechProb,
    flagged: isPoorConfidence,
    thresholdOrigin: 'library defaults, NOT tuned'
  });

  if (!isPoorConfidence) {
    return items.map(item => ({ ...item, reasons: [...(item.reasons || [])] }));
  }

  // Append 'asr_low_confidence' to every item and mark needs_review
  return items.map(item => {
    const existingReasons = Array.isArray(item.reasons) ? [...item.reasons] : [];
    if (!existingReasons.includes('asr_low_confidence')) {
      existingReasons.push('asr_low_confidence');
    }
    return {
      ...item,
      status: 'needs_review',
      reasons: existingReasons
    };
  });
}
