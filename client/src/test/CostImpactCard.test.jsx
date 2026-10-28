import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExpenseForm from '../pages/ExpenseForm.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: ({ children }) => <a>{children}</a>,
}));

vi.mock('../components/Toast.jsx', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../utils/api.js', () => ({
  apiFetch: vi.fn().mockImplementation((url) => {
    if (url.includes('/variance')) {
      return Promise.resolve({
        categories: {
          seed: {
            expected: 25000,
            expectedToDate: 15000,
            actual: 16000,
            variancePct: 0.067,
            budgetUsedPct: 0.64,
            tier: 'normal',
          },
        },
        total: {
          expected: 220000,
          expectedToDate: 120000,
          variancePct: 0.18,
          budgetUsedPct: 0.23,
          tier: 'significant',
        },
      });
    }
    if (url.includes('/summary')) {
      return Promise.resolve({ totalCost: 50000 });
    }
    if (url.includes('/cycles')) {
      return Promise.resolve({ items: [{ _id: 'cycle1', crop: 'Tomato', season: 'Yala', status: 'active' }] });
    }
    if (url.includes('/activity-codes')) {
      return Promise.resolve([{ _id: 'act1', code: 'A1', nameEn: 'Planting', categoryTags: ['seed'] }]);
    }
    if (url.includes('/auth/me')) {
      return Promise.resolve({ name: 'Sunil Perera', district: 'Kurunegala' });
    }
    return Promise.resolve({ items: [] });
  }),
}));

function renderWithClient(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CostImpactCard Component in ExpenseForm', () => {
  it('renders Cost Impact Summary section', async () => {
    renderWithClient(<ExpenseForm />);
    expect(await screen.findByText('Cost Impact Summary')).toBeInTheDocument();
  });

  it('shows full predicted total, expected-to-date, variance %, and tier badge as separate values', async () => {
    renderWithClient(<ExpenseForm />);
    expect(await screen.findByText('Full Predicted Total:')).toBeInTheDocument();
    expect(await screen.findByText('Expected To Date (Phased):')).toBeInTheDocument();
    expect(await screen.findByText('Variance % vs Phase:')).toBeInTheDocument();
    expect(await screen.findByText('Current Actual Cost:')).toBeInTheDocument();
    expect(await screen.findByText('New Actual Total:')).toBeInTheDocument();

    // Tier badge – find by category tier badge id
    await waitFor(() => {
      const badge = document.getElementById('cost-impact-category-tier-badge');
      expect(badge).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('renders category expected-to-date and dynamic inline warning above +15%', async () => {
    renderWithClient(<ExpenseForm />);
    expect(await screen.findByText(/Expected To Date:/i)).toBeInTheDocument();

    // Dynamic warning banner should be displayed since total variance is +18% (> 15%)
    await waitFor(() => {
      const warning = document.getElementById('cost-impact-warning-banner');
      expect(warning).toBeTruthy();
      expect(warning.textContent).toContain('Overspend Warning');
    });
  });
});
