import React from 'react';
import { motion } from 'framer-motion';
import { Leaf, Plus, Minus, Coins, Check, ArrowRight } from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';
import AnimatedNumber from '../common/AnimatedNumber';
import advisoryData from '../../data/advisory_data.json';

const LEAFY_ICONS = {
  'Gotukola': '🥗',
  'Kankun': '🌿',
  'Kathurumurunga': '🌱',
  'Kohila Leaves': '🍃',
  'Mukunuwenna': '🥬',
  'Nivithi': '🌱',
  'Sarana': '🌿',
  'Thampala': '🥗'
};

export default function StepLeafy() {
  const enableLeafy = useCalculatorStore(s => s.enableLeafy);
  const setEnableLeafy = useCalculatorStore(s => s.setEnableLeafy);
  const selectedLeafyName = useCalculatorStore(s => s.selectedLeafyName);
  const setSelectedLeafyName = useCalculatorStore(s => s.setSelectedLeafyName);
  const leafyPerches = useCalculatorStore(s => s.leafyPerches);
  const setLeafyPerches = useCalculatorStore(s => s.setLeafyPerches);

  const leafyGreens = advisoryData.leafy_greens;
  const currentLeafy = leafyGreens.find(l => l.name === selectedLeafyName) || leafyGreens[0];

  // Mathematical calculation of interim cash-flow income
  const grossIncome = leafyPerches * (currentLeafy.bunches_per_perch_cycle || 35) *
    (currentLeafy.cycles_per_season || 4) * (currentLeafy.avg_price_lkr || 65);
  const cost = leafyPerches * (currentLeafy.operational_cost_per_perch || 800) *
    (currentLeafy.cycles_per_season || 4);
  const netExtraIncome = enableLeafy ? Math.max(0, grossIncome - cost) : 0;

  const handleStepper = (delta) => {
    const nextVal = Math.round((leafyPerches + delta) * 2) / 2;
    setLeafyPerches(Math.min(40, Math.max(1, nextVal)));
  };

  // Plant density dots for the animated bed
  const plantBedCount = Math.min(36, Math.max(4, Math.round(leafyPerches * 1.5)));

  return (
    <div className="wizard-step-container">
      <div className="step-headline">
        <h2>Step 7: Leafy Greens Side Crop & Diversification</h2>
        <p>Short-cycle (30–45 day) indigenous green leaf cultivation generates early supplemental cash-flow before your primary crop harvest.</p>
      </div>

      {/* Main Toggle Card */}
      <div className="leafy-toggle-card">
        <div className="toggle-left-info">
          <div className="icon-leaf-wrap">
            <Leaf size={22} color="#059669" />
          </div>
          <div>
            <h3>Cultivate an indigenous leafy green side crop?</h3>
            <p>Utilize marginal field bunds and borders for rapid, high-margin turnover.</p>
          </div>
        </div>

        <label className="switch-toggle-label">
          <input
            type="checkbox"
            checked={enableLeafy}
            onChange={(e) => setEnableLeafy(e.target.checked)}
          />
          <span className="slider-round" />
        </label>
      </div>

      {enableLeafy ? (
        <div className="leafy-grid-layout">
          {/* Variety Cards */}
          <div className="leafy-varieties-panel">
            <div className="panel-title-row">
              <h4>Select Leafy Crop Variety</h4>
              <span className="sub">8 High-Demand Varieties</span>
            </div>

            <div className="leafy-cards-grid">
              {leafyGreens.map(lg => {
                const isSelected = selectedLeafyName === lg.name;
                const icon = LEAFY_ICONS[lg.name] || '🌿';

                return (
                  <motion.div
                    key={lg.name}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    className={`leafy-crop-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedLeafyName(lg.name)}
                    role="button"
                    tabIndex={0}
                  >
                    {isSelected && (
                      <div className="card-check-badge">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}

                    <div className="leafy-icon-box">{icon}</div>

                    <div className="leafy-text-box">
                      <h5>{lg.name}</h5>
                      <span className="leafy-price">
                        LKR {lg.avg_price_lkr.toFixed(0)} / {lg.unit}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Perches Slider & Animated Plant Bed */}
          <div className="leafy-controls-panel">
            <div className="control-group-box">
              <div className="control-label-row">
                <label>Dedicated Plot Area (Perches)</label>
                <span className="current-acre-pill">{leafyPerches} Perches</span>
              </div>

              <div className="acreage-slider-stepper-wrap">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => handleStepper(-1)}
                  disabled={leafyPerches <= 1}
                >
                  <Minus size={16} />
                </button>

                <input
                  type="range"
                  min="1"
                  max="40"
                  step="1"
                  value={leafyPerches}
                  onChange={(e) => setLeafyPerches(e.target.value)}
                  className="acreage-slider-input"
                />

                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => handleStepper(1)}
                  disabled={leafyPerches >= 40}
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Animated Plant Bed Visual */}
              <div className="animated-plant-bed-visual">
                <div className="bed-header">
                  <span>Simulated {selectedLeafyName} Nursery Bed ({leafyPerches} Perches)</span>
                </div>
                <div className="bed-plants-container">
                  {Array.from({ length: plantBedCount }).map((_, i) => (
                    <motion.span
                      key={i}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.02, type: "spring" }}
                      className="bed-plant-sprout"
                      title={`${selectedLeafyName} clump`}
                    >
                      🌱
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>

            {/* Extra Net Income KPI Preview */}
            <div className="leafy-income-card">
              <div className="income-head">
                <Coins size={22} color="#059669" />
                <div>
                  <span className="lbl">Estimated Extra Net Farm Income</span>
                  <div className="val">
                    + <AnimatedNumber value={netExtraIncome} decimals={0} prefix="LKR " />
                  </div>
                </div>
              </div>
              <p className="income-sub">
                Based on 4 harvest cycles per season • Direct farm gate and retail bundling.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="leafy-skipped-banner">
          <p>Leafy greens side crop is disabled. Calculation will focus exclusively on {selectedLeafyName || 'primary crop'}.</p>
          <button
            type="button"
            className="btn-enable-leafy"
            onClick={() => setEnableLeafy(true)}
          >
            Enable Leafy Greens
          </button>
        </div>
      )}
    </div>
  );
}
