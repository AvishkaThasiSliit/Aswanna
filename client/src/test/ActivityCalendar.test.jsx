import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ActivityCalendarPage from '../pages/ActivityCalendarPage.jsx';

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

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ActivityCalendarPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('ActivityCalendarPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 13-month grid with activity codes and greys out invalid days', async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/cycles') && !url.includes('/calendar')) {
        return Promise.resolve({
          items: [{ _id: 'cycle777', status: 'active', startDate: '2026-04-01' }],
        });
      }
      if (url.includes('/calendar')) {
        return Promise.resolve({
          months: [
            { index: 1, year: 2026, month: 4, monthName: 'Apr', daysInMonth: 30, invalidDays: [31] },
            { index: 2, year: 2026, month: 5, monthName: 'May', daysInMonth: 31, invalidDays: [] },
            { index: 3, year: 2026, month: 6, monthName: 'Jun', daysInMonth: 30, invalidDays: [31] },
          ],
          calendar: {
            2026: {
              4: { 15: ['EXP', 'IRR'] },
              5: { 10: ['NW'] },
            },
          },
          dayDetails: {
            '2026-04-15': {
              date: '2026-04-15',
              year: 2026,
              month: 4,
              day: 15,
              activityCodes: ['EXP', 'IRR'],
              hasNoWork: false,
              expenses: [
                { _id: 'e1', entryDate: '2026-04-15', activityCode: 'EXP', activityName: 'Land Prep', dayStatus: 'worked', totalAmount: 4500 },
              ],
            },
          },
        });
      }
      return Promise.resolve({});
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Activity Calendar/i);
    });

    // Check table rendered
    expect(document.querySelector('#activity-calendar-table')).toBeInTheDocument();

    // Months rendered
    await waitFor(() => {
      expect(screen.getByText('Apr')).toBeInTheDocument();
      expect(screen.getByText('May')).toBeInTheDocument();
      expect(screen.getByText('Jun')).toBeInTheDocument();
    });

    // Check activity codes rendered
    expect(screen.getByText('EXP,IRR')).toBeInTheDocument();
    // Check NW rendered (in legend and in grid)
    expect(screen.getAllByText('NW').length).toBeGreaterThanOrEqual(2);

    // Check invalid days (30-day months have day 31 invalid)
    const invalidCells = document.querySelectorAll('td[title="Invalid day"]');
    expect(invalidCells.length).toBeGreaterThanOrEqual(2);
  });

  it('opens day details modal when clicking on a day with expenses', async () => {
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/cycles') && !url.includes('/calendar')) {
        return Promise.resolve({
          items: [{ _id: 'cycle777', status: 'active', startDate: '2026-04-01' }],
        });
      }
      if (url.includes('/calendar')) {
        return Promise.resolve({
          months: [
            { index: 1, year: 2026, month: 4, monthName: 'Apr', daysInMonth: 30, invalidDays: [31] },
          ],
          calendar: {
            2026: {
              4: { 15: ['EXP'] },
            },
          },
          dayDetails: {
            '2026-04-15': {
              date: '2026-04-15',
              year: 2026,
              month: 4,
              day: 15,
              activityCodes: ['EXP'],
              hasNoWork: false,
              expenses: [
                { _id: 'e1', entryDate: '2026-04-15', activityCode: 'EXP', activityName: 'Land Prep', dayStatus: 'worked', totalAmount: 4500 },
              ],
            },
          },
        });
      }
      return Promise.resolve({});
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('EXP')).toBeInTheDocument();
    });

    // Click on the day cell button
    fireEvent.click(screen.getByTestId('cal-day-btn-2026-4-15'));

    // Modal appears
    await waitFor(() => {
      expect(document.getElementById('day-expenses-modal')).toBeInTheDocument();
      expect(screen.getByText(/Expenses for 2026-04-15/i)).toBeInTheDocument();
      expect(screen.getByText(/Land Prep/i)).toBeInTheDocument();
    });
  });
});
