import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import ModularSoilPlot from './ModularSoilPlot';
import StylizedCropGrid from './StylizedCropGrid';
import SmartWeatherStation from './SmartWeatherStation';
import { getCropConfig } from './crops/registry';

/**
 * Animated Field Container
 * Smoothly interpolates physical 3D dimensions when the farmer adjusts field acreage.
 */
function AnimatedFieldGroup({ groupScale = 1.0, children }) {
  const groupRef = useRef();

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.scale.lerp(
        new THREE.Vector3(groupScale, groupScale, groupScale),
        Math.min(1.0, delta * 9.0)
      );
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.32, 0]}>
      {children}
    </group>
  );
}

/**
 * 2D High-Quality Stylized Vector Fallback
 * Dynamically scales isometric grid dimension and plot scale with acreage.
 */
export function Field2DFallback({ crop = 'Tomato', acreage = 1.0, yieldFactor = 1.0 }) {
  const cfg = getCropConfig(crop);

  // Dynamic grid dimension based on acreage
  const gSize = acreage <= 0.5 ? 3 : (acreage <= 1.75 ? 4 : (acreage <= 3.5 ? 5 : 6));
  const svgScale = Math.min(1.22, Math.max(0.78, Math.pow(acreage, 0.16)));
  const isoTileW = gSize === 3 ? 50 : (gSize === 4 ? 40 : (gSize === 5 ? 32 : 27));
  const isoTileH = isoTileW * 0.55;

  const totalPolyW = gSize * isoTileW;
  const totalPolyH = gSize * isoTileH;

  return (
    <div className="field-2d-fallback-canvas" style={{ position: 'relative', width: '100%', height: '400px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <svg viewBox="0 0 540 340" width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="mintStudioGrad" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#2ea47e" />
            <stop offset="60%" stopColor="#1a6f54" />
            <stop offset="100%" stopColor="#114b38" />
          </radialGradient>
          <linearGradient id="clayBaseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b46d3e" />
            <stop offset="100%" stopColor="#7a421e" />
          </linearGradient>
          <linearGradient id="moundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#804921" />
            <stop offset="100%" stopColor="#542b10" />
          </linearGradient>
          <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feOffset dx="0" dy="6" />
            <feComponentTransfer><feFuncA type="linear" slope="0.3" /></feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Studio Mint Backdrop */}
        <rect width="540" height="340" rx="16" fill="url(#mintStudioGrad)" />

        {/* Ground Contact Shadow */}
        <ellipse cx="270" cy="275" rx={180 * svgScale} ry={38 * svgScale} fill="#062e22" opacity="0.45" />

        {/* Floating Isometric Modular Slab */}
        <g transform={`translate(270, 165) scale(${svgScale})`} filter="url(#softShadow)">
          {/* Base Pedestal Thickness */}
          <polygon
            points={`-${totalPolyW},${totalPolyH * 0.4} 0,${totalPolyH} ${totalPolyW},${totalPolyH * 0.4} ${totalPolyW},${totalPolyH * 0.4 + 18} 0,${totalPolyH + 18} -${totalPolyW},${totalPolyH * 0.4 + 18}`}
            fill="#5c2e12"
          />
          <polygon
            points={`0,${totalPolyH} ${totalPolyW},${totalPolyH * 0.4} ${totalPolyW},${totalPolyH * 0.4 + 18} 0,${totalPolyH + 18}`}
            fill="#44210c"
          />

          {/* Top Surface Rhombus Base */}
          <polygon
            points={`0,-${totalPolyH * 0.35} ${totalPolyW},${totalPolyH * 0.4} 0,${totalPolyH} -${totalPolyW},${totalPolyH * 0.4}`}
            fill="url(#clayBaseGrad)"
            stroke="#7a421e"
            strokeWidth="2"
          />

          {/* Dynamic Modular Tile Grid */}
          {Array.from({ length: gSize }).map((_, r) => {
            return Array.from({ length: gSize }).map((_, c) => {
              const isoX = (c - r) * (isoTileW * 0.95);
              const isoY = (c + r) * (isoTileH * 0.95) - (gSize * isoTileH * 0.3);

              const isWeatherStation = r === 0 && c === gSize - 1;

              return (
                <g key={`${r}-${c}`} transform={`translate(${isoX}, ${isoY})`}>
                  {/* Tile Seam */}
                  <polygon
                    points={`0,-${isoTileH * 0.7} ${isoTileW * 0.9},0 0,${isoTileH * 0.7} -${isoTileW * 0.9},0`}
                    fill={isWeatherStation ? "#a26135" : "#ad6839"}
                    stroke="#8c4e25"
                    strokeWidth="1.2"
                  />

                  {/* Raised Soil Mound */}
                  {!isWeatherStation && (
                    <g>
                      <ellipse cx="0" cy="4" rx={isoTileW * 0.5} ry={isoTileH * 0.45} fill="url(#moundGrad)" />
                      <ellipse cx="0" cy="2" rx={isoTileW * 0.32} ry={isoTileH * 0.3} fill="#693716" />

                      {/* Small Pebbles */}
                      <circle cx={-isoTileW * 0.35} cy="2" r="2.5" fill="#94a3b8" />
                      <circle cx={isoTileW * 0.32} cy="6" r="2" fill="#64748b" />

                      {/* Stylized Seedling Plant with Curved Leaves */}
                      <g transform="translate(0, -2)">
                        <line x1="0" y1="4" x2="0" y2="-20" stroke="#15803d" strokeWidth="2.8" strokeLinecap="round" />
                        <path d="M 0,-5 Q -12,-12 -14,-5 Q -10,2 0,-2" fill="#22c55e" stroke="#16a34a" strokeWidth="0.8" />
                        <path d="M 0,-5 Q 12,-12 14,-5 Q 10,2 0,-2" fill="#22c55e" stroke="#16a34a" strokeWidth="0.8" />
                        <path d="M 0,-12 Q -8,-20 -9,-14 Q -6,-6 0,-10" fill="#4ade80" />
                        <path d="M 0,-12 Q 8,-20 9,-14 Q 6,-6 0,-10" fill="#4ade80" />
                        {cfg.fruitColor && (
                          <circle cx="3.5" cy="-8" r={4 * yieldFactor} fill={cfg.fruitColor} />
                        )}
                      </g>
                    </g>
                  )}

                  {/* Corner Weather Station Mast */}
                  {isWeatherStation && (
                    <g transform="translate(0, -6)">
                      <ellipse cx="0" cy="5" rx="14" ry="7" fill="#334155" />
                      <line x1="0" y1="5" x2="0" y2="-75" stroke="#f8fafc" strokeWidth="4.5" strokeLinecap="round" />
                      <circle cx="0" cy="-25" r="3.5" fill="#10b981" />
                      <circle cx="0" cy="-55" r="3.5" fill="#10b981" />

                      {/* Photovoltaic Solar Panel */}
                      <g transform="translate(-14, -50) rotate(-22)">
                        <rect x="-10" y="-14" width="20" height="28" rx="2" fill="#1d4ed8" stroke="#f8fafc" strokeWidth="1.5" />
                        <line x1="0" y1="-14" x2="0" y2="14" stroke="#ffffff" strokeWidth="1" opacity="0.7" />
                        <line x1="-10" y1="0" x2="10" y2="0" stroke="#ffffff" strokeWidth="1" opacity="0.7" />
                      </g>

                      {/* Multi-Tier Sensor Shield (Stevenson Screen) */}
                      <g transform="translate(12, -44)">
                        <line x1="-8" y1="0" x2="0" y2="0" stroke="#64748b" strokeWidth="2" />
                        {[-6, -2, 2, 6].map((y, i) => (
                          <line key={i} x1="-6" y1={y} x2="6" y2={y} stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                        ))}
                      </g>

                      {/* Spinning Anemometer Cups at Top */}
                      <g transform="translate(-8, -78)">
                        <line x1="0" y1="0" x2="0" y2="-6" stroke="#475569" strokeWidth="2" />
                        <circle cx="-5" cy="-6" r="2.5" fill="#1e293b" />
                        <circle cx="5" cy="-6" r="2.5" fill="#1e293b" />
                      </g>
                      <g transform="translate(6, -78)">
                        <line x1="-5" y1="-6" x2="5" y2="-6" stroke="#94a3b8" strokeWidth="2" />
                        <polygon points="5,-8 9,-6 5,-4" fill="#10b981" />
                      </g>
                    </g>
                  )}
                </g>
              );
            });
          })}
        </g>
      </svg>
      <div className="fallback-badge" style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backdropFilter: 'blur(8px)' }}>
        <span>2D Agritech Preview ({crop} • {acreage} ac)</span>
      </div>
    </div>
  );
}

