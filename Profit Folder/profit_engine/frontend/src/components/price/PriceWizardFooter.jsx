import React from 'react';
import { ArrowLeft, ArrowRight, TrendingUp } from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';

export default function PriceWizardFooter() {
  const currentStep = usePriceStore(s => s.currentStep);
  const nextStep = usePriceStore(s => s.nextStep);
  const prevStep = usePriceStore(s => s.prevStep);

  const isLastStep = currentStep === 3;

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
              Step 1 of 3
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
                <span>Generate Forecast & Charts</span>
                <TrendingUp size={16} />
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
