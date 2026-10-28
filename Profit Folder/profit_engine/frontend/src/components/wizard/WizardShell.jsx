import React from 'react';
import { useCalculatorStore } from '../../state/calculatorStore';
import ProgressHeader from './ProgressHeader';
import SelectionSummary from './SelectionSummary';
import StepTransition from './StepTransition';
import WizardFooter from './WizardFooter';
import CalculatingScreen from './CalculatingScreen';

import StepCrop from '../steps/StepCrop';
import StepDistrict from '../steps/StepDistrict';
import StepConditions from '../steps/StepConditions';
import StepField from '../steps/StepField';
import StepVehicle from '../steps/StepVehicle';
import StepLocation from '../steps/StepLocation';
import StepLeafy from '../steps/StepLeafy';

export default function WizardShell() {
  const currentStep = useCalculatorStore(s => s.currentStep);
  const isCalculatingScreen = useCalculatorStore(s => s.isCalculatingScreen);

  if (isCalculatingScreen) {
    return <CalculatingScreen />;
  }

  const renderActiveStep = () => {
    switch (currentStep) {
      case 1:
        return <StepCrop />;
      case 2:
        return <StepDistrict />;
      case 3:
        return <StepConditions />;
      case 4:
        return <StepField />;
      case 5:
        return <StepVehicle />;
      case 6:
        return <StepLocation />;
      case 7:
        return <StepLeafy />;
      default:
        return <StepCrop />;
    }
  };

  return (
    <div className="wizard-fullscreen-shell">
      <ProgressHeader />
      <SelectionSummary />

      <main className="wizard-step-body">
        <StepTransition stepKey={currentStep}>
          {renderActiveStep()}
        </StepTransition>
      </main>

      <WizardFooter />
    </div>
  );
}
