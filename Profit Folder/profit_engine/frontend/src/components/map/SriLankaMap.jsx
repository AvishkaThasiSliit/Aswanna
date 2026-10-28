import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { geoMercator, geoPath } from 'd3-geo';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import districtGeoJson from '../../data/lk-districts.geo.json';
import { resolveDistrictToPolygons, resolveValidDistrictsToPolygons } from '../../data/districtAliases';

export default function SriLankaMap({
  selectedDistrict,
  validDistricts = [],
  cropName = 'Crop',
  onSelectDistrict
}) {
  const [hoveredDistrict, setHoveredDistrict] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const mapSvgRef = useRef(null);

  // Map canvas dimensions
  const MAP_WIDTH = 480;
  const MAP_HEIGHT = 720;

  // D3-Geo projection fitted cleanly to Sri Lanka bounds
  const { pathGenerator, featureData } = useMemo(() => {
    const projection = geoMercator().fitExtent(
      [[25, 30], [MAP_WIDTH - 25, MAP_HEIGHT - 35]],
      districtGeoJson
    );
    const generator = geoPath().projection(projection);

    const data = districtGeoJson.features.map(f => {
      const name = f.properties.name;
      const pathD = generator(f) || '';
      const [cx, cy] = generator.centroid(f) || [0, 0];
      return {
        feature: f,
        name,
        pathD,
        centroid: [Math.round(cx), Math.round(cy)]
      };
    });

    return { pathGenerator: generator, featureData: data };
  }, []);

  // Expanded set of enabled polygon district names
  const enabledPolygonsSet = useMemo(() => {
    return resolveValidDistrictsToPolygons(validDistricts);
  }, [validDistricts]);

  // Highlighted polygon names for the currently selected district/command
  const selectedPolygonsSet = useMemo(() => {
    return new Set(resolveDistrictToPolygons(selectedDistrict));
  }, [selectedDistrict]);

  // Find centroid of the active selection (or average if multi-polygon like Udawalawa)
  const activeCentroid = useMemo(() => {
    const targets = featureData.filter(d => selectedPolygonsSet.has(d.name));
    if (targets.length === 0) return null;
    const avgX = targets.reduce((sum, d) => sum + d.centroid[0], 0) / targets.length;
    const avgY = targets.reduce((sum, d) => sum + d.centroid[1], 0) / targets.length;
    return [avgX, avgY];
  }, [featureData, selectedPolygonsSet]);

  // Pan and pinch zoom gesture handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e) => {
    if (isDragging.current) {
      setPanOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }

    if (mapSvgRef.current) {
      const rect = mapSvgRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="sri-lanka-carto-container" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Zoom / Pan Controls Toolbar */}
      <div className="map-zoom-toolbar">
        <button
          type="button"
          onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.25))}
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel(z => Math.max(0.8, z - 0.25))}
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          onClick={resetView}
          title="Reset View"
          aria-label="Reset View"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      <svg
        ref={mapSvgRef}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="sri-lanka-carto-svg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{ cursor: isDragging.current ? 'grabbing' : 'default' }}
      >
        <defs>
          {/* 1. Soft Maritime Ocean Gradient */}
          <linearGradient id="oceanGrad" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="50%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>

          {/* 2. Valid Growing District Gradient Fill */}
          <linearGradient id="validDistrictGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* 3. Selected District Strong Emerald Gradient */}
          <linearGradient id="selectedDistrictGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          {/* 4. Hover State Bright Fill */}
          <linearGradient id="hoverDistrictGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>

          {/* 5. Drop Shadow under the Entire Island */}
          <filter id="islandShadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#0f172a" floodOpacity="0.18" />
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.12" />
          </filter>

          {/* 6. Soft Inner Shadow for Valid Districts */}
          <filter id="districtInnerShadow">
            <feComponentTransfer in="SourceAlpha">
              <feFuncA type="linear" slope="0.7" />
            </feComponentTransfer>
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feOffset dx="0" dy="1.5" />
            <feComposite operator="out" in2="SourceGraphic" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0" />
            <feBlend mode="multiply" in2="SourceGraphic" />
          </filter>
        </defs>

        {/* Ocean Background Canvas */}
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#oceanGrad)" />

        {/* Subtle Animated Ocean Wave Lines */}
        <g className="ocean-wave-lines" opacity="0.45" stroke="#38bdf8" strokeWidth="1" fill="none">
          <path d="M 15 90 Q 40 85 65 90 T 115 90 T 165 90" strokeDasharray="3 4" />
          <path d="M 25 210 Q 55 205 85 210 T 145 210" strokeDasharray="4 6" />
          <path d="M 330 110 Q 360 105 390 110 T 450 110" strokeDasharray="3 5" />
          <path d="M 360 260 Q 395 255 430 260 T 475 260" strokeDasharray="4 6" />
          <path d="M 20 620 Q 60 615 100 620 T 180 620" strokeDasharray="4 5" />
          <path d="M 310 640 Q 360 635 410 640 T 470 640" strokeDasharray="3 5" />
        </g>

        {/* Ocean Labels */}
        <text x="32" y="145" className="ocean-label palk-strait">Palk Strait</text>
        <text x="330" y="685" className="ocean-label indian-ocean">Indian Ocean</text>
        <text x="45" y="450" className="ocean-label gulf-mannar">Gulf of Mannar</text>

        {/* Stylized Compass Rose */}
        <g transform="translate(420, 85)" className="compass-rose-group" opacity="0.75">
          <circle r="22" fill="#ffffff" fillOpacity="0.7" stroke="#0284c7" strokeWidth="1" />
          <circle r="18" fill="none" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="2 2" />
          {/* North Star Point */}
          <polygon points="0,-20 4,-5 0,0 -4,-5" fill="#0284c7" />
          <polygon points="0,-20 0,0 -4,-5" fill="#0369a1" />
          {/* South Point */}
          <polygon points="0,20 4,5 0,0 -4,5" fill="#94a3b8" />
          {/* East Point */}
          <polygon points="20,0 5,4 0,0 5,-4" fill="#94a3b8" />
          {/* West Point */}
          <polygon points="-20,0 -5,4 0,0 -5,-4" fill="#94a3b8" />
          <text x="0" y="-23" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0369a1">N</text>
        </g>

        {/* Main Island Group with Pan/Zoom Transform and Island Drop Shadow */}
        <g
          filter="url(#islandShadow)"
          transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}
          style={{ transformOrigin: `${MAP_WIDTH / 2}px ${MAP_HEIGHT / 2}px`, transition: isDragging.current ? 'none' : 'transform 0.15s ease-out' }}
        >
          {/* All 25 District Filled Polygons */}
          {featureData.map(({ name, pathD, centroid }) => {
            const isEnabled = enabledPolygonsSet.has(name);
            const isSelected = selectedPolygonsSet.has(name);
            const isHovered = hoveredDistrict === name;

            let fill = '#dcfce7'; // pale grey-green for invalid
            let opacity = 0.42;

            if (isSelected) {
              fill = 'url(#selectedDistrictGrad)';
              opacity = 1.0;
            } else if (isEnabled) {
              fill = isHovered ? 'url(#hoverDistrictGrad)' : 'url(#validDistrictGrad)';
              opacity = 1.0;
            }

            return (
              <g
                key={name}
                className={`district-carto-group ${isEnabled ? 'is-enabled' : 'is-disabled'} ${isSelected ? 'is-selected' : ''}`}
                onMouseEnter={() => setHoveredDistrict(name)}
                onMouseLeave={() => setHoveredDistrict(null)}
                onClick={() => {
                  if (isEnabled && onSelectDistrict) {
                    onSelectDistrict(name);
                  }
                }}
                style={{
                  cursor: isEnabled ? 'pointer' : 'not-allowed',
                  transform: (isHovered && isEnabled) ? 'translateY(-3.5px)' : 'none',
                  transition: 'transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), fill 0.2s ease'
                }}
              >
                {/* District Solid Filled Shape */}
                <path
                  d={pathD}
                  fill={fill}
                  fillOpacity={opacity}
                  stroke={isSelected ? '#ffffff' : '#ffffff'}
                  strokeWidth={isSelected ? '2' : '0.75'}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* District Name Label for Enabled Zones */}
                {isEnabled && (
                  <text
                    x={centroid[0]}
                    y={centroid[1]}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`district-centroid-label ${isSelected ? 'is-selected-text' : ''}`}
                    pointerEvents="none"
                  >
                    {name}
                  </text>
                )}
              </g>
            );
          })}

          {/* Centroid Pin & Animated Ripple for Selected District */}
          {activeCentroid && (
            <g transform={`translate(${activeCentroid[0]}, ${activeCentroid[1]})`} className="selected-pin-group" pointerEvents="none">
              {/* Expanding Ripple Circles */}
              <circle r="14" fill="#10b981" opacity="0.35" className="pin-pulse-ring" />
              <circle r="7" fill="#047857" stroke="#ffffff" strokeWidth="2" />
              <circle r="2.5" fill="#ffffff" />
            </g>
          )}
        </g>
      </svg>

      {/* Hover Tooltip Card */}
      <AnimatePresence>
        {hoveredDistrict && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="carto-district-tooltip"
            style={{
              left: `${Math.min(MAP_WIDTH - 140, Math.max(10, tooltipPos.x + 12))}px`,
              top: `${Math.min(MAP_HEIGHT - 60, Math.max(10, tooltipPos.y - 36))}px`
            }}
          >
            <div className="tooltip-title">{hoveredDistrict}</div>
            <div className="tooltip-status">
              {enabledPolygonsSet.has(hoveredDistrict) ? (
                <span className="text-doa-valid">✓ Commercial {cropName} Zone</span>
              ) : (
                <span className="text-doa-invalid">✕ Non-DOA survey zone</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
