import React from 'react';
import { Sprout, Award, ShieldCheck, Database, Layers } from 'lucide-react';

export default function CostHeroHeader({ modelAlgorithm, modelVersion }) {
  return (
    <div className="cost-hero-banner">
      <div className="cost-hero-content">
        <div className="cost-hero-icon-wrap">
          <Sprout size={28} />
        </div>
        <div className="cost-hero-text">
          <h1>
            <span>Cultivation Cost Estimator</span>
            <span style={{ fontSize: '13px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              DOA Verified
            </span>
          </h1>
          <p>
            Machine Learning Cost Inference for all 23 Department of Agriculture (DOA) crops calibrated with the 
            ExtraTrees Champion Regressor and 80% Conformal Prediction Intervals.
          </p>
        </div>
      </div>

      <div className="cost-hero-badges">
        <button
          type="button"
          className="cost-model-badge"
          style={{ cursor: 'pointer', border: '1px solid #86efac', background: '#ecfdf5', transition: 'all 0.2s' }}
          onClick={() => { window.location.search = '?tab=models'; }}
          title="Click to explore all trained models in the AI Model Registry"
        >
          <Award size={16} color="#059669" />
          <span>{modelAlgorithm || "ExtraTrees Champion (LOSO MAE Rs 22,822 • R² 0.9329)"}</span>
          <span style={{ fontSize: '10px', background: '#059669', color: '#ffffff', padding: '1px 6px', borderRadius: '4px', marginLeft: 6, fontWeight: 700 }}>
            Inspect Registry
          </span>
        </button>
        <div className="cost-hero-tags-row">
          <span className="cost-tag-chip">
            <Database size={11} style={{ display: 'inline', marginRight: 4 }} />
            23 Verified Crops
          </span>
          <span className="cost-tag-chip">
            <Layers size={11} style={{ display: 'inline', marginRight: 4 }} />
            25 Agrarian Districts
          </span>
          <span className="cost-tag-chip">
            <ShieldCheck size={11} style={{ display: 'inline', marginRight: 4 }} />
            80% Conformal Band
          </span>
        </div>
      </div>
    </div>
  );
}
