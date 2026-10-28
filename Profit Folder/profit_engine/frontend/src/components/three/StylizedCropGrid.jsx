import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import StylizedCropPlant from './StylizedCropPlant';
import { getCropConfig } from './crops/registry';

// Seeded pseudorandom generator
function pseudoRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Stylized Crop Grid Matrix
 * Distributes procedural plants cleanly on the 4x4 modular soil mounds
 * with subtle wind sway animation and deterministic variation.
 */
export default function StylizedCropGrid({
  crop = 'Tomato',
  acreage = 1.0,
  yieldFactor = 1.0,
  gridSize = 4,
  tileSize = 0.88,
  weatherStationCorner = { r: 0, c: 3 }
}) {
  const cfg = useMemo(() => getCropConfig(crop), [crop]);
  const groupRef = useRef();

  // Generate plant grid data (skipping the corner with weather station)
  const plants = useMemo(() => {
    const list = [];
    let idx = 0;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        // Skip corner occupied by IoT station
        if (r === weatherStationCorner.r && c === weatherStationCorner.c) {
          continue;
        }

        const seed = (r * 19 + c * 23) * 11.3;
        const x = (c - gridSize / 2 + 0.5) * tileSize;
        const z = (r - gridSize / 2 + 0.5) * tileSize;

        const baseRotY = pseudoRandom(seed) * Math.PI * 2;
        const scaleVar = 0.92 + pseudoRandom(seed + 1) * 0.16;

        list.push({
          id: `${r}-${c}`,
          x,
          z,
          rotY: baseRotY,
          scale: scaleVar,
          phase: (x * 1.5 + z * 1.8)
        });
        idx++;
      }
    }
    return list;
  }, [gridSize, tileSize, weatherStationCorner]);

  // Subtle wind sway animation
  const plantRefs = useRef([]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const windSpeed = 2.2;
    const windAmp = 0.05;

    plantRefs.current.forEach((ref, i) => {
      if (ref) {
        const p = plants[i];
        if (p) {
          const sway = Math.sin(t * windSpeed + p.phase) * windAmp;
          ref.rotation.z = sway;
          ref.rotation.x = sway * 0.5;
        }
      }
    });
  });

  return (
    <group ref={groupRef} position={[0, 0.04, 0]}>
      {plants.map((p, i) => (
        <group
          key={p.id}
          ref={(el) => (plantRefs.current[i] = el)}
          position={[p.x, 0, p.z]}
          rotation={[0, p.rotY, 0]}
          scale={[p.scale, p.scale, p.scale]}
        >
          <StylizedCropPlant
            crop={crop}
            cropConfig={cfg}
            yieldFactor={yieldFactor}
            randomSeed={i}
          />
        </group>
      ))}
    </group>
  );
}
