import React from 'react';
import { usePriceStore } from '../../state/priceStore';
import PriceProgressHeader from './PriceProgressHeader';
import PriceSelectionSummary from './PriceSelectionSummary';
import PriceWizardFooter from './PriceWizardFooter';

import PriceStepCommodity from './PriceStepCommodity';
import PriceStepHorizon from './PriceStepHorizon';
import PriceStepDynamics from './PriceStepDynamics';

export default function PriceWizardShell() {
  const currentStep = usePriceStore(s => s.currentStep);

  return (
    <div className="wizard-fullscreen-shell">
      {/* 1. Full-width Progress Header */}
      <PriceProgressHeader />

      {/* 2. Active Selection Chips */}
      <PriceSelectionSummary />

      {/* 3. Main Step Body */}
      <main className="wizard-step-body">
        {currentStep === 1 && <PriceStepCommodity />}
        {currentStep === 2 && <PriceStepHorizon />}
        {currentStep === 3 && <PriceStepDynamics />}
      </main>

      {/* 4. Pinned Sticky Footer with Back / Next */}
      <PriceWizardFooter />
    </div>
  );
}
