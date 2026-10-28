import React from 'react';
import { CloudRain, Sun, Droplets, CloudSun, Calendar, Info, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useCostStore } from '../../state/costStore';

export default function CostStepRegimes() {
  const selectedSeason = useCostStore(s => s.selectedSeason);
  const setSelectedSeason = useCostStore(s => s.setSelectedSeason);
  const selectedIrrigation = useCostStore(s => s.selectedIrrigation);
  const setSelectedIrrigation = useCostStore(s => s.setSelectedIrrigation);
  const selectedCrop = useCostStore(s => s.selectedCrop);
  const nextStep = useCostStore(s => s.nextStep);
  const prevStep = useCostStore(s => s.prevStep);

  return (
    <div className="cost-step-regimes-container">
      <div className="cost-step-head">
        <div className="cost-step-icon-badge">
          <Calendar size={22} />
        </div>
        <div>
          <h2>Step 3: Cultivation Regimes</h2>
          <p>
            Configure monsoon seasonality and irrigation infrastructure for <strong>{selectedCrop}</strong>.
          </p>
        </div>
      </div>

      <div className="cost-regimes-grid">
        {/* Season Selection Cards */}
        <div className="cost-regime-section-card">
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sun size={17} color="#d97706" />
            <span>Cultivation Season</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              className={`cost-regime-card ${selectedSeason === 'Maha' ? 'active' : ''}`}
              onClick={() => setSelectedSeason('Maha')}
            >
              <div className="cost-regime-top">
                <div className="cost-regime-icon-wrap" style={{ background: '#dbeafe', color: '#2563eb' }}>
                  <CloudRain size={22} />
                </div>
                {selectedSeason === 'Maha' && <Check size={18} color="#059669" />}
              </div>
              <h4 className="cost-regime-title">Maha (Wet Season)</h4>
              <span className="cost-regime-badge">October – March</span>
              <p className="cost-regime-desc">
                Major northeast monsoon cycle. Abundant water availability, primary highland &amp; low-country harvest period.
              </p>
            </button>

            <button
              type="button"
              className={`cost-regime-card ${selectedSeason === 'Yala' ? 'active' : ''}`}
              onClick={() => setSelectedSeason('Yala')}
            >
              <div className="cost-regime-top">
                <div className="cost-regime-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
                  <Sun size={22} />
                </div>
                {selectedSeason === 'Yala' && <Check size={18} color="#059669" />}
              </div>
              <h4 className="cost-regime-title">Yala (Dry Season)</h4>
              <span className="cost-regime-badge">April – September</span>
              <p className="cost-regime-desc">
                Minor dry cultivation season. Higher solar radiation, requiring strategic irrigation scheduling and storage tanks.
              </p>
            </button>
          </div>
        </div>

        {/* Irrigation Regime Cards */}
        <div className="cost-regime-section-card">
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Droplets size={17} color="#0284c7" />
            <span>Water &amp; Irrigation Regime</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              className={`cost-regime-card ${selectedIrrigation === 'Irrigated' ? 'active' : ''}`}
              onClick={() => setSelectedIrrigation('Irrigated')}
            >
              <div className="cost-regime-top">
                <div className="cost-regime-icon-wrap" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                  <Droplets size={22} />
                </div>
                {selectedIrrigation === 'Irrigated' && <Check size={18} color="#059669" />}
              </div>
              <h4 className="cost-regime-title">Irrigated</h4>
              <span className="cost-regime-badge">Canal / Tube Well / Lift</span>
              <p className="cost-regime-desc">
                Reliable controlled water supply with predictable yields. Includes pumping electricity and canal maintenance dues.
              </p>
            </button>

            <button
              type="button"
              className={`cost-regime-card ${selectedIrrigation === 'Rainfed' ? 'active' : ''}`}
              onClick={() => setSelectedIrrigation('Rainfed')}
            >
              <div className="cost-regime-top">
                <div className="cost-regime-icon-wrap" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                  <CloudSun size={22} />
                </div>
                {selectedIrrigation === 'Rainfed' && <Check size={18} color="#059669" />}
              </div>
              <h4 className="cost-regime-title">Rainfed</h4>
              <span className="cost-regime-badge">Direct Rainfall Dependent</span>
              <p className="cost-regime-desc">
                Eliminates mechanical pump and diesel operational costs, but subject to seasonal rainfall timing and dry spells.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Regime Insights Pill */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Info size={16} color="#059669" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '12.5px', color: '#475569' }}>
          <strong>Econometric Impact:</strong> Irrigated regimes add ~LKR 18,000–35,000/acre in machinery fuel &amp; water maintenance, but elevate average harvest consistency by over 28%.
        </span>
      </div>

      {/* Navigation Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
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
          onClick={nextStep}
        >
          <span>Next: 3D Field &amp; Acreage</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
