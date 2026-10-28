/**
 * AlertsPage – shows tiered alerts for the active cycle.
 *
 * Route: /alerts
 *
 * Displays:
 *   - Summary badge counts (significant / attention / normal)
 *   - Resolved filter selector (Active / Resolved / All)
 *   - Alert cards per category with tier colour, variance %, and resolve button
 *   - Empty state when no alerts exist
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, AlertCircle, CheckCircle2, BellOff, RefreshCw, Filter, Check
} from 'lucide-react';

import { apiFetch } from '../utils/api.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import SectionCard from '../components/SectionCard.jsx';
import { useToast } from '../components/Toast.jsx';

// ── Tier config ──────────────────────────────────────────────────────────────
const TIER = {
  significant: {
    label:   'Significant Overspend',
    bg:      'bg-red-50 border-red-200',
    badge:   'bg-red-100 text-red-800 border-red-300',
    icon:    AlertTriangle,
    iconCls: 'text-red-500',
  },
  attention: {
    label:   'Attention Required',
    bg:      'bg-amber-50 border-amber-200',
    badge:   'bg-amber-100 text-amber-800 border-amber-300',
    icon:    AlertCircle,
    iconCls: 'text-amber-500',
  },
  normal: {
    label:   'Normal',
    bg:      'bg-emerald-50 border-emerald-200',
    badge:   'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon:    CheckCircle2,
    iconCls: 'text-emerald-500',
  },
};

const CATEGORY_LABELS = {
  seed: 'Seed', fertilizer: 'Fertilizer', agrochemical: 'Agrochemical',
  labour: 'Labour', machinery: 'Machinery', fuel: 'Fuel',
  irrigation: 'Irrigation', other: 'Other', total: 'Total',
};

function pct(v) {
  if (!isFinite(v)) return 'N/A';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

// ── AlertCard ────────────────────────────────────────────────────────────────
function AlertCard({ alert, lang, onResolve, isResolving }) {
  const { t } = useTranslation();
  const cfg = TIER[alert.tier] || TIER.normal;
  const Icon = cfg.icon;
  const isResolved = !!alert.resolvedAt;

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 transition-all ${cfg.bg} ${isResolved ? 'opacity-65' : ''}`}>
      <div className={`mt-0.5 shrink-0 ${cfg.iconCls}`}>
        <Icon size={22} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800">
            {CATEGORY_LABELS[alert.category] || alert.category}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.badge}`}>
            {cfg.label}
          </span>
          {isResolved && (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
              <Check size={12} /> Resolved ({formatDate(alert.resolvedAt)})
            </span>
          )}
        </div>

        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm text-slate-700">
          <div>
            <span className="text-xs text-slate-400 block">Deviation (Variance %)</span>
            <span className={`font-semibold ${alert.variancePct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {pct(alert.variancePct)}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Expected To Date</span>
            <span className="font-medium">{formatCurrency(alert.expectedToDate, lang)}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Actual Spend</span>
            <span className="font-medium">{formatCurrency(alert.actualToDate, lang)}</span>
          </div>
        </div>

        {/* Recommended Action */}
        <div className="mt-2 text-xs p-2.5 rounded-lg bg-white/80 border border-slate-200/60 text-slate-700 shadow-2xs">
          <span className="font-bold text-slate-900 block mb-0.5">
            💡 {t('alerts.recommendedAction')}:
          </span>
          <span>
            {alert.tier === 'significant' ? t('alerts.recSignificant') :
             alert.tier === 'attention' ? t('alerts.recAttention') :
             t('alerts.recNormal')}
          </span>
        </div>

        <div className="mt-2 text-xs text-slate-400">
          Day {alert.dayOfCycle} of cycle · Updated {formatDate(alert.updatedAt)}
        </div>
      </div>

      {!isResolved && alert.tier !== 'normal' && (
        <button
          id={`resolve-alert-${alert._id}`}
          onClick={() => onResolve(alert._id)}
          disabled={isResolving}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 shadow-sm"
        >
          <Check size={14} className="text-emerald-600" />
          {t('alerts.resolve')}
        </button>
      )}
    </div>
  );
}

