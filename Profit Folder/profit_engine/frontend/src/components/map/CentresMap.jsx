import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { geoMercator, geoPath } from 'd3-geo';
import { ZoomIn, ZoomOut, RotateCcw, Truck, Navigation, Clock } from 'lucide-react';
import districtGeoJson from '../../data/lk-districts.geo.json';
import { ECONOMIC_CENTRES_GEO } from '../../data/centres';
import { resolveDistrictToPolygons } from '../../data/districtAliases';

export default function CentresMap({
  userCoords,
  userDistrict = 'Badulla',
  selectedCentreName,
  selectedCentreDetails,
  vehicleName = 'Transport Vehicle',
  rankedCentres = [],
  onSelectCentre
}) {
  const [hoveredCentre, setHoveredCentre] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const mapSvgRef = useRef(null);

  // Canvas bounds
  const MAP_WIDTH = 440;
  const MAP_HEIGHT = 560;

  // D3-Geo projection fitted cleanly to Sri Lanka bounds
  const { projection, featureData } = useMemo(() => {
    const proj = geoMercator().fitExtent(
      [[18, 20], [MAP_WIDTH - 18, MAP_HEIGHT - 20]],
      districtGeoJson
    );
    const gen = geoPath().projection(proj);

    const data = districtGeoJson.features.map(f => {
      const name = f.properties.name;
      const pathD = gen(f) || '';
      const [cx, cy] = gen.centroid(f) || [0, 0];
      return {
        feature: f,
        name,
        pathD,
        centroid: [Math.round(cx), Math.round(cy)]
      };
    });

    return { projection: proj, featureData: data };
  }, []);

  // Selected Economic Centre
  const selectedCentre = useMemo(() => {
    return ECONOMIC_CENTRES_GEO.find(c => c.name === selectedCentreName) || ECONOMIC_CENTRES_GEO[0];
  }, [selectedCentreName]);

  // Projected Farm Origin Point
  const userPoint = useMemo(() => {
    if (userCoords && userCoords.lat && userCoords.lon) {
      const [x, y] = projection([userCoords.lon, userCoords.lat]);
      return { x: Math.round(x), y: Math.round(y) };
    }
    const [x, y] = projection([81.0550, 6.9934]); // Default Badulla
    return { x: Math.round(x), y: Math.round(y) };
  }, [userCoords, projection]);

  // Projected Selected Economic Centre Destination Point
  const centrePoint = useMemo(() => {
    const [x, y] = projection([selectedCentre.lon, selectedCentre.lat]);
    return { x: Math.round(x), y: Math.round(y) };
  }, [selectedCentre, projection]);

  // Polygons corresponding to Farmer's District and Selected Centre's District
  const userPolygons = useMemo(() => {
    return new Set(resolveDistrictToPolygons(userDistrict));
  }, [userDistrict]);

  const targetPolygons = useMemo(() => {
    return new Set(resolveDistrictToPolygons(selectedCentre.district));
  }, [selectedCentre.district]);

  // Generate realistic Highway Corridor trajectory (not a straight line)
  const corridor = useMemo(() => {
    if (!userPoint || !centrePoint) return null;
    const dx = centrePoint.x - userPoint.x;
    const dy = centrePoint.y - userPoint.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 3) {
      return {
        pathD: `M ${userPoint.x} ${userPoint.y} L ${centrePoint.x} ${centrePoint.y}`,
        midPoint: { x: userPoint.x, y: userPoint.y },
        badgePos: { x: userPoint.x, y: userPoint.y - 35 },
        type: 'Local Trade Depot Corridor'
      };
    }

    // A. Local Mountain Passes (short distances, e.g. Badulla <-> Keppetipola / Nuwara Eliya)
    if (dist < 55) {
      const nx = -dy / dist;
      const ny = dx / dist;
      const bend = Math.min(10, Math.max(5, dist * 0.28));
      const cp1x = userPoint.x + dx * 0.33 + nx * bend;
      const cp1y = userPoint.y + dy * 0.33 + ny * bend;
      const cp2x = userPoint.x + dx * 0.67 - nx * bend;
      const cp2y = userPoint.y + dy * 0.67 - ny * bend;

      const pathD = `M ${userPoint.x.toFixed(1)} ${userPoint.y.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${centrePoint.x.toFixed(1)} ${centrePoint.y.toFixed(1)}`;
      const midPoint = {
        x: (userPoint.x + centrePoint.x) / 2 + nx * (bend * 0.35),
        y: (userPoint.y + centrePoint.y) / 2 + ny * (bend * 0.35)
      };
      // Place badge with ample vertical clearance so it never overlaps the pins
      const badgePos = {
        x: (userPoint.x + centrePoint.x) / 2 + 10,
        y: Math.min(userPoint.y, centrePoint.y) - 48
      };

      return {
        pathD,
        midPoint,
        badgePos,
        type: 'A5 / A16 Highland Winding Pass'
      };
    }

    // B. Inter-District National Highways with Topographic Waypoints
    const originDist = userDistrict || 'Badulla';
    const destDist = selectedCentre.district;

    // Badulla <-> Dambulla: Curves naturally along Mahiyanganaya / Randenigala valley corridor
    if ((originDist === 'Badulla' && destDist === 'Matale') || (originDist === 'Matale' && destDist === 'Badulla')) {
      const valleyWp = { x: 256, y: 338 };
      const pathD = `M ${userPoint.x.toFixed(1)} ${userPoint.y.toFixed(1)} Q ${valleyWp.x} ${valleyWp.y} ${centrePoint.x.toFixed(1)} ${centrePoint.y.toFixed(1)}`;
      const midPoint = {
        x: (userPoint.x + centrePoint.x + valleyWp.x * 2) / 4,
        y: (userPoint.y + centrePoint.y + valleyWp.y * 2) / 4
      };
      return {
        pathD,
        midPoint,
        badgePos: midPoint,
        type: 'A26 / A9 Mahaweli Valley Arterial Highway'
      };
    }

    // Badulla <-> Western / Colombo (Meegoda, Narahenpita, Rathmalana, Welisara):
    // Follows the A4 southern corridor (Beragala - Balangoda - Ratnapura - Avissawella)
    if (
      (originDist === 'Badulla' && ['Colombo', 'Gampaha'].includes(destDist)) ||
      (['Colombo', 'Gampaha'].includes(originDist) && destDist === 'Badulla')
    ) {
      const southPassWp = { x: 196, y: 442 };
      const pathD = `M ${userPoint.x.toFixed(1)} ${userPoint.y.toFixed(1)} Q ${southPassWp.x} ${southPassWp.y} ${centrePoint.x.toFixed(1)} ${centrePoint.y.toFixed(1)}`;
      const midPoint = {
        x: (userPoint.x + centrePoint.x + southPassWp.x * 2) / 4,
        y: (userPoint.y + centrePoint.y + southPassWp.y * 2) / 4
      };
      return {
        pathD,
        midPoint,
        badgePos: midPoint,
        type: 'A4 Southern Agrarian Trunk Highway'
      };
    }

    // C. General Highway Arc: Curving naturally around high mountain massifs
    const mx = (userPoint.x + centrePoint.x) / 2;
    const my = (userPoint.y + centrePoint.y) / 2;
    const nx = -dy / dist;
    const ny = dx / dist;

    // Mountain massif knot roughly at (215, 395)
    const toMassifX = 215 - mx;
    const toMassifY = 395 - my;
    const dot = nx * toMassifX + ny * toMassifY;
    const bendSign = dot >= 0 ? -1 : 1;
    const bendMag = Math.min(28, Math.max(12, dist * 0.16));

    const cx = mx + nx * bendMag * bendSign;
    const cy = my + ny * bendMag * bendSign;

    const pathD = `M ${userPoint.x.toFixed(1)} ${userPoint.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${centrePoint.x.toFixed(1)} ${centrePoint.y.toFixed(1)}`;
    const midPoint = { x: (mx + cx) / 2, y: (my + cy) / 2 };
    return {
      pathD,
      midPoint,
      badgePos: midPoint,
      type: 'National Agrarian Freight Corridor'
    };
  }, [userPoint, centrePoint, userDistrict, selectedCentre]);

  // Route metrics from props or ranked list
  const activeDetails = useMemo(() => {
    if (selectedCentreDetails) return selectedCentreDetails;
    return rankedCentres.find(rc => rc.name === selectedCentreName) || {
      distanceKm: 22,
      travelTime: '35 mins',
      freightCost: 815,
      isEstimated: true
    };
  }, [selectedCentreDetails, rankedCentres, selectedCentreName]);

  // Drag and pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
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
    setIsDragging(false);
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="centres-carto-card" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Zoom / Pan Toolbar */}
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
        className="centres-svg-map"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{ cursor: isDragging ? 'grabbing' : 'default' }}
      >
        <defs>
          {/* 1. Maritime Ocean Gradient */}
          <linearGradient id="oceanGradCentres" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="50%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>

          {/* 2. Farmer's Origin District Fill */}
          <linearGradient id="farmDistrictGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a7f3d0" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>

          {/* 3. Selected Economic Centre District Fill */}
          <linearGradient id="hubDistrictGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>

          {/* 4. Island Drop Shadow */}
          <filter id="islandShadowCentres" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#0f172a" floodOpacity="0.16" />
          </filter>

          {/* 5. Highway Route Aura Glow */}
          <filter id="corridorGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* 6. Route Badge Drop Shadow */}
          <filter id="badgeDropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#0f172a" floodOpacity="0.25" />
          </filter>

          {/* 7. Pin Shadow */}
          <filter id="pinShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Ocean Background Canvas */}
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#oceanGradCentres)" />

        {/* Subtle Ocean Wave Lines */}
        <g opacity="0.4" stroke="#38bdf8" strokeWidth="1" fill="none">
          <path d="M 15 80 Q 40 75 65 80 T 115 80" strokeDasharray="3 4" />
          <path d="M 20 200 Q 50 195 80 200 T 130 200" strokeDasharray="4 6" />
          <path d="M 320 90 Q 350 85 380 90 T 430 90" strokeDasharray="3 5" />
          <path d="M 330 240 Q 365 235 400 240" strokeDasharray="4 6" />
          <path d="M 25 540 Q 65 535 105 540 T 165 540" strokeDasharray="4 5" />
        </g>

        {/* Ocean Labels */}
        <text x="24" y="125" className="ocean-label palk-strait">Palk Strait</text>
        <text x="310" y="575" className="ocean-label indian-ocean">Indian Ocean</text>
        <text x="30" y="390" className="ocean-label gulf-mannar">Gulf of Mannar</text>

        {/* Compass Rose */}
        <g transform="translate(390, 65)" className="compass-rose-group" opacity="0.7">
          <circle r="18" fill="#ffffff" fillOpacity="0.75" stroke="#0284c7" strokeWidth="1" />
          <polygon points="0,-16 3,-4 0,0 -3,-4" fill="#0284c7" />
          <polygon points="0,-16 0,0 -3,-4" fill="#0369a1" />
          <polygon points="0,16 3,4 0,0 -3,4" fill="#94a3b8" />
          <polygon points="16,0 4,3 0,0 4,-3" fill="#94a3b8" />
          <polygon points="-16,0 -4,3 0,0 -4,-3" fill="#94a3b8" />
          <text x="0" y="-18" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0369a1">N</text>
        </g>

        {/* Island & Network Layer with Pan / Zoom */}
        <g
          filter="url(#islandShadowCentres)"
          transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}
          style={{ transformOrigin: `${MAP_WIDTH / 2}px ${MAP_HEIGHT / 2}px`, transition: isDragging ? 'none' : 'transform 0.15s ease-out' }}
        >
          {/* 1. All 25 District Polygons */}
          {featureData.map(({ name, pathD, centroid }) => {
            const isUserDistrict = userPolygons.has(name);
            const isTargetDistrict = targetPolygons.has(name);

            let fill = '#f8fafc';
            let stroke = '#cbd5e1';
            let strokeWidth = '0.75';
            let fillOpacity = 0.9;

            if (isUserDistrict) {
              fill = 'url(#farmDistrictGrad)';
              stroke = '#059669';
              strokeWidth = '1.5';
              fillOpacity = 1.0;
            } else if (isTargetDistrict) {
              fill = 'url(#hubDistrictGrad)';
              stroke = '#d97706';
              strokeWidth = '1.5';
              fillOpacity = 1.0;
            }

            return (
              <g key={name} className="district-polygon-node">
                <path
                  d={pathD}
                  fill={fill}
                  fillOpacity={fillOpacity}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Subtle District Name watermark */}
                <text
                  x={centroid[0]}
                  y={centroid[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="7"
                  fill={isUserDistrict ? '#047857' : isTargetDistrict ? '#92400e' : '#94a3b8'}
                  fontWeight={isUserDistrict || isTargetDistrict ? '700' : '500'}
                  pointerEvents="none"
                  opacity={isUserDistrict || isTargetDistrict ? 0.95 : 0.6}
                >
                  {name}
                </text>
              </g>
            );
          })}

          {/* 2. REALISTIC MULTI-LAYER HIGHWAY ROAD TRANSIT CORRIDOR */}
          {corridor && (
            <g className="highway-corridor-system">
              {/* Layer A: Atmospheric Roadway Glow */}
              <path
                d={corridor.pathD}
                fill="none"
                stroke="#10b981"
                strokeWidth="14"
                strokeLinecap="round"
                opacity="0.28"
                filter="url(#corridorGlow)"
              />

              {/* Layer B: Heavy Dark Asphalt Foundation / Casing */}
              <path
                d={corridor.pathD}
                fill="none"
                stroke="#0f172a"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Layer C: Paved Highway Surface Bed */}
              <path
                d={corridor.pathD}
                fill="none"
                stroke="#334155"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Layer D: Active Emerald Logistics Transit Lane */}
              <path
                d={corridor.pathD}
                fill="none"
                stroke="#059669"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Layer E: Flowing Neon White Centerline (Live Dynamic Traffic Animation) */}
              <path
                d={corridor.pathD}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray="6 7"
                className="corridor-highway-flow"
              />

              {/* Layer F: Animated Delivery Vehicle Driving Along the Corridor */}
              <g className="corridor-moving-vehicle">
                <animateMotion
                  dur={`${Math.max(3.2, Math.min(7.5, (activeDetails.distanceKm || 25) / 16))}s`}
                  repeatCount="indefinite"
                  path={corridor.pathD}
                  rotate="auto"
                />
                <g transform="translate(-11, -8)" filter="url(#pinShadow)">
                  {/* Truck Body */}
                  <rect x="0" y="0" width="22" height="16" rx="4" fill="#047857" stroke="#ffffff" strokeWidth="1.5" />
                  {/* Cargo Divider */}
                  <line x1="8" y1="0" x2="8" y2="16" stroke="#065f46" strokeWidth="1" />
                  {/* Windshield */}
                  <rect x="14" y="3" width="5" height="10" rx="1.5" fill="#a7f3d0" />
                  {/* Headlights / Forward Arrow */}
                  <polygon points="17,5 21,8 17,11" fill="#fef08a" />
                  {/* Wheels */}
                  <circle cx="4.5" cy="0" r="1.8" fill="#0f172a" />
                  <circle cx="4.5" cy="16" r="1.8" fill="#0f172a" />
                  <circle cx="16.5" cy="0" r="1.8" fill="#0f172a" />
                  <circle cx="16.5" cy="16" r="1.8" fill="#0f172a" />
                </g>
              </g>

              {/* Layer G: Floating Interactive Highway Corridor Badge (Distance, Time, Freight) */}
              <g
                transform={`translate(${corridor.badgePos ? corridor.badgePos.x : corridor.midPoint.x}, ${corridor.badgePos ? corridor.badgePos.y : corridor.midPoint.y})`}
                className="corridor-route-badge-node"
                pointerEvents="none"
              >
                {/* Background Shadow Pill */}
                <rect
                  x="-75"
                  y="-34"
                  width="150"
                  height="23"
                  rx="8"
                  fill="#0f172a"
                  fillOpacity="0.94"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  filter="url(#badgeDropShadow)"
                />
                {/* Highway Distance & Time */}
                <text x="0" y="-19" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff">
                  🛣️ {activeDetails.distanceKm} km {activeDetails.isEstimated ? '(est.)' : ''} • {activeDetails.travelTime}
                </text>
                
              </g>
            </g>
          )}

          {/* 3. All 14 Dedicated Economic Centres */}
          {ECONOMIC_CENTRES_GEO.map(c => {
            const [cx, cy] = projection([c.lon, c.lat]);
            const isSelected = c.name === selectedCentreName;
            const shortName = c.name.replace(' Dedicated Economic Centre', '').replace(' Economic Centre', '');
            const isKeyRegionalHub = ['dambulla_ec', 'thambuttegama_ec', 'ampara_ec', 'embilipitiya_ec', 'nuwara_eliya_ec', 'keppetipola_ec', 'kurunduwatta_ec'].includes(c.id);

            return (
              <g
                key={c.id}
                className={`centre-marker-node ${isSelected ? 'is-selected-centre' : ''}`}
                onClick={() => onSelectCentre && onSelectCentre(c)}
                onMouseEnter={() => setHoveredCentre(c)}
                onMouseLeave={() => setHoveredCentre(null)}
                style={{ cursor: 'pointer' }}
              >
                {isSelected ? (
                  // Prominent Destination Market Terminal Pin
                  <g transform={`translate(${cx}, ${cy})`} filter="url(#pinShadow)">
                    {/* Animated Pulsing Radar Rings */}
                    <circle cx="0" cy="0" r="22" fill="#d97706" opacity="0.25" className="hub-radar-pulse" />
                    <circle cx="0" cy="0" r="14" fill="#f59e0b" opacity="0.4" />
                    {/* Main Hub Core */}
                    <circle cx="0" cy="0" r="8" fill="#b45309" stroke="#ffffff" strokeWidth="2.5" />
                    <circle cx="0" cy="0" r="3.5" fill="#fef3c7" />

                    
                  </g>
                ) : (
                  // Secondary Market Hub Node
                  <g transform={`translate(${cx}, ${cy})`}>
                    <circle
                      cx="0"
                      cy="0"
                      r="4.5"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="hub-circle-node"
                    />
                    {isKeyRegionalHub && (
                      <text
                        x="0"
                        y="-7"
                        textAnchor="middle"
                        fontSize="7"
                        fontWeight="600"
                        fill="#475569"
                        pointerEvents="none"
                      >
                        {shortName}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* 4. Farmer's Origin Farm Plot Pin */}
          <g transform={`translate(${userPoint.x}, ${userPoint.y})`} className="farm-origin-marker" filter="url(#pinShadow)">
            {/* Concentric Pulsing Radar Rings */}
            <circle cx="0" cy="0" r="16" fill="#10b981" opacity="0.35" className="pin-pulse-ring" />
            <circle cx="0" cy="0" r="8" fill="#059669" stroke="#ffffff" strokeWidth="2.5" />
            <circle cx="0" cy="0" r="3" fill="#ffffff" />

            {/* Farm Origin Badge Positioned Below Pin for Zero Overlap */}
            <g transform="translate(0, 13)">
              <rect
                x="-38"
                y="-1"
                width="76"
                height="16"
                rx="8"
                fill="#047857"
                stroke="#ffffff"
                strokeWidth="1.2"
                filter="url(#badgeDropShadow)"
              />
              <text x="0" y="10.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#ffffff">
                🌱 Your Farm
              </text>
            </g>
          </g>
        </g>
      </svg>

      {/* Hover Tooltip for Other Centres */}
      <AnimatePresence>
        {hoveredCentre && hoveredCentre.name !== selectedCentreName && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="carto-centre-tooltip"
            style={{
              left: `${Math.min(MAP_WIDTH - 150, Math.max(10, tooltipPos.x + 12))}px`,
              top: `${Math.min(MAP_HEIGHT - 60, Math.max(10, tooltipPos.y - 36))}px`
            }}
          >
            <div className="tooltip-centre-name">🏪 {hoveredCentre.name}</div>
            <div className="tooltip-centre-sub">
              <span>{hoveredCentre.district} • {hoveredCentre.role}</span>
            </div>
            <div className="tooltip-centre-action">Click to reroute transit corridor here</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corridor Telemetry Bar */}
      <div className="corridor-telemetry-bar">
        <div className="telemetry-item">
          <span className="telemetry-label">Active Route</span>
          <span className="telemetry-val text-emerald">
            <Truck size={13} /> {corridor?.type || 'Transit Highway'}
          </span>
        </div>
        <div className="telemetry-item">
          <span className="telemetry-label">Road Distance</span>
          <span className="telemetry-val">
            <Navigation size={13} color="#059669" /> {activeDetails.distanceKm} km {activeDetails.isEstimated ? '(est.)' : ''}
          </span>
        </div>
        <div className="telemetry-item">
          <span className="telemetry-label">Est. Duration</span>
          <span className="telemetry-val">
            <Clock size={13} color="#2563eb" /> {activeDetails.travelTime}
          </span>
        </div>
      </div>
    </div>
  );
}