export default function FieldScene({
  crop = 'Tomato',
  acreage = 1.0,
  yieldFactor = 1.0,
  isLowPower = false
}) {
  const cfg = useMemo(() => getCropConfig(crop), [crop]);

  if (isLowPower) {
    return <Field2DFallback crop={crop} acreage={acreage} yieldFactor={yieldFactor} />;
  }

  // Dynamic plot dimension & scale based on farmer's acreage
  const { gridSize, tileSize, groupScale, weatherStationPos, weatherStationCorner, totalPlotWidth } = useMemo(() => {
    let gSize = 4;
    if (acreage <= 0.5) {
      gSize = 3; // 3x3 = 9 tiles for smallholder plots (0.25 - 0.5 ac)
    } else if (acreage <= 1.75) {
      gSize = 4; // 4x4 = 16 tiles for standard holdings (0.75 - 1.75 ac)
    } else if (acreage <= 3.5) {
      gSize = 5; // 5x5 = 25 tiles for medium holdings (2.0 - 3.5 ac)
    } else {
      gSize = 6; // 6x6 = 36 tiles for large commercial holdings (3.75 - 10 ac)
    }

    const tSize = 0.88;
    const wsCorner = { r: 0, c: gSize - 1 };
    const wsX = (gSize / 2 - 0.5) * tSize;
    const wsZ = -(gSize / 2 - 0.5) * tSize;

    // Smooth continuous dimensional scale interpolation across acreage:
    // 0.25 ac -> 0.76x, 0.5 ac -> 0.85x, 1.0 ac -> 1.00x, 2.0 ac -> 1.15x, 5.0 ac -> 1.34x, 10.0 ac -> 1.50x
    const contScale = Math.min(1.5, Math.max(0.75, Math.pow(acreage, 0.16)));

    return {
      gridSize: gSize,
      tileSize: tSize,
      groupScale: contScale,
      weatherStationCorner: wsCorner,
      weatherStationPos: [wsX, 0.05, wsZ],
      totalPlotWidth: gSize * tSize
    };
  }, [acreage]);

  return (
    <div className="three-canvas-container diorama-view">
      <Canvas
        shadows
        camera={{ position: [4.2, 4.8, 4.8], fov: 38 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        {/* Soft Studio Lighting tailored for rich clay/stylized models */}
        <ambientLight intensity={0.75} />
        <hemisphereLight skyColor="#ffffff" groundColor="#3e2723" intensity={0.4} />

        {/* Primary Sun Directional Light casting crisp contact shadows */}
        <directionalLight
          position={[6, 9, 5]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
          shadow-bias={-0.0001}
        />

        {/* Soft Mint Studio Fill Light from opposite angle */}
        <directionalLight
          position={[-5, 4, -4]}
          intensity={0.45}
          color="#a7f3d0"
        />

        <Suspense fallback={null}>
          <AnimatedFieldGroup groupScale={groupScale}>
            {/* 1. Modular Elevated Soil Pedestal with Mounds & Pebbles */}
            <ModularSoilPlot
              key={`plot-${gridSize}`}
              gridSize={gridSize}
              tileSize={tileSize}
              groundColor={cfg.groundColor || '#a76a3e'}
              weatherStationCorner={weatherStationCorner}
            />

            {/* 2. Organized Stylized Crop Plant Grid */}
            <StylizedCropGrid
              key={`crop-${crop}-${gridSize}`}
              crop={crop}
              acreage={acreage}
              yieldFactor={yieldFactor}
              gridSize={gridSize}
              tileSize={tileSize}
              weatherStationCorner={weatherStationCorner}
            />

            {/* 3. Corner Smart Agriculture Weather & IoT Sensor Mast */}
            <SmartWeatherStation position={weatherStationPos} />

            {/* 4. Soft Ambient Contact Shadows beneath the floating pedestal */}
            <ContactShadows
              position={[0, -0.21, 0]}
              opacity={0.65}
              scale={totalPlotWidth * 1.6}
              blur={1.8}
              far={3.0}
            />
          </AnimatedFieldGroup>
        </Suspense>

        {/* Responsive, Damped Orbit Controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          enableDamping={true}
          dampingFactor={0.06}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={3.0}
          maxDistance={9.5}
          autoRotate={false}
        />
      </Canvas>
    </div>
  );
}
