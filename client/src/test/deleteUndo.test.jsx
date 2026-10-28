import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => {
      const map = {
        'toast.deleted':  'Expense record deleted.',
        'toast.undo':     'Undo',
        'toast.restored': 'Expense record restored successfully.',
        'toast.error':    'An error occurred.',
        'toast.cycleClosed': 'Cycle is closed.',
        'confirm.deleteTitle':   'Delete Expense Record',
        'confirm.deleteMessage': 'Are you sure?',
        'confirm.confirmDelete': 'Delete Record',
        'confirm.cancel':        'Cancel',
      };
      return map[key] || fallback || key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../utils/api.js', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code   = code;
    }
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return actual;
});

import { apiFetch } from '../utils/api.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { ToastProvider, useToast } from '../components/Toast.jsx';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function Wrapper({ children }) {
  return (
    <QueryClientProvider client={makeQC()}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

// ─── ConfirmDialog tests ──────────────────────────────────────────────────────

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmDialog isOpen={false} title="T" message="M" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText('T')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Delete Expense Record"
        message="Are you sure?"
        confirmText="Delete Record"
        cancelText="Cancel"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Delete Expense Record')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        title="T"
        message="M"
        confirmText="Delete Record"
        cancelText="Cancel"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Delete Record'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        title="T"
        message="M"
        confirmText="Delete Record"
        cancelText="Cancel"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ─── Delete + Undo flow tests (using ToastProvider) ──────────────────────────

function DeleteUndoTestHarness({ expenseId = 'exp-123', resolveDelete = true, resolveRestore = true }) {
  const { showToast } = useToast();

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
      showToast('Expense record deleted.', 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            await apiFetch(`/api/expenses/${expenseId}/restore`, { method: 'POST' });
            showToast('Expense record restored successfully.', 'success');
          } catch {
            showToast('An error occurred.', 'error');
          }
        },
      });
    } catch {
      showToast('An error occurred.', 'error');
    }
  };

  return <button onClick={handleDelete}>Delete</button>;
}

describe('Delete + Undo flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows toast after successful delete', async () => {
    apiFetch.mockResolvedValueOnce({ success: true });
    render(
      <Wrapper>
        <DeleteUndoTestHarness />
      </Wrapper>
    );
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => {
      expect(screen.getByText('Expense record deleted.')).toBeInTheDocument();
    });
    expect(screen.getByText('Undo')).toBeInTheDocument();
  });

  it('calls restore API when Undo is clicked', async () => {
    apiFetch
      .mockResolvedValueOnce({ success: true })   // DELETE
      .mockResolvedValueOnce({ _id: 'exp-123' }); // restore

    render(
      <Wrapper>
        <DeleteUndoTestHarness />
      </Wrapper>
    );

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(screen.getByText('Undo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Undo'));

    await waitFor(() => {
      expect(screen.getByText('Expense record restored successfully.')).toBeInTheDocument();
    });

    expect(apiFetch).toHaveBeenCalledWith('/api/expenses/exp-123/restore', { method: 'POST' });
  });

  it('shows error toast when delete fails', async () => {
    apiFetch.mockRejectedValueOnce(new Error('Network error'));
    render(
      <Wrapper>
        <DeleteUndoTestHarness />
      </Wrapper>
    );
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => {
      expect(screen.getByText('An error occurred.')).toBeInTheDocument();
    });
  });
});
