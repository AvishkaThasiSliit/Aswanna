import React from 'react';
import { TrendingUp, RefreshCw, Sparkles, Database, CheckCircle2 } from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';

export default function PriceHeroHeader() {
  const isLoading = usePriceStore(s => s.isLoading);
  const fetchForecast = usePriceStore(s => s.fetchForecast);
  const forecastResult = usePriceStore(s => s.forecastResult);

  const originDate = forecastResult?.forecast?.origin_date || 'August 2026';
  const originWeek = forecastResult?.forecast?.origin_week || 464;

  return (
    <div className="price-hero-banner">
      <div className="price-hero-content">
        <div className="price-hero-icon-wrap">
          <TrendingUp size={26} />
        </div>
        <div className="price-hero-text">
          <div className="price-hero-title-row">
            <h1>Market Price Forecaster</h1>
            <span className="price-ai-badge">
              <Sparkles size={13} />
              AI Automated Champion
            </span>
          </div>
          <p>
            Multi-horizon econometric & machine learning price intelligence calibrated across all 32 Central Bank & DCS vegetable varieties with 80% conformal confidence bands.
          </p>
        </div>
      </div>

      <div className="price-hero-meta-panel">
        <div className="price-meta-pill live">
          <span className="live-dot" />
          <Database size={13} />
          <span>CBSL Origin Week {originWeek} ({originDate})</span>
        </div>

        <button
          type="button"
          className="price-meta-pill champion"
          onClick={() => { window.location.search = '?tab=models'; }}
          style={{ cursor: 'pointer', border: '1px solid #86efac', background: '#ecfdf5', transition: 'all 0.2s', outline: 'none' }}
          title="Click to explore all 34 trained price forecasting models in the AI Model Registry"
        >
          <CheckCircle2 size={13} color="#059669" />
          <span>34 Trained AI Models (View Registry)</span>
        </button>

        <button
          type="button"
          className="price-refresh-btn"
          onClick={fetchForecast}
          disabled={isLoading}
          title="Refresh live bulletin forecast"
        >
          <RefreshCw size={14} className={isLoading ? "spin" : ""} />
          <span>{isLoading ? 'Updating...' : 'Sync'}</span>
        </button>
      </div>
    </div>
  );
}
