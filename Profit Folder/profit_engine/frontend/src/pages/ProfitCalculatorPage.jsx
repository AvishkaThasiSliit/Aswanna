import React from 'react';
import { useCalculatorStore } from '../state/calculatorStore';
import { useAdvisoryPredict } from '../hooks/useAdvisoryPredict';
import WizardShell from '../components/wizard/WizardShell';
import ResultsDashboard from '../components/results/ResultsDashboard';

export default function ProfitCalculatorPage() {
  const isResultView = useCalculatorStore(s => s.isResultView);

  // Initialize prediction lifecycle hook
  useAdvisoryPredict();

  return (
    <div className="profit-calculator-page">
      {isResultView ? (
        <ResultsDashboard />
      ) : (
        <WizardShell />
      )}
    </div>
  );
}
