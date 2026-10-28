import React, { useMemo } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Target, 
  Info
} from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';
import { PRICE_COMMODITIES } from '../../data/priceCommoditiesData';

export default function PriceStepDynamics() {
  const selectedCommodity = usePriceStore(s => s.selectedCommodity);
  const farmerTargetPrice = usePriceStore(s => s.farmerTargetPrice);
  const setFarmerTargetPrice = usePriceStore(s => s.setFarmerTargetPrice);
  const forecastResult = usePriceStore(s => s.forecastResult);

  const meta = PRICE_COMMODITIES[selectedCommodity] || {};
  const history = forecastResult?.history?.history || [];

  const stats = useMemo(() => {
    if (!history || history.length === 0) {
      return { min: 200, max: 700, avg: 450, count: 0 };
    }
    const prices = history.map(h => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = sum / prices.length;
    return { min, max, avg, count: prices.length };
  }, [history]);

  const pointForecast = forecastResult?.forecast?.point_forecast;

  return (
    <div className="price-step-card-wrap">
      <div className="price-step-header">
        <div className="price-step-icon-badge">
          <BarChart3 size={22} />
        </div>
        <div>
          <h2>Step 3: Market Arrival Dynamics & Target Price</h2>
          <p>
            Review seasonal market characteristics and optionally set your farm breakeven selling price to benchmark against our live prediction.
          </p>
        </div>
      </div>

      <div className="price-dynamics-grid">
        {/* Market Profile Card */}
        <div className="price-dyn-card">
          <div className="price-dyn-head">
            <Calendar size={18} color="#059669" />
            <h3>Seasonal Production & Trading Patterns</h3>
          </div>

          <div className="price-dyn-body">
            <div className="dyn-spec-row">
              <span className="label">Cultivation Seasons</span>
              <span className="val">{meta.seasons || 'Maha & Yala'}</span>
            </div>
            <div className="dyn-spec-row">
              <span className="label">Key Supply Districts</span>
              <span className="val">{meta.districts ? meta.districts.join(', ') : 'All Agro-Zones'}</span>
            </div>
            <div className="dyn-spec-row">
              <span className="label">Price Volatility Profile</span>
              <span className={`val-tag volatility-${(meta.volatility || 'moderate').toLowerCase()}`}>
                {meta.volatility || 'Moderate'} Volatility
              </span>
            </div>
            <div className="dyn-spec-row">
              <span className="label">52-Week Price Spread</span>
              <span className="val">Rs {stats.min.toFixed(0)} – Rs {stats.max.toFixed(0)} / {meta.unit || 'kg'}</span>
            </div>
            <p className="dyn-note">
              {meta.description}
            </p>
          </div>
        </div>

        {/* Target Selling Price Card */}
        <div className="price-dyn-card">
          <div className="price-dyn-head">
            <Target size={18} color="#2563eb" />
            <h3>Target Farm-Gate Benchmark (Optional)</h3>
          </div>

          <div className="price-dyn-body">
            <p className="dyn-intro">
              Enter your target price or production cost per kg. We’ll compare your target with the forecast in the results dashboard.
            </p>

            <div className="target-input-group">
              <label htmlFor="farmerTargetPrice">Desired Selling Price (Rs / {meta.unit || 'kg'})</label>
              <div className="target-input-wrap">
                <span className="currency-prefix">LKR</span>
                <input
                  id="farmerTargetPrice"
                  type="number"
                  placeholder={`e.g. ${stats.avg.toFixed(0)}`}
                  value={farmerTargetPrice}
                  onChange={(e) => setFarmerTargetPrice(e.target.value)}
                  min="0"
                />
              </div>
            </div>

            {pointForecast && farmerTargetPrice && (
              <div className={`target-comparison-badge ${Number(pointForecast) >= Number(farmerTargetPrice) ? 'favorable' : 'tight'}`}>
                {Number(pointForecast) >= Number(farmerTargetPrice) ? (
                  <span>✅ Target achievable: Forecast (Rs {pointForecast.toFixed(0)}) exceeds your target!</span>
                ) : (
                  <span>⚠️ Tight margin: Forecast (Rs {pointForecast.toFixed(0)}) is below your target.</span>
                )}
              </div>
            )}

            <div className="dyn-tip-box">
              <Info size={14} color="#0284c7" />
              <span>
                Tip: Dedicated Economic Centres (Dambulla, Meegoda, Keppetipola) typically trade at a 15–25% spread above farm-gate collector rates.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
