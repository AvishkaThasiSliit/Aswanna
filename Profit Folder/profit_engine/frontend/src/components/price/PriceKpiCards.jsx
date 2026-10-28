import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Activity, 
  Store, 
  ShieldCheck 
} from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';

export default function PriceKpiCards() {
  const forecastResult = usePriceStore(s => s.forecastResult);
  const selectedHorizon = usePriceStore(s => s.selectedHorizon);

  const forecast = forecastResult?.forecast;
  if (!forecast) return null;

  const pointForecast = forecast.point_forecast || 0;
  const lastPrice = forecast.last_observed_price || pointForecast;
  const unit = forecast.unit || 'kg';

  const delta = pointForecast - lastPrice;
  const deltaPct = lastPrice > 0 ? (delta / lastPrice) * 100 : 0;

  const isUp = deltaPct > 2;
  const isDown = deltaPct < -2;

  const interval = forecast.interval_80;
  const lo = interval?.lo ?? pointForecast * 0.85;
  const hi = interval?.hi ?? pointForecast * 1.15;

  return (
    <div className="price-kpi-grid">
      {/* 1. Point Price Forecast */}
      <div className="price-kpi-card highlight">
        <div className="kpi-card-head">
          <div className="kpi-icon-pill green">
            {isUp ? <TrendingUp size={16} /> : isDown ? <TrendingDown size={16} /> : <Minus size={16} />}
          </div>
          <span className="kpi-label">Point Price Forecast</span>
          <span className={`kpi-trend-pill ${isUp ? 'bullish' : isDown ? 'bearish' : 'neutral'}`}>
            {isUp ? `+${deltaPct.toFixed(1)}%` : isDown ? `${deltaPct.toFixed(1)}%` : '0.0%'}
          </span>
        </div>
        <div className="kpi-card-val">
          LKR {pointForecast.toFixed(2)}
          <span className="kpi-unit">/{unit}</span>
        </div>
        <div className="kpi-card-sub">
          Expected Wholesale Target ({selectedHorizon}W Horizon)
        </div>
      </div>

      {/* 2. 80% Conformal Range */}
      <div className="price-kpi-card">
        <div className="kpi-card-head">
          <div className="kpi-icon-pill blue">
            <Activity size={16} />
          </div>
          <span className="kpi-label">80% Conformal Interval</span>
          <span className="kpi-metric-tag blue">80% Confidence</span>
        </div>
        <div className="kpi-card-val range">
          LKR {lo.toFixed(1)} – {hi.toFixed(1)}
        </div>
        <div className="kpi-card-sub">
          Statistical Range for Weather & Market Shocks
        </div>
      </div>

      {/* 3. Last Observed Price */}
      <div className="price-kpi-card">
        <div className="kpi-card-head">
          <div className="kpi-icon-pill amber">
            <Store size={16} />
          </div>
          <span className="kpi-label">Last Observed Bulletin</span>
          <span className="kpi-metric-tag amber">Origin Wk {forecast.origin_week}</span>
        </div>
        <div className="kpi-card-val">
          LKR {lastPrice.toFixed(2)}
          <span className="kpi-unit">/{unit}</span>
        </div>
        <div className="kpi-card-sub">
          Recorded on {forecast.origin_date || 'Latest Bulletin'}
        </div>
      </div>

      {/* 4. Active ML Champion Model */}
      <div className="price-kpi-card">
        <div className="kpi-card-head">
          <div className="kpi-icon-pill purple">
            <ShieldCheck size={16} />
          </div>
          <span className="kpi-label">Active ML Engine</span>
          <span className="kpi-metric-tag green">Auto-Tuned</span>
        </div>
        <div className="kpi-card-val model-title">
          {forecast.model_used || 'AutoARIMA'}
        </div>
        <div className="kpi-card-sub">
          Target Date: {forecast.target_date} (Week {forecast.target_week})
        </div>
      </div>
    </div>
  );
}
