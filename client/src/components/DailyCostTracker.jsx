/**
 * DailyCostTracker – Daily Cost Tracker hub component.
 *
 * Displays:
 *   - Summary tiles (Today, This Week, Monthly, Avg Daily)
 *   - Category Donut Chart (Recharts PieChart)
 *   - Recent records compact table
 *   - Spending status banner (On Track / Attention Required / Over Budget)
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Activity, TrendingUp, Calendar, AlertTriangle, CheckCircle2, DollarSign } from 'lucide-react';

import { apiFetch } from '../utils/api.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import SectionCard from './SectionCard.jsx';
import KpiTile from './KpiTile.jsx';

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

export default function DailyCostTracker({ cycleId }) {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  // Fetch recent expenses
  const { data: expData, isLoading } = useQuery({
    queryKey: ['expenses-tracker', cycleId],
    queryFn: () => {
      const params = new URLSearchParams({
        ...(cycleId ? { cycleId } : {}),
        pageSize: 50,
        sort: '-entryDate',
      });
      return apiFetch(`/api/expenses?${params}`);
    },
    enabled: true,
  });

  // Fetch variance
  const { data: variance } = useQuery({
    queryKey: ['variance', cycleId],
    queryFn: () => apiFetch(`/api/cycles/${cycleId}/variance`),
    enabled: !!cycleId,
  });

  // Calculate summary metrics
  const { todayTotal, weekTotal, monthTotal, categoryPieData, recentItems } = useMemo(() => {
    if (!expData?.items) return { todayTotal: 0, weekTotal: 0, monthTotal: 0, categoryPieData: [], recentItems: [] };
    
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    let todaySum = 0;
    let weekSum = 0;
    let monthSum = 0;
    const catMap = {};

    for (const exp of expData.items) {
      const expDate = new Date(exp.entryDate);
      const expStr = expDate.toISOString().slice(0, 10);
      const amt = exp.totalAmount || 0;

      if (expStr === todayStr) todaySum += amt;
      if (expDate >= weekAgo) weekSum += amt;
      if (expDate >= monthAgo) monthSum += amt;

      // Group category totals from inputs / subtotals
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

    const pieData = Object.entries(catMap)
      .filter(([_, value]) => value > 0)
      .map(([cat, value]) => ({
        name: CATEGORY_LABELS[cat] || cat,
        value,
        color: CATEGORY_COLORS[cat] || '#64748b',
      }));

    return {
      todayTotal: todaySum,
      weekTotal: weekSum,
      monthTotal: monthSum,
      categoryPieData: pieData,
      recentItems: expData.items.slice(0, 5),
    };
  }, [expData]);

  // Determine overall spending status banner
  const statusBanner = useMemo(() => {
    if (!variance?.total) return { label: 'On Track', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 };
    const vPct = variance.total.variancePct || 0;
    if (vPct > 0.15) {
      return { label: 'Over Budget', color: 'bg-red-50 text-red-800 border-red-200', icon: AlertTriangle };
    }
    if (vPct > 0.10) {
      return { label: 'Attention Required', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertTriangle };
    }
    return { label: 'On Track', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 };
  }, [variance]);

  const StatusIcon = statusBanner.icon;

  return (
    <div className="space-y-6" id="daily-cost-tracker-hub">
      {/* ── Spending Status Banner ─────────────────────────────────── */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${statusBanner.color}`}>
        <div className="flex items-center gap-3">
          <StatusIcon size={24} />
          <div>
            <h3 className="font-bold text-sm">Cycle Spending Status: {statusBanner.label}</h3>
            <p className="text-xs opacity-90">
              {variance?.total?.variancePct !== undefined
                ? `Current variance is ${(variance.total.variancePct * 100).toFixed(1)}% vs phased expected budget.`
                : 'Spending matches expected daily allocation.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary Tiles ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          id="tile-spent-today"
          title="Spent Today"
          value={isLoading ? '…' : formatCurrency(todayTotal, lang)}
          icon={Activity}
        />
        <KpiTile
          id="tile-spent-week"
          title="Spent This Week"
          value={isLoading ? '…' : formatCurrency(weekTotal, lang)}
          icon={TrendingUp}
        />
        <KpiTile
          id="tile-spent-month"
          title="Spent 30 Days"
          value={isLoading ? '…' : formatCurrency(monthTotal, lang)}
          icon={Calendar}
        />
        <KpiTile
          id="tile-avg-daily"
          title="Avg Daily Spend"
          value={isLoading ? '…' : formatCurrency(Math.round(monthTotal / 30), lang)}
          icon={DollarSign}
        />
      </div>

      {/* ── Donut Chart & Recent Records Grid ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Donut Chart */}
        <SectionCard number="1" title="Category Cost Distribution (Donut)">
          {categoryPieData.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No expenses recorded yet.</div>
          ) : (
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
                  <Tooltip formatter={(v) => formatCurrency(v, lang)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        {/* Recent Records Compact List */}
        <SectionCard number="2" title="Recent Daily Records">
          {recentItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No recent records.</div>
          ) : (
            <div className="space-y-2">
              {recentItems.map((item) => (
                <div key={item._id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">{formatDate(item.entryDate)}</span>
                    <span className="text-slate-500">{item.dayStatus === 'no_work' ? 'No Work Day' : item.activityCode?.nameSi || item.activityCode?.nameEn || 'Worked Day'}</span>
                  </div>
                  <span className="font-bold text-slate-900">{formatCurrency(item.totalAmount, lang)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
