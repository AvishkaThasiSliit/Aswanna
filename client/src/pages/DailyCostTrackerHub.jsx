/**
 * DailyCostTrackerHub – Main hub for Daily Cost Tracker at /tracker.
 *
 * Distinct from /tracker/records (Expense Log).
 * Contains 5 numbered sections:
 *  1. Summary tiles: Today's Expense, Current Cultivation Cost, Predicted Total Cost, Remaining Budget (with status badge)
 *  2. Predicted vs Actual Line Chart
 *  3. Expense Breakdown Donut (amount and % per category)
 *  4. Recent 4 Expense Records + "Add New Expense" and "View All Expenses" buttons
 *  5. Spending Status Panel (Normal / Attention / Significant in plain language)
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend as ChartLegend,
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as PieTooltip
} from 'recharts';
import {
  Activity, TrendingUp, Calendar, AlertTriangle, CheckCircle2, DollarSign, Plus, ListFilter, ArrowRight, BrainCircuit
} from 'lucide-react';

import { apiFetch } from '../utils/api.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import SectionCard from '../components/SectionCard.jsx';
import KpiTile from '../components/KpiTile.jsx';

const CATEGORY_COLORS = {
  seed: '#10b981',
  fertilizer: '#3b82f6',
  agrochemical: '#8b5cf6',
  labour: '#f59e0b',
  machinery: '#ec4899',
  fuel: '#ef4444',
  irrigation: '#06b6d4',
  other: '#64748b',
};

const CATEGORY_LABELS = {
  seed: 'Seed', fertilizer: 'Fertilizer', agrochemical: 'Agrochemical',
  labour: 'Labour', machinery: 'Machinery', fuel: 'Fuel',
  irrigation: 'Irrigation', other: 'Other',
};

export default function DailyCostTrackerHub() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch active cycle
  const { data: cyclesData } = useQuery({
    queryKey: ['cycles-active'],
    queryFn: () => apiFetch('/api/cycles?status=active&pageSize=1'),
  });
  const cycle = cyclesData?.items?.[0];

  // Fetch recent expenses
  const { data: expData, isLoading: isExpLoading } = useQuery({
    queryKey: ['expenses-hub', cycle?._id],
    queryFn: () => {
      const params = new URLSearchParams({
        ...(cycle?._id ? { cycleId: cycle._id } : {}),
        pageSize: 50,
        sort: '-entryDate',
      });
      return apiFetch(`/api/expenses?${params}`);
    },
    enabled: true,
  });

  // Fetch variance & budget data
  const { data: variance, isLoading: isVarLoading } = useQuery({
    queryKey: ['variance', cycle?._id],
    queryFn: () => apiFetch(`/api/cycles/${cycle._id}/variance`),
    enabled: !!cycle?._id,
    refetchInterval: 30000,
  });

  // 1. Calculate Summary Tile Metrics
  const { hasBaseline, todayTotal, totalActual, totalExpected, remainingBudget, tier, categoryPieData, recentRecords, lineChartData } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    
    let todaySum = 0;
    const catMap = {};
    const items = expData?.items || [];

    for (const exp of items) {
      const expDate = new Date(exp.entryDate);
      const expStr = expDate.toISOString().slice(0, 10);
      const amt = exp.totalAmount || 0;

      if (expStr === todayStr) todaySum += amt;

      if (exp.inputs) {
        for (const input of exp.inputs) {
          const cat = input.categoryTag || 'other';
          catMap[cat] = (catMap[cat] || 0) + (input.cost || 0);
        }
      }
      if (exp.subtotals?.labour) catMap.labour = (catMap.labour || 0) + exp.subtotals.labour;
      if (exp.subtotals?.machinery) catMap.machinery = (catMap.machinery || 0) + exp.subtotals.machinery;
      if (exp.other?.amount) catMap.other = (catMap.other || 0) + exp.other.amount;
    }

    const hasBaseline = Boolean(
      variance &&
      variance.status !== 'missing_baseline' &&
      variance.baselineStatus !== 'missing' &&
      variance.baselines !== null &&
      variance.total?.expected != null
    );

    const actual = variance?.total?.actual ?? items.reduce((acc, i) => acc + (i.totalAmount || 0), 0);
    const expected = hasBaseline ? variance.total.expected : null;
    const remaining = hasBaseline && expected != null ? (expected > actual ? expected - actual : 0) : null;
    const currentTier = hasBaseline ? (variance?.total?.tier || 'normal') : 'no_baseline';

    const grandCatTotal = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
    const pieData = Object.entries(catMap)
      .filter(([_, val]) => val > 0)
      .map(([cat, val]) => ({
        name: CATEGORY_LABELS[cat] || cat,
        value: val,
        percentage: ((val / grandCatTotal) * 100).toFixed(1),
        color: CATEGORY_COLORS[cat] || '#64748b',
      }));

    // Line chart data per category or time
    const chartData = (hasBaseline && variance?.categories)
      ? Object.entries(variance.categories).map(([cat, d]) => ({
          category: CATEGORY_LABELS[cat] || cat,
          Predicted: d.expectedToDate,
          Actual: d.actual,
        }))
      : [];

    return {
      hasBaseline,
      todayTotal: todaySum,
      totalActual: actual,
      totalExpected: expected,
      remainingBudget: remaining,
      tier: currentTier,
      categoryPieData: pieData,
      recentRecords: items.slice(0, 4),
      lineChartData: chartData,
    };
  }, [expData, variance]);

  const tierBadgeStyle = {
    normal: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    attention: 'bg-amber-100 text-amber-800 border-amber-300',
    significant: 'bg-red-100 text-red-800 border-red-300',
    no_baseline: 'bg-slate-100 text-slate-600 border-slate-300',
  }[tier] || 'bg-emerald-100 text-emerald-800 border-emerald-300';

  return (
    <div className="space-y-6 pb-8" id="daily-cost-tracker-hub">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('tracker.hubTitle')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('tracker.hubSubtitle')}
            {cycle && <span className="ml-2 font-medium text-primary">· {cycle.crop} {cycle.season}</span>}
          </p>
        </div>
      </div>

      {/* ── SECTION 1: Summary Tiles ──────────────────────────────── */}
      <SectionCard number="1" title="Financial Summary & Budget Tiles">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Today's Expense */}
          <KpiTile
            id="tile-today-expense"
            title={t('tracker.spentToday')}
            value={isExpLoading ? '…' : formatCurrency(todayTotal, lang)}
            icon={Activity}
          />

          {/* Current Cultivation Cost */}
          <KpiTile
            id="tile-cultivation-cost"
            title={t('tracker.cultivationCost')}
            value={isVarLoading ? '…' : formatCurrency(totalActual, lang)}
            icon={TrendingUp}
            highlight
          />

          {/* Predicted Total Cost */}
          <KpiTile
            id="tile-predicted-cost"
            title={t('tracker.predictedTotalCost')}
            value={
              isVarLoading
                ? '…'
                : hasBaseline && totalExpected != null
                ? formatCurrency(totalExpected, lang)
                : (t('kpi.noBaseline') || 'No baseline yet')
            }
            icon={BrainCircuit}
          />

          {/* Remaining Budget with Status Badge */}
          <div id="tile-remaining-budget" className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('tracker.remainingBudget')}</span>
              <span id="remaining-budget-status-badge" className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${tierBadgeStyle}`}>
                {hasBaseline ? tier : (t('kpi.noBaseline') || 'No baseline yet')}
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {isVarLoading
                ? '…'
                : hasBaseline && remainingBudget != null
                ? formatCurrency(remainingBudget, lang)
                : (t('kpi.noBaseline') || 'No baseline yet')}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {!hasBaseline
                ? 'No baseline yet for active cycle'
                : tier === 'significant'
                ? 'Budget severely depleted'
                : tier === 'attention'
                ? 'Budget under strain'
                : 'On track with phased plan'}
            </p>
          </div>
        </div>

        {/* Clear No Baseline Banner with Retry Action */}
        {!hasBaseline && !isVarLoading && cycle?._id && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800">
            <span>No baseline yet: SO1 predictions are missing or not ready for this cycle.</span>
            <button
              id="retry-baseline-btn"
              onClick={async () => {
                try {
                  await apiFetch(`/api/cycles/${cycle._id}/retry-baseline`, { method: 'POST' });
                  queryClient.invalidateQueries({ queryKey: ['variance', cycle._id] });
                  queryClient.invalidateQueries({ queryKey: ['cycles-active'] });
                } catch (e) {
                  console.error('Retry baseline failed', e);
                }
              }}
              className="px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold text-xs transition-colors"
            >
              Retry Baseline
            </button>
          </div>
        )}
      </SectionCard>

      {/* ── SECTION 2: Predicted vs Actual Line Chart ────────────── */}
      <SectionCard number="2" title={t('tracker.predictedVsActualChart')}>
        {lineChartData.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No baseline or category predictions available for active cycle.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={lineChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `Rs.${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={70} />
                <ChartTooltip formatter={(v) => formatCurrency(v, lang)} />
                <ChartLegend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Predicted" name="Phased Predicted" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="Actual" name="Actual Spend" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* ── SECTION 3: Expense Breakdown Donut (Amount + %) ──────── */}
      <SectionCard number="3" title={t('tracker.donutTitle')}>
        {categoryPieData.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">{t('tracker.noExpenses')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <PieTooltip formatter={(v) => formatCurrency(v, lang)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Detailed Legend with Amount and % */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category Distribution</h3>
              {categoryPieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50/50 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-slate-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-500">{item.percentage}%</span>
                    <span className="font-bold text-slate-900 font-mono">{formatCurrency(item.value, lang)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── SECTION 4: Recent 4 Expense Records + Navigation Buttons */}
      <SectionCard number="4" title={t('tracker.recentRecords')}>
        <div className="space-y-4">
          {recentRecords.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">{t('tracker.noRecent')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentRecords.map((item) => (
                <div key={item._id} className="p-3 rounded-xl border border-slate-200 bg-white hover:border-primary/40 transition-colors shadow-sm text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900 block">{formatDate(item.entryDate)}</span>
                    <span className="text-slate-500 text-[11px]">
                      {item.dayStatus === 'no_work' ? 'No Work Day' : item.activityCode?.nameSi || item.activityCode?.nameEn || 'Worked Day'}
                    </span>
                  </div>
                  <span className="font-extrabold text-primary text-sm font-mono">{formatCurrency(item.totalAmount, lang)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="hub-add-expense-btn"
              onClick={() => navigate('/tracker/add')}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-bold rounded-control hover:bg-emerald-900 transition-colors text-xs shadow-sm"
            >
              <Plus size={16} />
              <span>{t('tracker.addNewExpense')}</span>
            </button>

            <button
              id="hub-view-all-btn"
              onClick={() => navigate('/tracker/records')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-300 font-bold rounded-control hover:bg-slate-50 transition-colors text-xs shadow-sm"
            >
              <ListFilter size={16} />
              <span>{t('tracker.viewAllExpenses')}</span>
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── SECTION 5: Spending Status Panel (Plain Language) ────── */}
      <SectionCard number="5" title={t('tracker.spendingStatusPanel')}>
        <div id="spending-status-panel" className={`p-4 rounded-xl border ${
          tier === 'significant' ? 'bg-red-50 border-red-200 text-red-900' :
          tier === 'attention' ? 'bg-amber-50 border-amber-200 text-amber-900' :
          'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-start gap-3">
            {tier === 'significant' ? <AlertTriangle size={24} className="text-red-500 shrink-0 mt-0.5" /> :
             tier === 'attention' ? <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-0.5" /> :
             <CheckCircle2 size={24} className="text-emerald-500 shrink-0 mt-0.5" />}
            
            <div className="space-y-1">
              <h3 className="font-bold text-sm capitalize">
                Status: {t(`tracker.status${tier.charAt(0).toUpperCase() + tier.slice(1)}`)}
              </h3>
              <p className="text-xs leading-relaxed opacity-90">
                {t(`tracker.status${tier.charAt(0).toUpperCase() + tier.slice(1)}Desc`)}
              </p>
              {variance?.total?.variancePct != null && (
                <p className="text-[11px] font-mono font-medium pt-1">
                  Current phased variance: {(variance.total.variancePct * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
