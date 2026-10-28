import React from 'react';
import { Sparkles, Award, Calculator, Sprout, BarChart3 } from 'lucide-react';

export default function AdvisoryPage({ onNavigateTab }) {
  return (
    <div>
      <div className="page-hero-banner">
        <div className="page-title-wrap">
          <div className="hero-icon-pill">
            <Sparkles size={24} />
          </div>
          <div>
            <h2>Agricultural Intelligence & Advisory</h2>
            <p>Multi-crop comparisons, farm-gate vs retail spread analysis, and crop recommendations.</p>
          </div>
        </div>

        <div className="hero-tag-pill">
          <Award size={15} />
          <span>Research Decision Support System</span>
        </div>
      </div>

      <div className="standalone-view-card">
        <h3>System Navigation</h3>
        <p style={{ fontSize: '13.5px', color: '#475569', marginBottom: 16 }}>
          Select one of the primary modules from the sidebar or access individual engines:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div
            className="directory-card"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigateTab && onNavigateTab('calculator')}
          >
            <div className="directory-card-head">
              <h4>Farmer Profit Calculator</h4>
              <Calculator size={20} color="#059669" />
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b' }}>
              Combined cultivation cost, harvest retail price forecast, transport logistics, and leafy green diversification.
            </p>
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>Open Calculator ➔</span>
          </div>

          <div
            className="directory-card"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigateTab && onNavigateTab('cost')}
          >
            <div className="directory-card-head">
              <h4>Cultivation Cost Estimator</h4>
              <Sprout size={20} color="#059669" />
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b' }}>
              Inspect individual cultivation costs, SHAP drivers, and labour/fertilizer breakdowns for all 23 DOA crops.
            </p>
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>Open Cost Estimator ➔</span>
          </div>

          <div
            className="directory-card"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigateTab && onNavigateTab('price')}
          >
            <div className="directory-card-head">
              <h4>Market Price Forecaster</h4>
              <BarChart3 size={20} color="#2563eb" />
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b' }}>
              Inspect multi-horizon price projections and 52-week historical price trajectories for all 32 CBSL vegetables.
            </p>
            <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 700 }}>Open Price Forecaster ➔</span>
          </div>
        </div>
      </div>
    </div>
  );
}
