import React from 'react';
import { useCalculatorStore } from '../../state/calculatorStore';
import { Sprout, MapPin, Calendar, Layers, Truck, Store, Leaf } from 'lucide-react';
import { CROPS_METADATA } from '../../data/cropsData';

export default function SelectionSummary() {
  const selectedCrop = useCalculatorStore(s => s.selectedCrop);
  const selectedDistrict = useCalculatorStore(s => s.selectedDistrict);
  const selectedSeason = useCalculatorStore(s => s.selectedSeason);
  const selectedIrrigation = useCalculatorStore(s => s.selectedIrrigation);
  const acreage = useCalculatorStore(s => s.acreage);
  const selectedVehicleId = useCalculatorStore(s => s.selectedVehicleId);
  const selectedCentreName = useCalculatorStore(s => s.selectedCentreName);
  const enableLeafy = useCalculatorStore(s => s.enableLeafy);
  const selectedLeafyName = useCalculatorStore(s => s.selectedLeafyName);
  const leafyPerches = useCalculatorStore(s => s.leafyPerches);
  const currentStep = useCalculatorStore(s => s.currentStep);
  const setStep = useCalculatorStore(s => s.setStep);

  const cropMeta = CROPS_METADATA[selectedCrop] || {};

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

        {/* Conditions Chip */}
        {currentStep >= 3 && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 3 ? 'chip-active' : ''}`}
            onClick={() => setStep(3)}
            title="Click to change Conditions"
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
            title="Click to change Acreage"
          >
            <Layers size={12} className="chip-icon" />
            <span className="chip-val">{acreage} ac</span>
          </button>
        )}

        {/* Vehicle Chip */}
        {currentStep >= 5 && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 5 ? 'chip-active' : ''}`}
            onClick={() => setStep(5)}
            title="Click to change Vehicle"
          >
            <Truck size={12} className="chip-icon" />
            <span className="chip-val">{selectedVehicleId.replace(/_/g, ' ').toUpperCase()}</span>
          </button>
        )}

        {/* Centre Chip */}
        {currentStep >= 6 && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 6 ? 'chip-active' : ''}`}
            onClick={() => setStep(6)}
            title="Click to change Economic Centre"
          >
            <Store size={12} className="chip-icon" />
            <span className="chip-val">{selectedCentreName.replace(' Economic Centre', '').replace(' Dedicated', '')}</span>
          </button>
        )}

        {/* Leafy Chip */}
        {currentStep >= 7 && (
          <button
            type="button"
            className={`summary-chip ${currentStep === 7 ? 'chip-active' : ''}`}
            onClick={() => setStep(7)}
            title="Click to change Leafy Greens"
          >
            <Leaf size={12} className="chip-icon" />
            <span className="chip-val">{enableLeafy ? `${selectedLeafyName} (${leafyPerches}p)` : 'No Side Crop'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
