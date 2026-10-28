import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fuel, Package, Sparkles } from 'lucide-react';
import { getVehicleHotspots } from '../../data/vehicleHotspots';

/**
 * High-Quality 2.5D Stylized Vector Vehicle Illustrator
 * Renders real recognizable vehicles (wheels, cab, windows, cargo deck)
 * for each vehicle in the fleet, with interactive hotspots.
 */
export default function Vehicle2DIllustration({
  vehicle,
  focusArea = 'default',
  fuelPrice = 315.0,
  onSelectHotspot
}) {
  const hotspots = getVehicleHotspots(vehicle.id);
  const isDiesel = (vehicle.fuel_type || '').toLowerCase().includes('diesel');
  const fuelRate = isDiesel ? fuelPrice : 360.0;

  const vId = vehicle.id;
  const isTuk = vId.includes('bajaj_re');
  const isBike = vId.includes('ct100');
  const isBolero = vId.includes('bolero');
  const isLorry = vId.includes('shared_lorry') || vId.includes('elf');
  const isKei = vId.includes('suzuki_carry');
  const isBatta = vId.includes('batta') || vId.includes('batti') || vId.includes('ace');

  return (
    <div className="vehicle-illustration-canvas">
      {/* Studio Lighting Background Circle */}
      <div className="studio-floor-disc" />

      <svg
        viewBox="0 0 620 340"
        className={`vehicle-svg-scene focus-${focusArea}`}
        aria-label={`${vehicle.name} vehicle model view`}
      >
        <defs>
          {/* Wheel gradients */}
          <radialGradient id="tireGrad" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </radialGradient>
          <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="80%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </radialGradient>

          {/* Windshield glass reflection */}
          <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#e0f2fe" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
          </linearGradient>

          {/* Bodywork Paint Gradients */}
          <linearGradient id="blueCabGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="whiteCabGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="greenTukGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <linearGradient id="redPikGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>

          {/* Studio Shadow Filter */}
          <filter id="studioShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
            <feOffset dx="0" dy="10" />
            <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ground Contact Shadow */}
        <ellipse cx="310" cy="285" rx="240" ry="24" fill="#0f172a" opacity="0.25" filter="url(#studioShadow)" />

        {/* ---------------- 1. BAJAJ THREE-WHEELER (TUK-TUK) ---------------- */}
        {isTuk && (
          <g transform="translate(70, 45)">
            {/* Rear Wheels */}
            <circle cx="340" cy="225" r="34" fill="url(#tireGrad)" />
            <circle cx="340" cy="225" r="18" fill="url(#rimGrad)" stroke="#475569" strokeWidth="2" />
            <circle cx="340" cy="225" r="6" fill="#1e293b" />

            {/* Main Passenger & Cargo Cabin Body */}
            <path d="M 120 180 L 140 100 Q 155 75 220 75 L 360 75 Q 385 75 390 110 L 395 210 Q 395 230 375 230 L 160 230 Q 130 230 120 180 Z"
              fill={vehicle.id.includes('diesel') ? "url(#blueCabGrad)" : "url(#greenTukGrad)"}
              stroke="#0f172a" strokeWidth="3" />

            {/* Black Canvas Canopy Roof */}
            <path d="M 135 105 Q 155 65 220 65 L 365 65 Q 395 65 400 105 L 135 105 Z"
              fill="#1e293b" stroke="#0f172a" strokeWidth="2" />

            {/* Front Single Wheel with Fork */}
            <line x1="105" y1="165" x2="85" y2="230" stroke="#64748b" strokeWidth="8" strokeLinecap="round" />
            <path d="M 60 215 Q 85 190 110 215" fill="#334155" stroke="#0f172a" strokeWidth="2" />
            <circle cx="85" cy="230" r="30" fill="url(#tireGrad)" />
            <circle cx="85" cy="230" r="16" fill="url(#rimGrad)" stroke="#475569" strokeWidth="2" />
            <circle cx="85" cy="230" r="5" fill="#1e293b" />

            {/* Windshield Glass */}
            <path d="M 130 170 L 145 105 L 210 105 L 195 170 Z" fill="url(#glassGrad)" stroke="#0f172a" strokeWidth="2" />
            <line x1="165" y1="110" x2="160" y2="155" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />

            {/* Passenger Entry Opening */}
            <path d="M 225 105 L 310 105 L 310 195 L 215 195 Z" fill="#0f172a" opacity="0.85" />
            <rect x="235" y="155" width="70" height="35" rx="4" fill="#78350f" />

            {/* Rear Cargo Compartment Door */}
            <rect x="330" y="115" width="55" height="75" rx="4" fill="#1e293b" stroke="#ffffff" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="375" cy="150" r="3" fill="#cbd5e1" />

            {/* Chrome Headlight */}
            <circle cx="95" cy="175" r="12" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
            <circle cx="95" cy="175" r="6" fill="#ffffff" />
          </g>
        )}

        {/* ---------------- 2. BAJAJ CT100 MOTORBIKE ---------------- */}
        {isBike && (
          <g transform="translate(85, 55)">
            {/* Rear Wheel with Spokes */}
            <circle cx="340" cy="210" r="42" fill="none" stroke="#1e293b" strokeWidth="14" />
            <circle cx="340" cy="210" r="34" fill="#ffffff" fillOpacity="0.1" stroke="#94a3b8" strokeWidth="2" />
            <line x1="340" y1="176" x2="340" y2="244" stroke="#64748b" strokeWidth="2" />
            <line x1="306" y1="210" x2="374" y2="210" stroke="#64748b" strokeWidth="2" />
            <circle cx="340" cy="210" r="10" fill="#334155" />

            {/* Front Wheel with Fork */}
            <circle cx="100" cy="210" r="42" fill="none" stroke="#1e293b" strokeWidth="14" />
            <circle cx="100" cy="210" r="34" fill="#ffffff" fillOpacity="0.1" stroke="#94a3b8" strokeWidth="2" />
            <line x1="100" y1="176" x2="100" y2="244" stroke="#64748b" strokeWidth="2" />
            <line x1="66" y1="210" x2="134" y2="210" stroke="#64748b" strokeWidth="2" />
            <circle cx="100" cy="210" r="10" fill="#334155" />

            {/* Front Telescopic Fork */}
            <line x1="100" y1="210" x2="135" y2="105" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
            <line x1="135" y1="105" x2="145" y2="90" stroke="#1e293b" strokeWidth="5" />

            {/* Chassis & Engine Block */}
            <polygon points="135,105 210,140 250,210 180,210" fill="#334155" stroke="#0f172a" strokeWidth="3" />
            <rect x="180" y="160" width="40" height="30" rx="3" fill="#64748b" stroke="#1e293b" strokeWidth="2" />

            {/* Exhaust Pipe */}
            <path d="M 205 185 L 290 205 L 350 205" fill="none" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />

            {/* Metallic Teardrop Petrol Tank */}
            <path d="M 140 100 Q 180 75 220 100 Q 235 125 180 125 Q 140 125 140 100 Z"
              fill="url(#redPikGrad)" stroke="#0f172a" strokeWidth="3" />
            <circle cx="180" cy="94" r="5" fill="#f8fafc" stroke="#475569" strokeWidth="1" />

            {/* Commuter Seat */}
            <path d="M 220 105 Q 270 100 310 110 L 305 130 L 220 125 Z" fill="#0f172a" stroke="#334155" strokeWidth="2" />

            {/* Rear Cargo Carrier Rack */}
            <line x1="305" y1="115" x2="365" y2="115" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
            <line x1="330" y1="115" x2="330" y2="140" stroke="#cbd5e1" strokeWidth="3" />
            {/* Cargo sacks on rack */}
            <ellipse cx="340" cy="100" rx="22" ry="12" fill="#ca8a04" stroke="#78350f" strokeWidth="2" />

            {/* Headlight */}
            <circle cx="120" cy="102" r="10" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
          </g>
        )}

        {/* ---------------- 3. DIMO BATTA / TATA ACE / SUZUKI CARRY MINI TRUCK ---------------- */}
        {(isBatta || isKei) && (
          <g transform="translate(50, 45)">
            {/* Front Wheel */}
            <circle cx="130" cy="225" r="36" fill="url(#tireGrad)" />
            <circle cx="130" cy="225" r="18" fill="url(#rimGrad)" stroke="#475569" strokeWidth="2" />
            <circle cx="130" cy="225" r="6" fill="#1e293b" />

            {/* Rear Wheel */}
            <circle cx="410" cy="225" r="36" fill="url(#tireGrad)" />
            <circle cx="410" cy="225" r="18" fill="url(#rimGrad)" stroke="#475569" strokeWidth="2" />
            <circle cx="410" cy="225" r="6" fill="#1e293b" />

            {/* Chassis Main Rails */}
            <rect x="90" y="200" width="370" height="18" rx="4" fill="#334155" stroke="#0f172a" strokeWidth="2" />

            {/* Diesel/Petrol Fuel Tank on Chassis */}
            <rect x="200" y="198" width="55" height="20" rx="5" fill="#475569" stroke="#0f172a" strokeWidth="2" />
            <circle cx="212" cy="208" r="4" fill={isDiesel ? "#f59e0b" : "#22c55e"} />

            {/* Driver Cab */}
            <path d="M 80 205 L 80 145 Q 82 85 145 80 L 195 80 L 195 205 Z"
              fill={isKei ? "url(#whiteCabGrad)" : "url(#blueCabGrad)"}
              stroke="#0f172a" strokeWidth="3" />

            {/* Windshield & Side Window */}
            <path d="M 88 135 L 138 88 L 185 88 L 185 135 Z" fill="url(#glassGrad)" stroke="#0f172a" strokeWidth="2" />
            <line x1="140" y1="90" x2="140" y2="135" stroke="#334155" strokeWidth="2" />
            <line x1="115" y1="130" x2="95" y2="105" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />

            {/* Door Seam & Handle */}
            <line x1="145" y1="138" x2="145" y2="202" stroke="#1e293b" strokeWidth="2" />
            <rect x="155" y="150" width="14" height="4" rx="2" fill="#0f172a" />

            {/* Front Headlights & Bumper */}
            <rect x="68" y="175" width="14" height="18" rx="3" fill="#fef08a" stroke="#eab308" strokeWidth="2" />
            <rect x="62" y="198" width="28" height="15" rx="3" fill="#1e293b" />

            {/* Flatbed Cargo Deck Body */}
            <rect x="205" y="125" width="265" height="75" rx="4" fill="#cbd5e1" stroke="#0f172a" strokeWidth="3" />
            {/* Drop-side Panels Texture */}
            <line x1="205" y1="150" x2="470" y2="150" stroke="#94a3b8" strokeWidth="2" />
            <line x1="205" y1="175" x2="470" y2="175" stroke="#94a3b8" strokeWidth="2" />
            <line x1="290" y1="125" x2="290" y2="200" stroke="#64748b" strokeWidth="2" />
            <line x1="380" y1="125" x2="380" y2="200" stroke="#64748b" strokeWidth="2" />

            {/* Headboard Cab Protector */}
            <rect x="198" y="75" width="8" height="125" rx="2" fill="#475569" stroke="#0f172a" strokeWidth="2" />

            {/* Produce Sacks / Harvest Crates in Cargo Deck */}
            <rect x="220" y="98" width="35" height="27" rx="3" fill="#16a34a" stroke="#14532d" strokeWidth="1.5" />
            <rect x="260" y="98" width="35" height="27" rx="3" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.5" />
            <rect x="300" y="98" width="35" height="27" rx="3" fill="#f97316" stroke="#9a3412" strokeWidth="1.5" />
            <rect x="340" y="98" width="35" height="27" rx="3" fill="#eab308" stroke="#854d0e" strokeWidth="1.5" />
          </g>
        )}

        {/* ---------------- 4. MAHINDRA BOLERO PIK-UP ---------------- */}
        {isBolero && (
          <g transform="translate(45, 45)">
            {/* Big Heavy-Duty Tires */}
            <circle cx="140" cy="225" r="40" fill="url(#tireGrad)" />
            <circle cx="140" cy="225" r="22" fill="url(#rimGrad)" stroke="#475569" strokeWidth="2" />
            <circle cx="140" cy="225" r="7" fill="#1e293b" />

            <circle cx="410" cy="225" r="40" fill="url(#tireGrad)" />
            <circle cx="410" cy="225" r="22" fill="url(#rimGrad)" stroke="#475569" strokeWidth="2" />
            <circle cx="410" cy="225" r="7" fill="#1e293b" />

            {/* Sturdy Chassis */}
            <rect x="75" y="195" width="410" height="22" rx="4" fill="#334155" stroke="#0f172a" strokeWidth="2" />

            {/* Long Bonnet Hood + Cab */}
            <path d="M 65 180 L 65 145 L 140 145 L 175 85 L 245 85 L 245 195 L 65 195 Z"
              fill="url(#redPikGrad)" stroke="#0f172a" strokeWidth="3" />

            {/* Windshield & Windows */}
            <polygon points="145,140 178,92 235,92 235,140" fill="url(#glassGrad)" stroke="#0f172a" strokeWidth="2" />

            {/* Front Bolero Vertical Grille */}
            <rect x="60" y="145" width="6" height="35" fill="#f8fafc" stroke="#334155" strokeWidth="1" />
            <rect x="52" y="148" width="12" height="15" rx="2" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
            <rect x="48" y="185" width="22" height="15" rx="3" fill="#1e293b" />

            {/* High-Walled Metal Utility Cargo Bed */}
            <rect x="250" y="110" width="230" height="85" rx="4" fill="#b91c1c" stroke="#0f172a" strokeWidth="3" />
            <rect x="255" y="115" width="220" height="75" fill="#991b1b" stroke="#7f1d1d" strokeWidth="1" />

            {/* Harvest Crates Loaded */}
            <rect x="270" y="85" width="45" height="30" rx="3" fill="#d97706" stroke="#78350f" strokeWidth="1.5" />
            <rect x="325" y="85" width="45" height="30" rx="3" fill="#16a34a" stroke="#14532d" strokeWidth="1.5" />
            <rect x="380" y="85" width="45" height="30" rx="3" fill="#eab308" stroke="#854d0e" strokeWidth="1.5" />
          </g>
        )}

        {/* ---------------- 5. SHARED COMMERCIAL FREIGHT LORRY ---------------- */}
        {isLorry && (
          <g transform="translate(35, 35)">
            {/* Front Wheel */}
            <circle cx="115" cy="245" r="38" fill="url(#tireGrad)" />
            <circle cx="115" cy="245" r="20" fill="url(#rimGrad)" stroke="#475569" strokeWidth="2" />

            {/* Rear Tandem Dual Wheels */}
            <circle cx="390" cy="245" r="38" fill="url(#tireGrad)" />
            <circle cx="390" cy="245" r="20" fill="url(#rimGrad)" stroke="#475569" strokeWidth="2" />
            <circle cx="455" cy="245" r="38" fill="url(#tireGrad)" />
            <circle cx="455" cy="245" r="20" fill="url(#rimGrad)" stroke="#475569" strokeWidth="2" />

            {/* Heavy Freight Chassis */}
            <rect x="60" y="215" width="460" height="24" rx="4" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />

            {/* Fuel Tank (Large Heavy Commercial Tank) */}
            <rect x="180" y="210" width="75" height="28" rx="6" fill="#475569" stroke="#0f172a" strokeWidth="2" />
            <circle cx="195" cy="224" r="5" fill="#f59e0b" />

            {/* High Commercial Cab */}
            <path d="M 65 215 L 65 95 Q 68 65 110 65 L 165 65 L 165 215 Z"
              fill="#059669" stroke="#0f172a" strokeWidth="3" />

            {/* Windshield & Windows */}
            <path d="M 72 90 L 105 72 L 155 72 L 155 135 L 72 135 Z" fill="url(#glassGrad)" stroke="#0f172a" strokeWidth="2" />
            {/* Sun visor */}
            <polygon points="60,72 165,72 165,65 60,65" fill="#047857" stroke="#064e3b" strokeWidth="1" />

            {/* Large Wooden / Steel Wholesale Produce Cage */}
            <rect x="175" y="45" width="340" height="170" rx="4" fill="#d97706" stroke="#0f172a" strokeWidth="3" />
            {/* Stake Vertical Slats */}
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={i} x1={205 + i * 36} y1="45" x2={205 + i * 36} y2="215" stroke="#78350f" strokeWidth="4" />
            ))}
            <line x1="175" y1="100" x2="515" y2="100" stroke="#78350f" strokeWidth="3" />
            <line x1="175" y1="160" x2="515" y2="160" stroke="#78350f" strokeWidth="3" />
          </g>
        )}

        {/* ---------------- HOTSPOT 1: FUEL TANK MARKER ---------------- */}
        <g
          transform={`translate(${hotspots.svgHotspots.tank.x * 6.2}, ${hotspots.svgHotspots.tank.y * 3.4})`}
          className={`vehicle-hotspot-svg ${focusArea === 'tank' ? 'is-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onSelectHotspot('tank'); }}
          style={{ cursor: 'pointer' }}
        >
          <circle r="18" fill="#f59e0b" opacity="0.25" className="hotspot-pulse-circle" />
          <circle r="11" fill={focusArea === 'tank' ? '#f59e0b' : '#ffffff'} stroke="#d97706" strokeWidth="2.5" />
          <path d="M -4 -4 L 4 -4 L 4 4 L -4 4 Z" fill={focusArea === 'tank' ? '#ffffff' : '#d97706'} />
        </g>

        {/* ---------------- HOTSPOT 2: CARGO STORAGE MARKER ---------------- */}
        <g
          transform={`translate(${hotspots.svgHotspots.storage.x * 6.2}, ${hotspots.svgHotspots.storage.y * 3.4})`}
          className={`vehicle-hotspot-svg ${focusArea === 'storage' ? 'is-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onSelectHotspot('storage'); }}
          style={{ cursor: 'pointer' }}
        >
          <circle r="18" fill="#10b981" opacity="0.25" className="hotspot-pulse-circle" />
          <circle r="11" fill={focusArea === 'storage' ? '#10b981' : '#ffffff'} stroke="#059669" strokeWidth="2.5" />
          <path d="M -4 -4 L 4 -4 L 4 4 L -4 4 Z" fill={focusArea === 'storage' ? '#ffffff' : '#059669'} />
        </g>
      </svg>

      {/* Interactive Floating Hotspot Info Card */}
      <AnimatePresence>
        {focusArea === 'tank' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="vehicle-floating-card card-fuel"
          >
            <div className="card-header">
              <Fuel size={16} color="#d97706" />
              <h4>{hotspots.tank.label}</h4>
            </div>
            <div className="card-body">
              <div className="spec-row">
                <span>Fuel Grade:</span>
                <strong>{vehicle.fuel_type}</strong>
              </div>
              <div className="spec-row">
                <span>Current Fuel Price:</span>
                <strong>LKR {fuelRate.toFixed(2)} / L</strong>
              </div>
              <div className="spec-row">
                <span>Practical Economy:</span>
                <strong className="text-emerald">{hotspots.fuelEconomy}</strong>
              </div>
            </div>
          </motion.div>
        )}

        {focusArea === 'storage' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="vehicle-floating-card card-storage"
          >
            <div className="card-header">
              <Package size={16} color="#059669" />
              <h4>{hotspots.storage.label}</h4>
            </div>
            <div className="card-body">
              <div className="spec-row">
                <span>Max Payload Capacity:</span>
                <strong className="text-emerald">{vehicle.payload_kg?.toLocaleString()} kg</strong>
              </div>
              <div className="spec-row">
                <span>Estimated Volume:</span>
                <strong>{hotspots.cargoVolume}</strong>
              </div>
              <div className="spec-row">
                <span>Typical Freight:</span>
                <span>{vehicle.typical_use}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
