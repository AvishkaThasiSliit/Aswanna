import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ReferenceDot
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, BrainCircuit, Activity, Filter, Search
} from 'lucide-react';

import { apiFetch } from '../utils/api.js';
import { formatCurrency } from '../utils/formatters.js';
import SectionCard from '../components/SectionCard.jsx';
import KpiTile from '../components/KpiTile.jsx';
import DailyCostTracker from '../components/DailyCostTracker.jsx';
import ForecastCard from '../components/ForecastCard.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_STYLE = {
  normal:      'bg-emerald-100 text-emerald-800 border-emerald-200',
  attention:   'bg-amber-100 text-amber-800 border-amber-200',
  significant: 'bg-red-100 text-red-800 border-red-200',
};

const TIER_LABEL = { normal: 'Normal', attention: 'Attention', significant: 'Significant' };

const CATEGORY_LABELS = {
  seed: 'Seed', fertilizer: 'Fertilizer', agrochemical: 'Agrochem.',
  labour: 'Labour', machinery: 'Machinery', fuel: 'Fuel',
  irrigation: 'Irrigation', other: 'Other',
};

function pct(v) {
  if (!isFinite(v)) return 'N/A';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

// Custom chart tooltip
function CustomTooltip({ active, payload, label, lang }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-medium">{formatCurrency(p.value, lang)}</span>
        </p>
      ))}
    </div>
  );
}

