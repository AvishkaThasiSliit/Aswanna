import React from 'react';
import { Cpu, DollarSign, TrendingUp, TrendingDown, Sprout, Calendar, Droplets } from 'lucide-react';

const FEATURE_META = {
  'Crop': { label: 'Crop Baseline Agronomy', icon: Sprout },
  'USD_LKR_Rate': { label: 'Currency Exchange Rate (USD/LKR)', icon: DollarSign },
  'Prev_Season_Total_Cost_Incl_Imputed': { label: 'Prior Season Cost Baseline', icon: Calendar },
  'Irrigation_Type': { label: 'Irrigation & Water Regime', icon: Droplets },
  'District': { label: 'District Agro-Ecological Zone', icon: Sprout },
  'Season': { label: 'Seasonal Monsoon Effect', icon: Calendar }
};

export default function CostShapDrivers({ drivers }) {
  if (!drivers || drivers.length === 0) return null;

  return (
    <div className="cost-shap-card">
      <div className="cost-shap-head">
        <h3>
          <Cpu size={18} color="#059669" />
          <span>Machine Learning Feature Attributions (SHAP Drivers)</span>
        </h3>
        <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
          Explainable AI (XAI)
        </span>
      </div>

      <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>
        Relative contribution of macro-economic indicators, regional variables, and farm configuration to the ExtraTrees Champion cost estimation.
      </p>

      <div className="cost-driver-grid">
        {drivers.map((drv, idx) => {
          const isPositive = drv.direction === '+';
          const meta = FEATURE_META[drv.feature] || { label: drv.feature, icon: Cpu };
          const IconComponent = meta.icon;
          const pct = drv.contribution_pct || 0;

          return (
            <div key={idx} className="cost-driver-card">
              <div className="cost-driver-top">
                <span className="cost-driver-name">
                  <IconComponent size={14} color="#64748b" />
                  <span>{meta.label}</span>
                </span>
                <span className={`cost-driver-impact-badge ${isPositive ? 'pos' : 'neg'}`}>
                  {isPositive ? <TrendingUp size={11} style={{ display: 'inline', marginRight: 2 }} /> : <TrendingDown size={11} style={{ display: 'inline', marginRight: 2 }} />}
                  {drv.direction} {pct.toFixed(1)}%
                </span>
              </div>

              <div className="cost-driver-bar-track">
                <div 
                  className={`cost-driver-bar-fill ${isPositive ? 'pos' : 'neg'}`}
                  style={{ width: `${Math.min(100, Math.max(10, pct * 2))}%` }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8' }}>
                <span>{isPositive ? 'Upward cost pressure' : 'Deflationary saving'}</span>
                <span>Impact: {pct.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
