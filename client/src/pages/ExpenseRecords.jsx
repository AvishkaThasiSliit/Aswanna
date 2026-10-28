import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ListOrdered, TrendingUp, CalendarCheck, BrainCircuit,
  PlusCircle, FileDown, WifiOff
} from 'lucide-react';

import { apiFetch, ApiError } from '../utils/api.js';
import { formatCurrency } from '../utils/formatters.js';
import SectionCard from '../components/SectionCard.jsx';
import KpiTile from '../components/KpiTile.jsx';
import FilterBar from '../components/FilterBar.jsx';
import DataTable from '../components/DataTable.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import { useToast } from '../components/Toast.jsx';

const PAGE_SIZE = 7;

// ─── Helper to build API query params from filter state ──────────────────────
function buildQueryParams(filters) {
  const params = new URLSearchParams();
  if (filters.search)    params.set('search', filters.search);
  if (filters.category)  params.set('category', filters.category);
  if (filters.startDate) params.set('from', filters.startDate);
  if (filters.endDate)   params.set('to', filters.endDate);
  if (filters.minAmount) params.set('minAmount', filters.minAmount);
  if (filters.maxAmount) params.set('maxAmount', filters.maxAmount);
  params.set('page', String(filters.page || 1));
  params.set('pageSize', String(PAGE_SIZE));
  params.set('sort', '-entryDate');
  return params.toString();
}

// ─── Default filters ──────────────────────────────────────────────────────────
function defaultFilters() {
  return {
    search: '',
    category: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    page: 1,
  };
}

// ─── Read filters from URL ────────────────────────────────────────────────────
function filtersFromSearchParams(sp) {
  return {
    search:    sp.get('search') || '',
    category:  sp.get('category') || '',
    startDate: sp.get('startDate') || '',
    endDate:   sp.get('endDate') || '',
    minAmount: sp.get('minAmount') || '',
    maxAmount: sp.get('maxAmount') || '',
    page:      Number(sp.get('page') || 1),
  };
}