export default function BudgetOverview() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  // Filters state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTier, setSelectedTier] = useState('');

  // Fetch active cycle
  const { data: cyclesData } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch('/api/cycles?status=active&pageSize=1'),
  });
  const cycle = cyclesData?.items?.[0];

  // Fetch variance
  const { data: variance, isLoading: varLoading } = useQuery({
    queryKey: ['variance', cycle?._id],
    queryFn: () => apiFetch(`/api/cycles/${cycle._id}/variance`),
    enabled: !!cycle?._id,
    refetchInterval: 30000,
  });

  // Fetch forecast
  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ['forecast', cycle?._id],
    queryFn: () => apiFetch(`/api/cycles/${cycle._id}/forecast`),
    enabled: !!cycle?._id,
    retry: false,
    refetchInterval: 60000,
  });

  // Build category line chart data: Predicted (dashed), Actual (solid), Low-High band, Deviation marker
  const lineChartData = useMemo(() => {
    if (!variance?.categories) return [];
    return Object.entries(variance.categories).map(([cat, data]) => ({
      category: CATEGORY_LABELS[cat] || cat,
      Predicted: data.expectedToDate,
      Actual: data.actual,
      Low: data.low,
      High: data.high,
      deviation: data.actual - data.expectedToDate,
    }));
  }, [variance]);

  // Filtered categories for table
  const filteredCategories = useMemo(() => {
    if (!variance?.categories) return [];
    return Object.entries(variance.categories).filter(([cat, data]) => {
      if (selectedCategory && cat !== selectedCategory) return false;
      if (selectedTier && data.tier !== selectedTier) return false;
      return true;
    });
  }, [variance, selectedCategory, selectedTier]);

  const queryClient = useQueryClient();
  const noBaseline = !variance || variance.baselines === null || variance.status === 'missing_baseline' || variance.baselineStatus === 'missing' || cycle?.baselineStatus === 'missing';
  const total = variance?.total;
  const variancePct = total?.variancePct;
  const isOver = variancePct > 0;

  return (
    <div className="space-y-6 pb-8" id="budget-overview-page">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-900">Predicted vs Actual Cost Impact</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          SO1 Phased Baseline vs Actual Spend with low-high tolerance band and tier alerts
          {cycle && <span className="ml-2 font-medium text-primary">· {cycle.crop} {cycle.season}</span>}
        </p>
      </div>

      {/* ── SO1 Metadata Banners ──────────────────────────────────── */}
      {variance?.so1Metadata && (
        <div className="space-y-2 mb-2" id="so1-banners">
          {variance.so1Metadata.low_confidence && (
            <div id="banner-low-confidence" className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              <span>{t('so1.lowConfidenceBanner')}</span>
            </div>
          )}
          {variance.so1Metadata.district_policy_used === 'extrapolated' && (
            <div id="banner-extrapolated" className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm flex items-center gap-2">
              <BrainCircuit size={18} className="text-blue-600 shrink-0" />
              <span>{t('so1.extrapolatedBanner')}</span>
            </div>
          )}
          {variance.so1Metadata.lag_saturation_detected && (
            <div id="banner-lag-saturation" className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-600 shrink-0" />
              <div>
                <span>{t('so1.lagSaturationBanner')}</span>
                {variance.so1Metadata.lag_saturation_note && (
                  <p className="text-xs text-orange-700 mt-0.5">{variance.so1Metadata.lag_saturation_note}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Cost Impact Summary KPIs ─────────────────────────────── */}
      <SectionCard number="1" title="Cost Impact Summary">
        {noBaseline && !varLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <BrainCircuit size={40} className="mb-3 opacity-40" />
            <p className="font-medium text-slate-700">No baseline available yet</p>
            <p className="text-xs mt-1">Activate a crop cycle or retry SO1 baseline fetch.</p>
            {cycle?._id && (
              <button
                id="btn-overview-retry-baseline"
                onClick={async () => {
                  try {
                    await apiFetch(`/api/cycles/${cycle._id}/retry-baseline`, { method: 'POST' });
                    queryClient.invalidateQueries({ queryKey: ['variance', cycle._id] });
                    queryClient.invalidateQueries({ queryKey: ['cycles'] });
                  } catch (e) {
                    console.error('Retry baseline failed', e);
                  }
                }}
                className="mt-3 px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-emerald-700 font-semibold transition-colors"
              >
                Retry Baseline
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiTile
                id="kpi-total-expected"
                title="Total Budget (SO1)"
                value={varLoading ? '…' : formatCurrency(total?.expected, lang)}
                icon={BrainCircuit}
              />
              <KpiTile
                id="kpi-expected-to-date"
                title="Expected To Date"
                value={varLoading ? '…' : formatCurrency(total?.expectedToDate, lang)}
                icon={Activity}
              />
              <KpiTile
                id="kpi-total-actual"
                title="Total Spent"
                value={varLoading ? '…' : formatCurrency(total?.actual, lang)}
                icon={TrendingUp}
                highlight
              />
              <KpiTile
                id="kpi-variance-pct"
                title="Variance vs Phase"
                value={varLoading ? '…' : pct(variancePct)}
                subtext={isOver ? 'Overspending vs plan' : 'Within budget'}
                icon={isOver ? TrendingUp : CheckCircle2}
                highlight={isOver}
              />
            </div>

            {/* SO1 Prediction Interval Info Bar */}
            {(variance?.intervalLow != null || total?.low != null) && (
              <div id="so1-interval-panel" className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{t('so1.predictionInterval')}:</span>
                  <span className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {formatCurrency(variance.intervalLow ?? total.low, lang)} – {formatCurrency(variance.intervalHigh ?? total.high, lang)}
                  </span>
                  {variance.so1Metadata?.model_version && (
                    <span className="text-[11px] text-slate-400">
                      (Model: {variance.so1Metadata.model_version})
                    </span>
                  )}
                </div>
                {variance.withinPredictionInterval !== undefined && (
                  <span
                    id="badge-total-within-interval"
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      variance.withinPredictionInterval
                        ? 'bg-sky-50 text-sky-800 border-sky-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    ℹ️ {variance.withinPredictionInterval ? t('so1.withinInterval') : t('so1.outsideInterval')}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* ── Predicted vs Actual Line Chart ────────────────────────── */}
      {!noBaseline && (
        <SectionCard number="2" title="Predicted vs Actual Category Performance (Line Chart)">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={lineChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `Rs.${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={70} />
                <Tooltip content={<CustomTooltip lang={lang} />} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                
                {/* Low-High Shaded Band */}
                <Area type="monotone" dataKey="High" fill="#e0f2fe" stroke="none" name="High Bound (+15%)" />
                <Area type="monotone" dataKey="Low" fill="#ffffff" stroke="none" name="Low Bound (-10%)" />
                
                {/* Predicted Dashed Line */}
                <Line
                  type="monotone"
                  dataKey="Predicted"
                  name="Predicted (SO1 Phased)"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  strokeDasharray="6 6"
                  dot={{ r: 4 }}
                />

                {/* Actual Solid Line */}
                <Line
                  type="monotone"
                  dataKey="Actual"
                  name="Actual Spend"
                  stroke="#10b981"
                  strokeWidth={3}
                  strokeDasharray="0"
                  dot={{ r: 5, fill: '#10b981' }}
                />

                {/* Deviation Marker at total deviation */}
                {total?.actual > total?.expectedToDate && (
                  <ReferenceLine
                    y={total.actual}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{ value: 'Actual Total Deviation', fill: '#ef4444', fontSize: 11, position: 'top' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 border-b-2 border-dashed border-blue-500"></span> Blue Dashed: Phased Predicted</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-emerald-500"></span> Emerald Solid: Actual Spend</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-sky-100 border border-sky-200 rounded"></span> Shaded Band: Low-High Range</span>
          </div>
        </SectionCard>
      )}

      {/* ── Projected End-of-Season Cost ─────────────────────────── */}
      <ForecastCard forecast={forecast} isLoading={forecastLoading} />

      {/* ── Daily Cost Tracker Hub ─────────────────────────────────── */}
      <DailyCostTracker cycleId={cycle?._id} />

      {/* ── Category Variance Table with Filters & Inline Bars ── */}
      {!noBaseline && (
        <SectionCard number="3" title="Category Variance & Tier Breakdown">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Filter size={16} /> Filters:
            </div>
            
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Categories</option>
              {Object.keys(CATEGORY_LABELS).map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>

            <select
              value={selectedTier}
              onChange={e => setSelectedTier(e.target.value)}
              className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Alert Tiers</option>
              <option value="normal">Normal</option>
              <option value="attention">Attention</option>
              <option value="significant">Significant</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="py-2.5 px-3 text-left">Category</th>
                  <th className="py-2.5 px-3 text-left">Full Budget</th>
                  <th className="py-2.5 px-3 text-left">Expected To Date</th>
                  <th className="py-2.5 px-3 text-left">Actual Spend</th>
                  <th className="py-2.5 px-3 text-left">Spend Progress</th>
                  <th className="py-2.5 px-3 text-left">Variance %</th>
                  <th className="py-2.5 px-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map(([cat, data]) => {
                  const usedPct = Math.min(100, Math.max(0, (data.budgetUsedPct || 0) * 100));
                  const inInterval = data.low != null && data.high != null
                    ? (data.actual >= data.low && data.actual <= data.high)
                    : null;
                  return (
                    <tr key={cat} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{CATEGORY_LABELS[cat] || cat}</span>
                          {data.is_estimated_split && (
                            <span
                              id={`badge-estimated-split-${cat}`}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
                              title={t('so1.estimatedSplitTooltip')}
                            >
                              {t('so1.estimatedSplit')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{formatCurrency(data.expected, lang)}</td>
                      <td className="py-3 px-3 text-blue-700 font-medium">{formatCurrency(data.expectedToDate, lang)}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{formatCurrency(data.actual, lang)}</td>
                      
                      {/* Inline Spend Progress Bar */}
                      <td className="py-3 px-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${data.tier === 'significant' ? 'bg-red-500' : data.tier === 'attention' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${usedPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 font-mono w-10 text-right">{usedPct.toFixed(0)}%</span>
                        </div>
                      </td>

                      <td className={`py-3 px-3 font-semibold ${data.variancePct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {pct(data.variancePct)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TIER_STYLE[data.tier] || TIER_STYLE.normal}`}>
                            {TIER_LABEL[data.tier] || data.tier}
                          </span>
                          {inInterval !== null && (
                            <span
                              id={`badge-interval-${cat}`}
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                inInterval
                                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}
                            >
                              ℹ️ {inInterval ? t('so1.withinInterval') : t('so1.outsideInterval')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
