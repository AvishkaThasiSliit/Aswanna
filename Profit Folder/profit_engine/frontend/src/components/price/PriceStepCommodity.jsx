import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Check, Store, ArrowRight, Sparkles, MapPin, Calendar, Activity } from 'lucide-react';
import { usePriceStore } from '../../state/priceStore';
import { 
  PRICE_COMMODITIES, 
  ALL_COMMODITIES_LIST, 
  COMMODITY_CATEGORIES 
} from '../../data/priceCommoditiesData';

export default function PriceStepCommodity() {
  const selectedCommodity = usePriceStore(s => s.selectedCommodity);
  const setSelectedCommodity = usePriceStore(s => s.setSelectedCommodity);
  const nextStep = usePriceStore(s => s.nextStep);
  const vegetablesCatalog = usePriceStore(s => s.vegetablesCatalog);
  const fetchVegetablesCatalog = usePriceStore(s => s.fetchVegetablesCatalog);

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!vegetablesCatalog || vegetablesCatalog.length === 0) {
      fetchVegetablesCatalog();
    }
  }, [vegetablesCatalog, fetchVegetablesCatalog]);

  // Lookup latest price from live catalog
  const priceLookup = useMemo(() => {
    const map = {};
    if (vegetablesCatalog && Array.isArray(vegetablesCatalog)) {
      vegetablesCatalog.forEach(item => {
        map[item.name] = item.latest_price;
      });
    }
    return map;
  }, [vegetablesCatalog]);

  const filteredCommodities = useMemo(() => {
    return ALL_COMMODITIES_LIST.filter(cName => {
      const meta = PRICE_COMMODITIES[cName] || {};
      const matchesCategory = activeCategory === 'All' || meta.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        cName.toLowerCase().includes(q) ||
        (meta.displayName && meta.displayName.toLowerCase().includes(q)) ||
        (meta.sinhala && meta.sinhala.includes(q)) ||
        (meta.category && meta.category.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const activeMeta = PRICE_COMMODITIES[selectedCommodity] || {
    displayName: selectedCommodity,
    sinhala: '',
    category: 'Upcountry',
    unit: '1kg',
    icon: '🌱',
    districts: ['Badulla'],
    seasons: 'Maha & Yala',
    volatility: 'Moderate',
    description: 'Selected vegetable variety for market price forecasting.'
  };

  const currentPrice = priceLookup[selectedCommodity];

  return (
    <div className="price-step-card-wrap">
      <div className="price-step-header">
        <div className="price-step-icon-badge">
          <Store size={22} />
        </div>
        <div>
          <h2>Step 1: Select Vegetable Commodity</h2>
          <p>
            Choose from all 32 CBSL varieties across Upcountry, Lowland, and Leafy Greens calibrated with real historical weekly bulletins.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="price-filter-toolbar">
        <div className="price-cat-tabs">
          {COMMODITY_CATEGORIES.map(cat => {
            const count = cat === 'All'
              ? ALL_COMMODITIES_LIST.length
              : ALL_COMMODITIES_LIST.filter(c => PRICE_COMMODITIES[c]?.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                className={`price-cat-tab-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                <span>{cat}</span>
                <span className="price-cat-count">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="price-search-box">
          <Search size={15} className="price-search-icon" />
          <input
            type="text"
            placeholder="Search commodity or සිංහල..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="price-search-clear"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Visual Commodity Grid */}
      <div className="price-commodity-grid">
        {filteredCommodities.map(cName => {
          const meta = PRICE_COMMODITIES[cName] || {};
          const isSelected = selectedCommodity === cName;
          const livePrice = priceLookup[cName];

          return (
            <div
              key={cName}
              className={`price-commodity-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedCommodity(cName)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedCommodity(cName)}
            >
              {isSelected && (
                <div className="price-card-selected-tag">
                  <Check size={12} strokeWidth={3} />
                </div>
              )}

              <div className="price-commodity-icon-box" style={{ background: meta.bg || '#f1f5f9' }}>
                <span className="price-commodity-emoji">{meta.icon || '🌱'}</span>
              </div>

              <div className="price-commodity-info">
                <div className="price-commodity-name-row">
                  <h4 className="price-commodity-title">{meta.displayName || cName}</h4>
                  {meta.sinhala && (
                    <span className="price-commodity-sinhala">{meta.sinhala}</span>
                  )}
                </div>

                <div className="price-commodity-meta-tags">
                  <span className="price-commodity-badge">{meta.category}</span>
                  {livePrice !== undefined && (
                    <span className="price-commodity-price-pill">
                      Rs {livePrice.toFixed(0)}/{meta.unit || 'kg'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Commodity Spotlight Footer */}
      <div className="price-spotlight-bar">
        <div className="price-spotlight-main">
          <div className="price-spotlight-avatar" style={{ background: activeMeta.bg }}>
            <span>{activeMeta.icon}</span>
          </div>
          <div className="price-spotlight-details">
            <div className="price-spotlight-title-row">
              <h3>{activeMeta.displayName || selectedCommodity}</h3>
              {activeMeta.sinhala && <span className="spotlight-sinhala">{activeMeta.sinhala}</span>}
              <span className="spotlight-cat-tag">{activeMeta.category}</span>
              {currentPrice && (
                <span className="spotlight-price-tag">
                  Latest: Rs {currentPrice.toFixed(2)} / {activeMeta.unit}
                </span>
              )}
            </div>
            <p className="price-spotlight-desc">{activeMeta.description}</p>
            <div className="price-spotlight-attributes">
              <span><MapPin size={12} /> {activeMeta.districts.slice(0, 3).join(', ')}</span>
              <span><Calendar size={12} /> {activeMeta.seasons}</span>
              <span><Activity size={12} /> Volatility: {activeMeta.volatility}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn-continue-forward"
          onClick={nextStep}
        >
          <span>Continue to Horizon & Model</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
