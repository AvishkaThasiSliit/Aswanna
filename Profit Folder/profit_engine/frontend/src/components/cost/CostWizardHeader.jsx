import React from 'react';
import { Sprout, MapPin, Calendar, Layers, TrendingUp, Check } from 'lucide-react';
import { useCostStore } from '../../state/costStore';

const STEPS = [
  { id: 1, label: 'Crop', icon: Sprout },
  { id: 2, label: 'District (Map)', icon: MapPin },
  { id: 3, label: 'Regimes', icon: Calendar },
  { id: 4, label: 'Acres', icon: Layers },
  { id: 5, label: 'Yield & Output', icon: TrendingUp }
];

export default function CostWizardHeader() {
  const currentStep = useCostStore(s => s.currentStep);
  const setStep = useCostStore(s => s.setStep);
  const isResultView = useCostStore(s => s.isResultView);

  const progressPct = isResultView ? 100 : Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100);

  return (
    <div className="cost-wizard-nav-box">
      {/* Step Numbers & Icons */}
      <div className="cost-steps-list">
        {STEPS.map((st) => {
          const isPassed = !isResultView ? st.id < currentStep : true;
          const isCurrent = !isResultView && st.id === currentStep;
          const IconComp = st.icon;

          return (
            <button
              key={st.id}
              type="button"
              className={`cost-step-nav-pill ${isCurrent ? 'active' : ''} ${isPassed ? 'completed' : ''}`}
              onClick={() => setStep(st.id)}
            >
              <div className="cost-step-nav-circle">
                {isPassed ? <Check size={13} /> : <IconComp size={13} />}
              </div>
              <span className="cost-step-nav-label">
                <span className="step-num">Step {st.id}</span>
                <span className="step-name">{st.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress Track */}
      <div className="cost-wizard-progress-track">
        <div 
          className="cost-wizard-progress-fill" 
          style={{ width: `${progressPct}%` }} 
        />
      </div>
    </div>
  );
}
