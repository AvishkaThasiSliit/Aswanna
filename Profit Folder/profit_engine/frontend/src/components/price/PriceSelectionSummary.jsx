import React, { useMemo } from 'react';
import { Store, Calendar, ShieldCheck, Target } from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';
import { PRICE_COMMODITIES, HORIZON_CONFIGS } from '../../data/priceCommoditiesData';

export default function PriceSelectionSummary() {
  const selectedCommodity = usePriceStore(s => s.selectedCommodity);
  const selectedHorizon = usePriceStore(s => s.selectedHorizon);
  const selectedModel = usePriceStore(s => s.selectedModel);
  const farmerTargetPrice = usePriceStore(s => s.farmerTargetPrice);
  const currentStep = usePriceStore(s => s.currentStep);
  const setStep = usePriceStore(s => s.setStep);
  const vegetablesCatalog = usePriceStore(s => s.vegetablesCatalog);

  const meta = PRICE_COMMODITIES[selectedCommodity] || {};
  const activeConfig = HORIZON_CONFIGS.find(h => h.horizon === selectedHorizon) || HORIZON_CONFIGS[1];

  const currentPrice = useMemo(() => {
    if (vegetablesCatalog && Array.isArray(vegetablesCatalog)) {
      const match = vegetablesCatalog.find(v => v.name === selectedCommodity);
      if (match) return match.latest_price;
    }
    return null;
  }, [vegetablesCatalog, selectedCommodity]);

  const modelLabel = selectedModel === 'selected' 
    ? activeConfig.modelSimpleName 
    : selectedModel === 'naive' 
    ? 'Naive Baseline' 
    : '4-Year Seasonal Mean';

  return (
    <div className="selection-summary-bar">
      <div className="summary-title-col">
        <span className="summary-lbl">Active Selection</span>
      </div>

      <div className="summary-chips-wrap">
        {/* Commodity Chip */}
        <button
          type="button"
          className={`summary-chip ${currentStep === 1 ? 'chip-active' : ''}`}
          onClick={() => setStep(1)}
          title="Click to change Commodity"
        >
          <span className="chip-icon">{meta.icon || '🌱'}</span>
          <span className="chip-val">
            {meta.displayName || selectedCommodity}
            {currentPrice !== null && ` (Rs ${currentPrice.toFixed(0)})`}
          </span>
        </button>

        {/* Horizon Chip */}
        {currentStep >= 2 && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 2 ? 'chip-active' : ''}`}
            onClick={() => setStep(2)}
            title="Click to change Forecast Horizon"
          >
            <Calendar size={12} className="chip-icon" />
            <span className="chip-val">{activeConfig.title} ({activeConfig.days})</span>
          </button>
        )}

        {/* AI Model Chip */}
        {currentStep >= 2 && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 2 ? 'chip-active' : ''}`}
            onClick={() => setStep(2)}
            title="Click to change or view Model"
          >
            <ShieldCheck size={12} className="chip-icon" />
            <span className="chip-val">{modelLabel}</span>
          </button>
        )}

        {/* Target Benchmark Chip */}
        {currentStep >= 3 && farmerTargetPrice && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 3 ? 'chip-active' : ''}`}
            onClick={() => setStep(3)}
            title="Click to change Target Price"
          >
            <Target size={12} className="chip-icon" />
            <span className="chip-val">Target: Rs {farmerTargetPrice}/{meta.unit || 'kg'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
