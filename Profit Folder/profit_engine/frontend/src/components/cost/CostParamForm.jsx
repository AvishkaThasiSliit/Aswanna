import React from 'react';
import { Sliders, CheckCircle, RefreshCw, Plus, Minus, CloudRain, Sun, Droplets, CloudSun } from 'lucide-react';
import { CROP_DISTRICTS_MAP } from '../../data/cropDistricts';

export default function CostParamForm({
  selectedCrop,
  district,
  onDistrictChange,
  season,
  onSeasonChange,
  irrigation,
  onIrrigationChange,
  acreage,
  onAcreageChange,
  customYield,
  onCustomYieldChange,
  benchmarkYield,
  isLoading,
  onCalculate
}) {
  const validDistricts = CROP_DISTRICTS_MAP[selectedCrop] || ['Badulla'];

  const handleAcreageStep = (delta) => {
    const next = Math.max(0.25, Math.min(10.0, parseFloat((acreage + delta).toFixed(2))));
    onAcreageChange(next);
  };

  const handlePresetAcreage = (val) => {
    onAcreageChange(val);
  };

  return (
    <div className="cost-param-card">
      <div className="cost-param-header">
        <div className="cost-param-title">
          <Sliders size={18} color="#059669" />
          <h2>Cultivation Parameters</h2>
        </div>
        <span style={{ fontSize: '11.5px', color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
          {selectedCrop}
        </span>
      </div>

      {/* District Selection */}
      <div className="cost-param-group">
        <label>
          <span>Agrarian District</span>
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
            {validDistricts.length} Agro-Zones
          </span>
        </label>
        <select
          className="cost-select-styled"
          value={district}
          onChange={(e) => onDistrictChange(e.target.value)}
        >
          {validDistricts.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Quick district pill chips */}
        <div className="cost-district-chips">
          {validDistricts.map(d => (
            <button
              key={d}
              type="button"
              className={`cost-district-chip ${district === d ? 'active' : ''}`}
              onClick={() => onDistrictChange(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Season Selection */}
      <div className="cost-param-group">
        <label>
          <span>Cultivation Season</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Monsoon Alignment</span>
        </label>
        <div className="cost-toggle-grid">
          <button
            type="button"
            className={`cost-toggle-btn ${season === 'Maha' ? 'active' : ''}`}
            onClick={() => onSeasonChange('Maha')}
          >
            <CloudRain size={15} />
            <span>Maha (Wet)</span>
          </button>
          <button
            type="button"
            className={`cost-toggle-btn ${season === 'Yala' ? 'active' : ''}`}
            onClick={() => onSeasonChange('Yala')}
          >
            <Sun size={15} />
            <span>Yala (Dry)</span>
          </button>
        </div>
      </div>

      {/* Irrigation Regime */}
      <div className="cost-param-group">
        <label>
          <span>Irrigation Regime</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Water Source</span>
        </label>
        <div className="cost-toggle-grid">
          <button
            type="button"
            className={`cost-toggle-btn ${irrigation === 'Irrigated' ? 'active' : ''}`}
            onClick={() => onIrrigationChange('Irrigated')}
          >
            <Droplets size={15} />
            <span>Irrigated</span>
          </button>
          <button
            type="button"
            className={`cost-toggle-btn ${irrigation === 'Rainfed' ? 'active' : ''}`}
            onClick={() => onIrrigationChange('Rainfed')}
          >
            <CloudSun size={15} />
            <span>Rainfed</span>
          </button>
        </div>
      </div>

      {/* Acreage Control */}
      <div className="cost-param-group">
        <label>
          <span>Cultivation Acreage</span>
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
            {acreage} {acreage === 1 ? 'Acre' : 'Acres'}
          </span>
        </label>
        
        <div className="cost-acreage-box">
          <div className="cost-acreage-top">
            <button
              type="button"
              className="cost-acreage-stepper-btn"
              onClick={() => handleAcreageStep(-0.25)}
              disabled={acreage <= 0.25}
            >
              <Minus size={14} />
            </button>
            <span className="cost-acreage-val">{acreage.toFixed(2)} Ac</span>
            <button
              type="button"
              className="cost-acreage-stepper-btn"
              onClick={() => handleAcreageStep(0.25)}
              disabled={acreage >= 10.0}
            >
              <Plus size={14} />
            </button>
          </div>

          <input
            type="range"
            min="0.25"
            max="10.0"
            step="0.25"
            className="cost-slider-range"
            value={acreage}
            onChange={(e) => onAcreageChange(parseFloat(e.target.value))}
          />

          <div className="cost-acreage-presets">
            {[0.25, 0.5, 1.0, 2.0, 5.0].map(val => (
              <button
                key={val}
                type="button"
                className={`cost-preset-btn ${acreage === val ? 'active' : ''}`}
                onClick={() => handlePresetAcreage(val)}
              >
                {val} Ac
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expected Yield */}
      <div className="cost-param-group">
        <label>
          <span>Expected Yield (kg/ac)</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {benchmarkYield ? `Benchmark: ${benchmarkYield.toLocaleString()} kg` : 'Optional Override'}
          </span>
        </label>
        <div className="cost-input-wrapper">
          <input
            type="number"
            step="50"
            className="cost-input-styled"
            placeholder={benchmarkYield ? String(benchmarkYield) : "Enter yield in kg/ac"}
            value={customYield}
            onChange={(e) => onCustomYieldChange(e.target.value)}
          />
          <span className="cost-input-unit">kg/ac</span>
        </div>

        {customYield && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <span style={{ fontSize: '11px', color: '#059669' }}>
              Custom yield active
            </span>
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => onCustomYieldChange('')}
            >
              Reset to Benchmark
            </button>
          </div>
        )}
      </div>

      {/* Action Button */}
      <button
        type="button"
        className="cost-btn-run"
        onClick={onCalculate}
        disabled={isLoading}
      >
        <RefreshCw size={16} className={isLoading ? "spin-icon" : ""} />
        <span>{isLoading ? "Running Inference..." : "Recalculate Cost Estimate"}</span>
      </button>

      <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <CheckCircle size={12} color="#10b981" />
        <span>Auto-calibrates live with all parameter modifications</span>
      </div>
    </div>
  );
}
