import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';

import i18n from '../i18n/i18n.js';
import SetupWizard from '../pages/SetupWizard.jsx';
import * as apiModule from '../utils/api.js';

vi.mock('../utils/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

describe('SetupWizard Component Tests per Step', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage('en');
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    apiModule.apiFetch.mockImplementation((url) => {
      if (url.includes('/farmer-profiles')) {
        return Promise.resolve({ items: [] });
      }
      if (url.includes('/machinery-owned')) {
        return Promise.resolve({ items: [] });
      }
      if (url.includes('/lands')) {
        return Promise.resolve({ items: [] });
      }
      if (url.includes('/cycles')) {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({});
    });
  });

  const renderWizard = (initialPath = '/setup/farmer') => {
    return render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/setup/*" element={<SetupWizard />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>
    );
  };

  // ── Step 1 Tests ───────────────────────────────────────────────────────────
  describe('Step 1: Farmer Profile', () => {
    it('validates required name field', async () => {
      renderWizard('/setup/farmer');
      await waitFor(() => expect(screen.getByLabelText(/Name/i)).toBeInTheDocument());

      const nextBtn = screen.getByRole('button', { name: /Save & Next/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });
      expect(apiModule.apiFetch).not.toHaveBeenCalledWith('/farmer-profiles', expect.anything());
    });

    it('rejects future date of birth', async () => {
      renderWizard('/setup/farmer');
      await waitFor(() => expect(screen.getByLabelText(/Name/i)).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Saman Kumara' } });
      const futureDate = '2099-01-01';
      fireEvent.change(screen.getByLabelText(/Date of Birth/i), { target: { value: futureDate } });

      fireEvent.click(screen.getByRole('button', { name: /Save & Next/i }));

      await waitFor(() => {
        expect(screen.getByText(/Date of birth cannot be in the future/i)).toBeInTheDocument();
      });
    });

    it('validates NIC format (9 digits + V/X or 12 digits)', async () => {
      renderWizard('/setup/farmer');
      await waitFor(() => expect(screen.getByLabelText(/Name/i)).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Saman Kumara' } });
      // Invalid NIC
      fireEvent.change(screen.getByLabelText(/NIC/i), { target: { value: '12345ABC' } });

      fireEvent.click(screen.getByRole('button', { name: /Save & Next/i }));

      await waitFor(() => {
        expect(screen.getByText(/NIC must be 9 digits/i)).toBeInTheDocument();
      });

      // Valid 9 digits + V
      fireEvent.change(screen.getByLabelText(/NIC/i), { target: { value: '123456789V' } });
      fireEvent.click(screen.getByRole('button', { name: /Save & Next/i }));

      await waitFor(() => {
        expect(screen.queryByText(/NIC must be 9 digits/i)).not.toBeInTheDocument();
      });
    });

    it('validates phone format (10 digits starting with 0)', async () => {
      renderWizard('/setup/farmer');
      await waitFor(() => expect(screen.getByLabelText(/Name/i)).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Saman Kumara' } });
      // Invalid phone
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '771234567' } });

      fireEvent.click(screen.getByRole('button', { name: /Save & Next/i }));

      await waitFor(() => {
        expect(screen.getByText(/Phone must be a 10-digit Sri Lankan number/i)).toBeInTheDocument();
      });

      // Valid phone
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '0771234567' } });
      fireEvent.click(screen.getByRole('button', { name: /Save & Next/i }));

      await waitFor(() => {
        expect(screen.queryByText(/Phone must be a 10-digit Sri Lankan number/i)).not.toBeInTheDocument();
      });
    });
  });

  // ── Step 2 Tests ───────────────────────────────────────────────────────────
  describe('Step 2: Machinery Owned', () => {
    it('allows empty machinery list and navigates on Next', async () => {
      apiModule.apiFetch.mockResolvedValueOnce({ items: [] });
      renderWizard('/setup/machinery');

      await waitFor(() => {
        expect(screen.getByText(/No machinery recorded yet/i)).toBeInTheDocument();
      });

      const nextBtn = screen.getByRole('button', { name: /Save & Next/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(apiModule.apiFetch).toHaveBeenCalledWith('/machinery-owned/batch', expect.objectContaining({
          method: 'POST',
        }));
      });
    });

    it('supports adding repeatable machinery rows and validates required purchase year if filled', async () => {
      renderWizard('/setup/machinery');
      await waitFor(() => expect(screen.getByText(/No machinery recorded yet/i)).toBeInTheDocument());

      // Add a machinery row
      fireEvent.click(screen.getByRole('button', { name: /Add Equipment/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Equipment/i)).toBeInTheDocument();
      });

      // Clear purchase year
      fireEvent.change(screen.getByLabelText(/Purchase Year/i), { target: { value: '' } });
      fireEvent.change(screen.getByLabelText(/Equipment/i), { target: { value: 'Tractor' } });

      fireEvent.click(screen.getByRole('button', { name: /Save & Next/i }));

      await waitFor(() => {
        expect(screen.getByText(/Purchase year is required/i)).toBeInTheDocument();
      });

      // Now fill valid year
      fireEvent.change(screen.getByLabelText(/Purchase Year/i), { target: { value: '2022' } });
      fireEvent.click(screen.getByRole('button', { name: /Save & Next/i }));

      await waitFor(() => {
        expect(screen.queryByText(/Purchase year is required/i)).not.toBeInTheDocument();
      });
    });
  });

  // ── Step 3 Tests ───────────────────────────────────────────────────────────
  describe('Step 3: Land Details', () => {
    it('requires at least one land with valid landCode and extent', async () => {
      renderWizard('/setup/lands');

      await waitFor(() => {
        expect(screen.getByLabelText(/Land Code/i)).toBeInTheDocument();
      });

      // Clear landCode
      fireEvent.change(screen.getByLabelText(/Land Code/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /Save & Next/i }));

      await waitFor(() => {
        expect(screen.getByText(/Land code is required/i)).toBeInTheDocument();
      });
    });

    it('computes live acres when extentValue and unit change', async () => {
      renderWizard('/setup/lands');

      await waitFor(() => {
        expect(screen.getByLabelText(/Land Code/i)).toBeInTheDocument();
      });

      // 1 Hectare should compute to 2.47 acres
      fireEvent.change(screen.getByLabelText(/\(Extent\)/i), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText(/Extent Unit/i), { target: { value: 'hectare' } });

      await waitFor(() => {
        expect(screen.getByText(/2.47 acres/i)).toBeInTheDocument();
      });
    });

    it('detects duplicate landCode in repeatable land rows', async () => {
      renderWizard('/setup/lands');

      await waitFor(() => {
        expect(screen.getByLabelText(/Land Code/i)).toBeInTheDocument();
      });

      // Add another land row
      fireEvent.click(screen.getByRole('button', { name: /Add Land/i }));

      await waitFor(() => {
        expect(screen.getAllByLabelText(/Land Code/i).length).toBe(2);
      });

      const landCodeInputs = screen.getAllByLabelText(/Land Code/i);
      // Set both to duplicate "L-1"
      fireEvent.change(landCodeInputs[0], { target: { value: 'L-1' } });
      fireEvent.change(landCodeInputs[1], { target: { value: 'L-1' } });

      fireEvent.click(screen.getByRole('button', { name: /Save & Next/i }));

      await waitFor(() => {
        expect(screen.getByText(/This Land Code is already in use by another of your lands/i)).toBeInTheDocument();
      });
    });
  });

  // ── Step 4 Tests ───────────────────────────────────────────────────────────
  describe('Step 4: Start Cultivation Cycle', () => {
    it('creates and activates cycle, displaying baselineStatus', async () => {
      apiModule.apiFetch.mockImplementation((url, opts) => {
        if (url.includes('/lands')) {
          return Promise.resolve({
            items: [{ _id: 'land-123', landCode: 'L-1', district: 'Kurunegala', extentValue: 1, extentUnit: 'acre' }]
          });
        }
        if (url.includes('/cycles') && opts?.method === 'POST') {
          return Promise.resolve({
            _id: 'cycle-999',
            crop: 'Tomato',
            season: 'Yala',
            status: 'active',
            baselineStatus: 'ready',
            baselineSource: 'SO1',
            district: 'Kurunegala'
          });
        }
        return Promise.resolve({ items: [] });
      });

      renderWizard('/setup/cycle');

      await waitFor(() => {
        expect(screen.getByLabelText(/Cultivation Land/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/Cultivation Land/i), { target: { value: 'land-123' } });
      fireEvent.click(screen.getByRole('button', { name: /^Start Cycle$/i }));

      await waitFor(() => {
        expect(screen.getByText(/Active Cultivation Cycle Running/i)).toBeInTheDocument();
        expect(screen.getByText(/Ready \(SO1\)/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Go to Expense Form/i })).toBeInTheDocument();
      });
    });
  });
});
