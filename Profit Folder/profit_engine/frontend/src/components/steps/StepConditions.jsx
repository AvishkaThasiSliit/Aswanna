import React from 'react';
import { motion } from 'framer-motion';
import { CloudRain, Sun, Waves, CloudDrizzle, Droplets, Coins, Award, Sparkles } from 'lucide-react';
import { useCalculatorStore, getSuggestedSeason } from '../../state/calculatorStore';

export default function StepConditions() {
  const selectedSeason = useCalculatorStore(s => s.selectedSeason);
  const setSelectedSeason = useCalculatorStore(s => s.setSelectedSeason);

  const selectedIrrigation = useCalculatorStore(s => s.selectedIrrigation);
  const setSelectedIrrigation = useCalculatorStore(s => s.setSelectedIrrigation);

  const profitMode = useCalculatorStore(s => s.profitMode);
  const setProfitMode = useCalculatorStore(s => s.setProfitMode);

  const suggestedSeason = getSuggestedSeason();

  return (
    <div className="wizard-step-container">
      <div className="step-headline">
        <h2>Step 3: Season, Irrigation & Profit Mode</h2>
        <p>Agronomic growing environment and accounting methodology. Current calendar year {new Date().getFullYear()} is applied automatically.</p>
      </div>

      {/* Section 1: Season */}
      <div className="conditions-section-group">
        <div className="section-label-row">
          <h3>1. Cultivation Season</h3>
          <span className="section-desc">Monsoonal cycle defining rainfall and harvest schedules</span>
        </div>

        <div className="toggle-cards-row">
          {/* Maha */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className={`condition-toggle-card ${selectedSeason === 'Maha' ? 'selected' : ''}`}
            onClick={() => setSelectedSeason('Maha')}
            role="button"
            tabIndex={0}
          >
            <div className="card-badge-row">
              {suggestedSeason === 'Maha' && (
                <span className="badge-suggested">
                  <Sparkles size={11} /> Suggested for now
                </span>
              )}
            </div>

            <div className="toggle-card-icon-wrap" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
              <CloudRain size={28} />
            </div>

            <h4>Maha Season</h4>
            <span className="card-sub-timeline">October – March (Northeast Monsoon)</span>
            <p className="card-explanation">
              Major cultivation season across Sri Lanka fueled by the Northeast monsoon with higher rainfall abundance.
            </p>
          </motion.div>

          {/* Yala */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className={`condition-toggle-card ${selectedSeason === 'Yala' ? 'selected' : ''}`}
            onClick={() => setSelectedSeason('Yala')}
            role="button"
            tabIndex={0}
          >
            <div className="card-badge-row">
              {suggestedSeason === 'Yala' && (
                <span className="badge-suggested">
                  <Sparkles size={11} /> Suggested for now
                </span>
              )}
            </div>

            <div className="toggle-card-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Sun size={28} />
            </div>

            <h4>Yala Season</h4>
            <span className="card-sub-timeline">April – September (Southwest Monsoon)</span>
            <p className="card-explanation">
              Secondary agricultural season characterized by drier weather in the Dry Zone and focused irrigation commands.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Section 2: Irrigation Regime */}
      <div className="conditions-section-group">
        <div className="section-label-row">
          <h3>2. Irrigation Water Supply</h3>
          <span className="section-desc">Water delivery system used for the cultivation plot</span>
        </div>

        <div className="toggle-cards-row three-col">
          {/* Irrigated */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className={`condition-toggle-card ${selectedIrrigation === 'Irrigated' ? 'selected' : ''}`}
            onClick={() => setSelectedIrrigation('Irrigated')}
            role="button"
            tabIndex={0}
          >
            <div className="toggle-card-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
              <Waves size={26} />
            </div>
            <h4>Irrigated</h4>
            <p className="card-explanation">
              Water delivered via Mahaweli canals, major/minor reservoirs, or agro-well pumps. Stable and high yield potential.
            </p>
          </motion.div>

          {/* Rainfed */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className={`condition-toggle-card ${selectedIrrigation === 'Rainfed' ? 'selected' : ''}`}
            onClick={() => setSelectedIrrigation('Rainfed')}
            role="button"
            tabIndex={0}
          >
            <div className="toggle-card-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <CloudDrizzle size={26} />
            </div>
            <h4>Rainfed</h4>
            <p className="card-explanation">
              Directly dependent on monsoonal rainfall without external canal or well irrigation networks.
            </p>
          </motion.div>

          {/* Unspecified / Baseline */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className={`condition-toggle-card ${selectedIrrigation === 'Unspecified' ? 'selected' : ''}`}
            onClick={() => setSelectedIrrigation('Unspecified')}
            role="button"
            tabIndex={0}
          >
            <div className="toggle-card-icon-wrap" style={{ background: '#f1f5f9', color: '#475569' }}>
              <Droplets size={26} />
            </div>
            <h4>Unspecified</h4>
            <p className="card-explanation">
              Uses the regional aggregate benchmark blend for the agrarian district.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Section 3: Cost & Profit Accounting Mode */}
      <div className="conditions-section-group">
        <div className="section-label-row">
          <h3>3. Cost & Profit Evaluation Mode</h3>
          <span className="section-desc">Accounting standard used for cost and net profit calculations</span>
        </div>

        <div className="toggle-cards-row">
          {/* Economic Full Cost */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className={`condition-toggle-card ${profitMode === 'economic' ? 'selected' : ''}`}
            onClick={() => setProfitMode('economic')}
            role="button"
            tabIndex={0}
          >
            <div className="toggle-card-icon-wrap" style={{ background: '#ede9fe', color: '#7c3aed' }}>
              <Award size={26} />
            </div>
            <h4>Economic Full Cost (Incl. Imputed)</h4>
            <span className="card-sub-timeline">Recommended for rigorous financial planning</span>
            <p className="card-explanation">
              Includes out-of-pocket cash costs <strong>plus imputed values</strong> of unpaid family labour and owned land rental value.
            </p>
          </motion.div>

          {/* Cash Out-of-Pocket */}
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className={`condition-toggle-card ${profitMode === 'cash' ? 'selected' : ''}`}
            onClick={() => setProfitMode('cash')}
            role="button"
            tabIndex={0}
          >
            <div className="toggle-card-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Coins size={26} />
            </div>
            <h4>Out-of-Pocket Cash Cost (Excl. Imputed)</h4>
            <span className="card-sub-timeline">Direct bank/wallet expenditure only</span>
            <p className="card-explanation">
              Measures only direct paid cash expenses: purchased seeds, fertilizers, agro-chemicals, hired tractor & hired labor.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
