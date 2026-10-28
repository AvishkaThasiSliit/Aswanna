import React from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useCostStore } from '../../state/costStore';

export default function CostWizardFooter() {
  const currentStep = useCostStore(s => s.currentStep);
  const nextStep = useCostStore(s => s.nextStep);
  const prevStep = useCostStore(s => s.prevStep);

  const isLastStep = currentStep === 5;

  return (
    <footer className="wizard-sticky-footer">
      <div className="footer-content-wrap">
        <div>
          {currentStep > 1 ? (
            <button
              type="button"
              className="wizard-btn-back"
              onClick={prevStep}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          ) : (
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              Step 1 of 5
            </span>
          )}
        </div>

        <div className="footer-right-actions">
          <button
            type="button"
            className={`wizard-btn-next ${isLastStep ? 'btn-finish' : ''}`}
            onClick={nextStep}
          >
            {isLastStep ? (
              <>
                <span>Calculate Cultivation Cost</span>
                <Sparkles size={16} />
              </>
            ) : (
              <>
                <span>Next Step</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </footer>
  );
}
