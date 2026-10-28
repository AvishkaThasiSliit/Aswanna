import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../utils/api.js';
import { useToast } from '../components/Toast.jsx';
import SectionCard from '../components/SectionCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { formatCurrency } from '../utils/formatters.js';
import {
  DollarSign, TrendingUp, TrendingDown, Scale, Sprout,
  Lock, CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';

export default function CycleSummaryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast() || {};
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // 1. Fetch active cycle
  const { data: cyclesData, isLoading: isCyclesLoading } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch('/cycles'),
  });

  const activeCycle = useMemo(() => {
    if (!cyclesData) return null;
    const items = cyclesData.items || cyclesData;
    if (Array.isArray(items)) {
      return items.find(c => c.status === 'active' || c.status === 'harvesting') || items.find(c => c.status === 'closed') || null;
    }
    return null;
  }, [cyclesData]);

  const cycleId = activeCycle?._id;
  const isClosed = activeCycle?.status === 'closed';

  // 2. Fetch Cycle Summary
  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['cycleSummary', cycleId],
    queryFn: () => apiFetch(`/cycles/${cycleId}/summary`),
    enabled: Boolean(cycleId),
  });

  // 3. Close Cycle Mutation (forward-only: draft -> active -> harvesting -> closed)
  const closeCycleMutation = useMutation({
    mutationFn: async () => {
      if (activeCycle.status === 'active') {
        await apiFetch(`/cycles/${cycleId}/transition`, {
          method: 'POST',
          body: JSON.stringify({ toStatus: 'harvesting' }),
        });
      }
      return apiFetch(`/cycles/${cycleId}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus: 'closed' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      queryClient.invalidateQueries({ queryKey: ['cycleSummary', cycleId] });
      setIsConfirmOpen(false);
      if (showToast) {
        showToast(t('cycleSummary.cycleClosed', 'Cycle Closed (Read-Only)'), 'success');
      }
    },
    onError: (err) => {
      if (showToast) {
        showToast(err.message || 'Failed to close cycle', 'error');
      }
      setIsConfirmOpen(false);
    },
  });

  const totalCost = summary?.totalCost || 0;
  const totalIncome = summary?.totalIncome || 0;
  const profit = summary?.profit || 0;
  const totalHarvest = summary?.totalHarvest || 0;
  const costPerKg = summary?.costPerKg || 0;
  const hasSales = Boolean(summary?.hasSales);
  const isProfitPositive = profit >= 0;

  return (
    <div className="space-y-6 pb-12" id="cycle-summary-page">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t('cycleSummary.title', 'Cultivation Cycle Summary')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('cycleSummary.subtitle', 'Consolidated financial and yield outcome of the cultivation cycle')}
        </p>
      </div>

      {/* Closed Cycle Banner */}
      {isClosed && (
        <div id="cycle-closed-banner" className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-amber-800 text-sm font-medium">
          <Lock size={18} className="shrink-0 text-amber-600" />
          <span>{t('cycleSummary.cycleClosedWarning', 'This cultivation cycle is closed and read-only.')}</span>
        </div>
      )}

      {/* ─── SECTION 1: FINANCIAL & YIELD OVERVIEW ─────────────────────────── */}
      <SectionCard
        number="1"
        title={t('cycleSummary.section1Title', 'Financial & Yield Overview (මුළු සාරාංශය)')}
        badge={
          isClosed ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-300">
              <Lock size={12} />
              <span>Closed</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 size={12} />
              <span>Active Cycle</span>
            </span>
          )
        }
      >
        <div className="space-y-6">
          {/* Main KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Cost Tile */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                {t('cycleSummary.totalCost', 'Total Cost (මුළු වියදම)')}
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1" id="summary-total-cost">
                {formatCurrency(totalCost)}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Direct cultivation expenses
              </span>
            </div>

            {/* Profit Tile: SHOW BESIDE COST ONLY WHEN SALES EXIST */}
            {hasSales ? (
              <div
                className={`p-5 rounded-xl border ${
                  isProfitPositive
                    ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50/60 border-rose-300 text-rose-950'
                }`}
                id="summary-profit-card"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {t('cycleSummary.profit', 'Profit (ලාභය)')}
                  </span>
                  {isProfitPositive ? (
                    <TrendingUp size={18} className="text-emerald-600" />
                  ) : (
                    <TrendingDown size={18} className="text-rose-600" />
                  )}
                </div>
                <div
                  className={`text-2xl font-black mt-1 ${
                    isProfitPositive ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                  id="summary-profit-value"
                >
                  {formatCurrency(profit)}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  {isProfitPositive ? 'Net positive return' : 'Net cultivation loss'}
                </span>
              </div>
            ) : (
              <div className="p-5 bg-amber-50/40 border border-amber-200 rounded-xl text-amber-900" id="summary-no-sales-notice">
                <span className="text-xs font-bold uppercase tracking-wider block text-amber-800">
                  {t('cycleSummary.profit', 'Profit (ලාභය)')}
                </span>
                <p className="text-xs text-amber-700 mt-2">
                  {t('cycleSummary.noSalesNotice', 'Sales have not been recorded yet. Profit will be shown once sales are recorded.')}
                </p>
              </div>
            )}

            {/* Total Income Tile */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                {t('cycleSummary.totalIncome', 'Total Income (මුළු ආදායම)')}
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1" id="summary-total-income">
                {formatCurrency(totalIncome)}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                {summary?.saleCount || 0} rounds recorded
              </span>
            </div>

            {/* Total Harvest Tile */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                {t('cycleSummary.totalHarvest', 'Total Harvest (මුළු අස්වැන්න)')}
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1" id="summary-total-harvest">
                {totalHarvest.toLocaleString()} kg
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                {summary?.harvestCount || 0} harvest rounds
              </span>
            </div>

            {/* Cost Per Kg Tile */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                {t('cycleSummary.costPerKg', 'Cost per Kg (කිලෝවක වියදම)')}
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1" id="summary-cost-per-kg">
                Rs. {costPerKg.toFixed(2)}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Unit production expenditure
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ─── SECTION 2: CYCLE LIFECYCLE & CLOSURE ─────────────────────────── */}
      <SectionCard
        number="2"
        title={t('cycleSummary.section2Title', 'Cycle Lifecycle & Closure (කන්නය අවසන් කිරීම)')}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {isClosed
              ? t('cycleSummary.cycleClosedWarning', 'This cultivation cycle is closed and read-only.')
              : t('cycleSummary.closeConfirmMessage', 'Closing this cycle is permanent and forward-only. The cycle will become read-only and final accuracy metrics will be recorded.')}
          </p>

          <div className="pt-2">
            {isClosed ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-control select-none">
                <Lock size={14} />
                <span>{t('cycleSummary.cycleClosed', 'Cycle Closed (Read-Only)')}</span>
              </div>
            ) : (
              <button
                type="button"
                id="close-cycle-btn"
                onClick={() => setIsConfirmOpen(true)}
                disabled={closeCycleMutation.isPending || !cycleId}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-control transition-colors shadow-sm disabled:opacity-50"
              >
                {closeCycleMutation.isPending
                  ? t('cycleSummary.closingCycle', 'Closing...')
                  : t('cycleSummary.closeCycle', 'Close Cycle')}
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={t('cycleSummary.closeConfirmTitle', 'Close Cultivation Cycle?')}
        message={t('cycleSummary.closeConfirmMessage', 'Closing this cycle is permanent and forward-only. The cycle will become read-only and final accuracy metrics will be recorded.')}
        confirmText={t('cycleSummary.closeCycle', 'Close Cycle')}
        cancelText={t('harvestSales.cancel', 'Cancel')}
        isDestructive={true}
        onConfirm={() => closeCycleMutation.mutate()}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}
