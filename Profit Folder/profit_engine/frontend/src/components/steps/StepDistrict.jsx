import React from 'react';
import { motion } from 'framer-motion';
import { Award, CheckCircle, Info, MapPin } from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';
import { CROP_DISTRICTS_MAP, SPECIAL_REGIONS_MAP } from '../../data/cropDistricts';
import SriLankaMap from '../map/SriLankaMap';
import advisoryData from '../../data/advisory_data.json';

export default function StepDistrict() {
  const selectedCrop = useCalculatorStore(s => s.selectedCrop);
  const selectedDistrict = useCalculatorStore(s => s.selectedDistrict);
  const setSelectedDistrict = useCalculatorStore(s => s.setSelectedDistrict);

  const validDistricts = CROP_DISTRICTS_MAP[selectedCrop] ||
    advisoryData.crops[selectedCrop]?.districts || ['Badulla'];

  // Separate plain districts and special agrarian commands
  const specialRegions = validDistricts.filter(d => SPECIAL_REGIONS_MAP[d]);
  const plainDistricts = validDistricts.filter(d => !SPECIAL_REGIONS_MAP[d]);

  return (
    <div className="wizard-step-container">
      <div className="step-headline">
        <h2>Step 2: Select Your Agrarian District</h2>
        <p>Interactive agro-ecological cultivation map. Only verified Department of Agriculture (DOA) commercial growing areas for <strong>{selectedCrop}</strong> are enabled.</p>
      </div>

      <div className="district-step-layout">
        {/* Left Column: Interactive Map */}
        <div className="map-view-card">
          <div className="map-card-header">
            <div className="badge-verified-doa">
              <Award size={14} />
              <span>DOA Agro-Ecological Boundary System</span>
            </div>
            <span className="map-hint-text">Click an enabled green region to select</span>
          </div>

          <SriLankaMap
            selectedDistrict={selectedDistrict}
            validDistricts={validDistricts}
            cropName={selectedCrop}
            onSelectDistrict={(dist) => setSelectedDistrict(dist)}
          />

          {/* Sub-Command Irrigation Regions (e.g. Mahaweli System H, Udawalawa) */}
          {specialRegions.length > 0 && (
            <div className="special-regions-box">
              <span className="special-lbl">Irrigation & Sub-Command Schemes:</span>
              <div className="special-chips-list">
                {specialRegions.map(reg => {
                  const meta = SPECIAL_REGIONS_MAP[reg] || { anchorDistrict: reg, label: reg };
                  const isSelected = selectedDistrict === reg;
                  return (
                    <button
                      key={reg}
                      type="button"
                      className={`special-chip-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedDistrict(reg)}
                    >
                      <MapPin size={12} />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Selected District Details & Accessible Fallback */}
        <div className="district-side-panel">
          <motion.div
            key={selectedDistrict}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="selected-district-card"
          >
            <div className="card-top-badge">
              <CheckCircle size={15} color="#059669" />
              <span>DOA Verified Growing Zone</span>
            </div>

            <h3 className="district-name-title">{selectedDistrict}</h3>
            <p className="district-desc-sub">
              Official agrarian district approved for commercial <strong>{selectedCrop}</strong> cultivation under national economic surveys.
            </p>

            <div className="district-attributes">
              <div className="attr-item">
                <span className="attr-label">Target Crop:</span>
                <span className="attr-value">{selectedCrop}</span>
              </div>
              <div className="attr-item">
                <span className="attr-label">Agronomic Status:</span>
                <span className="attr-value" style={{ color: '#059669', fontWeight: 600 }}>Optimal Yield Zone</span>
              </div>
            </div>
          </motion.div>

          {/* Accessible Fallback Chip List */}
          <div className="fallback-districts-card">
            <h4>
              <Info size={14} color="#64748b" />
              <span>All Verified Districts for {selectedCrop}</span>
            </h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 10px' }}>
              Quick selector for mobile and keyboard navigation:
            </p>
            <div className="fallback-chips-grid">
              {validDistricts.map(d => (
                <button
                  key={d}
                  type="button"
                  className={`fallback-chip ${selectedDistrict === d ? 'active' : ''}`}
                  onClick={() => setSelectedDistrict(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
