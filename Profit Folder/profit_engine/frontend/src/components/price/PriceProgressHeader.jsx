import React from 'react';
import { Store, Calendar, BarChart3, Check } from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';

const PRICE_STEPS = [
  { id: 1, label: 'Commodity', icon: Store },
  { id: 2, label: 'Horizon & Model', icon: Calendar },
  { id: 3, label: 'Market Dynamics', icon: BarChart3 }
];

export default function PriceProgressHeader() {
  const currentStep = usePriceStore(s => s.currentStep);
  const setStep = usePriceStore(s => s.setStep);

  return (
    <div className="wizard-progress-header">
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${((currentStep - 1) / (PRICE_STEPS.length - 1)) * 100}%` }}
        />
      </div>

      <div className="progress-steps-list">
        {PRICE_STEPS.map((step) => {
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
