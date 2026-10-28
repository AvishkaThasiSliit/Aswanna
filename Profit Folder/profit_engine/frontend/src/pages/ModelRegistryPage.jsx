import React, { useState, useMemo } from 'react';
import '../styles/modelRegistry.css';
import { 
  Cpu, 
  Sparkles, 
  Award, 
  BarChart3, 
  Sprout, 
  ShieldCheck, 
  Search, 
  X, 
  ExternalLink, 
  Layers, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  BrainCircuit, 
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  Flame,
  Grid3X3,
  ListFilter
} from 'lucide-react';
import { COST_MODELS, PRICE_MODELS, ENGINE_METADATA } from '../data/modelRegistryData';

export default function ModelRegistryPage() {
  const [activeEngine, setActiveEngine] = useState('cost'); // 'cost' | 'price' | 'champions'
  const [selectedFamily, setSelectedFamily] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingModel, setInspectingModel] = useState(null);
  const [priceViewMode, setPriceViewMode] = useState('table'); // 'table' | 'matrix'
  const [sortByCost, setSortByCost] = useState('r2_desc');
  const [sortByPrice, setSortByPrice] = useState('smape_asc');

  // Filter & Sort Cost Models
  const filteredCostModels = useMemo(() => {
    let list = COST_MODELS.filter(m => {
      let matchFamily = true;
      if (selectedFamily !== 'All') {
        const sel = selectedFamily.toLowerCase();
        const fam = (m.family || '').toLowerCase();
        const cat = (m.familyCategory || '').toLowerCase();
        if (sel === 'tree ensembles') {
          matchFamily = fam.includes('tree') || cat.includes('shallow') && !fam.includes('linear');
        } else if (sel === 'deep learning') {
          matchFamily = fam.includes('deep') || cat.includes('deep');
        } else if (sel === 'foundation models') {
          matchFamily = fam.includes('foundation') || cat.includes('foundation');
        } else if (sel === 'statistical & econometric') {
          matchFamily = fam.includes('statistical') || fam.includes('econometric') || fam.includes('exponential') || fam.includes('baseline') || cat.includes('statistical');
        } else if (sel === 'linear & regularized') {
          matchFamily = fam.includes('linear') || fam.includes('penalized');
        } else {
          matchFamily = fam.includes(sel) || cat.includes(sel);
        }
      }

      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        m.name.toLowerCase().includes(q) || 
        m.raw_name?.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.runId?.toLowerCase().includes(q);

      return matchFamily && matchSearch;
    });

    // Sorting
    return [...list].sort((a, b) => {
      if (sortByCost === 'r2_desc') return b.losoR2 - a.losoR2;
      if (sortByCost === 'r2_asc') return a.losoR2 - b.losoR2;
      if (sortByCost === 'mae_asc') return a.losoMae - b.losoMae;
      if (sortByCost === 'rmse_asc') return a.losoRmse - b.losoRmse;
      if (sortByCost === 'smape_asc') return a.losoSmape - b.losoSmape;
      if (sortByCost === 'time_asc') return a.trainTimeSec - b.trainTimeSec;
      if (sortByCost === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [selectedFamily, searchQuery, sortByCost]);

  // Filter & Sort Price Models
  const filteredPriceModels = useMemo(() => {
    let list = PRICE_MODELS.filter(m => {
      let matchFamily = true;
      if (selectedFamily !== 'All') {
        const sel = selectedFamily.toLowerCase();
        const fam = (m.family || '').toLowerCase();
        if (sel === 'tree ensembles') {
          matchFamily = fam.includes('tree') || fam.includes('boosting') || fam.includes('bagging');
        } else if (sel === 'deep learning') {
          matchFamily = fam.includes('deep') || fam.includes('neural') || fam.includes('attention') || fam.includes('recurrent') || fam.includes('cnn');
        } else if (sel === 'ensembles & blends') {
          matchFamily = fam.includes('ensemble') || fam.includes('hybrid') || fam.includes('stacking') || fam.includes('blending');
        } else if (sel === 'econometric & statistical') {
          matchFamily = fam.includes('econometric') || fam.includes('statistical') || fam.includes('additive') || fam.includes('exponential') || fam.includes('autoregressive');
        } else if (sel === 'linear regressors') {
          matchFamily = fam.includes('linear') || fam.includes('penalized');
        } else if (sel === 'baselines & moving avg') {
          matchFamily = fam.includes('baseline') || fam.includes('heuristic') || fam.includes('smoothing') || fam.includes('seasonal') || fam.includes('kernel');
        } else {
          matchFamily = fam.includes(sel);
        }
      }

      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        m.name.toLowerCase().includes(q) || 
        m.raw_name?.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q);

      return matchFamily && matchSearch;
    });

    // Sorting
    return [...list].sort((a, b) => {
      if (sortByPrice === 'smape_asc') return a.testSmape - b.testSmape;
      if (sortByPrice === 'mase_asc') return a.testMase - b.testMase;
      if (sortByPrice === 'r2_desc') return b.testR2 - a.testR2;
      if (sortByPrice === 'da_desc') return b.testDa - a.testDa;
      if (sortByPrice === 'rmse_asc') return a.testRmse - b.testRmse;
      if (sortByPrice === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [selectedFamily, searchQuery, sortByPrice]);

  // Family pills for active tab
  const activeFamilies = useMemo(() => {
    if (activeEngine === 'cost') {
      return [
        'All', 
        'Tree Ensembles', 
        'Deep Learning', 
        'Foundation Models', 
        'Statistical & Econometric', 
        'Linear & Regularized'
      ];
    }
    return [
      'All', 
      'Tree Ensembles', 
      'Deep Learning', 
      'Ensembles & Blends', 
      'Econometric & Statistical', 
      'Linear Regressors', 
      'Baselines & Moving Avg'
    ];
  }, [activeEngine]);

  return (
    <div className="registry-page-wrap">
      {/* 1. Hero Header Banner */}
      <div className="registry-hero-banner">
        <div className="registry-hero-content">
          <div className="registry-hero-icon-box">
            <BrainCircuit size={28} />
          </div>
          <div className="registry-hero-text">
            <h1>
              AI Model Registry & Diagnostics
              <span className="registry-hero-badge">Verified Research Benchmarks</span>
            </h1>
            <p>
              Complete architectural leaderboard of all <strong>{COST_MODELS.length + PRICE_MODELS.length} models</strong> trained and evaluated across both the Cultivation Cost and Price Forecasting engines ({COST_MODELS.length} Cost models, {PRICE_MODELS.length} Price models).
            </p>
          </div>
        </div>

        <div className="registry-hero-tags">
          <div className="hero-metric-pill">
            <Cpu size={14} />
            <span>{COST_MODELS.length + PRICE_MODELS.length} Total Models</span>
          </div>
          <div className="hero-metric-pill">
            <ShieldCheck size={14} color="#34d399" />
            <span>80% Conformal Calibration</span>
          </div>
        </div>
      </div>

      {/* 2. Engine Switcher Navigation */}
      <div className="registry-engine-nav">
        <button
          type="button"
          className={`engine-tab-btn ${activeEngine === 'cost' ? 'active' : ''}`}
          onClick={() => { setActiveEngine('cost'); setSelectedFamily('All'); setSearchQuery(''); }}
        >
          <Sprout size={16} />
          <span>Cultivation Cost Engine (DOA)</span>
          <span className="engine-count-badge">{COST_MODELS.length} Models</span>
        </button>

        <button
          type="button"
          className={`engine-tab-btn ${activeEngine === 'price' ? 'active' : ''}`}
          onClick={() => { setActiveEngine('price'); setSelectedFamily('All'); setSearchQuery(''); }}
        >
          <BarChart3 size={16} />
          <span>Vegetable Price Forecaster (CBSL)</span>
          <span className="engine-count-badge">{PRICE_MODELS.length} Models</span>
        </button>

        <button
          type="button"
          className={`engine-tab-btn ${activeEngine === 'champions' ? 'active' : ''}`}
          onClick={() => setActiveEngine('champions')}
        >
          <Award size={16} />
          <span>Champion Architectures</span>
          <span className="engine-count-badge">Production Core</span>
        </button>
      </div>

      {/* 3. COST ENGINE TAB */}
      {activeEngine === 'cost' && (
        <>
          {/* Cost Engine KPI Cards */}
          <div className="registry-kpi-grid">
            <div className="reg-kpi-card">
              <div className="reg-kpi-head">
                <Award size={16} color="#059669" />
                <span>Production Champion</span>
              </div>
              <div className="reg-kpi-val" style={{ color: '#059669' }}>
                Gradient Boosting Regressor
              </div>
              <div className="reg-kpi-sub">
                LOSO R² = 0.9018 • MAE = Rs 26,786 • Latency = 8.6ms
              </div>
            </div>

            <div className="reg-kpi-card">
              <div className="reg-kpi-head">
                <Flame size={16} color="#2563eb" />
                <span>Top Overall Benchmark</span>
              </div>
              <div className="reg-kpi-val">
                ExtraTrees Regressor
              </div>
              <div className="reg-kpi-sub">
                Highest LOSO R² = 0.9329 • Lowest MAE = Rs 22,822
              </div>
            </div>

            <div className="reg-kpi-card">
              <div className="reg-kpi-head">
                <Sparkles size={16} color="#d97706" />
                <span>Deep Tabular Benchmark</span>
              </div>
              <div className="reg-kpi-val">
                TabNet (Attentive Neural Net)
              </div>
              <div className="reg-kpi-sub">
                LOSO R² = 0.8044 • MAE = Rs 38,106 (33s train time)
              </div>
            </div>

            <div className="reg-kpi-card">
              <div className="reg-kpi-head">
                <Layers size={16} color="#7c3aed" />
                <span>Evaluation Protocol</span>
              </div>
              <div className="reg-kpi-val">
                Leave-One-Season-Out (LOSO)
              </div>
              <div className="reg-kpi-sub">
                Tested across all 37 trained model variants & baselines
              </div>
            </div>
          </div>

          {/* Search, Filter & Sort Toolbar */}
          <div className="registry-toolbar">
            <div className="family-filter-pills">
              {activeFamilies.map(f => (
                <button
                  key={f}
                  type="button"
                  className={`family-pill-btn ${selectedFamily === f ? 'active' : ''}`}
                  onClick={() => setSelectedFamily(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Sort selector */}
              <div className="registry-sort-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 8 }}>
                <ArrowUpDown size={14} color="#64748b" />
                <span style={{ color: '#64748b', fontWeight: 600 }}>Sort:</span>
                <select 
                  value={sortByCost} 
                  onChange={(e) => setSortByCost(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}
                >
                  <option value="r2_desc">LOSO R² (Highest first)</option>
                  <option value="mae_asc">LOSO MAE (Lowest error)</option>
                  <option value="rmse_asc">LOSO RMSE (Lowest error)</option>
                  <option value="smape_asc">LOSO sMAPE % (Lowest error)</option>
                  <option value="time_asc">Train Time (Fastest)</option>
                  <option value="name_asc">Model Name (A-Z)</option>
                </select>
              </div>

              {/* Search Box */}
              <div className="registry-search-box">
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search among all 37 cost models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={14} color="#94a3b8" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Count Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 12px 0', fontSize: 13, color: '#64748b' }}>
            <span>
              Showing <strong style={{ color: '#0f172a' }}>{filteredCostModels.length}</strong> of <strong style={{ color: '#0f172a' }}>{COST_MODELS.length}</strong> trained cultivation cost models
              {selectedFamily !== 'All' && <span> in <strong>{selectedFamily}</strong></span>}
            </span>
            {(selectedFamily !== 'All' || searchQuery) && (
              <button 
                type="button" 
                onClick={() => { setSelectedFamily('All'); setSearchQuery(''); }}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600, fontSize: 12.5 }}
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Leaderboard Table */}
          <div className="registry-table-container">
            <table className="registry-table">
              <thead>
                <tr>
                  <th>Rank & Model Algorithm</th>
                  <th>Family</th>
                  <th>Status</th>
                  <th>LOSO R² (Higher=Better)</th>
                  <th>LOSO MAE (Rs/Acre)</th>
                  <th>LOSO RMSE (Rs)</th>
                  <th>sMAPE (%)</th>
                  <th>Train Latency</th>
                  <th>Inspector</th>
                </tr>
              </thead>
              <tbody>
                {filteredCostModels.map((m, idx) => (
                  <tr key={m.id} className={m.isChampion ? 'champion-row' : ''}>
                    <td>
                      <div className="model-name-cell">
                        <span className="model-main-name">
                          <span style={{ color: '#94a3b8', fontSize: 12, marginRight: 6, fontWeight: 700 }}>#{idx + 1}</span>
                          {m.name}
                          {m.isChampion && <CheckCircle2 size={14} color="#059669" />}
                        </span>
                        <span className="model-family-sub">{m.dataset}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{m.family}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${m.isChampion ? 'champion' : m.status.includes('Top') || m.status.includes('Highest') ? 'high' : 'benchmark'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="metric-highlight">
                      {m.losoR2 < -10 ? '< -10.0' : m.losoR2.toFixed(4)}
                    </td>
                    <td>
                      {m.losoMae > 1000000 ? `> Rs 1M` : `Rs ${m.losoMae.toLocaleString()}`}
                    </td>
                    <td>
                      {m.losoRmse > 1000000 ? `> Rs 1M` : `Rs ${m.losoRmse.toLocaleString()}`}
                    </td>
                    <td>{m.losoSmape > 100 ? `${m.losoSmape}%` : `${m.losoSmape}%`}</td>
                    <td>{m.trainTimeSec}s</td>
                    <td>
                      <button
                        type="button"
                        className="btn-inspect-model"
                        onClick={() => setInspectingModel(m)}
                      >
                        <span>Details</span>
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 4. PRICE ENGINE TAB */}
      {activeEngine === 'price' && (
        <>
          {/* Price Engine KPI Cards */}
          <div className="registry-kpi-grid">
            <div className="reg-kpi-card">
              <div className="reg-kpi-head">
                <Award size={16} color="#059669" />
                <span>Multi-Horizon Champions</span>
              </div>
              <div className="reg-kpi-val" style={{ color: '#059669', fontSize: 15 }}>
                Lasso (1W) • AutoARIMA (4W) • CatBoost (8W) • Transformer (12W)
              </div>
              <div className="reg-kpi-sub">
                Best-in-class specialized forecaster assigned per planting timeframe
              </div>
            </div>

            <div className="reg-kpi-card">
              <div className="reg-kpi-head">
                <Sparkles size={16} color="#2563eb" />
                <span>Best 1-Week Flash Accuracy</span>
              </div>
              <div className="reg-kpi-val">
                5.62% – 6.07% sMAPE
              </div>
              <div className="reg-kpi-sub">
                Simple Average Top 3 & Lasso immediate market precision
              </div>
            </div>

            <div className="reg-kpi-card">
              <div className="reg-kpi-head">
                <TrendingUp size={16} color="#d97706" />
                <span>Peak Directional Accuracy (DA)</span>
              </div>
              <div className="reg-kpi-val">
                71.43% DA
              </div>
              <div className="reg-kpi-sub">
                Prophet & TCN-1D (70.29% DA) market turnaround capture
              </div>
            </div>

            <div className="reg-kpi-card">
              <div className="reg-kpi-head">
                <ShieldCheck size={16} color="#7c3aed" />
                <span>Conformal Risk Framework</span>
              </div>
              <div className="reg-kpi-val">
                80.7% Test Coverage
              </div>
              <div className="reg-kpi-sub">
                Guaranteed coverage across Sri Lanka's 32 key vegetable commodities
              </div>
            </div>
          </div>

          {/* View Mode & Filter Toolbar */}
          <div className="registry-toolbar">
            <div className="family-filter-pills">
              {activeFamilies.map(f => (
                <button
                  key={f}
                  type="button"
                  className={`family-pill-btn ${selectedFamily === f ? 'active' : ''}`}
                  onClick={() => setSelectedFamily(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* View toggle */}
              <div style={{ display: 'flex', background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => setPriceViewMode('table')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: priceViewMode === 'table' ? '#ffffff' : 'transparent',
                    color: priceViewMode === 'table' ? '#0f172a' : '#64748b'
                  }}
                >
                  <ListFilter size={13} />
                  <span>Main Comparison</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPriceViewMode('matrix')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: priceViewMode === 'matrix' ? '#ffffff' : 'transparent',
                    color: priceViewMode === 'matrix' ? '#0f172a' : '#64748b'
                  }}
                >
                  <Grid3X3 size={13} />
                  <span>Horizon Matrix (h=1,4,8,12)</span>
                </button>
              </div>

              {/* Sort selector */}
              {priceViewMode === 'table' && (
                <div className="registry-sort-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 8 }}>
                  <ArrowUpDown size={14} color="#64748b" />
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Sort:</span>
                  <select 
                    value={sortByPrice} 
                    onChange={(e) => setSortByPrice(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}
                  >
                    <option value="smape_asc">Test sMAPE % (Lowest error)</option>
                    <option value="mase_asc">Test MASE (Lowest error)</option>
                    <option value="r2_desc">Test R² (Highest first)</option>
                    <option value="da_desc">Directional Acc DA % (Highest)</option>
                    <option value="rmse_asc">Test RMSE (Lowest)</option>
                    <option value="name_asc">Model Name (A-Z)</option>
                  </select>
                </div>
              )}

              {/* Search Box */}
              <div className="registry-search-box">
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search among all 34 price models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={14} color="#94a3b8" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Count Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 12px 0', fontSize: 13, color: '#64748b' }}>
            <span>
              Showing <strong style={{ color: '#0f172a' }}>{filteredPriceModels.length}</strong> of <strong style={{ color: '#0f172a' }}>{PRICE_MODELS.length}</strong> trained vegetable price forecasting models
              {selectedFamily !== 'All' && <span> in <strong>{selectedFamily}</strong></span>}
            </span>
            {(selectedFamily !== 'All' || searchQuery) && (
              <button 
                type="button" 
                onClick={() => { setSelectedFamily('All'); setSearchQuery(''); }}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600, fontSize: 12.5 }}
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* View Mode 1: Main Comparison Table */}
          {priceViewMode === 'table' ? (
            <div className="registry-table-container">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th>Rank & Model Algorithm</th>
                    <th>Family</th>
                    <th>Status / Role</th>
                    <th>Test sMAPE (Lower=Better)</th>
                    <th>Test MASE</th>
                    <th>Test RMSE (Rs)</th>
                    <th>Directional Acc (DA %)</th>
                    <th>80% Coverage</th>
                    <th>Inspector</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPriceModels.map((m, idx) => (
                    <tr key={m.id} className={m.isChampion ? 'champion-row' : ''}>
                      <td>
                        <div className="model-name-cell">
                          <span className="model-main-name">
                            <span style={{ color: '#94a3b8', fontSize: 12, marginRight: 6, fontWeight: 700 }}>#{idx + 1}</span>
                            {m.name}
                            {m.isChampion && <CheckCircle2 size={14} color="#059669" />}
                          </span>
                          <span className="model-family-sub">{m.dataset}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{m.family}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${m.isChampion ? 'champion' : m.status.includes('Top') || m.status.includes('High') ? 'high' : 'benchmark'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="metric-highlight">{m.testSmape}%</td>
                      <td>{m.testMase.toFixed(4)}</td>
                      <td>Rs {m.testRmse.toFixed(2)}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: m.testDa >= 68 ? '#059669' : m.testDa >= 60 ? '#1e293b' : '#dc2626' }}>
                          {m.testDa}%
                        </span>
                      </td>
                      <td>{m.cov80}%</td>
                      <td>
                        <button
                          type="button"
                          className="btn-inspect-model"
                          onClick={() => setInspectingModel(m)}
                        >
                          <span>Details</span>
                          <ExternalLink size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* View Mode 2: Multi-Horizon Matrix */
            <div className="horizon-breakdown-panel">
              <div className="horizon-panel-head">
                <div>
                  <h3>Multi-Horizon Symmetric MAPE (sMAPE %) Degradation Matrix</h3>
                  <p>
                    Verified holdout sMAPE across 1 Week (Flash), 4 Weeks (Harvest), 8 Weeks (Maturation), and 12 Weeks (Quarterly) for all <strong>{filteredPriceModels.length} models</strong>.
                  </p>
                </div>
                <span className="registry-hero-badge">CBSL / HARTI 32 Commodities</span>
              </div>

              <div className="horizon-table-wrap">
                <table className="horizon-table">
                  <thead>
                    <tr>
                      <th>Model Name</th>
                      <th>Family</th>
                      <th>h=1 Week (Flash)</th>
                      <th>h=4 Weeks (Harvest)</th>
                      <th>h=8 Weeks (Maturation)</th>
                      <th>h=12 Weeks (Quarterly)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPriceModels.map(m => (
                      <tr key={m.id} className={m.isChampion ? 'champion-row' : ''}>
                        <td style={{ fontWeight: 700 }}>
                          {m.name}
                          {m.isChampion && <span style={{ marginLeft: 6 }}>🏆</span>}
                        </td>
                        <td style={{ color: '#64748b', fontSize: 12 }}>{m.family}</td>
                        <td>
                          <span className={`horizon-cell-val ${m.horizonChampion === 1 ? 'champion-h' : ''}`}>
                            {m.h1Smape != null ? `${m.h1Smape}%` : 'N/A'} {m.horizonChampion === 1 && '🏆 Champ'}
                          </span>
                        </td>
                        <td>
                          <span className={`horizon-cell-val ${m.horizonChampion === 4 ? 'champion-h' : ''}`}>
                            {m.h4Smape != null ? `${m.h4Smape}%` : 'N/A'} {m.horizonChampion === 4 && '🏆 Champ'}
                          </span>
                        </td>
                        <td>
                          <span className={`horizon-cell-val ${m.horizonChampion === 8 ? 'champion-h' : ''}`}>
                            {m.h8Smape != null ? `${m.h8Smape}%` : 'N/A'} {m.horizonChampion === 8 && '🏆 Champ'}
                          </span>
                        </td>
                        <td>
                          <span className={`horizon-cell-val ${m.horizonChampion === 12 ? 'champion-h' : ''}`}>
                            {m.h12Smape != null ? `${m.h12Smape}%` : 'N/A'} {m.horizonChampion === 12 && '🏆 Champ'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-inspect-model"
                            onClick={() => setInspectingModel(m)}
                          >
                            <span>Details</span>
                            <ExternalLink size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 5. CHAMPIONS OVERVIEW TAB */}
      {activeEngine === 'champions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
            {/* Cost Champion Card */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sprout size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Cultivation Cost Champion</h3>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Department of Agriculture Econometric Engine</span>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Selected Production Champion:</span>
                  <strong style={{ color: '#059669' }}>Gradient Boosting Regressor</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Top Overall Benchmark:</span>
                  <strong style={{ color: '#2563eb' }}>ExtraTrees Regressor (R² = 0.9329)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Generalization Performance:</span>
                  <strong>LOSO R² = 0.9018 • MAE = Rs 26,786</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Inference Latency:</span>
                  <strong>8.6 milliseconds / query</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Coverage & Conformal Width:</span>
                  <strong>100% LOSO Coverage (80% Conformal)</strong>
                </div>
              </div>

              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0 }}>
                Across the 37 models trained (including Deep TabNet, FT-Transformer, LLaMA 3.1 8B, and Chronos-Bolt), tree-based ensembles demonstrated superior empirical stability on the N=641 agricultural tabular regime.
              </p>
            </div>

            {/* Price Champions Card */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Price Forecaster Champions</h3>
                  <span style={{ fontSize: 12, color: '#64748b' }}>CBSL Multi-Horizon Forecasting Suite</span>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>h=1 Week Flash Sales:</span>
                  <strong style={{ color: '#059669' }}>Lasso Regressor (6.07% sMAPE)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>h=4 Weeks Harvest Target:</span>
                  <strong style={{ color: '#059669' }}>AutoARIMA Rolling (15.31% sMAPE)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>h=8 Weeks Crop Maturation:</span>
                  <strong style={{ color: '#059669' }}>CatBoost Multi-Factor (18.45% sMAPE)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>h=12 Weeks Quarterly Planning:</span>
                  <strong style={{ color: '#059669' }}>Transformer Deep AI (21.72% sMAPE)</strong>
                </div>
              </div>

              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0 }}>
                Rather than forcing a single static model for all planning scopes, the system autonomously deploys the optimal champion tailored to each specific temporal horizon from among all 34 trained time-series architectures.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. INSPECTION MODAL DRAWER */}
      {inspectingModel && (
        <div className="modal-overlay" onClick={() => setInspectingModel(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{inspectingModel.name}</h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>{inspectingModel.family} • {inspectingModel.status}</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setInspectingModel(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: 13.5, color: '#334155', margin: 0, lineHeight: 1.5 }}>
                {inspectingModel.description}
              </p>

              <div className="modal-spec-grid">
                <div className="modal-spec-box">
                  <span className="label">Evaluation Dataset</span>
                  <span className="val">{inspectingModel.dataset}</span>
                </div>
                <div className="modal-spec-box">
                  <span className="label">Primary Metric</span>
                  <span className="val">
                    {inspectingModel.losoR2 != null ? `LOSO R² = ${inspectingModel.losoR2}` : `Test sMAPE = ${inspectingModel.testSmape}%`}
                  </span>
                </div>
                {inspectingModel.runId && (
                  <div className="modal-spec-box">
                    <span className="label">Experiment Run ID</span>
                    <span className="val" style={{ fontFamily: 'monospace', fontSize: 11 }}>{inspectingModel.runId}</span>
                  </div>
                )}
                {inspectingModel.testDa != null && (
                  <div className="modal-spec-box">
                    <span className="label">Directional Accuracy (DA)</span>
                    <span className="val">{inspectingModel.testDa}%</span>
                  </div>
                )}
              </div>

              {/* Multi-horizon stats if available */}
              {inspectingModel.h1Smape != null && (
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
                  <h4 style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
                    Multi-Horizon sMAPE Error Breakdown:
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                    <div style={{ background: '#ffffff', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>h=1 Week</div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{inspectingModel.h1Smape}%</div>
                    </div>
                    <div style={{ background: '#ffffff', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>h=4 Weeks</div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{inspectingModel.h4Smape}%</div>
                    </div>
                    <div style={{ background: '#ffffff', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>h=8 Weeks</div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{inspectingModel.h8Smape}%</div>
                    </div>
                    <div style={{ background: '#ffffff', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>h=12 Weeks</div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{inspectingModel.h12Smape}%</div>
                    </div>
                  </div>
                </div>
              )}

              {inspectingModel.hyperparameters && Object.keys(inspectingModel.hyperparameters).length > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px 0', color: '#0f172a' }}>
                    Hyperparameters & Architecture Config:
                  </h4>
                  <pre className="modal-code-block">
                    {JSON.stringify(inspectingModel.hyperparameters, null, 2)}
                  </pre>
                </div>
              )}

              {inspectingModel.pros && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                  <div style={{ color: '#15803d' }}>
                    <strong>Strengths:</strong> {inspectingModel.pros}
                  </div>
                  <div style={{ color: '#b91c1c' }}>
                    <strong>Trade-offs:</strong> {inspectingModel.cons}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-inspect-model"
                style={{ background: '#0f172a', color: '#ffffff' }}
                onClick={() => setInspectingModel(null)}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
