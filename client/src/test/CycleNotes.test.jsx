import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CycleNotesPage from '../pages/CycleNotesPage.jsx';

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
      <CycleNotesPage />
    </QueryClientProvider>
  );
}

describe('CycleNotesPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notes form generated from schema with existing notes', async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/cycles')) {
        return Promise.resolve({
          items: [{ _id: 'cycle101', status: 'active' }],
        });
      }
      if (url.includes('/cycle-notes')) {
        return Promise.resolve({
          note: {
            pestsAndDiseases: 'Stem borer observed',
            otherCropLosses: 'Minor flood at edge',
            areaNotHarvested: '0.25',
            other: 'Extra nitrogen applied',
          },
        });
      }
      return Promise.resolve({});
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Special Notes/i)).toBeInTheDocument();
    });

    // Check fields from schema
    await waitFor(() => {
      expect(screen.getByDisplayValue('Stem borer observed')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Minor flood at edge')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.25')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Extra nitrogen applied')).toBeInTheDocument();
    });
  });

  it('submits updated notes successfully', async () => {
    mockApiFetch.mockImplementation((url, opts) => {
      if (url.includes('/cycles')) {
        return Promise.resolve({
          items: [{ _id: 'cycle101', status: 'active' }],
        });
      }
      if (url.includes('/cycle-notes')) {
        if (opts?.method === 'POST') {
          return Promise.resolve({ _id: 'note101', other: 'Updated note' });
        }
        return Promise.resolve({ note: null });
      }
      return Promise.resolve({});
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Notes/i })).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    // Modify one of the inputs
    fireEvent.change(inputs[0], { target: { value: 'New pest note' } });

    const saveBtn = screen.getByRole('button', { name: /Save Notes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/cycle-notes',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(mockShowToast).toHaveBeenCalled();
    });
  });

  it('displays closed cycle warning when cycle is closed', async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/cycles')) {
        return Promise.resolve({
          items: [{ _id: 'cycle101', status: 'closed' }],
        });
      }
      if (url.includes('/cycle-notes')) {
        return Promise.resolve({ note: null });
      }
      return Promise.resolve({});
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/cultivation cycle is closed and read-only/i)).toBeInTheDocument();
    });
    // Save button is hidden when closed
    expect(screen.queryByRole('button', { name: /Save Notes/i })).not.toBeInTheDocument();
  });
});
