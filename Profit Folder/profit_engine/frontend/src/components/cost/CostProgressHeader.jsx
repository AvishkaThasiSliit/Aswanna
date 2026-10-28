import React from 'react';
import { Sprout, MapPin, Calendar, Layers, TrendingUp, Check } from 'lucide-react';
import { useCostStore } from '../../state/costStore';

const COST_STEPS = [
  { id: 1, label: 'Crop', icon: Sprout },
  { id: 2, label: 'District (Map)', icon: MapPin },
  { id: 3, label: 'Regimes', icon: Calendar },
  { id: 4, label: 'Acres', icon: Layers },
  { id: 5, label: 'Yield & Output', icon: TrendingUp }
];

export default function CostProgressHeader() {
  const currentStep = useCostStore(s => s.currentStep);
  const setStep = useCostStore(s => s.setStep);

  return (
    <div className="wizard-progress-header">
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${((currentStep - 1) / (COST_STEPS.length - 1)) * 100}%` }}
        />
      </div>

      <div className="progress-steps-list">
        {COST_STEPS.map((step) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isClickable = isCompleted;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`progress-step-item ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isClickable ? 'clickable' : ''}`}
              onClick={() => isClickable && setStep(step.id)}
              role="button"
              tabIndex={isClickable ? 0 : -1}
              aria-label={`Step ${step.id}: ${step.label}`}
              title={isClickable ? `Jump back to Step ${step.id}: ${step.label}` : step.label}
            >
              <div className="step-circle">
                {isCompleted ? (
                  <Check size={14} className="check-icon" strokeWidth={3} />
                ) : (
                  <Icon size={15} />
                )}
                <span className="step-number-sub">{step.id}</span>
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
