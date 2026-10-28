import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Check, Sprout, Calendar, TrendingUp } from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';
import { CROPS_METADATA, CROP_CATEGORIES } from '../../data/cropsData';
import advisoryData from '../../data/advisory_data.json';

export default function StepCrop() {
  const selectedCrop = useCalculatorStore(s => s.selectedCrop);
  const setSelectedCrop = useCalculatorStore(s => s.setSelectedCrop);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const allCrops = useMemo(() => {
    return Object.keys(advisoryData.crops);
  }, []);

  const filteredCrops = useMemo(() => {
    return allCrops.filter(cropName => {
      const meta = CROPS_METADATA[cropName] || {};
      const matchesSearch = cropName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (meta.sinhala && meta.sinhala.includes(searchQuery));
      const matchesCat = activeCategory === 'All' || meta.category === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [allCrops, searchQuery, activeCategory]);

  const activeMeta = CROPS_METADATA[selectedCrop] || {};
  const activeCropData = advisoryData.crops[selectedCrop] || {};

  return (
    <div className="wizard-step-container">
      <div className="step-headline">
        <h2>Step 1: Choose Your Primary Crop</h2>
        <p>Select from 24 Department of Agriculture (DOA) commercial crop varieties cultivated across Sri Lanka.</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="crop-filter-toolbar">
        <div className="crop-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search crop by English or Sinhala name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="crop-search-input"
          />
        </div>

        <div className="crop-cat-chips">
          {CROP_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`cat-chip-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Crop Cards Grid */}
      <div className="crop-cards-grid">
        {filteredCrops.map((cropName) => {
          const meta = CROPS_METADATA[cropName] || { icon: '🌱', sinhala: '', category: 'Vegetables' };
          const isSelected = selectedCrop === cropName;

          return (
            <motion.div
              key={cropName}
              whileHover={{ y: -4, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.97 }}
              className={`crop-select-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedCrop(cropName)}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
            >
              {isSelected && (
                <div className="crop-card-check-badge">
                  <Check size={14} strokeWidth={3} />
                </div>
              )}

              <div className="crop-card-icon-wrap" style={{ background: meta.bg || '#f1f5f9' }}>
                <span className="crop-emoji-icon">{meta.icon || '🌱'}</span>
              </div>

              <div className="crop-card-info">
                <h4 className="crop-card-title">{cropName}</h4>
                {meta.sinhala && <span className="crop-card-sinhala">{meta.sinhala}</span>}
                <span className="crop-card-category-tag">{meta.category}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Selected Crop Info Strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="crop-info-strip"
      >
        <div className="strip-left">
          <span className="strip-badge-selected">Selected</span>
          <span className="strip-crop-name">{selectedCrop}</span>
          {activeMeta.sinhala && <span className="strip-sinhala">({activeMeta.sinhala})</span>}
        </div>

        <div className="strip-metrics">
          <div className="strip-metric-item">
            <Sprout size={15} color="#059669" />
            <div>
              <span className="lbl">Typical Yield</span>
              <span className="val">
                {activeCropData.typical_yield_kg_ac ? `${activeCropData.typical_yield_kg_ac.toLocaleString()} kg/ac` : 'Benchmark'}
              </span>
            </div>
          </div>

          <div className="strip-metric-item">
            <Calendar size={15} color="#2563eb" />
            <div>
              <span className="lbl">Primary Season</span>
              <span className="val">{activeMeta.season || (activeCropData.seasons || []).join(' & ') || 'Maha & Yala'}</span>
            </div>
          </div>

          <div className="strip-metric-item">
            <TrendingUp size={15} color="#d97706" />
            <div>
              <span className="lbl">Benchmark Retail</span>
              <span className="val">
                {activeCropData.typical_retail_price_kg ? `LKR ${activeCropData.typical_retail_price_kg.toFixed(0)}/kg` : 'CBSL Market'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
