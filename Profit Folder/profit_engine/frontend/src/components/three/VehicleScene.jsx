import React, { useState, useEffect } from 'react';
import { Fuel, Package, RotateCcw, ShieldCheck, Box, Compass, ExternalLink, X } from 'lucide-react';
import advisoryData from '../../data/advisory_data.json';
import { getVehicleHotspots } from '../../data/vehicleHotspots';
import { getSketchfabModel } from '../../data/sketchfabModels';
import Vehicle2DIllustration from './Vehicle2DIllustration';

export default function VehicleScene({
  vehicleId = 'dimo_batta_ht2',
  focusArea = 'default',
  fuelPrice = 315.0,
  onSelectHotspot
}) {
  const vehicle = advisoryData.vehicles.find(v => v.id === vehicleId) || advisoryData.vehicles[0];
  const hotspots = getVehicleHotspots(vehicle.id);
  const sketchfab = getSketchfabModel(vehicle.id);

  const [viewMode, setViewMode] = useState('3d'); // '3d' (Sketchfab Interactive) | 'blueprint' (2.5D schematic)
  const [iframeLoading, setIframeLoading] = useState(true);

  const isDiesel = (vehicle.fuel_type || '').toLowerCase().includes('diesel');
  const fuelRate = isDiesel ? fuelPrice : 360.0;

  // Auto-clear loading backdrop on model change after 2.0s or iframe onLoad
  useEffect(() => {
    setIframeLoading(true);
    const timer = setTimeout(() => {
      setIframeLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [sketchfab.modelId]);

  return (
    <div className="vehicle-scene-wrapper">
      {/* Hotspot & View Mode Quick Inspector Toolbar */}
      <div className="vehicle-hotspot-toolbar">
        {/* Hotspot 1: Fuel Tank */}
        <button
          type="button"
          className={`hotspot-tab-btn ${focusArea === 'tank' ? 'active-tank' : ''}`}
          onClick={() => onSelectHotspot && onSelectHotspot(focusArea === 'tank' ? 'default' : 'tank')}
          title="Inspect Fuel Tank & Economy"
        >
          <Fuel size={13} />
          <span>Fuel Tank ({vehicle.fuel_type})</span>
        </button>

        {/* Hotspot 2: Cargo Deck */}
        <button
          type="button"
          className={`hotspot-tab-btn ${focusArea === 'storage' ? 'active-storage' : ''}`}
          onClick={() => onSelectHotspot && onSelectHotspot(focusArea === 'storage' ? 'default' : 'storage')}
          title="Inspect Cargo Storage & Payload"
        >
          <Package size={13} />
          <span>Cargo Deck ({vehicle.payload_kg} kg)</span>
        </button>

        {/* View Mode Toggle: 3D Model vs Blueprint */}
        <button
          type="button"
          className={`hotspot-tab-btn view-toggle-btn ${viewMode === '3d' ? 'active-3d' : 'active-blueprint'}`}
          onClick={() => {
            setViewMode(m => (m === '3d' ? 'blueprint' : '3d'));
            setIframeLoading(true);
          }}
          title={viewMode === '3d' ? 'Switch to 2.5D Schematic Blueprint' : 'Switch to Interactive 3D Model'}
        >
          {viewMode === '3d' ? <Compass size={13} /> : <Box size={13} />}
          <span>{viewMode === '3d' ? '🎮 3D Orbit View' : '📐 Blueprint Specs'}</span>
        </button>

        {/* Reset View Button */}
        {focusArea !== 'default' && (
          <button
            type="button"
            className="hotspot-tab-btn btn-reset-hotspot"
            onClick={() => onSelectHotspot && onSelectHotspot('default')}
            title="Reset to Full Overview"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Main Viewport Container */}
      <div className="vehicle-viewport-container">
        {viewMode === '3d' ? (
          <div className="sketchfab-3d-wrapper">
            {iframeLoading && (
              <div className="sketchfab-loader-backdrop">
                <div className="sketchfab-spin-indicator" />
                <span>Loading 3D Model: {vehicle.name}...</span>
              </div>
            )}
            <iframe
              key={sketchfab.modelId}
              title={sketchfab.title}
              src={sketchfab.embedUrl}
              className="sketchfab-3d-iframe"
              frameBorder="0"
              allow="autoplay; fullscreen; xr-spatial-tracking"
              allowFullScreen
              onLoad={() => setIframeLoading(false)}
            />

            {/* Floating HUD Spec Cards over 3D Viewport when a Hotspot is active */}
            {focusArea === 'tank' && (
              <div className="vehicle-floating-card card-fuel hud-3d-card">
                <div className="card-header">
                  <Fuel size={15} color="#d97706" />
                  <h4>{hotspots.tank.label}</h4>
                  <button
                    type="button"
                    className="btn-card-close"
                    onClick={() => onSelectHotspot && onSelectHotspot('default')}
                    title="Close"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="card-body">
                  <div className="spec-row">
                    <span>Fuel Grade:</span>
                    <strong>{vehicle.fuel_type}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Fuel Price:</span>
                    <strong>LKR {fuelRate.toFixed(2)} / L</strong>
                  </div>
                  <div className="spec-row">
                    <span>Practical Economy:</span>
                    <strong className="text-emerald">{hotspots.fuelEconomy}</strong>
                  </div>
                </div>
              </div>
            )}

            {focusArea === 'storage' && (
              <div className="vehicle-floating-card card-storage hud-3d-card">
                <div className="card-header">
                  <Package size={15} color="#059669" />
                  <h4>{hotspots.storage.label}</h4>
                  <button
                    type="button"
                    className="btn-card-close"
                    onClick={() => onSelectHotspot && onSelectHotspot('default')}
                    title="Close"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="card-body">
                  <div className="spec-row">
                    <span>Max Payload:</span>
                    <strong className="text-emerald">{vehicle.payload_kg?.toLocaleString()} kg</strong>
                  </div>
                  <div className="spec-row">
                    <span>Cargo Volume:</span>
                    <strong>{hotspots.cargoVolume}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Typical Freight:</span>
                    <span>{vehicle.typical_use}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Vehicle2DIllustration
            vehicle={vehicle}
            focusArea={focusArea}
            fuelPrice={fuelPrice}
            onSelectHotspot={onSelectHotspot}
          />
        )}
      </div>

      {/* Footer Attribution & Metadata Bar */}
      <div className="vehicle-scene-footer-bar">
        <div className="footer-spec-badge">
          <ShieldCheck size={13} color="#059669" />
          <span>DOA Logistics Profile: {vehicle.name}</span>
        </div>

        {viewMode === '3d' && sketchfab && (
          <div className="sketchfab-author-credit">
            <span>
              3D Model:{' '}
              <a
                href={sketchfab.modelUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="View original 3D asset on Sketchfab"
              >
                <strong>{sketchfab.title}</strong>
              </a>{' '}
              by{' '}
              <a
                href={sketchfab.authorUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Visit author profile on Sketchfab"
              >
                {sketchfab.author}
              </a>
            </span>
            <ExternalLink size={10} color="#64748b" />
          </div>
        )}
      </div>
    </div>
  );
}

