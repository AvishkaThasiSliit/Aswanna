import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CycleSummaryPage from '../pages/CycleSummaryPage.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
    i18n: { language: 'en' },
  }),
}));

const mockApiFetch = vi.fn();
vi.mock('../utils/api.js', () => ({
  apiFetch: (...args) => mockApiFetch(...args),
}));

const mockShowToast = vi.fn();
vi.mock('../components/Toast.jsx', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CycleSummaryPage />
    </QueryClientProvider>
  );
}

describe('CycleSummaryPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tiles and shows profit when sales exist', async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/cycles') && !url.includes('/summary')) {
        return Promise.resolve({
          items: [{ _id: 'cycle555', status: 'active' }],
        });
      }
      if (url.includes('/summary')) {
        return Promise.resolve({
          totalCost: 17000,
          totalIncome: 62000,
          profit: 45000,
          totalHarvest: 800,
          costPerKg: 21.25,
          hasSales: true,
          harvestCount: 2,
          saleCount: 2,
        });
      }
      return Promise.resolve({});
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Cultivation Cycle Summary/i)).toBeInTheDocument();
    });

    // Wait for summary query to load and render cards
    await waitFor(() => {
      expect(document.getElementById('summary-profit-card')).toBeInTheDocument();
      expect(screen.getByText('Rs. 21.25')).toBeInTheDocument();
      expect(document.getElementById('summary-total-harvest')).toHaveTextContent('800 kg');
    });
  });

  it('hides profit value and shows notice when sales do not exist', async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/cycles') && !url.includes('/summary')) {
        return Promise.resolve({
          items: [{ _id: 'cycle555', status: 'active' }],
        });
      }
      if (url.includes('/summary')) {
        return Promise.resolve({
          totalCost: 17000,
          totalIncome: 0,
          profit: -17000,
          totalHarvest: 800,
          costPerKg: 21.25,
          hasSales: false,
          harvestCount: 2,
          saleCount: 0,
        });
      }
      return Promise.resolve({});
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Cultivation Cycle Summary/i)).toBeInTheDocument();
    });

    // Notice is shown
    expect(document.querySelector('#summary-no-sales-notice')).toBeInTheDocument();
    // Profit card with value is NOT shown
    expect(document.querySelector('#summary-profit-card')).toBeNull();
  });

  it('handles Close Cycle with confirmation dialog', async () => {
    mockApiFetch.mockImplementation((url, opts) => {
      if (url.includes('/transition')) {
        return Promise.resolve({ _id: 'cycle555', status: 'closed' });
      }
      if (url.includes('/summary')) {
        return Promise.resolve({
          totalCost: 17000,
          totalIncome: 62000,
          profit: 45000,
          totalHarvest: 800,
          costPerKg: 21.25,
          hasSales: true,
        });
      }
      if (url.includes('/cycles')) {
        return Promise.resolve({
          items: [{ _id: 'cycle555', status: 'active' }],
        });
      }
      return Promise.resolve({});
    });

    renderComponent();

    await waitFor(() => {
      const btn = document.getElementById('close-cycle-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });

    const closeBtn = document.getElementById('close-cycle-btn');
    fireEvent.click(closeBtn);

    // Confirm dialog opens
    await waitFor(() => {
      expect(screen.getByText(/Close Cultivation Cycle\?/i)).toBeInTheDocument();
    });

    const confirmBtns = screen.getAllByRole('button', { name: /Close Cycle/i });
    // Click the confirmation button in dialog
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/cycles/cycle555/transition',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
