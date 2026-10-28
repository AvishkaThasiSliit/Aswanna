import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HarvestSales from '../pages/HarvestSales.jsx';

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
      <HarvestSales />
    </QueryClientProvider>
  );
}

describe('HarvestSales Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockImplementation((url, opts) => {
      if (url.includes('/cycles')) {
        return Promise.resolve({
          items: [{ _id: 'cycle123', status: 'active', startDate: '2026-04-01' }],
        });
      }
      if (url.includes('/harvests')) {
        if (opts?.method === 'POST') {
          return Promise.resolve({ _id: 'h2', round: 2, yield: 300 });
        }
        return Promise.resolve({
          items: [{ _id: 'h1', round: 1, yield: 500, harvestDate: '2026-04-10' }],
        });
      }
      if (url.includes('/sales')) {
        if (opts?.method === 'POST') {
          return Promise.resolve({ _id: 's2', round: 2, quantitySold: 200, income: 25000 });
        }
        return Promise.resolve({
          items: [{ _id: 's1', round: 1, quantitySold: 600, income: 40000, saleDate: '2026-04-12' }],
        });
      }
      return Promise.resolve({});
    });
  });

  it('renders harvest and sales sections with computed totals', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Harvest & Sales/i)).toBeInTheDocument();
    });

    // Check computed yield and sales
    await waitFor(() => {
      expect(document.getElementById('total-harvest-display')).toHaveTextContent('500 kg');
      expect(screen.getAllByText(/600 kg/).length).toBeGreaterThan(0);
    });

    // Warning because totalSold (600) > totalHarvest (500)
    expect(screen.getByText(/Warning: Total quantity sold exceeds total quantity harvested/i)).toBeInTheDocument();
  });

  it('submits a new harvest round', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Round/i })).toBeEnabled();
    });

    const yieldInput = screen.getByLabelText(/Yield/i);
    fireEvent.change(yieldInput, { target: { value: '300' } });

    const submitBtn = screen.getByRole('button', { name: /Add Round/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/harvests',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('triggers soft delete and toast undo callback on harvest delete', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByTitle('Delete').length).toBeGreaterThan(0);
    });

    const deleteBtns = screen.getAllByTitle('Delete');
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/harvests/h1', { method: 'DELETE' });
      expect(mockShowToast).toHaveBeenCalled();
    });
  });
});
