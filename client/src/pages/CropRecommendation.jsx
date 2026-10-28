/**
 * CropRecommendation – SO3.5 FR8 Crop Recommendation Page.
 *
 * Displays:
 *  - District, Season & Irrigation Filter Bar
 *  - Section 1: Accuracy-Weighted Crop Ranking Cards with Cost Interval, Data Quality & Reliability Badges
 *  - Section 2: Baseline Comparison Table (SO1 Cost-Only Rank vs Accuracy-Weighted Rank)
 *  - Section 3: Unavailable Crops (when SO1 baseline could not be obtained for a candidate crop)
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Award, Filter, AlertCircle, CheckCircle2, HelpCircle, ShieldCheck, Sparkles, Scale,
  BrainCircuit, MapPin, AlertTriangle, Droplets
} from 'lucide-react';

import { apiFetch } from '../utils/api.js';
import { formatCurrency } from '../utils/formatters.js';
import SectionCard from '../components/SectionCard.jsx';

const DISTRICTS = ['Kurunegala', 'Anuradhapura', 'Polonnaruwa', 'Badulla', 'Kandy', 'Ampara', 'Galle'];
const SEASONS = ['Yala', 'Maha'];
const IRRIGATION_OPTIONS = ['Unspecified', 'Irrigated', 'Rainfed'];

export default function CropRecommendation() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [selectedDistrict, setSelectedDistrict] = useState('Kurunegala');
  const [selectedSeason, setSelectedSeason] = useState('Yala');
  const [selectedIrrigation, setSelectedIrrigation] = useState('Unspecified');

  // Fetch crop recommendations
  const { data: recData, isLoading } = useQuery({
    queryKey: ['crop-recommendation', selectedDistrict, selectedSeason, selectedIrrigation],
    queryFn: () => apiFetch(
      `/api/crop-recommendation?district=${encodeURIComponent(selectedDistrict)}&season=${encodeURIComponent(selectedSeason)}&irrigation=${encodeURIComponent(selectedIrrigation)}`
    ),
  });

  const crops = recData?.items || [];
  const unavailable = recData?.unavailable || [];

  return (
    <div className="space-y-6 pb-8" id="crop-recommendation-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('recommendation.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('recommendation.subtitle')}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter size={16} /> {t('filters.category')}:
        </div>

        {/* District Selector */}
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="rec-district-select" className="text-slate-600 font-medium">
            {t('recommendation.filterDistrict')}:
          </label>
          <select
            id="rec-district-select"
            aria-label={t('recommendation.filterDistrict')}
            value={selectedDistrict}
            onChange={e => setSelectedDistrict(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {DISTRICTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Season Selector */}
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="rec-season-select" className="text-slate-600 font-medium">
            {t('recommendation.filterSeason')}:
          </label>
          <select
            id="rec-season-select"
            aria-label={t('recommendation.filterSeason')}
            value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {SEASONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Irrigation Regime Selector */}
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="rec-irrigation-select" className="text-slate-600 font-medium flex items-center gap-1">
            <Droplets size={14} className="text-blue-500" /> {t('recommendation.filterIrrigation')}:
          </label>
          <select
            id="rec-irrigation-select"
            aria-label={t('recommendation.filterIrrigation')}
            value={selectedIrrigation}
            onChange={e => setSelectedIrrigation(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {IRRIGATION_OPTIONS.map(irr => (
              <option key={irr} value={irr}>
                {t(`recommendation.irrigationOptions.${irr}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── SECTION 1: Accuracy-Weighted Crop Ranking ─────────────── */}
      <SectionCard number="1" title={t('recommendation.section1Title')}>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : crops.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No crop recommendations available for selected district/season.
          </div>
        ) : (
          <div className="space-y-4">
            {crops.map((item) => {
              const relPct = (item.reliability * 100).toFixed(1);
              const isTop = item.accuracyRank === 1;
              const isExtrapolated = item.dataQuality === 'extrapolated' || item.district_policy_used === 'extrapolated';
              const isRegional = item.dataQuality === 'regional_fallback' || item.district_policy_used === 'whole_island';

              return (
                <div
                  key={item.crop}
                  className={`p-5 rounded-2xl border transition-all ${
                    isTop ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/20 shadow-md' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 mt-0.5 ${
                        isTop ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
                      }`}>
                        #{item.accuracyRank}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-slate-900">{item.crop}</h3>
                          {isTop && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold tracking-wider uppercase flex items-center gap-1">
                              <Award size={12} /> Recommended
                            </span>
                          )}

                          {/* Data Quality & Low Confidence Badges (Never hidden when extrapolated) */}
                          {isExtrapolated ? (
                            <span
                              id={`badge-quality-${item.crop.toLowerCase()}`}
                              className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-bold flex items-center gap-1"
                            >
                              <BrainCircuit size={12} /> {t('recommendation.qualityBadges.extrapolated')}
                            </span>
                          ) : isRegional ? (
                            <span
                              id={`badge-quality-${item.crop.toLowerCase()}`}
                              className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-bold flex items-center gap-1"
                            >
                              <MapPin size={12} /> {t('recommendation.qualityBadges.regionalFallback')}
                            </span>
                          ) : (
                            <span
                              id={`badge-quality-${item.crop.toLowerCase()}`}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold flex items-center gap-1"
                            >
                              <CheckCircle2 size={12} /> {t('recommendation.qualityBadges.observed')}
                            </span>
                          )}

                          {item.low_confidence && (
                            <span
                              id={`badge-low-conf-${item.crop.toLowerCase()}`}
                              className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold flex items-center gap-1"
                            >
                              <AlertTriangle size={12} /> {t('recommendation.qualityBadges.lowConfidence')}
                            </span>
                          )}
                        </div>

                        {/* Cost & Interval Display */}
                        <p className="text-xs text-slate-500 mt-1">
                          {t('recommendation.predictedTotal')}:{' '}
                          <span className="font-bold text-slate-800">{formatCurrency(item.predictedCost, lang)}</span>
                          {item.intervalLow != null && item.intervalHigh != null && (
                            <span className="text-slate-500 ml-1">
                              ({t('recommendation.predictedRange')}: {formatCurrency(item.intervalLow, lang)} – {formatCurrency(item.intervalHigh, lang)})
                            </span>
                          )}
                          {' · '}Expected Yield:{' '}
                          <span className="font-medium text-slate-800">{item.expectedYield} kg/acre</span>
                        </p>

                        {/* One-line Plain Language Data Quality Note */}
                        <p className="text-[11px] text-slate-500 mt-0.5 italic">
                          {isExtrapolated
                            ? t('recommendation.qualityNotes.extrapolated')
                            : isRegional
                            ? t('recommendation.qualityNotes.regionalFallback')
                            : item.low_confidence
                            ? t('recommendation.qualityNotes.lowConfidence')
                            : t('recommendation.qualityNotes.observed')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
                      {/* Reliability Badge */}
                      {item.coldStart ? (
                        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5">
                          <HelpCircle size={14} /> {t('recommendation.coldStartBadge')}
                        </span>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                          item.reliability >= 0.90 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          item.reliability >= 0.80 ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          <ShieldCheck size={14} /> {relPct}% {t('recommendation.reliability')} ({t('recommendation.sampleSize')}: {item.sampleSize})
                        </span>
                      )}

                      {/* Cost per kg metric tile */}
                      <div className="text-right pl-3 border-l border-slate-200">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">{t('recommendation.costPerKg')}</span>
                        <span className="text-sm font-extrabold text-primary font-mono">{item.costEfficiency} LKR/kg</span>
                      </div>
                    </div>
                  </div>

                  {/* Plain Language Reason */}
                  <div className="mt-3 pt-3 border-t border-slate-100/80 text-xs text-slate-600 flex items-start gap-2">
                    <Sparkles size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{item.plainLanguageReason}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── SECTION 2: Baseline Comparison Table ───────────────────── */}
      <SectionCard number="2" title={t('recommendation.section2Title')}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
                <th className="py-3 px-4 text-left">Crop</th>
                <th className="py-3 px-4 text-center">{t('recommendation.costOnlyRank')}</th>
                <th className="py-3 px-4 text-center">{t('recommendation.weightedRank')}</th>
                <th className="py-3 px-4 text-left">Cost / Yield Unit</th>
                <th className="py-3 px-4 text-left">{t('recommendation.reliability')}</th>
                <th className="py-3 px-4 text-left">Rank Change Reason</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((item) => {
                const rankChanged = item.costOnlyRank !== item.accuracyRank;
                return (
                  <tr key={item.crop} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.crop}</td>
                    
                    {/* Cost-Only Rank */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-extrabold text-xs">
                        #{item.costOnlyRank}
                      </span>
                    </td>

                    {/* Accuracy-Weighted Rank */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md font-extrabold text-xs ${
                        rankChanged ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        #{item.accuracyRank}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">{item.costEfficiency} LKR/kg</td>

                    <td className="py-3 px-4">
                      {item.coldStart ? (
                        <span className="text-xs text-amber-700 font-medium">Cold-Start (0 history)</span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-800">
                          {(item.reliability * 100).toFixed(1)}% ({item.sampleSize} seasons)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">
                      {rankChanged ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <Scale size={14} /> Adjusted from #{item.costOnlyRank} to #{item.accuracyRank} due to past error history
                        </span>
                      ) : (
                        <span className="text-slate-400">Rank unchanged</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── SECTION 3: Unavailable Crops (if any) ─────────────────── */}
      {unavailable.length > 0 && (
        <SectionCard number="3" title={t('recommendation.sectionUnavailableTitle')}>
          <p className="text-xs text-slate-500 mb-3">{t('recommendation.sectionUnavailableSubtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="unavailable-crops-list">
            {unavailable.map((u) => (
              <div key={u.crop} className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900">{u.crop}</h4>
                  <p className="text-xs text-rose-700 mt-0.5">
                    <span className="font-semibold">{t('recommendation.reasonUnavailable')}:</span> {u.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
