// FROZEN: end-of-season cost forecasting overlaps SO1 (cost prediction). Not part of the SO3 deliverable. Disabled by default.

import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info, Sparkles, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '../utils/formatters.js';
import SectionCard from './SectionCard.jsx';

export default function ForecastCard({ forecast, isLoading = false, error = null }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  // If endpoint is disabled ({ enabled: false }), render nothing
  if (forecast?.enabled === false) {
    return null;
  }

  if (isLoading) {
    return (
      <SectionCard title={t('forecast.cardTitle')}>
        <div className="animate-pulse space-y-4 py-4" data-testid="forecast-loading">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-16 bg-slate-100 rounded"></div>
            <div className="h-16 bg-slate-100 rounded"></div>
            <div className="h-16 bg-slate-100 rounded"></div>
            <div className="h-16 bg-slate-100 rounded"></div>
          </div>
        </div>
      </SectionCard>
    );
  }

  // If endpoint is 404 (mode off) or error without data, render nothing
  if (error || !forecast) {
    return null;
  }

  const isTooEarly = forecast.status === 'too_early';
  const isInsufficient = forecast.status === 'insufficient_data';
  const isReady = forecast.status === 'ready';

  return (
    <SectionCard title={t('forecast.cardTitle')} className="border-primary/20 shadow-sm" data-testid="forecast-card">
      {/* Subtitle & Method Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 -mt-1">
        <p className="text-sm text-slate-500">
          {t('forecast.subtitle')}
        </p>
        {forecast.method && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            forecast.method === 'learned'
              ? 'bg-purple-100 text-purple-800 border border-purple-200'
              : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`} data-testid="forecast-method-badge">
            <Sparkles size={13} />
            {forecast.method === 'learned' ? t('forecast.learnedMethod') : t('forecast.priorMethod')}
          </span>
        )}
      </div>

      {/* State: Too Early */}
      {isTooEarly && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3" data-testid="forecast-too-early">
          <div className="flex items-center gap-2 font-semibold text-amber-950">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <span>{t('forecast.tooEarlyTitle')}</span>
          </div>
          <p className="text-sm text-amber-800">
            {t('forecast.tooEarlyDesc', {
              tau: Math.round((forecast.tau || 0) * 100),
              minTau: Math.round((forecast.minTau || 0.3) * 100),
            })}
          </p>
          <div className="flex items-center gap-4 text-xs font-medium text-amber-900/80 pt-1">
            <span>{t('forecast.spendToDate')}: {formatCurrency(forecast.spendToDate || 0, lang)}</span>
            <span>·</span>
            <span>Baseline: {formatCurrency(forecast.baselineTotal || 0, lang)}</span>
          </div>
        </div>
      )}

      {/* State: Insufficient Data */}
      {isInsufficient && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-2" data-testid="forecast-insufficient-data">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Info size={18} className="text-slate-500 shrink-0" />
            <span>{t('forecast.insufficientDataTitle')}</span>
          </div>
          <p className="text-sm text-slate-600">
            {forecast.message || t('forecast.insufficientDataDesc')}
          </p>
        </div>
      )}

      {/* State: Ready */}
      {isReady && (
        <div className="space-y-5" data-testid="forecast-ready">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Projected Final Cost */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                {t('forecast.projectedTotal')}
              </span>
              <span className="text-xl md:text-2xl font-bold text-slate-900" data-testid="forecast-final-cost">
                {formatCurrency(forecast.forecastFinal, lang)}
              </span>
              <span className="text-xs text-slate-500 block mt-1">
                Baseline: {formatCurrency(forecast.baselineTotal, lang)}
              </span>
            </div>

            {/* 80% Conformal Interval */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                {t('forecast.predictionInterval')}
              </span>
              <span className="text-sm md:text-base font-bold text-slate-900 block" data-testid="forecast-interval">
                {formatCurrency(forecast.interval.low, lang)} – {formatCurrency(forecast.interval.high, lang)}
              </span>
              <span className="text-xs text-slate-500 block mt-1">
                Level: {Math.round((forecast.interval.level || 0.8) * 100)}%
              </span>
            </div>

            {/* Spend to Date */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                {t('forecast.spendToDate')}
              </span>
              <span className="text-xl md:text-2xl font-bold text-slate-900" data-testid="forecast-spend-to-date">
                {formatCurrency(forecast.spendToDate, lang)}
              </span>
              <span className="text-xs text-slate-500 block mt-1">
                {t('forecast.progress')}: {Math.round(forecast.tau * 100)}%
              </span>
            </div>

            {/* Projected Overspend */}
            <div className={`p-4 rounded-xl border ${
              forecast.projectedOverspendPct > 5
                ? 'bg-red-50 border-red-200 text-red-900'
                : forecast.projectedOverspendPct > 0
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <span className="text-xs font-medium uppercase tracking-wider block mb-1">
                {t('forecast.projectedOverspend')}
              </span>
              <div className="flex items-center gap-1.5" data-testid="forecast-overspend-pct">
                {forecast.projectedOverspendPct > 0 ? (
                  <>
                    <TrendingUp size={20} className={forecast.projectedOverspendPct > 5 ? 'text-red-600' : 'text-amber-600'} />
                    <span className="text-xl md:text-2xl font-bold">
                      +{forecast.projectedOverspendPct}%
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} className="text-emerald-600" />
                    <span className="text-xl md:text-2xl font-bold">
                      {t('forecast.onTrack')}
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs block mt-1 opacity-80">
                vs SO1 Phased Target
              </span>
            </div>
          </div>

          {/* Caveats & Disclaimers Footer */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5" data-testid="forecast-caveats">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <ShieldAlert size={14} className="text-slate-500" />
              <span>{t('forecast.advisoryNotice')}</span>
            </div>
            <p className="text-slate-500 pl-5 leading-relaxed">
              {t('forecast.conformalNotice')}
            </p>
            <p className="text-slate-500 pl-5 leading-relaxed" data-testid="forecast-derived-curves-notice">
              {t('forecast.derivedCurvesNotice')}
            </p>
            <p className="text-slate-500 pl-5 leading-relaxed" data-testid="forecast-sudden-shocks-notice">
              {t('forecast.suddenShocksNotice')}
            </p>
            {forecast.notes && forecast.notes.length > 0 && (
              <ul className="list-disc list-inside pl-5 space-y-0.5 text-slate-500">
                {forecast.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
