import React, { useState, useMemo } from 'react';
import { Search, X, Check, Sprout, ArrowRight } from 'lucide-react';
import { useCostStore } from '../../state/costStore';
import { CROPS_METADATA, CROP_CATEGORIES } from '../../data/cropsData';
import { CROP_DISTRICTS_MAP } from '../../data/cropDistricts';

export const ALL_COST_CROPS = [
  'Tomato', 'Paddy', 'Big Onion', 'Potato', 'Cabbage', 'Carrot', 'Brinjal',
  'Green Chilli', 'Capsicum', 'Bitter Gourd', 'Pumpkin', 'Pole Bean', 'Black Gram',
  'Cowpea', 'Gingelly', 'Green Gram', 'Groundnut', 'Kurakkan', 'Maize',
  'Manioc', 'Red Onion', 'Soybean', 'Sweet Potato'
];

export default function CostStepCrop() {
  const selectedCrop = useCostStore(s => s.selectedCrop);
  const setSelectedCrop = useCostStore(s => s.setSelectedCrop);
  const nextStep = useCostStore(s => s.nextStep);

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCrops = useMemo(() => {
    return ALL_COST_CROPS.filter(cropName => {
      const meta = CROPS_METADATA[cropName] || {};
      const matchesCategory = activeCategory === 'All' || meta.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        cropName.toLowerCase().includes(q) || 
        (meta.sinhala && meta.sinhala.includes(q)) ||
        (meta.category && meta.category.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const activeMeta = CROPS_METADATA[selectedCrop] || {};
  const validDistricts = CROP_DISTRICTS_MAP[selectedCrop] || ['Badulla'];

  return (
    <div className="cost-step-crop-container">
      <div className="cost-step-head">
        <div className="cost-step-icon-badge">
          <Sprout size={22} />
        </div>
        <div>
          <h2>Step 1: Select Cultivation Crop</h2>
          <p>
            Choose from all 23 Department of Agriculture (DOA) crops calibrated with verified ML econometric baselines.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="cost-crop-filter-bar">
        <div className="cost-cat-pills">
          {CROP_CATEGORIES.map(cat => {
            const count = cat === 'All' 
              ? ALL_COST_CROPS.length 
              : ALL_COST_CROPS.filter(c => CROPS_METADATA[c]?.category === cat).length;
            if (count === 0 && cat !== 'All') return null;
            return (
              <button
                key={cat}
                type="button"
                className={`cost-cat-pill-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                <span>{cat}</span>
                <span style={{ fontSize: '11px', opacity: 0.8 }}>({count})</span>
              </button>
            );
          })}
        </div>

        <div className="cost-crop-search-box">
          <Search size={14} className="cost-crop-search-icon" />
          <input
            type="text"
            placeholder="Search crop or සිංහල..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              type="button" 
              className="cost-crop-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Visual Crop Cards Grid */}
      <div className="cost-crops-grid">
        {filteredCrops.map(cropName => {
          const meta = CROPS_METADATA[cropName] || {
            icon: '🌱',
            sinhala: '',
            category: 'Vegetables',
            bg: '#f1f5f9',
            color: '#059669',
            typicalYieldKgAc: 5000
          };
          const isSelected = selectedCrop === cropName;
          const distCount = (CROP_DISTRICTS_MAP[cropName] || ['Badulla']).length;

          return (
            <button
              key={cropName}
              type="button"
              className={`crop-card-item ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedCrop(cropName)}
            >
              <div 
                className="crop-avatar-circle"
                style={{ 
                  background: meta.bg || '#f1f5f9', 
                  border: isSelected ? '1px solid #10b981' : '1px solid transparent' 
                }}
              >
                {meta.icon || '🌱'}
              </div>

              <div className="crop-info-meta">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span className="crop-name-title">{cropName}</span>
                  {isSelected && <Check size={14} color="#059669" style={{ flexShrink: 0 }} />}
                </div>
                <div className="crop-sinhala-subtitle">{meta.sinhala || cropName}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                  <span className="crop-tag-pill">{meta.category}</span>
                  <span style={{ fontSize: '9.5px', color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>
                    {distCount} {distCount === 1 ? 'zone' : 'zones'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selection Confirmation Bar */}
      <div className="cost-selection-confirm-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: '28px', background: activeMeta.bg || '#ecfdf5', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {activeMeta.icon || '🌱'}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Selected Crop: {selectedCrop} <span style={{ color: '#64748b', fontWeight: 500 }}>({activeMeta.sinhala})</span>
            </div>
            <div style={{ fontSize: '12px', color: '#059669', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>Verified Zones: {validDistricts.join(', ')}</span>
              <span>•</span>
              <span>Benchmark: {activeMeta.typicalYieldKgAc?.toLocaleString() || '7,000'} kg/ac</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="cost-btn-step-next"
          onClick={nextStep}
        >
          <span>Next: Select District</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
