import React from 'react';
import {
  Sprout,
  MapPin,
  Calendar,
  Layers,
  Truck,
  Store,
  Leaf,
  Check
} from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';

const WIZARD_STEPS = [
  { id: 1, label: 'Crop', icon: Sprout },
  { id: 2, label: 'District', icon: MapPin },
  { id: 3, label: 'Conditions', icon: Calendar },
  { id: 4, label: 'Field', icon: Layers },
  { id: 5, label: 'Vehicle', icon: Truck },
  { id: 6, label: 'Market', icon: Store },
  { id: 7, label: 'Side Crop', icon: Leaf }
];

export default function ProgressHeader() {
  const currentStep = useCalculatorStore(s => s.currentStep);
  const setStep = useCalculatorStore(s => s.setStep);

  return (
    <div className="wizard-progress-header">
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100}%` }}
        />
      </div>

      <div className="progress-steps-list">
        {WIZARD_STEPS.map((step) => {
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