// ── AlertsPage ───────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Resolved filter state: 'false' (active/unresolved), 'true' (resolved), 'all'
  const [resolvedFilter, setResolvedFilter] = useState('false');
  // Severity filter state: 'all', 'significant', 'attention', 'normal'
  const [severityFilter, setSeverityFilter] = useState('all');

  // Fetch active cycle
  const { data: cyclesData } = useQuery({
    queryKey: ['cycles-active'],
    queryFn: () => apiFetch('/api/cycles?status=active&pageSize=1'),
  });
  const cycle = cyclesData?.items?.[0];

  // Fetch alerts for active cycle with resolved and severity filters
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['alerts', cycle?._id, resolvedFilter, severityFilter],
    queryFn: () => {
      const sp = new URLSearchParams({ cycleId: cycle._id });
      if (resolvedFilter !== 'all') sp.set('resolved', resolvedFilter);
      if (severityFilter !== 'all') sp.set('severity', severityFilter);
      return apiFetch(`/api/alerts?${sp.toString()}`);
    },
    enabled: !!cycle?._id,
    refetchInterval: 30000,
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: (id) => apiFetch(`/api/alerts/${id}/resolve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      showToast(t('alerts.resolvedSuccess'), 'success');
    },
    onError: () => showToast(t('alerts.resolveError'), 'error'),
  });

  // Summary counts
  const counts = alerts.reduce(
    (acc, a) => { acc[a.tier] = (acc[a.tier] || 0) + 1; return acc; },
    { significant: 0, attention: 0, normal: 0 }
  );

  // Sort: significant → attention → normal
  const sorted = [...alerts].sort((a, b) => {
    const order = { significant: 0, attention: 1, normal: 2 };
    return (order[a.tier] ?? 3) - (order[b.tier] ?? 3);
  });

  return (
    <div className="space-y-6 pb-8" id="alerts-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('alerts.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('alerts.subtitle')}
            {cycle && <span className="ml-2 font-medium text-primary">· {cycle.crop} {cycle.season}</span>}
          </p>
        </div>
        <button
          id="alerts-refresh-btn"
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-all"
        >
          <RefreshCw size={14} />
          {t('alerts.refresh')}
        </button>
      </div>

      {/* ── Summary, Severity & Resolved Filter bar ────────────────────────────── */}
      {!isLoading && cycle && (
        <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="flex gap-3 flex-wrap">
            {[
              { tier: 'significant', color: 'text-red-700 bg-red-50 border-red-200' },
              { tier: 'attention',   color: 'text-amber-700 bg-amber-50 border-amber-200' },
              { tier: 'normal',      color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            ].map(({ tier, color }) => (
              <button
                key={tier}
                onClick={() => setSeverityFilter(severityFilter === tier ? 'all' : tier)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all ${color} ${severityFilter === tier ? 'ring-2 ring-primary' : 'hover:opacity-80'}`}
              >
                <span className="text-lg font-bold">{counts[tier]}</span>
                <span>{TIER[tier].label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Severity filter selector */}
            <div className="flex items-center gap-2 text-sm">
              <Filter size={14} className="text-slate-500" />
              <label htmlFor="alert-severity-filter" className="text-slate-600 font-medium">{t('alerts.severity')}:</label>
              <select
                id="alert-severity-filter"
                aria-label={t('alerts.severity')}
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
              >
                <option value="all">{t('alerts.allSeverities')}</option>
                <option value="significant">{t('alerts.significant')}</option>
                <option value="attention">{t('alerts.attention')}</option>
                <option value="normal">{t('alerts.normal')}</option>
              </select>
            </div>

            {/* Resolved filter selector */}
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="alert-resolved-filter" className="text-slate-600 font-medium">{t('alerts.status')}:</label>
              <select
                id="alert-resolved-filter"
                aria-label={t('alerts.status')}
                value={resolvedFilter}
                onChange={e => setResolvedFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
              >
                <option value="false">{t('alerts.active')}</option>
                <option value="true">{t('alerts.resolved')}</option>
                <option value="all">{t('alerts.allAlerts')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── No cycle / no baseline ──────────────────────────────────── */}
      {!cycle && !isLoading && (
        <SectionCard number="1" title={t('alerts.noActiveCycle')}>
          <div className="flex flex-col items-center py-12 text-slate-400">
            <BellOff size={40} className="mb-3 opacity-40" />
            <p className="font-medium">{t('alerts.noActiveCycle')}</p>
            <p className="text-xs mt-1">{t('alerts.noActiveCycleDesc')}</p>
          </div>
        </SectionCard>
      )}

      {/* ── Alert list ────────────────────────────────────────────── */}
      {cycle && (
        <SectionCard number="1" title={t('alerts.title')}>
          {isLoading && (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && alerts.length === 0 && (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <CheckCircle2 size={40} className="mb-3 opacity-40 text-emerald-400" />
              <p className="font-medium">{t('alerts.noAlerts')}</p>
              <p className="text-xs mt-1">{t('alerts.noAlertsDesc')}</p>
            </div>
          )}

          {!isLoading && sorted.length > 0 && (
            <div className="space-y-3">
              {sorted.map(alert => (
                <AlertCard
                  key={alert._id}
                  alert={alert}
                  lang={lang}
                  onResolve={(id) => resolveMutation.mutate(id)}
                  isResolving={resolveMutation.isPending}
                />
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
