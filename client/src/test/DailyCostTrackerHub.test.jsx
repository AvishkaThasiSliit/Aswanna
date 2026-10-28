import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DailyCostTrackerHub from '../pages/DailyCostTrackerHub.jsx';
import en from '../i18n/locales/en.json';

function getNested(obj, keyPath) {
  return keyPath.split('.').reduce((acc, part) => acc?.[part], obj) || keyPath;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => getNested(en, key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('../utils/api.js', () => ({
  apiFetch: vi.fn().mockImplementation((url) => {
    if (url.includes('/api/cycles?status=active')) {
      return Promise.resolve({ items: [{ _id: 'cycle1', crop: 'Paddy', season: 'Maha' }] });
    }
    if (url.includes('/api/expenses')) {
      return Promise.resolve({
        items: [
          { _id: 'e1', entryDate: new Date().toISOString(), dayStatus: 'worked', totalAmount: 5000, activityCode: { nameEn: 'Land Preparation' }, inputs: [{ categoryTag: 'seed', cost: 5000 }] },
          { _id: 'e2', entryDate: '2026-10-09T00:00:00.000Z', dayStatus: 'worked', totalAmount: 12000, activityCode: { nameEn: 'Fertilizing' }, inputs: [{ categoryTag: 'fertilizer', cost: 12000 }] },
        ]
      });
    }
    if (url.includes('/variance')) {
      return Promise.resolve({
        total: { expected: 100000, expectedToDate: 45000, actual: 17000, variancePct: 0.05, tier: 'normal' },
        categories: {
          seed: { expectedToDate: 5000, actual: 5000 },
          fertilizer: { expectedToDate: 10000, actual: 12000 }
        }
      });
    }
    return Promise.resolve([]);
  }),
}));

function renderHub() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <DailyCostTrackerHub />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('DailyCostTrackerHub Page', () => {
  it('renders all 5 numbered sections', async () => {
    renderHub();
    expect(await screen.findByText('Financial Summary & Budget Tiles')).toBeInTheDocument();
    expect(screen.getByText('Predicted vs Actual Cost Trend')).toBeInTheDocument();
    expect(screen.getByText('Expense Breakdown (Donut)')).toBeInTheDocument();
    expect(screen.getByText('Recent 4 Expense Records')).toBeInTheDocument();
    expect(screen.getByText('Spending Status Panel')).toBeInTheDocument();
  });

  it('displays summary tiles including remaining budget and status badge', async () => {
    renderHub();
    expect(await screen.findByText("Spent Today")).toBeInTheDocument();
    expect(screen.getByText("Current Cultivation Cost")).toBeInTheDocument();
    expect(screen.getByText("Predicted Total Cost")).toBeInTheDocument();
    expect(screen.getByText("Remaining Budget")).toBeInTheDocument();
    expect(await screen.findByText(/Normal Status/i)).toBeInTheDocument();
  });

  it('renders quick action buttons: Add New Expense and View All Expenses', async () => {
    renderHub();
    expect(await screen.findByRole('button', { name: /Add New Expense/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View All Expenses/i })).toBeInTheDocument();
  });

  it('displays clear "No baseline yet" when baseline is missing instead of silent zeros', async () => {
    const { apiFetch } = await import('../utils/api.js');
    apiFetch.mockImplementation((url) => {
      if (url.includes('/api/cycles?status=active')) {
        return Promise.resolve({ items: [{ _id: 'cycle_miss', crop: 'Paddy', season: 'Maha', baselineStatus: 'missing' }] });
      }
      if (url.includes('/api/expenses')) {
        return Promise.resolve({ items: [] });
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
      return Promise.resolve({ items: [] });
    });

    renderHub();
    const badges = await screen.findAllByText(/No baseline yet/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText(/Retry Baseline/i)).toBeInTheDocument();
  });
});
