import React, { useMemo } from 'react';
import { Activity, Gauge, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';

export default function PriceVolatilityDistributionChart() {
  const forecastResult = usePriceStore(s => s.forecastResult);
  const selectedCommodity = usePriceStore(s => s.selectedCommodity);

  const history = forecastResult?.history?.history || [];
  const forecast = forecastResult?.forecast;

  const distStats = useMemo(() => {
    if (!history || history.length === 0 || !forecast) return null;

    const prices = history.map(h => h.price).sort((a, b) => a - b);
    const n = prices.length;
    const min = prices[0];
    const max = prices[n - 1];
    const sum = prices.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    // Standard deviation & coefficient of variation
    const variance = prices.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const cvPct = (stdDev / mean) * 100;

    // Percentiles
    const p25 = prices[Math.floor(n * 0.25)];
    const median = prices[Math.floor(n * 0.5)];
    const p75 = prices[Math.floor(n * 0.75)];

    const point = forecast.point_forecast;
    // Calculate forecast percentile
    const belowCount = prices.filter(p => p <= point).length;
    const forecastPercentile = Math.round((belowCount / n) * 100);

    return {
      min,
      max,
      mean,
      stdDev,
      cvPct,
      p25,
      median,
      p75,
      point,
      forecastPercentile
    };
  }, [history, forecast]);

  if (!distStats) return null;

  const { min, max, mean, cvPct, p25, median, p75, point, forecastPercentile } = distStats;
  const range = max - min || 1;

  // Position percentage of point on min..max scale
  const pointPosPct = Math.min(100, Math.max(0, ((point - min) / range) * 100));

  const volatilityRating = cvPct > 35 ? 'High' : cvPct > 20 ? 'Moderate' : 'Low';
  const ratingColor = cvPct > 35 ? '#dc2626' : cvPct > 20 ? '#d97706' : '#059669';

  return (
    <div className="price-volatility-panel">
      <div className="volatility-head">
        <div className="volatility-title-wrap">
          <div className="volatility-icon-wrap">
            <Activity size={18} />
          </div>
          <div>
            <h3>52-Week Price Distribution & Volatility Gauge</h3>
            <p>
              Genuine statistical spread computed across all 52 recorded weekly CBSL bulletins.
            </p>
          </div>
        </div>

        <div className="volatility-pill" style={{ borderColor: ratingColor, color: ratingColor }}>
          <Gauge size={13} />
          <span>{volatilityRating} Volatility ({cvPct.toFixed(1)}% CV)</span>
        </div>
      </div>

      {/* Distribution Spectrum Bar */}
      <div className="distribution-slider-box">
        <div className="dist-labels-top">
          <span>52-Wk Low: LKR {min.toFixed(0)}</span>
          <span>Median: LKR {median.toFixed(0)}</span>
          <span>52-Wk High: LKR {max.toFixed(0)}</span>
        </div>

        <div className="dist-track">
          {/* Gradient Background */}
          <div className="dist-track-bg" />

          {/* 25th - 75th percentile normal band */}
          <div
            className="dist-normal-band"
            style={{
              left: `${((p25 - min) / range) * 100}%`,
              width: `${((p75 - p25) / range) * 100}%`
            }}
            title={`Typical Normal Band: Rs ${p25.toFixed(0)} - ${p75.toFixed(0)}`}
          />

          {/* Median marker */}
          <div
            className="dist-median-marker"
            style={{ left: `${((median - min) / range) * 100}%` }}
            title={`Median: Rs ${median.toFixed(0)}`}
          />

          {/* Forecast Position Pin */}
          <div
            className="dist-forecast-pin"
            style={{ left: `${pointPosPct}%` }}
          >
            <div className="pin-head">
              <span>Forecast: Rs {point.toFixed(0)}</span>
            </div>
            <div className="pin-stem" />
            <div className="pin-dot" />
          </div>
        </div>

        <div className="dist-summary-text">
          <ShieldCheck size={14} color="#059669" />
          <span>
            Current forecast of <strong>LKR {point.toFixed(2)}</strong> sits at the <strong>{forecastPercentile}th percentile</strong> of historical prices over the past year.
          </span>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="volatility-stats-row">
        <div className="v-stat-card">
          <span className="v-label">Lowest Week</span>
          <span className="v-val">Rs {min.toFixed(0)}</span>
        </div>
        <div className="v-stat-card">
          <span className="v-label">25th Percentile</span>
          <span className="v-val">Rs {p25.toFixed(0)}</span>
        </div>
        <div className="v-stat-card">
          <span className="v-label">52-Wk Average</span>
          <span className="v-val">Rs {mean.toFixed(0)}</span>
        </div>
        <div className="v-stat-card">
          <span className="v-label">75th Percentile</span>
          <span className="v-val">Rs {p75.toFixed(0)}</span>
        </div>
        <div className="v-stat-card">
          <span className="v-label">Highest Week</span>
          <span className="v-val">Rs {max.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
