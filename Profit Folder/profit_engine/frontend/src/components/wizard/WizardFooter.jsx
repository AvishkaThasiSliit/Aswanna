import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';

export default function WizardFooter({ isNextDisabled = false, disabledHint = '' }) {
  const currentStep = useCalculatorStore(s => s.currentStep);
  const nextStep = useCalculatorStore(s => s.nextStep);
  const prevStep = useCalculatorStore(s => s.prevStep);

  const [shake, setShake] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  const handleNextClick = () => {
    if (isNextDisabled) {
      setShake(true);
      setHintVisible(true);
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setHintVisible(false), 3000);
      return;
    }
    nextStep();
  };

  const isLastStep = currentStep === 7;

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
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Step 1 of 7
            </span>
          )}
        </div>

        <div className="footer-right-actions">
          {hintVisible && disabledHint && (
            <motion.span
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="wizard-disabled-hint"
            >
              {disabledHint}
            </motion.span>
          )}

          <motion.button
            type="button"
            className={`wizard-btn-next ${isLastStep ? 'btn-finish' : ''} ${isNextDisabled ? 'disabled' : ''}`}
            onClick={handleNextClick}
            animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            {isLastStep ? (
              <>
                <span>Calculate My Profit</span>
                <Sparkles size={16} />
              </>
            ) : (
              <>
                <span>Next Step</span>
                <ArrowRight size={16} />
              </>
            )}
          </motion.button>
        </div>
      </div>
    </footer>
  );
}
