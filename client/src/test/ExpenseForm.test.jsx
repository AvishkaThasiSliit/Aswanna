import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';

import i18n from '../i18n/i18n.js';
import ExpenseForm from '../pages/ExpenseForm.jsx';
import { calculateExpenseTotals } from '../../../shared/calc.js';
import * as apiModule from '../utils/api.js';

// Mock apiFetch
vi.mock('../utils/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

describe('ExpenseForm Unit & Integration Tests', () => {
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
      if (url.includes('/cycles')) {
        return Promise.resolve({
          items: [{ _id: 'c1', crop: 'Tomato', season: 'Yala', status: 'active', extentValue: 0.5, extentUnit: 'acre', district: 'Kurunegala' }]
        });
      }
      if (url.includes('/auth/me')) {
        return Promise.resolve({
          user: { name: 'Sunil Perera' },
          farmerProfile: { fullName: 'Sunil Perera', district: 'Kurunegala' }
        });
      }
      if (url.includes('/activity-codes')) {
        return Promise.resolve({
          items: [
            { _id: 'ac1', code: 'PH-01', nameEn: 'land preparation', nameSi: 'බිම් සකස් කිරීම', isPlaceholder: true },
            { _id: 'ac2', code: 'PH-02', nameEn: 'nursery', nameSi: 'තවාන් කටයුතු', isPlaceholder: true }
          ]
        });
      }
      if (url.includes('/summary')) {
        return Promise.resolve({ totalCost: 45000 });
      }
      return Promise.resolve({});
    });
  });

  const renderComponent = (initialEntries = ['/tracker/add']) => {
    return render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route path="/tracker/add" element={<ExpenseForm />} />
              <Route path="/tracker/edit/:id" element={<ExpenseForm />} />
              <Route path="/tracker/records" element={<div>Records Page</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>
    );
  };

  it('calculates preview total correctly (8500 + 3500 + 5000 = 17000)', () => {
    const rawData = {
      inputs: [{ cost: 8500 }],
      machinery: { cost: 3500 },
      labour: { familyLabour: 1, hiredLabour: 1, dailyWage: 2500 }, // (1+1)*2500 = 5000
      other: { amount: 0 },
      dayStatus: 'worked'
    };

    const result = calculateExpenseTotals(rawData);
    expect(result.subtotals.inputs).toBe(8500);
    expect(result.subtotals.machinery).toBe(3500);
    expect(result.subtotals.labour).toBe(5000);
    expect(result.totalAmount).toBe(17000);
  });

  it('toggles no_work dayStatus hiding cost sections', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Date & Activity' })).toBeInTheDocument();
    });

    const noWorkCheckbox = screen.getByRole('checkbox', { name: /Day Status/i });
    expect(noWorkCheckbox).not.toBeChecked();
    expect(screen.getByRole('heading', { name: 'Inputs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Machinery' })).toBeInTheDocument();

    // Toggle no_work
    fireEvent.click(noWorkCheckbox);
    expect(noWorkCheckbox).toBeChecked();

    // Inputs and Machinery headers should now be hidden
    expect(screen.queryByRole('heading', { name: 'Inputs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Machinery' })).not.toBeInTheDocument();
  });

  it('adds and removes repeatable input lines', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Input #1')).toBeInTheDocument();
    });

    expect(screen.queryByText('Input #2')).not.toBeInTheDocument();

    // Add input line
    const addButton = screen.getByRole('button', { name: /\+ Add Input Line/i });
    fireEvent.click(addButton);

    expect(screen.getByText('Input #1')).toBeInTheDocument();
    expect(screen.getByText('Input #2')).toBeInTheDocument();

    // Remove input line
    const removeButton = screen.getByRole('button', { name: /Remove input line #1/i });
    fireEvent.click(removeButton);

    expect(screen.queryByText('Input #2')).not.toBeInTheDocument();
  });

  it('displays mapped server field error next to activity select on submission failure', async () => {
    apiModule.apiFetch.mockImplementation((url, opts) => {
      if (opts?.method === 'POST' && url.includes('/expenses')) {
        // Construct ApiError matching exact server shape (status, code, message, fields)
        const error = new apiModule.ApiError(
          422,
          'VALIDATION_ERROR',
          'Validation failed',
          [{ field: 'activityCode', message: 'Activity code is invalid' }]
        );
        return Promise.reject(error);
      }
      if (url.includes('/cycles')) {
        return Promise.resolve({ items: [{ _id: 'c1', crop: 'Tomato', season: 'Yala', status: 'active', extentValue: 0.5, extentUnit: 'acre', district: 'Kurunegala' }] });
      }
      if (url.includes('/auth/me')) {
        return Promise.resolve({
          user: { name: 'Sunil Perera' },
          farmerProfile: { fullName: 'Sunil Perera', district: 'Kurunegala' }
        });
      }
      if (url.includes('/activity-codes')) {
        return Promise.resolve({
          items: [
            { _id: 'ac1', code: 'PH-01', nameEn: 'land preparation', nameSi: 'බිම් සකස් කිරීම', isPlaceholder: true }
          ]
        });
      }
      return Promise.resolve({});
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Date & Activity')).toBeInTheDocument();
      expect(screen.getByText('Tomato (Yala)')).toBeInTheDocument();
      expect(screen.getByText(/PH-01/i)).toBeInTheDocument();
    });

    // Select activity code
    const activitySelect = screen.getByRole('combobox', { name: /Activity/i });
    fireEvent.change(activitySelect, { target: { value: 'ac1' } });

    const inputCost = screen.getByLabelText(/Input Cost #1/i);
    fireEvent.change(inputCost, { target: { value: '5000' } });

    const saveButton = screen.getByRole('button', { name: /Save Expense/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Activity code is invalid')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