export default function ExpenseRecords() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive filter state from URL
  const [filters, setFilters] = useState(() => filtersFromSearchParams(searchParams));

  // Sync filters to URL whenever they change
  useEffect(() => {
    const sp = new URLSearchParams();
    if (filters.search)    sp.set('search', filters.search);
    if (filters.category)  sp.set('category', filters.category);
    if (filters.startDate) sp.set('startDate', filters.startDate);
    if (filters.endDate)   sp.set('endDate', filters.endDate);
    if (filters.minAmount) sp.set('minAmount', filters.minAmount);
    if (filters.maxAmount) sp.set('maxAmount', filters.maxAmount);
    if (filters.page > 1)  sp.set('page', String(filters.page));
    setSearchParams(sp, { replace: true });
  }, [filters, setSearchParams]);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline  = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ─── Data fetch ────────────────────────────────────────────────────────────
  const queryKey = ['expenses', filters];
  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => apiFetch(`/api/expenses?${buildQueryParams(filters)}`),
    keepPreviousData: true,
  });

  // ─── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => apiFetch(`/api/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });

      // Show toast with 10-second undo
      let undoUsed = false;
      const timer = setTimeout(() => {
        if (!undoUsed) showToast(t('toast.deleted'), 'success');
      }, 10000);

      showToast(
        t('toast.deleted'),
        'success',
        {
          label: t('toast.undo'),
          onClick: async () => {
            undoUsed = true;
            clearTimeout(timer);
            try {
              await apiFetch(`/api/expenses/${id}/restore`, { method: 'POST' });
              queryClient.invalidateQueries({ queryKey: ['expenses'] });
              showToast(t('toast.restored'), 'success');
            } catch (err) {
              const msg = err.code === 'CYCLE_CLOSED'
                ? t('toast.cycleClosed')
                : t('toast.error');
              showToast(msg, 'error');
            }
          }
        }
      );
    },
    onError: (err) => {
      const msg = err.code === 'CYCLE_CLOSED'
        ? t('toast.cycleClosed')
        : err.message || t('toast.error');
      showToast(msg, 'error');
    },
  });

  const handleDeleteRequest = useCallback((expense) => {
    setDeleteTarget(expense);
  }, []);

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget._id);
    setDeleteTarget(null);
  };

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters());
  }, []);

  // ─── Export CSV ─────────────────────────────────────────────────────────────
  const handleExport = async () => {
    const params = new URLSearchParams();
    if (filters.search)    params.set('search', filters.search);
    if (filters.category)  params.set('category', filters.category);
    if (filters.startDate) params.set('from', filters.startDate);
    if (filters.endDate)   params.set('to', filters.endDate);
    if (filters.minAmount) params.set('minAmount', filters.minAmount);
    if (filters.maxAmount) params.set('maxAmount', filters.maxAmount);

    try {
      const blob = await apiFetch(`/api/expenses/export.csv?${params.toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'expenses.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t('toast.error'), 'error');
    }
  };

  // ─── Derived KPI values ─────────────────────────────────────────────────────
  const totals = data?.totals || {};
  const entries       = totals.count ?? 0;
  const totalSpending = totals.totalSpending ?? 0;
  const todayExpense  = totals.todayExpense ?? 0;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-8" id="expense-records-page">
      {/* ─── Offline Banner ──────────────────────────────────────── */}
      {isOffline && (
        <div
          role="alert"
          className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-control text-sm font-medium"
        >
          <WifiOff size={18} />
          <span>You appear to be offline. Data shown may be stale.</span>
        </div>
      )}

      {/* ─── Section 1: KPI Tiles ─────────────────────────────────── */}
      <SectionCard number="1" title={t('sections.summary')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            id="kpi-entries"
            title={t('kpi.entries')}
            value={isLoading ? '…' : entries.toLocaleString()}
            icon={ListOrdered}
          />
          <KpiTile
            id="kpi-total-spending"
            title={t('kpi.totalSpending')}
            value={isLoading ? '…' : formatCurrency(totalSpending, lang)}
            icon={TrendingUp}
            highlight
          />
          <KpiTile
            id="kpi-today"
            title={t('kpi.todayExpense')}
            value={isLoading ? '…' : formatCurrency(todayExpense, lang)}
            icon={CalendarCheck}
          />
          <KpiTile
            id="kpi-predicted"
            title={t('kpi.predictedCost')}
            value="-"
            subtext={t('kpi.noBaseline')}
            icon={BrainCircuit}
          />
        </div>
      </SectionCard>

      {/* ─── Section 2: Records ──────────────────────────────────────── */}
      <SectionCard number="2" title={t('sections.records')}>
        {/* Filter bar */}
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          onClear={clearFilters}
        />

        {/* Loading state */}
        {isLoading && <TableSkeleton rows={5} columns={7} />}

        {/* Error state */}
        {isError && !isLoading && (
          <div
            role="alert"
            className="p-4 bg-rose-50 border border-rose-200 rounded-card text-rose-800 text-sm"
          >
            <strong>{t('toast.error')}</strong>{' '}
            {error?.message || 'Failed to load expense records.'}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && data?.items?.length === 0 && (
          <EmptyState
            title={t('table.noRecords')}
            description={t('table.noRecordsDesc')}
          />
        )}

        {/* Data table */}
        {!isLoading && !isError && data?.items?.length > 0 && (
          <>
            <DataTable
              data={data.items}
              total={data.total}
              page={data.page}
              pageSize={data.pageSize}
              onDelete={handleDeleteRequest}
            />

            {/* Pagination controls */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                id="btn-prev-page"
                onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                disabled={filters.page <= 1}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-control bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                ‹ {t('pagination.prev')}
              </button>
              <span className="text-sm text-slate-600 px-2">
                {t('pagination.page', { page: filters.page })}
              </span>
              <button
                id="btn-next-page"
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                disabled={filters.page * PAGE_SIZE >= (data?.total || 0)}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-control bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                {t('pagination.next')} ›
              </button>
            </div>
          </>
        )}
      </SectionCard>

      {/* ─── Section 3: Quick Actions ─────────────────────────────────── */}
      <SectionCard number="3" title={t('sections.quickActions')}>
        <div className="flex flex-wrap gap-3">
          <Link
            id="btn-add-expense"
            to="/tracker/add"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded-control hover:bg-navActive transition-colors shadow-sm"
          >
            <PlusCircle size={18} />
            {t('actions.addNewExpense')}
          </Link>
          <button
            id="btn-export-records"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-border bg-white text-slate-700 font-bold rounded-control hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FileDown size={18} />
            {t('actions.exportRecords')}
          </button>
        </div>
      </SectionCard>

      {/* ─── Delete Confirm Dialog ───────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('confirm.deleteTitle')}
        message={t('confirm.deleteMessage')}
        confirmText={t('confirm.confirmDelete')}
        cancelText={t('confirm.cancel')}
        isDestructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
