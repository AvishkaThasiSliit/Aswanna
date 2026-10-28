import React from 'react';
import { ArrowLeft, RefreshCw, Edit3, Sprout, MapPin, Calendar, Droplets, Layers } from 'lucide-react';
import { useCostStore } from '../../state/costStore';
import CostHeroHeader from './CostHeroHeader';
import CostKpiCards from './CostKpiCards';
import CostCashComparisonChart from './CostCashComparisonChart';
import CostBreakdownVisual from './CostBreakdownVisual';
import CostYieldSensitivityChart from './CostYieldSensitivityChart';
import CostShapDrivers from './CostShapDrivers';
import CostAdvisoryNotes from './CostAdvisoryNotes';

export default function CostResultsView() {
  const costResult = useCostStore(s => s.costResult);
  const selectedCrop = useCostStore(s => s.selectedCrop);
  const selectedDistrict = useCostStore(s => s.selectedDistrict);
  const selectedSeason = useCostStore(s => s.selectedSeason);
  const selectedIrrigation = useCostStore(s => s.selectedIrrigation);
  const acreage = useCostStore(s => s.acreage);
  const customYield = useCostStore(s => s.customYield);
  const isLoading = useCostStore(s => s.isLoading);
  const editParameters = useCostStore(s => s.editParameters);
  const fetchCostPrediction = useCostStore(s => s.fetchCostPrediction);

  return (
    <div className="cost-results-view-wrap">
      {/* Top Navigation & Configuration Summary Bar */}
      <div className="cost-results-top-nav">
        <button
          type="button"
          className="cost-btn-step-prev"
          onClick={() => editParameters(1)}
        >
          <ArrowLeft size={16} />
          <span>Edit Cultivation Plan</span>
        </button>

        <div className="cost-summary-ribbon">
          <span className="cost-ribbon-chip" onClick={() => editParameters(1)}>
            <Sprout size={12} />
            {selectedCrop}
          </span>
          <span className="cost-ribbon-chip" onClick={() => editParameters(2)}>
            <MapPin size={12} />
            {selectedDistrict}
          </span>
          <span className="cost-ribbon-chip" onClick={() => editParameters(3)}>
            <Calendar size={12} />
            {selectedSeason}
          </span>
          <span className="cost-ribbon-chip" onClick={() => editParameters(3)}>
            <Droplets size={12} />
            {selectedIrrigation}
          </span>
          <span className="cost-ribbon-chip" onClick={() => editParameters(4)}>
            <Layers size={12} />
            {acreage} Ac
          </span>
        </div>

        <button
          type="button"
          className="cost-btn-refresh-pill"
          onClick={fetchCostPrediction}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? "spin-icon" : ""} />
          <span>{isLoading ? "Recalculating..." : "Recalculate"}</span>
        </button>
      </div>

      {/* Model Benchmark Banner */}
      <CostHeroHeader
        modelAlgorithm={costResult?.model_algorithm}
        modelVersion={costResult?.model_version}
      />

      {/* Primary KPI & Secondary Metrics */}
      <CostKpiCards result={costResult} />

      {/* Liquidity Analysis: Cash Out-of-Pocket vs Imputed Family Resources */}
      <CostCashComparisonChart result={costResult} />

      {/* Empirical Breakdown Donut & Financial Table */}
      <CostBreakdownVisual result={costResult} />

      {/* Economies of Production: Yield-to-Cost Sensitivity Curve */}
      <CostYieldSensitivityChart
        result={costResult}
        customYield={customYield}
        acreage={acreage}
      />

      {/* Explainable AI SHAP Drivers */}
      {costResult?.top_drivers && (
        <CostShapDrivers drivers={costResult.top_drivers} />
      )}

      {/* Practical Agronomic Field Notes */}
      <CostAdvisoryNotes
        crop={selectedCrop}
        district={selectedDistrict}
        irrigation={selectedIrrigation}
      />

      {/* Bottom Sticky Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
        <button
          type="button"
          className="cost-btn-step-next"
          style={{ padding: '12px 28px', fontSize: '14px' }}
          onClick={() => editParameters(1)}
        >
          <Edit3 size={16} />
          <span>Modify Field &amp; Crop Parameters</span>
        </button>
      </div>
    </div>
  );
}
