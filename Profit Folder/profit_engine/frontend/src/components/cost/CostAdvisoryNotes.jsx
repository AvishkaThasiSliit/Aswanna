import React from 'react';
import { Lightbulb, Sprout, Droplets, Wrench, ShieldAlert } from 'lucide-react';

export default function CostAdvisoryNotes({ crop, district, irrigation }) {
  return (
    <div className="cost-advisory-card">
      <div className="cost-advisory-icon">
        <Lightbulb size={22} />
      </div>

      <div className="cost-advisory-content">
        <h4>Agronomic Cost-Optimization Strategies for {crop} in {district}</h4>
        <p>
          Targeted cultivation efficiency guidelines to keep field expenditure within the 80% conformal boundary:
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '12px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: 10 }}>
            <Sprout size={16} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '12px', color: '#1f2937' }}>
              <strong>Input Rationalization:</strong> Perform soil chemical testing before basal fertilizer application. Adopting DOA-recommended targeted split doses cuts unnecessary NPK input expenses by up to 15%.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: 10 }}>
            <Droplets size={16} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '12px', color: '#1f2937' }}>
              <strong>Water &amp; Fuel Optimization:</strong> Under {irrigation.toLowerCase()} regimes, scheduling night or early morning irrigation minimizes evaporative losses, saving pump diesel or electricity.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: 10 }}>
            <Wrench size={16} color="#7c3aed" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '12px', color: '#1f2937' }}>
              <strong>Machinery Collective Hire:</strong> Coordinate land preparation and mechanical harvesting with neighboring farmers in {district} to negotiate bulk tractor rental discounts.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: 10 }}>
            <ShieldAlert size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '12px', color: '#1f2937' }}>
              <strong>Family Labor Planning:</strong> Imputed household labor represents a substantial economic cost. Systematic scheduling during peak weeding and picking prevents reliance on costly emergency day-labor.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
