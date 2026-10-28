import React from 'react';
import { Layers, Plus, Minus, Info, ArrowRight, ArrowLeft, Rotate3d, Sparkles } from 'lucide-react';
import { useCostStore } from '../../state/costStore';
import FieldScene from '../three/FieldScene';

export default function CostStepField3D() {
  const acreage = useCostStore(s => s.acreage);
  const setAcreage = useCostStore(s => s.setAcreage);
  const selectedCrop = useCostStore(s => s.selectedCrop);
  const costResult = useCostStore(s => s.costResult);
  const nextStep = useCostStore(s => s.nextStep);
  const prevStep = useCostStore(s => s.prevStep);

  const handleStep = (delta) => {
    const next = Math.max(0.25, Math.min(10.0, parseFloat((acreage + delta).toFixed(2))));
    setAcreage(next);
  };

  // Calculate economies of scale discount estimate
  const scaleEfficiencyPct = acreage > 1.0 ? Math.min(12, (acreage - 1.0) * 1.8).toFixed(1) : '0.0';

  return (
    <div className="cost-step-field-container">
      <div className="cost-step-head">
        <div className="cost-step-icon-badge">
          <Layers size={22} />
        </div>
        <div>
          <h2>Step 4: 3D Field Scale &amp; Plot Simulation</h2>
          <p>
            Interactive 3D Agritech Diorama: Adjust field size and observe physical scale expansion for <strong>{selectedCrop}</strong>.
          </p>
        </div>
      </div>

      <div className="cost-field-split-view">
        {/* Left: Interactive 3D Field Diorama */}
        <div className="cost-field-canvas-card">
          <div className="cost-3d-badge-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11.5px', color: '#047857', fontWeight: 600 }}>
              <Rotate3d size={15} />
              <span>Interactive 3D Diorama • Drag to rotate, scroll to zoom</span>
            </div>
            <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
              {acreage} {acreage === 1 ? 'Acre' : 'Acres'} Scale
            </span>
          </div>

          <div style={{ height: '440px', width: '100%', position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
            <FieldScene
              crop={selectedCrop}
              acreage={acreage}
              yieldFactor={1.0}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: '11px', color: '#64748b' }}>
            <span>🌱 Stylized {selectedCrop} plants &amp; raised planting mounds</span>
            <span>📡 IoT Smart Agriculture solar weather mast</span>
          </div>
        </div>

        {/* Right: Field Controls & Scale Insights */}
        <div className="cost-field-controls-card">
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#0f172a' }}>
            Field Acreage Configuration
          </h3>

          <div className="cost-acreage-stepper-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="cost-acreage-stepper-btn"
                onClick={() => handleStep(-0.25)}
                disabled={acreage <= 0.25}
              >
                <Minus size={15} />
              </button>
              <div style={{ textAlign: 'center' }}>
                <span className="cost-acreage-big-num">{acreage.toFixed(2)}</span>
                <span style={{ fontSize: '13px', color: '#64748b', marginLeft: 4, fontWeight: 600 }}>Acres</span>
              </div>
              <button
                type="button"
                className="cost-acreage-stepper-btn"
                onClick={() => handleStep(0.25)}
                disabled={acreage >= 10.0}
              >
                <Plus size={15} />
              </button>
            </div>

            <input
              type="range"
              min="0.25"
              max="10.0"
              step="0.25"
              className="cost-slider-range"
              value={acreage}
              onChange={(e) => setAcreage(parseFloat(e.target.value))}
            />

            <div className="cost-acreage-presets">
              {[0.25, 0.5, 1.0, 2.0, 5.0].map(val => (
                <button
                  key={val}
                  type="button"
                  className={`cost-preset-btn ${acreage === val ? 'active' : ''}`}
                  onClick={() => setAcreage(val)}
                >
                  {val} Ac
                </button>
              ))}
            </div>
          </div>

          {/* Economies of Scale Card */}
          <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 12, padding: '14px', marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="#059669" />
                Economies of Scale
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#047857' }}>
                {scaleEfficiencyPct > 0 ? `-${scaleEfficiencyPct}% Cost Efficiency` : 'Standard Baseline'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11.5px', color: '#047857', lineHeight: 1.45 }}>
              Expanding field acreage distributes machinery mobilization, boundary fencing, and irrigation pump overheads across higher output volume.
            </p>
          </div>

          {/* Live Planning Cost Preview */}
          {costResult && (
            <div style={{ marginTop: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Estimated Cultivation Cost ({acreage} Ac)
              </span>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                LKR {Math.round(costResult.total_cost_incl_imputed).toLocaleString()}
              </div>
              <span style={{ fontSize: '11px', color: '#059669' }}>
                LKR {Math.round(costResult.predicted_cost_incl_imputed_per_acre).toLocaleString()} / acre
              </span>
            </div>
          )}

          {/* Navigation Footer */}
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
              onClick={nextStep}
            >
              <span>Next: Yield &amp; Harvest Output</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
