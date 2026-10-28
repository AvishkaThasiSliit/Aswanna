import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Fuel, Package, RotateCcw, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';
import { VEHICLES_METADATA } from '../../data/vehiclesData';
import VehicleScene from '../three/VehicleScene';
import advisoryData from '../../data/advisory_data.json';

export default function StepVehicle() {
  const selectedVehicleId = useCalculatorStore(s => s.selectedVehicleId);
  const setSelectedVehicleId = useCalculatorStore(s => s.setSelectedVehicleId);

  const dieselPrice = useCalculatorStore(s => s.dieselPrice);
  const setDieselPrice = useCalculatorStore(s => s.setDieselPrice);
  const petrolPrice = useCalculatorStore(s => s.petrolPrice);
  const setPetrolPrice = useCalculatorStore(s => s.setPetrolPrice);

  const [focusArea, setFocusArea] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('focus');
      if (p === 'tank' || p === 'storage') return p;
    }
    return 'default';
  });

  const vehicles = advisoryData.vehicles;
  const currentVehicle = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  const isDiesel = currentVehicle.fuel_type === 'Diesel';

  const handlePrevVehicle = () => {
    const idx = vehicles.findIndex(v => v.id === selectedVehicleId);
    const prevIdx = idx <= 0 ? vehicles.length - 1 : idx - 1;
    setSelectedVehicleId(vehicles[prevIdx].id);
  };

  const handleNextVehicle = () => {
    const idx = vehicles.findIndex(v => v.id === selectedVehicleId);
    const nextIdx = idx >= vehicles.length - 1 ? 0 : idx + 1;
    setSelectedVehicleId(vehicles[nextIdx].id);
  };

  return (
    <div className="wizard-step-container">
      <div className="step-headline">
        <h2>Step 5: Transport Vehicle & Fuel Logistics</h2>
        <p>Select your farm transport fleet. Inspect fuel efficiency and cargo payload capacity on the 3D model.</p>
      </div>

      <div className="vehicle-step-layout">
        {/* Left Column: 3D Vehicle Viewer */}
        <div className="vehicle-canvas-panel">
          <div className="vehicle-canvas-topbar">
            <div className="canvas-vehicle-tag">
              <Truck size={15} color="#2563eb" />
              <span>3D Vehicle Inspector: {currentVehicle.name}</span>
            </div>

            {focusArea !== 'default' && (
              <button
                type="button"
                className="btn-reset-camera"
                onClick={() => setFocusArea('default')}
              >
                <RotateCcw size={12} />
                <span>Reset Orbit View</span>
              </button>
            )}
          </div>

          <VehicleScene
            vehicleId={selectedVehicleId}
            focusArea={focusArea}
            onSelectHotspot={(hotspot) => setFocusArea(hotspot)}
          />

          {/* Floating Focus Inspection Badge */}
          <AnimatePresence>
            {focusArea === 'tank' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="floating-focus-card tank-focus"
              >
                <div className="focus-card-head">
                  <Fuel size={14} color="#d97706" />
                  <strong>Fuel Tank Focus ({currentVehicle.fuel_type})</strong>
                </div>
                <div className="focus-card-body">
                  <span>Current Price: LKR {isDiesel ? dieselPrice : petrolPrice} / Litre</span>
                  <span>Economy: {currentVehicle.practical_fuel_economy}</span>
                </div>
              </motion.div>
            )}

            {focusArea === 'storage' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="floating-focus-card storage-focus"
              >
                <div className="focus-card-head">
                  <Package size={14} color="#059669" />
                  <strong>Cargo Bed Focus</strong>
                </div>
                <div className="focus-card-body">
                  <span>Max Payload: {currentVehicle.payload_kg.toLocaleString()} kg</span>
                  <span>Typical Usage: {currentVehicle.typical_use}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="vehicle-hotspot-hint">
            <span>💡 Click the pulsing ⛽ tank or 📦 cargo pins to focus the camera</span>
          </div>
        </div>

        {/* Right Column: Fleet Carousel & Parameter Controls */}
        <div className="vehicle-details-panel">
          {/* Carousel Selector Header */}
          <div className="vehicle-carousel-selector">
            <button
              type="button"
              className="carousel-nav-btn"
              onClick={handlePrevVehicle}
              title="Previous Vehicle"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="carousel-title-box">
              <h3>{currentVehicle.name}</h3>
              <span className="vehicle-role-sub">{currentVehicle.typical_use}</span>
            </div>

            <button
              type="button"
              className="carousel-nav-btn"
              onClick={handleNextVehicle}
              title="Next Vehicle"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Quick Vehicle Fleet Strip */}
          <div className="fleet-pills-row">
            {vehicles.map(v => (
              <button
                key={v.id}
                type="button"
                className={`fleet-pill-btn ${selectedVehicleId === v.id ? 'active' : ''}`}
                onClick={() => setSelectedVehicleId(v.id)}
              >
                {v.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Vehicle Tech Specifications Grid */}
          <div className="vehicle-specs-card">
            {/* Spec 1: Fuel Economy (clickable to focus tank) */}
            <div
              className={`spec-interactive-item ${focusArea === 'tank' ? 'focused' : ''}`}
              onClick={() => setFocusArea('tank')}
              role="button"
              tabIndex={0}
            >
              <div className="spec-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
                <Fuel size={18} />
              </div>
              <div className="spec-content">
                <span className="spec-lbl">Practical Fuel Economy</span>
                <span className="spec-val">{currentVehicle.practical_fuel_economy}</span>
                <span className="spec-hint-text">Click to focus fuel tank in 3D</span>
              </div>
            </div>

            {/* Spec 2: Max Payload (clickable to focus storage) */}
            <div
              className={`spec-interactive-item ${focusArea === 'storage' ? 'focused' : ''}`}
              onClick={() => setFocusArea('storage')}
              role="button"
              tabIndex={0}
            >
              <div className="spec-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Package size={18} />
              </div>
              <div className="spec-content">
                <span className="spec-lbl">Cargo Payload Capacity</span>
                <span className="spec-val">{currentVehicle.payload_kg.toLocaleString()} kg</span>
                <span className="spec-hint-text">Click to focus cargo bed in 3D</span>
              </div>
            </div>
          </div>

          {/* Fuel Price Edit Field */}
          <div className="fuel-price-control-box">
            <div className="control-label-row">
              <label>
                Current {currentVehicle.fuel_type} Price (LKR / Litre)
              </label>
              <span className="fuel-tag-badge">
                {currentVehicle.fuel_type} Fuel
              </span>
            </div>

            <div className="fuel-input-wrap">
              <span className="prefix-lbl">LKR</span>
              <input
                type="number"
                step="1"
                min="100"
                max="800"
                value={isDiesel ? dieselPrice : petrolPrice}
                onFocus={() => setFocusArea('tank')}
                onChange={(e) => {
                  if (isDiesel) setDieselPrice(e.target.value);
                  else setPetrolPrice(e.target.value);
                }}
                className="fuel-price-input"
              />
              <span className="suffix-lbl">/ Litre</span>
            </div>
            <p className="fuel-hint-text">
              Adjust if recent Ceylon Petroleum Corporation (CPC) price revisions occurred.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
