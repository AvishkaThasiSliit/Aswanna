import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FilterBar from '../components/FilterBar.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = {
        'filters.search':   'Search...',
        'filters.category': 'Category',
        'filters.clear':    'Clear Filters',
        'categories.all':   'All Categories',
        'categories.inputs':   'Inputs',
        'categories.machinery':'Machinery',
        'categories.labour':   'Labour',
        'categories.other':    'Other',
      };
      return map[key] || key;
    },
  }),
}));

describe('FilterBar', () => {
  it('calls setFilters when search input changes', () => {
    const setFilters = vi.fn();
    render(
      <FilterBar
        filters={{ search: '', category: '', startDate: '', endDate: '', page: 1 }}
        setFilters={setFilters}
        onClear={vi.fn()}
      />
    );
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'seed' } });
    expect(setFilters).toHaveBeenCalledTimes(1);
    const updater = setFilters.mock.calls[0][0];
    expect(updater({ search: '', category: '', page: 1 })).toMatchObject({ search: 'seed', page: 1 });
  });

  it('calls setFilters with correct category on category change', () => {
    const setFilters = vi.fn();
    render(
      <FilterBar
        filters={{ search: '', category: '', startDate: '', endDate: '', page: 1 }}
        setFilters={setFilters}
        onClear={vi.fn()}
      />
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'labour' } });
    expect(setFilters).toHaveBeenCalledTimes(1);
    const updater = setFilters.mock.calls[0][0];
    expect(updater({ search: '', category: '', page: 1 })).toMatchObject({ category: 'labour', page: 1 });
  });

  it('shows clear button when filters are active', () => {
    render(
      <FilterBar
        filters={{ search: 'tomato', category: '', startDate: '', endDate: '', page: 1 }}
        setFilters={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
  });

  it('hides clear button when no active filters', () => {
    render(
      <FilterBar
        filters={{ search: '', category: '', startDate: '', endDate: '', page: 1 }}
        setFilters={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.queryByText('Clear Filters')).not.toBeInTheDocument();
  });

  it('calls onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    render(
      <FilterBar
        filters={{ search: 'x', category: '', startDate: '', endDate: '', page: 1 }}
        setFilters={vi.fn()}
        onClear={onClear}
      />
    );
    fireEvent.click(screen.getByText('Clear Filters'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
