import React from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  AlertCircle, 
  Store 
} from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';
import { PRICE_COMMODITIES } from '../../data/priceCommoditiesData';

export default function PriceAdvisoryCard() {
  const forecastResult = usePriceStore(s => s.forecastResult);
  const selectedCommodity = usePriceStore(s => s.selectedCommodity);
  const selectedHorizon = usePriceStore(s => s.selectedHorizon);
  const farmerTargetPrice = usePriceStore(s => s.farmerTargetPrice);

  const forecast = forecastResult?.forecast;
  if (!forecast) return null;

  const point = forecast.point_forecast;
  const last = forecast.last_observed_price || point;
  const deltaPct = last > 0 ? ((point - last) / last) * 100 : 0;
  const meta = PRICE_COMMODITIES[selectedCommodity] || {};

  const isBullish = deltaPct > 2.5;
  const isBearish = deltaPct < -2.5;

  const targetNum = farmerTargetPrice ? parseFloat(farmerTargetPrice) : null;
  const targetAchievable = targetNum !== null ? point >= targetNum : null;

  return (
    <div className="price-advisory-container">
      <div className="advisory-head">
        <div className="advisory-icon-wrap">
          <Sparkles size={20} />
        </div>
        <div>
          <h3>Aswenna Agronomic Market Advisory</h3>
          <p>
            Strategic market recommendations tailored for {meta.displayName || selectedCommodity} over the {selectedHorizon}-week horizon.
          </p>
        </div>
      </div>

      <div className="advisory-cards-grid">
        {/* 1. Trend Strategy */}
        <div className={`adv-card ${isBullish ? 'bullish' : isBearish ? 'bearish' : 'neutral'}`}>
          <div className="adv-card-header">
            {isBullish ? (
              <TrendingUp size={18} color="#059669" />
            ) : isBearish ? (
              <TrendingDown size={18} color="#dc2626" />
            ) : (
              <CheckCircle size={18} color="#2563eb" />
            )}
            <h4>
              {isBullish ? 'Favorable Bullish Trend (+)' : isBearish ? 'Supply Expansion Anticipated (-)' : 'Stable Equilibrium Trend (~)'}
            </h4>
          </div>
          <p>
            {isBullish
              ? `Prices are projected to increase by +${deltaPct.toFixed(1)}% to LKR ${point.toFixed(2)}/kg by ${forecast.target_date}. If crop physiology permits, timing peak harvests for weeks ${forecast.target_week - 1} to ${forecast.target_week} will yield premium farm-gate returns.`
              : isBearish
              ? `Expected market supply expansion may soften prices by ${deltaPct.toFixed(1)}% to LKR ${point.toFixed(2)}/kg by ${forecast.target_date}. Staggering harvests or negotiating firm forward contracts with village collectors can protect your margins.`
              : `Prices are projected to remain steady around LKR ${point.toFixed(2)}/kg. Focus planning on reducing post-harvest handling losses and optimizing vehicle transport loads.`}
          </p>
        </div>

        {/* 2. Target Price Benchmark */}
        {targetNum !== null && (
          <div className={`adv-card ${targetAchievable ? 'bullish' : 'bearish'}`}>
            <div className="adv-card-header">
              {targetAchievable ? (
                <CheckCircle size={18} color="#059669" />
              ) : (
                <AlertCircle size={18} color="#d97706" />
              )}
              <h4>Farm Target Benchmark Analysis</h4>
            </div>
            <p>
              {targetAchievable
                ? `Great news! The predicted price (LKR ${point.toFixed(2)}/kg) comfortably exceeds your desired target of LKR ${targetNum.toFixed(2)}/kg by +${((point - targetNum) / targetNum * 100).toFixed(1)}%. Expected profitability is strong.`
                : `Caution: The predicted price (LKR ${point.toFixed(2)}/kg) is below your requested threshold of LKR ${targetNum.toFixed(2)}/kg. Consider reducing input overheads or routing produce directly to major Dedicated Economic Centres.`}
            </p>
          </div>
        )}

        {/* 3. Transport & Dedicated Economic Centre Guidance */}
        <div className="adv-card neutral">
          <div className="adv-card-header">
            <Store size={18} color="#0284c7" />
            <h4>Wholesale vs Farm-Gate Spread</h4>
          </div>
          <p>
            Major Dedicated Economic Centres (Dambulla, Meegoda, Keppetipola) typically trade at an 18–25% premium over local gate collectors. If your total harvest exceeds 500 kg, hiring a shared small truck directly to an Economic Centre can capture up to +Rs 35–60/kg in added profit.
          </p>
        </div>
      </div>
    </div>
  );
}
