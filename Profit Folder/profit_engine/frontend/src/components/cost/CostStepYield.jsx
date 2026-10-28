import React from 'react';
import { Sprout, TrendingUp, Scale, ArrowRight, ArrowLeft, Rotate3d, Sparkles, Package } from 'lucide-react';
import { useCostStore } from '../../state/costStore';
import { CROPS_METADATA } from '../../data/cropsData';
import HarvestCrate3D, { getCrateCount } from '../three/HarvestCrate3D';

export default function CostStepYield() {
  const customYield = useCostStore(s => s.customYield);
  const setCustomYield = useCostStore(s => s.setCustomYield);
  const selectedCrop = useCostStore(s => s.selectedCrop);
  const acreage = useCostStore(s => s.acreage);
  const costResult = useCostStore(s => s.costResult);
  const prevStep = useCostStore(s => s.prevStep);
  const goToResults = useCostStore(s => s.goToResults);

  const benchmark = costResult?.historical_benchmark_yield_kg_ac || (CROPS_METADATA[selectedCrop]?.typicalYieldKgAc) || 7000;
  const currentYield = customYield ? parseFloat(customYield) : benchmark;
  const totalHarvest = Math.round(currentYield * acreage);

  // Unit cost calculation
  const totalCost = costResult?.total_cost_incl_imputed || 500000;
  const costPerKg = totalHarvest > 0 ? (totalCost / totalHarvest).toFixed(2) : '0.00';

  const yieldDeltaPct = Math.round(((currentYield - benchmark) / benchmark) * 100);
  const yieldFactor = benchmark > 0 ? currentYield / benchmark : 1.0;
  const crateCount = getCrateCount(yieldFactor);

  const handlePresetYield = (factor) => {
    const val = Math.round(benchmark * factor);
    setCustomYield(String(val));
  };

  return (
    <div className="cost-step-yield-container">
      <div className="cost-step-head">
        <div className="cost-step-icon-badge">
          <TrendingUp size={22} />
        </div>
        <div>
          <h2>Step 5: Yield Projections &amp; Harvest Output</h2>
          <p>
            Calibrate field harvest intensity vs historical Department of Agriculture benchmarks for <strong>{selectedCrop}</strong>.
          </p>
        </div>
      </div>

      <div className="cost-yield-split-grid">
        {/* Left Column: Yield Controls & Dynamic Output */}
        <div className="cost-yield-panel-card">
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Harvest Yield Calibration</span>
            <span style={{ fontSize: '12px', color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: 8, fontWeight: 600 }}>
              DOA Benchmark: {Math.round(benchmark).toLocaleString()} kg/ac
            </span>
          </h3>

          <div className="cost-yield-input-wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                Yield Intensity (kg/acre)
              </label>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#064e3b' }}>
                {Math.round(currentYield).toLocaleString()} <span style={{ fontSize: '13px', color: '#64748b' }}>kg/ac</span>
              </div>
            </div>

            <input
              type="range"
              min={Math.round(benchmark * 0.4)}
              max={Math.round(benchmark * 1.8)}
              step="50"
              className="cost-slider-range"
              value={currentYield}
              onChange={(e) => setCustomYield(e.target.value)}
            />

            <div className="cost-yield-presets-row">
              <button
                type="button"
                className={`cost-yield-preset-btn ${yieldDeltaPct === -20 ? 'active' : ''}`}
                onClick={() => handlePresetYield(0.8)}
              >
                Conservative (-20%)
              </button>
              <button
                type="button"
                className={`cost-yield-preset-btn ${!customYield || yieldDeltaPct === 0 ? 'active' : ''}`}
                onClick={() => setCustomYield('')}
              >
                DOA Baseline (100%)
              </button>
              <button
                type="button"
                className={`cost-yield-preset-btn ${yieldDeltaPct === 20 ? 'active' : ''}`}
                onClick={() => handlePresetYield(1.2)}
              >
                High Intensity (+20%)
              </button>
            </div>
          </div>

          {/* Dynamic Production KPIs */}
          <div className="cost-yield-output-strip">
            <div className="cost-yield-output-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                <Sprout size={14} />
                <span>Total Harvest Output</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '4px 0 2px' }}>
                {totalHarvest.toLocaleString()} kg
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Across {acreage} {acreage === 1 ? 'Acre' : 'Acres'}</span>
            </div>

            <div className="cost-yield-output-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#d97706', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                <Scale size={14} />
                <span>Unit Production Cost</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '4px 0 2px' }}>
                LKR {costPerKg} / kg
              </div>
              <span style={{ fontSize: '11px', color: yieldDeltaPct >= 0 ? '#059669' : '#e11d48' }}>
                {yieldDeltaPct > 0 ? `${yieldDeltaPct}% above benchmark` : yieldDeltaPct === 0 ? 'At baseline parity' : `${Math.abs(yieldDeltaPct)}% below benchmark`}
              </span>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: '12px', color: '#475569', lineHeight: 1.45, marginTop: 12 }}>
            <strong>Economic Insight:</strong> Higher harvest yields dilute fixed machinery and land prep costs, lowering your break-even cost per kilogram.
          </div>
        </div>

        {/* Right Column: Interactive 3D Harvest Crate */}
        <div className="cost-yield-panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={16} color="#059669" />
              <span>3D Harvest Crates Simulation</span>
            </span>
            <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} />
              <span>{crateCount} {crateCount === 1 ? 'Crate' : 'Stacked Crates'} (Fullness: {Math.round(yieldFactor * 100)}%)</span>
            </span>
          </div>

          {/* 3D Canvas Box */}
          <div style={{ width: '100%', height: '310px', borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', background: 'radial-gradient(circle, #fefce8 0%, #f0fdf4 100%)', position: 'relative' }}>
            <HarvestCrate3D crop={selectedCrop} yieldFactor={yieldFactor} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: '11px', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Rotate3d size={13} color="#059669" />
              <span>Drag to rotate 3D cluster • {crateCount} crates stacked</span>
            </span>
            <span style={{ fontWeight: 600, color: crateCount >= 4 ? '#047857' : '#334155' }}>
              ~{Math.round(totalHarvest / 25).toLocaleString()} crates (25kg standard)
            </span>
          </div>

          {/* Action Button to Results */}
          <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 16 }}>
            <button
              type="button"
              className="cost-btn-step-prev"
              onClick={prevStep}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              type="button"
              className="cost-btn-step-next"
              style={{ flex: 1 }}
              onClick={goToResults}
            >
              <span>View Executive Cost Analysis</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
