import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BudgetOverview from '../pages/BudgetOverview.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en' },
  }),
}));

// Mock recharts – jsdom has no SVG layout engine
vi.mock('recharts', () => {
  const Passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    ComposedChart: Passthrough,
    PieChart: Passthrough,
    Pie: () => null,
    Cell: () => null,
    Line: () => null,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    ReferenceDot: () => null,
  };
});

// Mock DailyCostTracker (uses recharts internally)
vi.mock('../components/DailyCostTracker.jsx', () => ({
  default: () => <div data-testid="daily-cost-tracker">DailyCostTracker</div>,
}));

vi.mock('../utils/api.js', () => ({
  apiFetch: vi.fn().mockImplementation((url) => {
    if (url.includes('/variance')) {
      return Promise.resolve({
        baselines: { seed: { expected: 25000 }, fertilizer: { expected: 45000 }, machinery: { expected: 30000 } },
        categories: {
          seed: { expected: 25000, expectedToDate: 17500, actual: 22000, variancePct: 0.04, budgetUsedPct: 0.728, tier: 'normal', low: 20000, high: 30000, is_estimated_split: false },
          fertilizer: { expected: 45000, expectedToDate: 22500, actual: 28000, variancePct: 0.244, budgetUsedPct: 0.622, tier: 'significant', low: 36000, high: 54000, is_estimated_split: false },
          machinery: { expected: 30000, expectedToDate: 15000, actual: 16000, variancePct: 0.067, budgetUsedPct: 0.533, tier: 'normal', low: 24000, high: 36000, is_estimated_split: true },
        },
        total: { expected: 100000, expectedToDate: 55000, actual: 66000, variancePct: 0.131, budgetUsedPct: 0.622, tier: 'attention', low: 80000, high: 120000 },
        intervalLow: 80000,
        intervalHigh: 120000,
        withinPredictionInterval: true,
        so1Metadata: {
          model_version: 'extratrees_champion_v2',
          low_confidence: true,
          district_policy_used: 'extrapolated',
          lag_saturation_detected: true,
          lag_saturation_note: 'Prior season cost exceeds training maximum',
        },
      });
    }
    if (url.includes('/cycles')) {
      return Promise.resolve({ items: [{ _id: 'cycle1', crop: 'Tomato', season: 'Yala', status: 'active' }] });
    }
    return Promise.resolve({ items: [] });
  }),
}));

function renderWithClient(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('BudgetOverview Page Component', () => {
  it('renders Cost Impact Summary title and KPI section', async () => {
    renderWithClient(<BudgetOverview />);
    expect(await screen.findByText(/Predicted vs Actual Cost Impact/i)).toBeInTheDocument();
  });

  it('renders category variance table with status badges and estimated split badge', async () => {
    renderWithClient(<BudgetOverview />);
    await screen.findByText('Rs. 100,000');
    expect(screen.getAllByText('Seed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fertilizer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Machinery').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Normal').length).toBeGreaterThanOrEqual(1);

    const splitBadge = await screen.findByText('so1.estimatedSplit');
    expect(splitBadge).toBeInTheDocument();
  });

  it('renders SO1 prediction interval panel and within-interval information badge', async () => {
    renderWithClient(<BudgetOverview />);
    await screen.findByText('Rs. 100,000');

    expect(await screen.findByText(/so1.predictionInterval/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/so1.withinInterval/i)).length).toBeGreaterThanOrEqual(1);
  });

  it('renders SO1 metadata banners for low confidence, extrapolation, and lag saturation', async () => {
    renderWithClient(<BudgetOverview />);
    await screen.findByText('Rs. 100,000');

    expect(await screen.findByText('so1.lowConfidenceBanner')).toBeInTheDocument();
    expect(await screen.findByText('so1.extrapolatedBanner')).toBeInTheDocument();
    expect(await screen.findByText('so1.lagSaturationBanner')).toBeInTheDocument();
  });

  it('renders missing baseline message and Retry Baseline button when variance status is missing_baseline', async () => {
    const { apiFetch } = await import('../utils/api.js');
    apiFetch.mockImplementation((url) => {
      if (url.includes('/variance')) {
        return Promise.resolve({
          status: 'missing_baseline',
          baselineStatus: 'missing',
          baselines: null,
          total: null,
          categories: null,
        });
      }
      if (url.includes('/cycles')) {
        return Promise.resolve({ items: [{ _id: 'cycle_missing', crop: 'Paddy', season: 'Maha', status: 'active', baselineStatus: 'missing' }] });
      }
      return Promise.resolve({ items: [] });
    });

    renderWithClient(<BudgetOverview />);
    expect(await screen.findByText(/No baseline available yet/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Retry Baseline/i })).toBeInTheDocument();
  });

  it('invokes retry baseline API when Retry Baseline button is clicked', async () => {
    const { apiFetch } = await import('../utils/api.js');
    apiFetch.mockImplementation((url, opts) => {
      if (url.includes('/retry-baseline')) {
        return Promise.resolve({ success: true, baselineStatus: 'ready' });
      }
      if (url.includes('/variance')) {
        return Promise.resolve({
          status: 'missing_baseline',
          baselineStatus: 'missing',
          baselines: null,
          total: null,
          categories: null,
        });
      }
      if (url.includes('/cycles')) {
        return Promise.resolve({ items: [{ _id: 'cycle_retry_test', crop: 'Paddy', season: 'Maha', status: 'active', baselineStatus: 'missing' }] });
      }
      return Promise.resolve({ items: [] });
    });

    renderWithClient(<BudgetOverview />);
    const retryBtn = await screen.findByRole('button', { name: /Retry Baseline/i });
    retryBtn.click();
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/retry-baseline'), expect.objectContaining({ method: 'POST' }));
    });
  });

  it('handles empty category variance safely when cycle has ready baseline', async () => {
    const { apiFetch } = await import('../utils/api.js');
    apiFetch.mockImplementation((url) => {
      if (url.includes('/variance')) {
        return Promise.resolve({
          categories: {},
          total: { expected: 100000, expectedToDate: 50000, actual: 50000, variancePct: 0, budgetUsedPct: 0.5, tier: 'normal' },
          so1Metadata: { model_version: 'extratrees_champion_v2' },
        });
      }
      if (url.includes('/cycles')) {
        return Promise.resolve({ items: [{ _id: 'cycle_empty_cat', crop: 'Paddy', season: 'Maha', status: 'active', baselineStatus: 'ready' }] });
      }
      return Promise.resolve({ items: [] });
    });

    renderWithClient(<BudgetOverview />);
    expect(await screen.findByText(/Predicted vs Actual Cost Impact/i)).toBeInTheDocument();
  });
});

