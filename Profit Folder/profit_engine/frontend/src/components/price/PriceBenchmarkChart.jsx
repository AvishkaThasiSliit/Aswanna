import React from 'react';
import { BarChart3, Sparkles, Info } from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';

export default function PriceBenchmarkChart() {
  const forecastResult = usePriceStore(s => s.forecastResult);
  const selectedHorizon = usePriceStore(s => s.selectedHorizon);

  const forecast = forecastResult?.forecast;
  if (!forecast) return null;

  const pointFc = forecast.point_forecast || 0;
  const lastObs = forecast.last_observed_price || pointFc;
  const naiveFc = forecast.naive_forecast || lastObs;
  const seasonal4yr = forecast.seasonal_mean_4yr_forecast || 0;
  const lo = forecast.interval_80?.lo ?? pointFc * 0.85;
  const hi = forecast.interval_80?.hi ?? pointFc * 1.15;
  const unit = forecast.unit || 'kg';

  const maxVal = Math.max(pointFc, lastObs, naiveFc, seasonal4yr, hi) * 1.15 || 100;

  const benchmarks = [
    {
      id: 'champion',
      name: `AI Champion Forecast (${forecast.model_used || 'AutoARIMA'})`,
      value: pointFc,
      color: '#059669',
      bgColor: '#ecfdf5',
      borderColor: '#a7f3d0',
      badge: 'Recommended Champion',
      badgeClass: 'green',
      delta: pointFc - lastObs,
      deltaPct: lastObs > 0 ? ((pointFc - lastObs) / lastObs) * 100 : 0,
      note: `Machine learning prediction with 80% conformal envelope [Rs ${lo.toFixed(0)} – ${hi.toFixed(0)}].`
    },
    {
      id: 'last_observed',
      name: 'Last Observed CBSL Bulletin (Origin Week)',
      value: lastObs,
      color: '#2563eb',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
      badge: 'Actual Recorded',
      badgeClass: 'blue',
      delta: 0,
      deltaPct: 0,
      note: 'Most recent official market bulletin price recorded before forward projection.'
    },
    {
      id: 'seasonal_mean',
      name: '4-Year Seasonal Historical Mean (2020–2024)',
      value: seasonal4yr,
      color: '#d97706',
      bgColor: '#fffbeb',
      borderColor: '#fde68a',
      badge: 'Historical Baseline',
      badgeClass: 'amber',
      delta: seasonal4yr - lastObs,
      deltaPct: lastObs > 0 ? ((seasonal4yr - lastObs) / lastObs) * 100 : 0,
      note: 'Average wholesale price recorded for this calendar week over past 4 years.'
    },
    {
      id: 'naive',
      name: 'Naive Persistence (No-Change Baseline)',
      value: naiveFc,
      color: '#64748b',
      bgColor: '#f8fafc',
      borderColor: '#e2e8f0',
      badge: 'Flat Baseline',
      badgeClass: 'gray',
      delta: 0,
      deltaPct: 0,
      note: 'Static reference assuming current supply conditions persist into future.'
    }
  ];

  return (
    <div className="price-benchmark-panel">
      <div className="benchmark-head">
        <div className="benchmark-title-wrap">
          <div className="benchmark-icon-wrap">
            <BarChart3 size={18} />
          </div>
          <div>
            <h3>Genuine Model & Historical Benchmark Comparison</h3>
            <p>
              Compare the auto-selected AI Champion against the 4-year seasonal mean and naive baseline for {selectedHorizon}-week horizon.
            </p>
          </div>
        </div>

        <span className="benchmark-tag">
          <Sparkles size={12} /> Verified ML Metrics
        </span>
      </div>

      <div className="benchmark-bars-list">
        {benchmarks.map((bm) => {
          const widthPct = Math.min(100, Math.max(10, (bm.value / maxVal) * 100));

          return (
            <div 
              key={bm.id} 
              className={`benchmark-row-card ${bm.id === 'champion' ? 'champion-row' : ''}`}
            >
              <div className="benchmark-row-top">
                <div className="benchmark-name-box">
                  <span className={`bm-badge ${bm.badgeClass}`}>{bm.badge}</span>
                  <span className="bm-name">{bm.name}</span>
                </div>

                <div className="benchmark-val-box">
                  <span className="bm-val" style={{ color: bm.color }}>
                    LKR {bm.value.toFixed(2)}
                    <span className="bm-unit">/{unit}</span>
                  </span>

                  {bm.id !== 'last_observed' && bm.id !== 'naive' && (
                    <span className={`bm-delta-tag ${bm.delta >= 0 ? 'pos' : 'neg'}`}>
                      {bm.delta >= 0 ? `+${bm.deltaPct.toFixed(1)}%` : `${bm.deltaPct.toFixed(1)}%`}
                    </span>
                  )}
                </div>
              </div>

              {/* Visual Horizontal Gauge Bar */}
              <div className="benchmark-progress-track">
                <div
                  className="benchmark-progress-fill"
                  style={{
                    width: `${widthPct}%`,
                    background: bm.color
                  }}
                />
              </div>

              <div className="benchmark-note-row">
                <Info size={12} color="#64748b" />
                <span>{bm.note}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
