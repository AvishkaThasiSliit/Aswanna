import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, Sprout, Package, RotateCcw, Plus, Minus, Eye } from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';
import FieldScene from '../three/FieldScene';
import AnimatedNumber from '../common/AnimatedNumber';
import advisoryData from '../../data/advisory_data.json';

export default function StepField() {
  const selectedCrop = useCalculatorStore(s => s.selectedCrop);
  const acreage = useCalculatorStore(s => s.acreage);
  const setAcreage = useCalculatorStore(s => s.setAcreage);
  const customYield = useCalculatorStore(s => s.customYield);
  const setCustomYield = useCalculatorStore(s => s.setCustomYield);
  const resetToTypicalYield = useCalculatorStore(s => s.resetToTypicalYield);

  const [use2DFallback, setUse2DFallback] = useState(false);

  const cropData = advisoryData.crops[selectedCrop] || advisoryData.crops['Tomato'];
  const benchmarkYieldPerAc = cropData.typical_yield_kg_ac || 6000;

  const currentYieldPerAc = customYield ? (parseFloat(customYield) || benchmarkYieldPerAc) : benchmarkYieldPerAc;
  const totalHarvestKg = currentYieldPerAc * acreage;
  const sackCount = Math.round(totalHarvestKg / 50); // 50kg produce sacks
  const yieldRatio = currentYieldPerAc / benchmarkYieldPerAc;

  const handleStepper = (delta) => {
    const nextVal = Math.round((acreage + delta) * 4) / 4;
    setAcreage(Math.min(10, Math.max(0.25, nextVal)));
  };

  return (
    <div className="wizard-step-container">
      <div className="step-headline">
        <h2>Step 4: Your Cultivation Field & Production Scale</h2>
        <p>Dynamic 3D simulation of your planting area. Adjust acreage to watch crop rows scale in real-time.</p>
      </div>

      <div className="field-step-grid">
        {/* Left Column: 3D Field Viewer Canvas */}
        <div className="field-canvas-card">
          <div className="canvas-header-bar">
            <div className="canvas-pill-tag">
              <Sprout size={14} color="#059669" />
              <span>Smart Plot: {selectedCrop}</span>
            </div>
            <div className="iot-status-badge">
              <span className="iot-pulse-dot" />
              <span>IoT Weather Mast Online</span>
            </div>
            <button
              type="button"
              className="toggle-canvas-mode-btn"
              onClick={() => setUse2DFallback(!use2DFallback)}
              title="Switch between 3D Canvas and 2D Lightweight Illustration"
            >
              <Eye size={13} />
              <span>{use2DFallback ? "Use 3D Canvas" : "2D Low-Power Mode"}</span>
            </button>
          </div>

          <FieldScene
            crop={selectedCrop}
            acreage={acreage}
            yieldFactor={yieldRatio}
            isLowPower={use2DFallback}
          />

          <div className="canvas-footer-hint">
            <span>🖱️ Drag to orbit 360° • Scroll to zoom • Inspect raised mounds & solar weather station</span>
          </div>
        </div>

        {/* Right Column: Acreage Slider + Yield Intelligence */}
        <div className="field-controls-card">
          {/* Acreage Slider & Stepper */}
          <div className="control-group-box">
            <div className="control-label-row">
              <label>Field Acreage (Acres)</label>
              <span className="current-acre-pill">{acreage.toFixed(2)} Acres</span>
            </div>

            <div className="acreage-slider-stepper-wrap">
              <button
                type="button"
                className="stepper-btn"
                onClick={() => handleStepper(-0.25)}
                disabled={acreage <= 0.25}
                title="Decrease 0.25 acres"
              >
                <Minus size={16} />
              </button>

              <input
                type="range"
                min="0.25"
                max="10.0"
                step="0.25"
                value={acreage}
                onChange={(e) => setAcreage(e.target.value)}
                className="acreage-slider-input"
              />

              <button
                type="button"
                className="stepper-btn"
                onClick={() => handleStepper(0.25)}
                disabled={acreage >= 10.0}
                title="Increase 0.25 acres"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="acreage-quick-presets">
              {[0.5, 1.0, 2.0, 3.0, 5.0].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`preset-chip ${acreage === preset ? 'active' : ''}`}
                  onClick={() => setAcreage(preset)}
                >
                  {preset} ac
                </button>
              ))}
            </div>
          </div>

          {/* Expected Yield Output Card */}
          <div className="yield-kpi-banner">
            <div className="yield-kpi-head">
              <div className="icon-wrap">
                <Package size={22} color="#059669" />
              </div>
              <div>
                <span className="lbl">Total Expected Harvest Output</span>
                <div className="val">
                  ≈ <AnimatedNumber value={totalHarvestKg} decimals={0} suffix=" kg" />
                </div>
              </div>
            </div>

            {/* Sacks Indicator */}
            <div className="sacks-visual-indicator">
              <span className="sacks-count">
                📦 Approximately <strong>{sackCount.toLocaleString()}</strong> commercial harvest sacks (50kg bags)
              </span>
            </div>
          </div>

          {/* Optional Yield Override */}
          <div className="yield-override-box">
            <div className="override-header-row">
              <label>Custom Yield Intensity (kg/acre)</label>
              {customYield && (
                <button
                  type="button"
                  className="btn-reset-benchmark"
                  onClick={resetToTypicalYield}
                >
                  <RotateCcw size={12} />
                  <span>Reset to DOA Benchmark ({benchmarkYieldPerAc.toLocaleString()})</span>
                </button>
              )}
            </div>

            <input
              type="number"
              placeholder={`DOA Historical Benchmark: ${benchmarkYieldPerAc.toLocaleString()} kg/ac`}
              value={customYield}
              onChange={(e) => setCustomYield(e.target.value)}
              className="override-yield-input"
            />
            <p className="override-hint">
              Leave blank to automatically use official DOA benchmark statistics for {selectedCrop}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
