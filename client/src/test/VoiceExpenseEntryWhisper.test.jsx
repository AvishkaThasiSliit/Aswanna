/**
 * VoiceExpenseEntry Whisper Integration Tests (TASK W1)
 *
 * NOTE: These tests verify the client-side plumbing for the Whisper ASR service
 * (MediaRecorder lifecycle, proxy endpoint invocation, confidence signal mapping,
 *  and fallback to typed entry when the service fails).
 * They test plumbing and UI integration, NOT speech accuracy.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';

import i18n from '../i18n/i18n.js';
import VoiceExpenseEntry from '../components/VoiceExpenseEntry.jsx';
import * as apiModule from '../utils/api.js';

// Mock apiFetch
vi.mock('../utils/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiFetch: vi.fn(),
    getAuthToken: vi.fn(() => 'mock-jwt-token'),
  };
});

// Mock MediaStream and MediaRecorder
class MockMediaRecorder {
  constructor(stream, options) {
    MockMediaRecorder.instance = this;
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
  }
  start(timeslice) {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['mock audio chunks'], { type: 'audio/webm' }) });
    }
    if (this.onstop) {
      this.onstop();
    }
  }
}

describe('VoiceExpenseEntry - Whisper Mode Plumbing Tests (TASK W1)', () => {
  const activeCycle = { _id: 'cycle-123', crop: 'Paddy', status: 'active' };
  const activityCodes = [{ _id: 'act-1', code: 'LAND-PREP', nameEn: 'Land Preparation' }];

  let originalFetch;
  let mockStream;

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage('en');
    localStorage.clear();

    vi.stubEnv('VITE_VOICE_ASR', 'whisper');

    mockStream = {
      getTracks: vi.fn(() => [
        { stop: vi.fn() },
      ]),
    };

    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
        configurable: true,
      });
    }

    window.MediaRecorder = MockMediaRecorder;
    window.MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);

    originalFetch = global.fetch;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    global.fetch = originalFetch;
  });

  const renderComponent = (props = {}) => {
    return render(
      <I18nextProvider i18n={i18n}>
        <VoiceExpenseEntry
          activeCycle={activeCycle}
          activityCodes={activityCodes}
          enabled={true}
          defaultDate="2026-10-27"
          {...props}
        />
      </I18nextProvider>
    );
  };

  it('records audio with MediaRecorder and invokes /api/voice/transcribe on stop', async () => {
    const mockTranscribeResponse = {
      text: 'paid 4500 for 2 bags of urea',
      segments: [
        { text: 'paid 4500 for 2 bags of urea', avg_logprob: -0.3, no_speech_prob: 0.05 }
      ],
      duration_s: 2.1,
      model: 'base.en',
      latency_ms: 120,
      used_initial_prompt: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTranscribeResponse,
    });

    renderComponent();

    const micBtn = screen.getByTestId('voice-mic-btn');
    expect(micBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(micBtn);
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(MockMediaRecorder.instance.state).toBe('recording');

    // Click stop recording
    const stopBtn = screen.getByText('Stop');
    await act(async () => {
      fireEvent.click(stopBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const [calledUrl, calledOptions] = global.fetch.mock.calls[0];
    expect(calledUrl).toContain('/api/voice/transcribe');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers.Authorization).toBe('Bearer mock-jwt-token');

    // Confirm transcript input is updated
    await waitFor(() => {
      const transcriptInput = screen.getByTestId('voice-transcript-input');
      expect(transcriptInput.value).toBe('paid 4500 for 2 bags of urea');
    });

    // Confirm item is extracted and added to pending table
    await waitFor(() => {
      expect(screen.getByText('fertilizer')).toBeInTheDocument();
      expect(screen.getByDisplayValue('4500')).toBeInTheDocument();
    });
  });

  it('marks items as asr_low_confidence when avg_logprob is below threshold and clears on Accept', async () => {
    // Threshold default is minAvgLogprob: -1.0; here avg_logprob is -1.4 (poor)
    const mockLowConfidenceResponse = {
      text: 'paid 4500 for urea',
      segments: [
        { text: 'paid 4500 for urea', avg_logprob: -1.4, no_speech_prob: 0.05 }
      ],
      duration_s: 1.5,
      model: 'base.en',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockLowConfidenceResponse,
    });

    renderComponent();

    const micBtn = screen.getByTestId('voice-mic-btn');
    await act(async () => {
      fireEvent.click(micBtn);
    });

    const stopBtn = screen.getByText('Stop');
    await act(async () => {
      fireEvent.click(stopBtn);
    });

    // Row should show Needs Review and the low confidence reason
    await waitFor(() => {
      expect(screen.getByText(/Speech recognition confidence is low/i)).toBeInTheDocument();
    });

    // Confirm button must be disabled
    const confirmBtn = screen.getByTestId('voice-confirm-btn');
    expect(confirmBtn).toBeDisabled();

    // Accept button should be available
    const acceptBtn = screen.getByRole('button', { name: /Accept amount/i });
    expect(acceptBtn).toBeInTheDocument();

    // Farmer taps Accept
    await act(async () => {
      fireEvent.click(acceptBtn);
    });

    // Reason is cleared and confirm button becomes enabled
    await waitFor(() => {
      expect(screen.queryByText(/Speech recognition confidence is low/i)).not.toBeInTheDocument();
      expect(confirmBtn).toBeEnabled();
    });
  });

  it('falls back to typed entry and preserves pending items when the speech service returns 503', async () => {
    renderComponent();

    // First add an existing pending item via text entry
    const transcriptInput = screen.getByTestId('voice-transcript-input');
    fireEvent.change(transcriptInput, { target: { value: 'paid 2500 for urea' } });
    const extractBtn = screen.getByTestId('voice-extract-btn');
    fireEvent.click(extractBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue('2500')).toBeInTheDocument();
    });

    // Service failure simulation: 503 Service Unavailable
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: 'Voice service unavailable. Python Whisper service is offline.'
      }),
    });

    const micBtn = screen.getByTestId('voice-mic-btn');
    await act(async () => {
      fireEvent.click(micBtn);
    });

    const stopBtn = screen.getByText('Stop');
    await act(async () => {
      fireEvent.click(stopBtn);
    });

    // Verify error banner is shown with fallback message
    await waitFor(() => {
      expect(screen.getByText(/Voice service unavailable/i)).toBeInTheDocument();
    });

    // Verify existing pending row is preserved
    expect(screen.getByDisplayValue('2500')).toBeInTheDocument();

    // Farmer can still type directly into transcript box
    fireEvent.change(transcriptInput, { target: { value: 'paid 1000 for diesel' } });
    expect(transcriptInput.value).toBe('paid 1000 for diesel');
  });
});
