import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AlertsPage from '../pages/AlertsPage.jsx';
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

vi.mock('../components/Toast.jsx', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../utils/api.js', () => ({
  apiFetch: vi.fn().mockImplementation((url) => {
    if (url.includes('/api/cycles?status=active')) {
      return Promise.resolve({ items: [{ _id: 'cycle1', crop: 'Tomato', season: 'Yala' }] });
    }
    if (url.includes('/api/alerts')) {
      return Promise.resolve([
        { _id: 'a1', category: 'fertilizer', tier: 'significant', variancePct: 0.25, expectedToDate: 22500, actualToDate: 28125, dayOfCycle: 36, resolvedAt: null },
        { _id: 'a2', category: 'fuel', tier: 'attention', variancePct: 0.10, expectedToDate: 12500, actualToDate: 13750, dayOfCycle: 36, resolvedAt: null },
      ]);
    }
    return Promise.resolve([]);
  }),
}));

function renderWithClient(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('AlertsPage Component', () => {
  it('renders alerts header and overspend alert cards', async () => {
    renderWithClient(<AlertsPage />);
    expect(await screen.findByText(/Tiered budget overspend alerts/i)).toBeInTheDocument();
    expect(await screen.findByText('Fertilizer')).toBeInTheDocument();
    expect(await screen.findByText('Fuel')).toBeInTheDocument();
  });

  it('displays resolve button for unresolved alerts', async () => {
    renderWithClient(<AlertsPage />);
    const resolveBtns = await screen.findAllByText(/Resolve/i);
    expect(resolveBtns.length).toBeGreaterThan(0);
  });

  it('renders severity and resolved status filter dropdowns in the UI', async () => {
    renderWithClient(<AlertsPage />);
    const severitySelect = await screen.findByRole('combobox', { name: /Severity/i });
    expect(severitySelect).toBeInTheDocument();
    expect(screen.getByText('All Severities')).toBeInTheDocument();

    const statusSelect = screen.getByRole('combobox', { name: /Status/i });
    expect(statusSelect).toBeInTheDocument();
  });

  it('displays deviation % and recommended action on alert cards', async () => {
    renderWithClient(<AlertsPage />);
    expect(await screen.findByText(/\+25\.0%/)).toBeInTheDocument();
    const recActions = await screen.findAllByText(/Recommended Action/i);
    expect(recActions.length).toBeGreaterThan(0);
  });
});
