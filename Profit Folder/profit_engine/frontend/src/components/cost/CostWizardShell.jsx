import React from 'react';
import { useCostStore } from '../../state/costStore';
import CostProgressHeader from './CostProgressHeader';
import CostSelectionSummary from './CostSelectionSummary';
import CostWizardFooter from './CostWizardFooter';

import CostStepCrop from './CostStepCrop';
import CostStepDistrict from './CostStepDistrict';
import CostStepRegimes from './CostStepRegimes';
import CostStepField3D from './CostStepField3D';
import CostStepYield from './CostStepYield';

export default function CostWizardShell() {
  const currentStep = useCostStore(s => s.currentStep);

  return (
    <div className="wizard-fullscreen-shell">
      {/* 1. Full-width Progress Header */}
      <CostProgressHeader />

      {/* 2. Active Selection Chips */}
      <CostSelectionSummary />

      {/* 3. Main Step Body */}
      <main className="wizard-step-body">
        {currentStep === 1 && <CostStepCrop />}
        {currentStep === 2 && <CostStepDistrict />}
        {currentStep === 3 && <CostStepRegimes />}
        {currentStep === 4 && <CostStepField3D />}
        {currentStep === 5 && <CostStepYield />}
      </main>

      {/* 4. Pinned Sticky Footer with Back / Next */}
      <CostWizardFooter />
    </div>
  );
}
