import React, { useMemo } from 'react';
import * as THREE from 'three';

// Seeded pseudorandom generator for deterministic pebble placement
function pseudoRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Modular Elevated Agronomic Soil Pedestal
 * Recreates the clean modular 4x4 tile grid with raised garden mounds,
 * concentric soil rings, indented tile grooves, and scattered decorative pebbles
 * from the reference 3D illustration.
 */
export default function ModularSoilPlot({
  gridSize = 4,
  tileSize = 0.88,
  groundColor = '#a76a3e',
  weatherStationCorner = { r: 0, c: 3 } // Corner where IoT mast sits
}) {
  const totalWidth = gridSize * tileSize;

  // Generate deterministic pebble data for each tile
  const tileDetails = useMemo(() => {
    const tiles = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const isWeatherCorner = r === weatherStationCorner.r && c === weatherStationCorner.c;
        const centerX = (c - gridSize / 2 + 0.5) * tileSize;
        const centerZ = (r - gridSize / 2 + 0.5) * tileSize;

        // 3 pebbles per tile around the mound
        const pebbles = [];
        const baseSeed = (r * 17 + c * 31) * 7.7;
        const pebbleCount = isWeatherCorner ? 2 : 3;

        for (let p = 0; p < pebbleCount; p++) {
          const pSeed = baseSeed + p * 13;
          const angle = (p * (Math.PI * 2) / pebbleCount) + (pseudoRandom(pSeed) - 0.5) * 0.8;
          const dist = 0.28 + pseudoRandom(pSeed + 1) * 0.08;
          const size = 0.026 + pseudoRandom(pSeed + 2) * 0.016;
          const stoneColor = pseudoRandom(pSeed + 3) > 0.5 ? '#94a3b8' : '#64748b';

          pebbles.push({
            x: centerX + Math.cos(angle) * dist,
            z: centerZ + Math.sin(angle) * dist,
            size,
            color: stoneColor,
            rotY: pseudoRandom(pSeed + 4) * Math.PI
          });
        }

        tiles.push({
          r,
          c,
          centerX,
          centerZ,
          isWeatherCorner,
          pebbles
        });
      }
    }
    return tiles;
  }, [gridSize, tileSize, weatherStationCorner]);

  return (
    <group position={[0, -0.05, 0]}>
      {/* 1. Main Elevated Clay Base Block (Floating Pedestal) */}
      <mesh position={[0, -0.16, 0]} receiveShadow castShadow>
        <boxGeometry args={[totalWidth + 0.1, 0.32, totalWidth + 0.1]} />
        <meshStandardMaterial
          color="#8b5028"
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      {/* 2. Top Surface Soil Bed */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[totalWidth + 0.02, totalWidth + 0.02]} />
        <meshStandardMaterial
          color={groundColor}
          roughness={0.85}
          metalness={0.02}
        />
      </mesh>

      {/* 3. Modular Tile Seams & Raised Garden Mounds */}
      {tileDetails.map((tile, i) => (
        <group key={i}>
          {/* Subtle Tile Outline Box / Raised Plate */}
          <mesh
            position={[tile.centerX, 0.015, tile.centerZ]}
            receiveShadow
          >
            <boxGeometry args={[tileSize - 0.04, 0.03, tileSize - 0.04]} />
            <meshStandardMaterial
              color="#b57745"
              roughness={0.8}
            />
          </mesh>

          {/* Smooth Concentric Soil Mound around plant base */}
          {!tile.isWeatherCorner && (
            <group position={[tile.centerX, 0.03, tile.centerZ]}>
              {/* Main Rounded Hillock Mound */}
              <mesh position={[0, 0.03, 0]} receiveShadow castShadow>
                <cylinderGeometry args={[0.07, 0.30, 0.07, 18]} />
                <meshStandardMaterial
                  color="#804921"
                  roughness={0.9}
                />
              </mesh>

              {/* Outer Concentric Soil Ripple Ring */}
              <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <ringGeometry args={[0.26, 0.34, 18]} />
                <meshStandardMaterial
                  color="#975a2a"
                  roughness={0.92}
                  side={THREE.DoubleSide}
                />
              </mesh>

              {/* Inner Root Crown Dimple */}
              <mesh position={[0, 0.065, 0]} receiveShadow>
                <cylinderGeometry args={[0.05, 0.07, 0.02, 12]} />
                <meshStandardMaterial
                  color="#5c3010"
                  roughness={0.95}
                />
              </mesh>
            </group>
          )}

          {/* Scattered Decorative Natural River Pebbles */}
          {tile.pebbles.map((peb, pIdx) => (
            <mesh
              key={pIdx}
              position={[peb.x, 0.04, peb.z]}
              rotation={[0.1, peb.rotY, 0.05]}
              scale={[1.1, 0.7, 1.0]}
              castShadow
              receiveShadow
            >
              <dodecahedronGeometry args={[peb.size, 1]} />
              <meshStandardMaterial
                color={peb.color}
                roughness={0.5}
                metalness={0.2}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
