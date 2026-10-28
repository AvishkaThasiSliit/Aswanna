import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VoiceDatasetCollectionPage from '../pages/VoiceDatasetCollectionPage.jsx';

vi.mock('../utils/auth.jsx', () => ({
  useAuth: () => ({
    user: { _id: 'user-123', name: 'Farmer Sunil', role: 'farmer' }
  })
}));

describe('VoiceDatasetCollectionPage Component (Phase 2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      // 1. Consent GET
      if (url.includes('/api/dataset-collection/consent') && (!opts || opts.method === undefined || opts.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hasConsented: false,
            consentGiven: false,
            pseudonymousSpeakerId: null
          })
        });
      }

      // 2. Consent POST
      if (url.includes('/api/dataset-collection/consent') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hasConsented: true,
            pseudonymousSpeakerId: 'spk_a8f9c1b2d3'
          })
        });
      }

      // 3. Prompts GET
      if (url.includes('/api/dataset-collection/prompts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            categories: [
              { id: 'fertilizer', labelSi: 'පොහොර', labelEn: 'Fertilizer' },
              { id: 'labor', labelSi: 'කම්කරු කුලී', labelEn: 'Hired Labor' }
            ],
            prompts: [
              {
                id: 'VP-PRM-001',
                category: 'fertilizer',
                language: 'si',
                promptText: 'යූරියා මිටි 2 ක් රුපියල් 14000 කට ගත්තා',
                englishMeaning: 'Bought 2 bags of urea fertilizer for 14000 rupees'
              },
              {
                id: 'VP-PRM-003',
                category: 'fertilizer',
                language: 'en',
                promptText: 'Bought two bags of urea fertilizer for 14000 rupees',
                englishMeaning: 'Bought 2 bags of urea fertilizer for 14000 rupees'
              }
            ]
          })
        });
      }

      // 4. Recordings GET
      if (url.includes('/api/dataset-collection/recordings') && (!opts || opts.method === undefined || opts.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            recordings: [
              {
                recordingId: 'rec_prev001',
                pseudonymousSpeakerId: 'spk_a8f9c1b2d3',
                speechMode: 'prompted',
                language: 'si',
                durationSeconds: 3.5,
                reviewStatus: 'reviewed',
                promptText: 'යූරියා මිටි 2 ක් රුපියල් 14000 කට ගත්තා'
              }
            ]
          })
        });
      }

      // 5. Recordings POST (upload)
      if (url.includes('/api/dataset-collection/recordings') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            message: 'Voice recording submitted successfully for review',
            recording: {
              recordingId: 'rec_new12345678',
              pseudonymousSpeakerId: 'spk_a8f9c1b2d3',
              speechMode: 'prompted',
              reviewStatus: 'pending'
            }
          })
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders consent confirmation card when participant has not yet consented', async () => {
    render(<VoiceDatasetCollectionPage />);

    await waitFor(() => {
      expect(screen.getByText(/Participant Consent/i)).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    const submitBtn = screen.getByRole('button', { name: /Confirm Consent/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submission when consent is checked and transitions to recording interface', async () => {
    render(<VoiceDatasetCollectionPage />);

    await waitFor(() => {
      expect(screen.getByText(/Participant Consent/i)).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const submitBtn = screen.getByRole('button', { name: /Confirm Consent/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Pseudonymous Speaker ID/i)).toBeInTheDocument();
      expect(screen.getByText(/spk_a8f9c1b2d3/i)).toBeInTheDocument();
    });
  });

  it('allows switching between Prompted Speech and Natural Speech modes', async () => {
    // Override consent to already true
    global.fetch.mockImplementationOnce((url) => {
      if (url.includes('/api/dataset-collection/consent')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hasConsented: true,
            pseudonymousSpeakerId: 'spk_a8f9c1b2d3'
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<VoiceDatasetCollectionPage />);

    await waitFor(() => {
      expect(screen.getByText(/Prompted Speech/i)).toBeInTheDocument();
      expect(screen.getByText(/Natural Speech/i)).toBeInTheDocument();
    });

    // Switch to Natural Speech
    const naturalBtn = screen.getByRole('button', { name: /Natural Speech/i });
    fireEvent.click(naturalBtn);

    expect(screen.getByText(/Natural Speech Recording Instructions/i)).toBeInTheDocument();
  });

  it('displays recent contributed recordings with reviewed gold status', async () => {
    global.fetch.mockImplementationOnce((url) => {
      if (url.includes('/api/dataset-collection/consent')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hasConsented: true,
            pseudonymousSpeakerId: 'spk_a8f9c1b2d3'
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<VoiceDatasetCollectionPage />);

    await waitFor(() => {
      expect(screen.getByText('rec_prev001')).toBeInTheDocument();
      expect(screen.getByText(/Reviewed \(Gold\)/i)).toBeInTheDocument();
    });
  });

  it('allows participant to open revocation modal and withdraw consent', async () => {
    // Initial fetch returns active consent
    global.fetch.mockImplementation((url, opts) => {
      if (url.includes('/api/dataset-collection/consent/revoke') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            message: 'Consent revoked',
            revokedAt: new Date().toISOString()
          })
        });
      }
      if (url.includes('/api/dataset-collection/consent') && (!opts?.method || opts.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hasConsented: true,
            pseudonymousSpeakerId: 'spk_a8f9c1b2d3',
            consentVersion: '1.0'
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<VoiceDatasetCollectionPage />);

    await waitFor(() => {
      expect(screen.getByText(/Withdraw Consent/i)).toBeInTheDocument();
    });

    // Click Withdraw Consent
    fireEvent.click(screen.getByRole('button', { name: /Withdraw Consent/i }));

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText(/Withdraw Voice Consent/i)).toBeInTheDocument();
      expect(screen.getByText(/Future training manifests will strictly exclude your audio/i)).toBeInTheDocument();
    });

    // Confirm revocation
    const confirmBtn = screen.getByRole('button', { name: /Yes, Withdraw Consent/i });
    fireEvent.click(confirmBtn);

    // Verify it transitions back to unconsented state
    await waitFor(() => {
      expect(screen.getByText(/Consent has been revoked/i)).toBeInTheDocument();
    });
  });
});
