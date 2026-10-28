import React from 'react';
import { Store, Calendar, BarChart3, Check } from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';

const PRICE_STEPS = [
  { id: 1, label: 'Commodity', icon: Store, sub: '32 CBSL Vegetables' },
  { id: 2, label: 'Horizon & AI Model', icon: Calendar, sub: 'Auto-Selected Best Model' },
  { id: 3, label: 'Market Dynamics', icon: BarChart3, sub: 'Seasonality & Targets' }
];

export default function PriceWizardHeader() {
  const currentStep = usePriceStore(s => s.currentStep);
  const setStep = usePriceStore(s => s.setStep);
  const isResultView = usePriceStore(s => s.isResultView);

  const progressPct = isResultView 
    ? 100 
    : Math.round(((currentStep - 1) / (PRICE_STEPS.length - 1)) * 100);

  return (
    <div className="price-wizard-nav-box">
      <div className="price-steps-list">
        {PRICE_STEPS.map((st) => {
          const isPassed = !isResultView ? st.id < currentStep : true;
          const isCurrent = !isResultView && st.id === currentStep;
          const IconComp = st.icon;

          return (
            <button
              key={st.id}
              type="button"
              className={`price-step-nav-pill ${isCurrent ? 'active' : ''} ${isPassed ? 'completed' : ''}`}
              onClick={() => setStep(st.id)}
            >
              <div className="price-step-nav-circle">
                {isPassed ? <Check size={14} /> : <IconComp size={14} />}
              </div>
              <span className="price-step-nav-label">
                <span className="step-num">Step {st.id}</span>
                <span className="step-name">{st.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="price-wizard-progress-track">
        <div 
          className="price-wizard-progress-fill" 
          style={{ width: `${progressPct}%` }} 
        />
      </div>
    </div>
  );
}
