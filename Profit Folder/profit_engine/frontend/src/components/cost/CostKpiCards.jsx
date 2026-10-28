import React from 'react';
import { DollarSign, Wallet, ShieldCheck, Scale, Sprout, TrendingUp, Cpu, Award } from 'lucide-react';

export default function CostKpiCards({ result }) {
  if (!result) return null;

  const totalEconomic = Math.round(result.total_cost_incl_imputed || 0);
  const perAcreEconomic = Math.round(result.predicted_cost_incl_imputed_per_acre || 0);

  const totalCash = Math.round(result.total_cost_excl_cash || 0);
  const perAcreCash = Math.round(result.predicted_cost_excl_cash_per_acre || 0);

  const cashPct = totalEconomic > 0 ? ((totalCash / totalEconomic) * 100).toFixed(1) : '0';

  const int80Low = result.interval_80 ? Math.round(result.interval_80.low) : null;
  const int80High = result.interval_80 ? Math.round(result.interval_80.high) : null;

  // Calculate conformal indicator position (0% - 100%)
  let positionPct = 50;
  if (int80Low !== null && int80High !== null && int80High > int80Low) {
    positionPct = Math.max(5, Math.min(95, ((totalEconomic - int80Low) / (int80High - int80Low)) * 100));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 3 Primary Glassmorphic Hero Cards */}
      <div className="cost-kpi-grid">
        {/* Card 1: Economic Cost */}
        <div className="cost-kpi-card economic">
          <div className="cost-kpi-head">
            <span className="cost-kpi-head-label">
              <Scale size={14} color="#e11d48" />
              Full Economic Cost
            </span>
            <div className="cost-kpi-icon-pill rose">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="cost-kpi-val">
            LKR {totalEconomic.toLocaleString()}
          </div>
          <div className="cost-kpi-sub">
            LKR {perAcreEconomic.toLocaleString()} / acre (Comprehensive)
          </div>
          <div className="cost-kpi-footer-badge">
            <span>Includes imputed family labour &amp; land rent</span>
          </div>
        </div>

        {/* Card 2: Cash Cost */}
        <div className="cost-kpi-card cash">
          <div className="cost-kpi-head">
            <span className="cost-kpi-head-label">
              <Wallet size={14} color="#059669" />
              Out-of-Pocket Cash
            </span>
            <div className="cost-kpi-icon-pill emerald">
              <Wallet size={16} />
            </div>
          </div>
          <div className="cost-kpi-val" style={{ color: '#047857' }}>
            LKR {totalCash.toLocaleString()}
          </div>
          <div className="cost-kpi-sub">
            LKR {perAcreCash.toLocaleString()} / acre (Direct expenses)
          </div>
          <div className="cost-kpi-footer-badge" style={{ background: '#ecfdf5', color: '#047857' }}>
            <span>{cashPct}% of total is direct cash expenditure</span>
          </div>
        </div>

        {/* Card 3: 80% Conformal Interval */}
        <div className="cost-kpi-card interval">
          <div className="cost-kpi-head">
            <span className="cost-kpi-head-label">
              <ShieldCheck size={14} color="#2563eb" />
              80% Conformal Band
            </span>
            <div className="cost-kpi-icon-pill blue">
              <Award size={16} />
            </div>
          </div>
          <div className="cost-kpi-val" style={{ fontSize: 20 }}>
            {int80Low !== null ? `LKR ${int80Low.toLocaleString()} – ${int80High.toLocaleString()}` : "Evaluating..."}
          </div>
          
          {/* Visual Mini Conformal Gauge */}
          {int80Low !== null && (
            <div style={{ marginTop: 8, marginBottom: 4 }}>
              <div style={{ position: 'relative', width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                <div 
                  style={{ 
                    position: 'absolute', 
                    left: `${positionPct}%`, 
                    top: -3, 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    background: '#2563eb', 
                    border: '2px solid #ffffff',
                    boxShadow: '0 1px 4px rgba(37,99,235,0.4)',
                    transform: 'translateX(-50%)' 
                  }} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#94a3b8', marginTop: 4 }}>
                <span>Low 10%</span>
                <span>Expected Mean</span>
                <span>High 90%</span>
              </div>
            </div>
          )}

          <div className="cost-kpi-footer-badge">
            <Cpu size={11} style={{ marginRight: 3 }} />
            <span>ExtraTrees Champion Regressor (LOSO MAE Rs 22k)</span>
          </div>
        </div>
      </div>

      {/* Secondary Efficiency Metrics Strip */}
      <div className="cost-secondary-strip">
        <div className="cost-sec-col">
          <div className="cost-sec-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Scale size={16} />
          </div>
          <div className="cost-sec-info">
            <span className="cost-sec-lbl">Cost / kg Produced</span>
            <span className="cost-sec-val">LKR {result.cost_per_kg_produced?.toFixed(2) || '0.00'}</span>
          </div>
        </div>

        <div className="cost-sec-col">
          <div className="cost-sec-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Sprout size={16} />
          </div>
          <div className="cost-sec-info">
            <span className="cost-sec-lbl">Total Harvest Output</span>
            <span className="cost-sec-val">{result.total_harvest_kg ? `${Math.round(result.total_harvest_kg).toLocaleString()} kg` : '—'}</span>
          </div>
        </div>

        <div className="cost-sec-col">
          <div className="cost-sec-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <TrendingUp size={16} />
          </div>
          <div className="cost-sec-info">
            <span className="cost-sec-lbl">Yield Delta</span>
            <span className="cost-sec-val" style={{ color: (result.yield_delta_pct || 0) >= 0 ? '#059669' : '#e11d48' }}>
              {(result.yield_delta_pct || 0) > 0 ? `+${result.yield_delta_pct}%` : `${result.yield_delta_pct || 0}%`}
            </span>
          </div>
        </div>

        <div className="cost-sec-col">
          <div className="cost-sec-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <Cpu size={16} />
          </div>
          <div className="cost-sec-info">
            <span className="cost-sec-lbl">Field Scale</span>
            <span className="cost-sec-val">{result.acreage} {result.acreage === 1 ? 'Acre' : 'Acres'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
