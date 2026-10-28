import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getCropConfig } from './crops/registry';

// Seeded pseudorandom generator for deterministic visual variety
function pseudoRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export default function CropInstances({ crop = 'Tomato', acreage = 1.0, yieldFactor = 1.0 }) {
  const cfg = useMemo(() => getCropConfig(crop), [crop]);
  const groupRef = useRef();

  // Growth transition animation on mount / crop change
  const growthScale = useRef(0.01);

  useEffect(() => {
    growthScale.current = 0.05;
  }, [crop]);

  // Mesh refs for multi-part instancing
  const stemsRef = useRef();
  const fruitsRef = useRef();
  const stakesRef = useRef();
  const leavesRef = useRef();

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorHelper = useMemo(() => new THREE.Color(), []);

  // Compute number of plants based on acreage and crop density
  const { plantCount, cols, rows, spacingX, spacingZ } = useMemo(() => {
    const baseDensity = cfg.type === 'flooded' ? 120 :
      cfg.type === 'tall_stalk' ? 40 :
      cfg.type === 'sprawling_vine' ? 24 :
      cfg.type === 'cabbage_head' ? 50 : 64;

    const count = Math.min(180, Math.max(20, Math.round(baseDensity * Math.min(acreage, 2.5))));
    const r = Math.round(Math.sqrt(count * 0.8));
    const c = Math.ceil(count / r);
    const spX = (cfg.rowSpacing || 0.5) * 1.6;
    const spZ = (cfg.plantSpacing || 0.3) * 1.8;
    return { plantCount: count, rows: r, cols: c, spacingX: spX, spacingZ: spZ };
  }, [cfg, acreage]);

  useFrame((state, delta) => {
    // Spring growth animation
    if (growthScale.current < 1.0) {
      growthScale.current = Math.min(1.0, growthScale.current + delta * 2.8);
    }

    const t = state.clock.getElapsedTime();
    const effectiveScale = (cfg.scale || 1.0) * growthScale.current;

    let idx = 0;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (idx >= plantCount) break;

        const seed = idx * 13.37;
        const randOffset = (pseudoRandom(seed) - 0.5) * 0.12;
        const randScale = 0.85 + pseudoRandom(seed + 1) * 0.3;
        const randRot = pseudoRandom(seed + 2) * Math.PI * 2;

        const x = (c - cols / 2) * spacingX + randOffset;
        const z = (r - rows / 2) * spacingZ + randOffset;

        // Wind sway physics
        const swayAmp = cfg.type === 'tall_stalk' ? 0.08 : (cfg.type === 'flooded' ? 0.09 : 0.04);
        const swayFreq = cfg.type === 'flooded' ? 2.5 : 1.8;
        const sway = Math.sin(t * swayFreq + x * 1.5 + z * 1.2) * swayAmp;

        // 1. Stems
        if (stemsRef.current) {
          dummy.position.set(x, 0.25 * effectiveScale, z);
          dummy.rotation.set(sway, randRot + sway * 0.5, sway * 0.6);
          dummy.scale.set(effectiveScale * randScale, effectiveScale * randScale * yieldFactor, effectiveScale * randScale);
          dummy.updateMatrix();
          stemsRef.current.setMatrixAt(idx, dummy.matrix);
        }

        // 2. Fruit / Panicles / Bulbs
        if (fruitsRef.current) {
          const fruitY = cfg.type === 'bulb' ? 0.08 :
            cfg.type === 'cabbage_head' ? 0.18 :
            cfg.type === 'tall_stalk' ? 0.85 :
            cfg.type === 'flooded' ? 0.55 : 0.38;

          dummy.position.set(x + Math.sin(randRot) * 0.05, fruitY * effectiveScale * yieldFactor, z + Math.cos(randRot) * 0.05);
          dummy.rotation.set(sway * 1.2, randRot, 0);
          dummy.scale.set(effectiveScale * randScale * yieldFactor, effectiveScale * randScale * yieldFactor, effectiveScale * randScale * yieldFactor);
          dummy.updateMatrix();
          fruitsRef.current.setMatrixAt(idx, dummy.matrix);
        }

        // 3. Stakes / Trellis (if crop uses vertical poles)
        if (stakesRef.current && (cfg.hasStakes || cfg.hasTrellis)) {
          dummy.position.set(x + 0.06, 0.5 * effectiveScale, z);
          dummy.rotation.set(0, 0, 0.02);
          dummy.scale.set(0.04, 1.1 * effectiveScale, 0.04);
          dummy.updateMatrix();
          stakesRef.current.setMatrixAt(idx, dummy.matrix);
        }

        // 4. Broad Leaves / Rosette
        if (leavesRef.current) {
          dummy.position.set(x, 0.12 * effectiveScale, z);
          dummy.rotation.set(0, randRot, 0);
          dummy.scale.set(effectiveScale * randScale, effectiveScale * randScale, effectiveScale * randScale);
          dummy.updateMatrix();
          leavesRef.current.setMatrixAt(idx, dummy.matrix);
        }

        idx++;
      }
    }

    if (stemsRef.current) stemsRef.current.instanceMatrix.needsUpdate = true;
    if (fruitsRef.current) fruitsRef.current.instanceMatrix.needsUpdate = true;
    if (stakesRef.current) stakesRef.current.instanceMatrix.needsUpdate = true;
    if (leavesRef.current) leavesRef.current.instanceMatrix.needsUpdate = true;
  });

  // Visibly show if crop config is unavailable
  if (cfg.isMissing) {
    return (
      <group position={[0, 0.5, 0]}>
        <Html center>
          <div className="crop-missing-badge">
            ⚠️ 3D model not available for {crop}
          </div>
        </Html>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      {/* Flooded Water Sheet for Paddy */}
      {cfg.water && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[cols * spacingX + 0.6, rows * spacingZ + 0.6]} />
          <meshStandardMaterial
            color="#38bdf8"
            roughness={0.1}
            metalness={0.6}
            transparent
            opacity={0.7}
          />
        </mesh>
      )}

      {/* 1. Main Stem Mesh */}
      <instancedMesh ref={stemsRef} args={[null, null, plantCount]} castShadow receiveShadow>
        {cfg.type === 'flooded' ? (
          <cylinderGeometry args={[0.015, 0.02, 0.65, 5]} />
        ) : cfg.type === 'tall_stalk' ? (
          <cylinderGeometry args={[0.04, 0.06, 1.4, 7]} />
        ) : cfg.type === 'bulb' ? (
          <coneGeometry args={[0.03, 0.45, 5]} />
        ) : cfg.type === 'cabbage_head' ? (
          <cylinderGeometry args={[0.05, 0.08, 0.15, 6]} />
        ) : (
          <cylinderGeometry args={[0.03, 0.04, 0.6, 6]} />
        )}
        <meshStandardMaterial color={cfg.stemColor || cfg.leafColor || '#15803d'} roughness={0.6} />
      </instancedMesh>

      {/* 2. Distinctive Fruit / Panicle / Bulb Geometry */}
      <instancedMesh ref={fruitsRef} args={[null, null, plantCount]} castShadow>
        {cfg.type === 'cabbage_head' ? (
          // Concentric layered cabbage head
          <sphereGeometry args={[cfg.headRadius || 0.22, 12, 10]} />
        ) : cfg.type === 'bulb' ? (
          // Onion or Beetroot round bulb
          <sphereGeometry args={[0.13, 10, 8]} />
        ) : cfg.type === 'feathery_root' ? (
          // Carrot orange crown cone
          <coneGeometry args={[0.07, 0.25, 8]} />
        ) : cfg.type === 'sprawling_vine' ? (
          // Giant pumpkin globe
          <sphereGeometry args={[cfg.fruitRadius || 0.26, 12, 10]} />
        ) : cfg.type === 'tall_stalk' ? (
          // Maize cobs or grain clusters
          <cylinderGeometry args={[0.06, 0.05, 0.28, 8]} />
        ) : cfg.type === 'flooded' ? (
          // Drooping rice grain panicle
          <coneGeometry args={[0.05, 0.35, 6]} />
        ) : (
          // Tomato or aubergine fruit globes
          <sphereGeometry args={[cfg.fruitRadius || 0.1, 8, 8]} />
        )}
        <meshStandardMaterial
          color={cfg.fruitColor || cfg.bulbColor || cfg.innerHeadColor || cfg.panicleColor || '#ef4444'}
          roughness={0.4}
        />
      </instancedMesh>

      {/* 3. Stakes / Trellis A-Frames */}
      {(cfg.hasStakes || cfg.hasTrellis) && (
        <instancedMesh ref={stakesRef} args={[null, null, plantCount]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 1.2, 5]} />
          <meshStandardMaterial color="#78350f" roughness={0.8} />
        </instancedMesh>
      )}

      {/* 4. Rosette / Broad Foliage */}
      {(cfg.type === 'cabbage_head' || cfg.type === 'tall_stalk' || cfg.type === 'sprawling_vine') && (
        <instancedMesh ref={leavesRef} args={[null, null, plantCount]} receiveShadow>
          <circleGeometry args={[0.28, 6]} />
          <meshStandardMaterial
            color={cfg.leafColor || '#15803d'}
            side={THREE.DoubleSide}
            roughness={0.7}
          />
        </instancedMesh>
      )}
    </group>
  );
}
