import React from 'react';
import { useCostStore } from '../../state/costStore';
import { Sprout, MapPin, Calendar, Layers, TrendingUp } from 'lucide-react';
import { CROPS_METADATA } from '../../data/cropsData';

export default function CostSelectionSummary() {
  const selectedCrop = useCostStore(s => s.selectedCrop);
  const selectedDistrict = useCostStore(s => s.selectedDistrict);
  const selectedSeason = useCostStore(s => s.selectedSeason);
  const selectedIrrigation = useCostStore(s => s.selectedIrrigation);
  const acreage = useCostStore(s => s.acreage);
  const customYield = useCostStore(s => s.customYield);
  const currentStep = useCostStore(s => s.currentStep);
  const setStep = useCostStore(s => s.setStep);

  const cropMeta = CROPS_METADATA[selectedCrop] || {};
  const displayYield = customYield 
    ? `${parseFloat(customYield).toLocaleString()} kg/ac` 
    : `${(cropMeta.typicalYieldKgAc || 7500).toLocaleString()} kg/ac`;

  return (
    <div className="selection-summary-bar">
      <div className="summary-title-col">
        <span className="summary-lbl">Active Selection</span>
      </div>

      <div className="summary-chips-wrap">
        {/* Crop Chip */}
        <button
          type="button"
          className={`summary-chip ${currentStep === 1 ? 'chip-active' : ''}`}
          onClick={() => setStep(1)}
          title="Click to change Crop"
        >
          <span className="chip-icon">{cropMeta.icon || '🌱'}</span>
          <span className="chip-val">{selectedCrop}</span>
        </button>

        {/* District Chip */}
        {currentStep >= 2 && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 2 ? 'chip-active' : ''}`}
            onClick={() => setStep(2)}
            title="Click to change District"
          >
            <MapPin size={12} className="chip-icon" />
            <span className="chip-val">{selectedDistrict}</span>
          </button>
        )}

        {/* Regimes Chip */}
        {currentStep >= 3 && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 3 ? 'chip-active' : ''}`}
            onClick={() => setStep(3)}
            title="Click to change Regimes"
          >
            <Calendar size={12} className="chip-icon" />
            <span className="chip-val">{selectedSeason} • {selectedIrrigation}</span>
          </button>
        )}

        {/* Acreage Chip */}
        {currentStep >= 4 && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 4 ? 'chip-active' : ''}`}
            onClick={() => setStep(4)}
            title="Click to change Acres"
          >
            <Layers size={12} className="chip-icon" />
            <span className="chip-val">{acreage} ac</span>
          </button>
        )}

        {/* Yield Chip */}
        {currentStep >= 5 && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 5 ? 'chip-active' : ''}`}
            onClick={() => setStep(5)}
            title="Click to change Yield"
          >
            <TrendingUp size={12} className="chip-icon" />
            <span className="chip-val">{displayYield}</span>
          </button>
        )}
      </div>
    </div>
  );
}
