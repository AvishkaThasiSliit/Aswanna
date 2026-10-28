import React from 'react';
import { motion } from 'framer-motion';
import { Edit3, RefreshCw, Printer, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';
import { useAdvisoryPredict } from '../../hooks/useAdvisoryPredict';
import { computeCombinedMetrics } from '../../utils/metrics';
import KpiCards from './KpiCards';
import ChannelComparison from './ChannelComparison';
import CostDonut from './CostDonut';
import ProfitTrendChart from './ProfitTrendChart';
import FinancialTable from './FinancialTable';
import AiRecommendations from './AiRecommendations';
import Skeleton from '../common/Skeleton';
import advisoryData from '../../data/advisory_data.json';

export default function ResultsDashboard() {
  const selectedCrop = useCalculatorStore(s => s.selectedCrop);
  const acreage = useCalculatorStore(s => s.acreage);
  const profitMode = useCalculatorStore(s => s.profitMode);
  const channelMode = useCalculatorStore(s => s.channelMode);
  const enableLeafy = useCalculatorStore(s => s.enableLeafy);
  const customYield = useCalculatorStore(s => s.customYield);

  const liveData = useCalculatorStore(s => s.liveData);
  const isCalculating = useCalculatorStore(s => s.isCalculating);
  const apiOnline = useCalculatorStore(s => s.apiOnline);
  const errorMessage = useCalculatorStore(s => s.errorMessage);

  const editInputs = useCalculatorStore(s => s.editInputs);
  const startOver = useCalculatorStore(s => s.startOver);

  const { triggerFetch } = useAdvisoryPredict();

  const cropData = advisoryData.crops[selectedCrop] || advisoryData.crops['Tomato'];

  const metrics = computeCombinedMetrics({
    liveData,
    cropData,
    acreage,
    profitMode,
    channelMode,
    enableLeafy,
    customYield
  });

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  return (
    <div className="results-dashboard-wrapper">
      {/* Top Controls Bar */}
      <div className="results-top-action-bar">
        <button
          type="button"
          className="btn-back-to-wizard"
          onClick={editInputs}
        >
          <ArrowLeft size={16} />
          <span>Edit Inputs / Return to Wizard</span>
        </button>

        <div className="results-action-buttons">
          <button
            type="button"
            className="results-action-btn"
            onClick={triggerFetch}
            disabled={isCalculating}
          >
            <RefreshCw size={15} className={isCalculating ? "spin" : ""} />
            <span>Recalculate</span>
          </button>

          <button
            type="button"
            className="results-action-btn secondary"
            onClick={handlePrint}
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Offline Alert Banner if API is down */}
      {(!apiOnline || errorMessage) && (
        <div className="results-offline-alert-card">
          <AlertTriangle size={20} color="#b45309" />
          <div className="alert-content">
            <strong>Advisory Engine Disconnected</strong>
            <p>{errorMessage || "Unable to reach predictive machine learning backend. Click retry to reconnect."}</p>
          </div>
          <button
            type="button"
            className="btn-retry-api"
            onClick={triggerFetch}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isCalculating && !liveData && (
        <div className="results-skeletons-group">
          <div className="kpi-cards-grid main-row">
            <Skeleton height="110px" borderRadius="16px" />
            <Skeleton height="110px" borderRadius="16px" />
            <Skeleton height="110px" borderRadius="16px" />
          </div>
          <Skeleton height="240px" borderRadius="16px" style={{ marginTop: 20 }} />
        </div>
      )}

      {/* Complete Results Presentation */}
      {metrics && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="results-content-stack"
        >
          {/* KPI Cards */}
          <KpiCards metrics={metrics} liveData={liveData} />

          {/* Channel Comparison */}
          <ChannelComparison metrics={metrics} liveData={liveData} />

          {/* Charts Row */}
          <div className="results-charts-grid">
            <CostDonut items={metrics.donutItems} totalAmount={metrics.totalCost} />
            <ProfitTrendChart trajectories={metrics.trajectories} />
          </div>

          {/* Financial Breakdown Table */}
          <FinancialTable rows={metrics.tableRows} totalCost={metrics.totalCost} />

          {/* AI Decision Recommendations */}
          <AiRecommendations recommendations={metrics.recommendations} />
        </motion.div>
      )}
    </div>
  );
}
