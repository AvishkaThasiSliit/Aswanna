import React from 'react';
import { 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  Sliders, 
  HelpCircle, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';
import { HORIZON_CONFIGS } from '../../data/priceCommoditiesData';

export default function PriceStepHorizon() {
  const selectedHorizon = usePriceStore(s => s.selectedHorizon);
  const setSelectedHorizon = usePriceStore(s => s.setSelectedHorizon);
  const selectedModel = usePriceStore(s => s.selectedModel);
  const setSelectedModel = usePriceStore(s => s.setSelectedModel);
  const showAdvanced = usePriceStore(s => s.showAdvancedModelSelector);
  const setShowAdvanced = usePriceStore(s => s.setShowAdvancedModelSelector);
  const forecastResult = usePriceStore(s => s.forecastResult);

  const activeConfig = HORIZON_CONFIGS.find(h => h.horizon === selectedHorizon) || HORIZON_CONFIGS[1];
  const originDate = forecastResult?.forecast?.origin_date || '2026-08-25';
  const targetDate = forecastResult?.forecast?.target_date || '2026-09-22';

  return (
    <div className="price-step-card-wrap">
      <div className="price-step-header">
        <div className="price-step-icon-badge">
          <Calendar size={22} />
        </div>
        <div>
          <h2>Step 2: Forecast Horizon & AI Model</h2>
          <p>
            Choose your planning timeframe. Aswenna automatically chooses the champion ML model so you get maximum accuracy without needing ML expertise.
          </p>
        </div>
      </div>

      {/* Horizon Cards Grid */}
      <div className="price-horizon-grid">
        {HORIZON_CONFIGS.map((hc) => {
          const isSelected = selectedHorizon === hc.horizon;

          return (
            <div
              key={hc.horizon}
              className={`price-horizon-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedHorizon(hc.horizon)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedHorizon(hc.horizon)}
            >
              <div className="price-horizon-card-head">
                <span className="price-horizon-badge">{hc.badge}</span>
                <span className="price-horizon-days">
                  <Clock size={12} /> {hc.days}
                </span>
              </div>

              <h3 className="price-horizon-title">{hc.title}</h3>
              <p className="price-horizon-sub">{hc.subtitle}</p>

              <div className="price-horizon-model-pill">
                <Sparkles size={13} color="#059669" />
                <span>{hc.modelSimpleName}</span>
              </div>

              <p className="price-horizon-desc">{hc.farmerTip}</p>
            </div>
          );
        })}
      </div>

      {/* Auto-Selected AI Model Showcase Banner */}
      <div className="price-auto-model-showcase">
        <div className="price-model-banner-head">
          <div className="price-model-title-wrap">
            <div className="price-model-ai-icon">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="price-model-badge-row">
                <h3>Recommended Engine: {activeConfig.modelSimpleName}</h3>
                <span className="price-auto-selected-tag">
                  <CheckCircle2 size={13} />
                  Auto-Selected For You
                </span>
              </div>
              <p className="price-model-subtitle">
                Farmers don’t need machine learning knowledge — Aswenna automatically engages the champion model with the lowest historical test error for {activeConfig.title.toLowerCase()}.
              </p>
            </div>
          </div>
        </div>

        <div className="price-model-specs-grid">
          <div className="price-spec-box">
            <span className="spec-label">Selected Horizon</span>
            <span className="spec-val">{activeConfig.title} ({activeConfig.days})</span>
          </div>

          <div className="price-spec-box">
            <span className="spec-label">Target Date</span>
            <span className="spec-val highlight">{targetDate}</span>
          </div>

          <div className="price-spec-box">
            <span className="spec-label">Underlying ML Architecture</span>
            <span className="spec-val">{activeConfig.modelName}</span>
          </div>

          <div className="price-spec-box">
            <span className="spec-label">Confidence Framework</span>
            <span className="spec-val">80% Conformal Prediction Band</span>
          </div>
        </div>

        <div className="price-model-explanation-card">
          <div className="explanation-icon">
            <HelpCircle size={16} color="#0284c7" />
          </div>
          <div className="explanation-text">
            <strong>Why this model?</strong> {activeConfig.description}
          </div>
        </div>

        {/* Optional Advanced Model Switcher */}
        <div className="price-advanced-drawer">
          <button
            type="button"
            className="btn-toggle-advanced"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Sliders size={14} />
            <span>{showAdvanced ? 'Hide Advanced ML Controls' : 'Show Advanced ML Model Options (Optional)'}</span>
          </button>

          {showAdvanced && (
            <div className="price-advanced-controls-box">
              <p className="advanced-intro">
                You can manually compare the AI Champion against traditional statistical baselines:
              </p>

              <div className="model-options-row">
                <button
                  type="button"
                  className={`model-option-btn ${selectedModel === 'selected' ? 'active' : ''}`}
                  onClick={() => setSelectedModel('selected')}
                >
                  <div className="model-opt-radio" />
                  <div>
                    <strong>AI Champion Model (Recommended)</strong>
                    <p>Auto-selected top-performing model ({activeConfig.modelSimpleName})</p>
                  </div>
                </button>

                <button
                  type="button"
                  className={`model-option-btn ${selectedModel === 'naive' ? 'active' : ''}`}
                  onClick={() => setSelectedModel('naive')}
                >
                  <div className="model-opt-radio" />
                  <div>
                    <strong>Naive Persistence Baseline</strong>
                    <p>Assumes price remains unchanged from last observed bulletin</p>
                  </div>
                </button>

                <button
                  type="button"
                  className={`model-option-btn ${selectedModel === 'seasonal_mean_4yr' ? 'active' : ''}`}
                  onClick={() => setSelectedModel('seasonal_mean_4yr')}
                >
                  <div className="model-opt-radio" />
                  <div>
                    <strong>4-Year Seasonal Mean</strong>
                    <p>Historical average for the matching week across 2020–2024</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
