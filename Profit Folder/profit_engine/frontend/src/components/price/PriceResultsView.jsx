import React from 'react';
import { 
  ArrowLeft, 
  RotateCcw, 
  Calculator, 
  Printer, 
  Calendar, 
  ShieldCheck,
  BrainCircuit 
} from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';
import { PRICE_COMMODITIES } from '../../data/priceCommoditiesData';
import PriceKpiCards from './PriceKpiCards';
import PriceTrajectoryChart from './PriceTrajectoryChart';
import PriceBenchmarkChart from './PriceBenchmarkChart';
import PriceVolatilityDistributionChart from './PriceVolatilityDistributionChart';
import PriceAdvisoryCard from './PriceAdvisoryCard';

export default function PriceResultsView() {
  const selectedCommodity = usePriceStore(s => s.selectedCommodity);
  const selectedHorizon = usePriceStore(s => s.selectedHorizon);
  const editParameters = usePriceStore(s => s.editParameters);
  const forecastResult = usePriceStore(s => s.forecastResult);

  const meta = PRICE_COMMODITIES[selectedCommodity] || {
    displayName: selectedCommodity,
    sinhala: '',
    unit: '1kg',
    category: 'Upcountry'
  };

  const forecast = forecastResult?.forecast;

  const handlePrint = () => {
    window.print();
  };

  const handleNavigateCalculator = () => {
    // Map commodity to calculator crop if available
    window.location.search = '?tab=calculator';
  };

  return (
    <div className="price-results-view-wrap">
      {/* Results Header Action Bar */}
      <div className="price-results-top-bar">
        <div className="results-top-title-wrap">
          <button
            type="button"
            className="btn-results-back"
            onClick={() => editParameters(2)}
          >
            <ArrowLeft size={16} />
            <span>Back to Wizard</span>
          </button>

          <div className="results-badge-group">
            <span className="results-crop-badge">
              <span className="crop-icon">{meta.icon || '🌱'}</span>
              <strong>{meta.displayName || selectedCommodity}</strong>
              {meta.sinhala && <span className="crop-sinhala">({meta.sinhala})</span>}
            </span>

            <span className="results-horizon-badge">
              <Calendar size={13} />
              <span>{selectedHorizon} Weeks Ahead ({forecast?.target_date || 'Target'})</span>
            </span>

            <span className="results-engine-badge">
              <ShieldCheck size={13} />
              <span>{forecast?.model_used || 'AutoARIMA Champion'}</span>
            </span>
          </div>
        </div>

        <div className="results-actions-right">
          <button
            type="button"
            className="btn-action-outline"
            onClick={() => { window.location.search = '?tab=models'; }}
          >
            <BrainCircuit size={14} color="#059669" />
            <span>AI Model Registry</span>
          </button>

          <button
            type="button"
            className="btn-action-outline"
            onClick={() => editParameters(1)}
          >
            <RotateCcw size={14} />
            <span>Change Commodity</span>
          </button>

          <button
            type="button"
            className="btn-action-outline"
            onClick={handlePrint}
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 1. Hero KPI Cards */}
      <PriceKpiCards />

      {/* 2. Primary 52-Week Trajectory & Fan Chart */}
      <PriceTrajectoryChart />

      {/* 3. Two-Column Detailed Analytics Grid */}
      <div className="price-charts-subgrid">
        <PriceBenchmarkChart />
        <PriceVolatilityDistributionChart />
      </div>

      {/* 4. Actionable Market Advisory */}
      <PriceAdvisoryCard />

      {/* 5. Bottom Navigation / Profit Calculator Link Bar */}
      <div className="price-results-bottom-bar">
        <div className="bottom-bar-left">
          <h4>Integrate Forecast with Farm Financials</h4>
          <p>
            Connect this expected selling price of <strong>LKR {forecast?.point_forecast?.toFixed(2)}/{meta.unit}</strong> directly into the Aswenna Profit Calculator to simulate your net farm return.
          </p>
        </div>

        <div className="bottom-bar-right">
          <button
            type="button"
            className="btn-action-primary"
            onClick={handleNavigateCalculator}
          >
            <Calculator size={16} />
            <span>Test in Profit Calculator</span>
          </button>
        </div>
      </div>
    </div>
  );
}
