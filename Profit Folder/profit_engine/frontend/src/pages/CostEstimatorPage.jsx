import React, { useEffect } from 'react';
import '../styles/costEstimator.css';
import { useCostStore } from '../state/costStore';
import CostWizardShell from '../components/cost/CostWizardShell';
import CostResultsView from '../components/cost/CostResultsView';

export default function CostEstimatorPage() {
  const isResultView = useCostStore(s => s.isResultView);
  const fetchCostPrediction = useCostStore(s => s.fetchCostPrediction);

  useEffect(() => {
    fetchCostPrediction();
  }, [fetchCostPrediction]);

  return (
    <div className={isResultView ? "cost-results-page-wrap" : "cost-fullscreen-page"}>
      {isResultView ? (
        <CostResultsView />
      ) : (
        <CostWizardShell />
      )}
    </div>
  );
}
