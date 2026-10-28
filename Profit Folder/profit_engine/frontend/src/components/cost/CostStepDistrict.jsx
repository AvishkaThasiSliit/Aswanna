import React from 'react';
import { MapPin, CheckCircle, Info, ArrowRight, ArrowLeft } from 'lucide-react';
import { useCostStore } from '../../state/costStore';
import SriLankaMap from '../map/SriLankaMap';
import { CROP_DISTRICTS_MAP } from '../../data/cropDistricts';
import { CROPS_METADATA } from '../../data/cropsData';

export default function CostStepDistrict() {
  const selectedCrop = useCostStore(s => s.selectedCrop);
  const selectedDistrict = useCostStore(s => s.selectedDistrict);
  const setSelectedDistrict = useCostStore(s => s.setSelectedDistrict);
  const nextStep = useCostStore(s => s.nextStep);
  const prevStep = useCostStore(s => s.prevStep);

  const validDistricts = CROP_DISTRICTS_MAP[selectedCrop] || ['Badulla'];
  const cropMeta = CROPS_METADATA[selectedCrop] || {};

  return (
    <div className="cost-step-district-container">
      <div className="cost-step-head">
        <div className="cost-step-icon-badge">
          <MapPin size={22} />
        </div>
        <div>
          <h2>Step 2: Agro-Ecological District &amp; Sri Lanka Map</h2>
          <p>
            Interactive geographic zoning: Select a verified agrarian district for <strong>{selectedCrop}</strong>.
          </p>
        </div>
      </div>

      <div className="cost-map-split-view">
        {/* Left: Interactive D3 Geo SVG Sri Lanka Map */}
        <div className="cost-map-canvas-card">
          <div className="cost-map-header-pill">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span>Interactive Sri Lanka Map — Click any green district to select</span>
          </div>

          <div style={{ height: '520px', position: 'relative' }}>
            <SriLankaMap
              selectedDistrict={selectedDistrict}
              validDistricts={validDistricts}
              cropName={selectedCrop}
              onSelectDistrict={(dist) => {
                if (validDistricts.includes(dist)) {
                  setSelectedDistrict(dist);
                }
              }}
            />
          </div>

          <div className="cost-map-legend-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11.5px', color: '#047857' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'inline-block' }} />
              <strong>Verified Growing Zone</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11.5px', color: '#94a3b8' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#e2e8f0', display: 'inline-block' }} />
              <span>Non-Recommended Region</span>
            </div>
          </div>
        </div>

        {/* Right: District Selection Panel */}
        <div className="cost-district-side-panel">
          <div className="cost-district-selected-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={20} />
              </div>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Active District</span>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>{selectedDistrict}</h3>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#047857', background: '#ecfdf5', padding: '6px 10px', borderRadius: 8 }}>
              <CheckCircle size={14} />
              <span>DOA Certified Agro-Zone for {selectedCrop}</span>
            </div>
          </div>

          {/* Quick Clickable District Chips */}
          <div className="cost-district-quick-list">
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
              All Verified Districts for {selectedCrop} ({validDistricts.length})
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {validDistricts.map(d => {
                const isActive = selectedDistrict === d;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`cost-district-chip-lg ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedDistrict(d)}
                  >
                    <span>{d}</span>
                    {isActive && <CheckCircle size={13} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agro-ecological insight */}
          <div className="cost-district-info-box">
            <Info size={16} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              The Department of Agriculture econometrically calibrates labor wage indexes and machinery tariffs specifically for <strong>{selectedDistrict}</strong>.
            </div>
          </div>

          {/* Navigation Buttons */}
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
              <span>Next: Cultivation Regimes</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
