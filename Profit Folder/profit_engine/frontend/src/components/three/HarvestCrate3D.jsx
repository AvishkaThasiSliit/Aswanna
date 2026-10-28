import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import * as THREE from 'three';

// Shared materials for performance and compact size
const woodMat = new THREE.MeshStandardMaterial({ color: "#d98845", roughness: 0.6 });
const darkWoodMat = new THREE.MeshStandardMaterial({ color: "#b86b2b", roughness: 0.65 });
const nailMat = new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.3, metalness: 0.8 });
const pumpkinMat = new THREE.MeshStandardMaterial({ color: "#f97316", roughness: 0.4 });
const carrotMat = new THREE.MeshStandardMaterial({ color: "#ea580c", roughness: 0.45 });
const greenMat = new THREE.MeshStandardMaterial({ color: "#22c55e", roughness: 0.5 });
const cabbageMat = new THREE.MeshStandardMaterial({ color: "#16a34a", roughness: 0.55 });
const cornMat = new THREE.MeshStandardMaterial({ color: "#eab308", roughness: 0.35 });
const tomatoMat = new THREE.MeshStandardMaterial({ color: "#ef4444", roughness: 0.3 });
const potatoMat = new THREE.MeshStandardMaterial({ color: "#b45309", roughness: 0.7 });
const onionMat = new THREE.MeshStandardMaterial({ color: "#c2410c", roughness: 0.4 });

/**
 * Single Produce Item based on Crop
 */
function ProduceItem({ crop, position, scale = 1.0, rotation = [0, 0, 0] }) {
  const sc = [scale, scale, scale];
  if (crop === 'Potato' || crop === 'Sweet Potato') {
    return (
      <mesh position={position} scale={[scale * 1.2, scale * 0.9, scale]} rotation={rotation} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <primitive object={potatoMat} attach="material" />
      </mesh>
    );
  }
  if (crop === 'Carrot') {
    return (
      <group position={position} scale={sc} rotation={rotation}>
        <mesh position={[0, -0.1, 0]} castShadow>
          <coneGeometry args={[0.1, 0.34, 10]} />
          <primitive object={carrotMat} attach="material" />
        </mesh>
        <mesh position={[0, 0.12, 0]} castShadow>
          <sphereGeometry args={[0.07, 8, 8]} />
          <primitive object={greenMat} attach="material" />
        </mesh>
      </group>
    );
  }
  if (crop === 'Pumpkin') {
    return (
      <mesh position={position} scale={sc} rotation={rotation} castShadow>
        <sphereGeometry args={[0.22, 14, 14]} />
        <primitive object={pumpkinMat} attach="material" />
      </mesh>
    );
  }
  if (crop === 'Cabbage') {
    return (
      <mesh position={position} scale={sc} rotation={rotation} castShadow>
        <sphereGeometry args={[0.22, 14, 14]} />
        <primitive object={cabbageMat} attach="material" />
      </mesh>
    );
  }
  if (crop === 'Maize') {
    return (
      <mesh position={position} scale={sc} rotation={rotation} castShadow>
        <cylinderGeometry args={[0.08, 0.09, 0.35, 10]} />
        <primitive object={cornMat} attach="material" />
      </mesh>
    );
  }
  if (crop === 'Big Onion' || crop === 'Red Onion') {
    return (
      <mesh position={position} scale={sc} rotation={rotation} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <primitive object={onionMat} attach="material" />
      </mesh>
    );
  }
  // Default: Tomato
  return (
    <group position={position} scale={sc} rotation={rotation}>
      <mesh castShadow>
        <sphereGeometry args={[0.19, 14, 14]} />
        <primitive object={tomatoMat} attach="material" />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.07, 0.01, 0.03, 5]} />
        <primitive object={greenMat} attach="material" />
      </mesh>
    </group>
  );
}

/**
 * Stylized Wooden Crate with Assorted Harvest Produce
 */
function SingleCrate({ crop = 'Tomato', position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const w = 1.35;
  const d = 0.95;
  const h = 0.72;
  const plankH = 0.16;
  const plankT = 0.05;

  return (
    <group position={position} rotation={rotation}>
      {/* Floor */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[w - 0.06, 0.04, d - 0.06]} />
        <primitive object={darkWoodMat} attach="material" />
      </mesh>

      {/* 4 Corner Posts */}
      {[
        [-w / 2 + 0.05, h / 2, -d / 2 + 0.05],
        [w / 2 - 0.05, h / 2, -d / 2 + 0.05],
        [-w / 2 + 0.05, h / 2, d / 2 - 0.05],
        [w / 2 - 0.05, h / 2, d / 2 - 0.05]
      ].map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={[0.1, h, 0.1]} />
          <primitive object={darkWoodMat} attach="material" />
        </mesh>
      ))}

      {/* Front & Back Slats (3 tiers) */}
      {[0.14, 0.38, 0.62].map((y, t) => (
        <React.Fragment key={`fb-${t}`}>
          <mesh position={[0, y, d / 2]} castShadow receiveShadow>
            <boxGeometry args={[w, plankH, plankT]} />
            <primitive object={woodMat} attach="material" />
          </mesh>
          <mesh position={[0, y, -d / 2]} castShadow receiveShadow>
            <boxGeometry args={[w, plankH, plankT]} />
            <primitive object={woodMat} attach="material" />
          </mesh>
          <mesh position={[-w / 2 + 0.05, y, d / 2 + 0.03]} castShadow>
            <sphereGeometry args={[0.024, 8, 8]} />
            <primitive object={nailMat} attach="material" />
          </mesh>
          <mesh position={[w / 2 - 0.05, y, d / 2 + 0.03]} castShadow>
            <sphereGeometry args={[0.024, 8, 8]} />
            <primitive object={nailMat} attach="material" />
          </mesh>
        </React.Fragment>
      ))}

      {/* Side Slats */}
      {[0.14, 0.38, 0.62].map((y, t) => (
        <React.Fragment key={`lr-${t}`}>
          <mesh position={[-w / 2, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[plankT, plankH, d - 0.04]} />
            <primitive object={woodMat} attach="material" />
          </mesh>
          <mesh position={[w / 2, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[plankT, plankH, d - 0.04]} />
            <primitive object={woodMat} attach="material" />
          </mesh>
        </React.Fragment>
      ))}

      {/* Produce Inside Crate */}
      <ProduceItem crop={crop} position={[0, 0.52, 0]} scale={1.0} rotation={[0, 0.2, 0]} />
      <ProduceItem crop={crop} position={[-0.28, 0.5, -0.15]} scale={0.92} rotation={[0.2, -0.4, 0.1]} />
      <ProduceItem crop={crop} position={[0.28, 0.5, -0.12]} scale={0.9} rotation={[-0.1, 0.5, 0]} />
      <ProduceItem crop={crop} position={[0.25, 0.53, 0.18]} scale={0.88} rotation={[0.2, 0.2, -0.2]} />
      <ProduceItem crop={crop} position={[-0.24, 0.53, 0.18]} scale={0.88} rotation={[-0.2, -0.3, 0.2]} />

      {/* Farm Assortment (Carrot / Pumpkin / Cabbage) */}
      <mesh position={[-0.32, 0.56, 0.05]} castShadow>
        <coneGeometry args={[0.08, 0.28, 8]} />
        <primitive object={carrotMat} attach="material" />
      </mesh>
      <mesh position={[0.34, 0.54, 0.02]} castShadow>
        <sphereGeometry args={[0.16, 10, 10]} />
        <primitive object={cabbageMat} attach="material" />
      </mesh>
    </group>
  );
}

/**
 * Crates Stack Arrangement:
 * Crates count dynamically increases from 1 to 5 based on yield!
 */
function CrateCluster({ crop = 'Tomato', crateCount = 3 }) {
  const groupRef = useRef();

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.18;
    }
  });

  // Position coordinates for 1 to 5 crates
  const crateConfigs = useMemo(() => {
    switch (crateCount) {
      case 1:
        return [{ pos: [0, -0.35, 0], rot: [0, 0, 0] }];
      case 2:
        return [
          { pos: [-0.75, -0.35, 0], rot: [0, 0.08, 0] },
          { pos: [0.75, -0.35, 0], rot: [0, -0.08, 0] }
        ];
      case 3:
        return [
          { pos: [-0.75, -0.45, 0], rot: [0, 0.06, 0] },
          { pos: [0.75, -0.45, 0], rot: [0, -0.06, 0] },
          { pos: [0, 0.32, 0], rot: [0, 0.15, 0] } // Stacked top
        ];
      case 4:
        return [
          { pos: [-0.75, -0.45, 0.05], rot: [0, 0.05, 0] },
          { pos: [0.75, -0.45, -0.05], rot: [0, -0.05, 0] },
          { pos: [-0.75, 0.32, 0.05], rot: [0, -0.05, 0] },
          { pos: [0.75, 0.32, -0.05], rot: [0, 0.05, 0] }
        ];
      case 5:
      default:
        return [
          { pos: [-0.95, -0.48, -0.35], rot: [0, 0.1, 0] },
          { pos: [0.95, -0.48, -0.35], rot: [0, -0.1, 0] },
          { pos: [0, -0.48, 0.65], rot: [0, 0.04, 0] },
          { pos: [-0.5, 0.28, 0.1], rot: [0, -0.08, 0] },
          { pos: [0.5, 0.28, 0.1], rot: [0, 0.08, 0] }
        ];
    }
  }, [crateCount]);

  return (
    <group ref={groupRef} position={[0, -0.05, 0]}>
      {crateConfigs.map((cfg, idx) => (
        <SingleCrate
          key={`crate-${idx}-${crateCount}`}
          crop={crop}
          position={cfg.pos}
          rotation={cfg.rot}
        />
      ))}
    </group>
  );
}

/**
 * Computes Crate Count from Yield Factor (1 to 5)
 */
export function getCrateCount(yieldFactor) {
  if (yieldFactor <= 0.68) return 1;
  if (yieldFactor <= 0.88) return 2;
  if (yieldFactor <= 1.12) return 3;
  if (yieldFactor <= 1.38) return 4;
  return 5;
}

export default function HarvestCrate3D({ crop = 'Tomato', yieldFactor = 1.0 }) {
  const crateCount = getCrateCount(yieldFactor);

  return (
    <div className="harvest-crate-3d-wrapper" style={{ width: '100%', height: '310px', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: [3.4, 2.8, 3.6], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.8} />
        <hemisphereLight skyColor="#ffffff" groundColor="#3e2723" intensity={0.4} />

        <directionalLight
          position={[4, 6, 4]}
          intensity={1.6}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-3, 4, -3]} intensity={0.5} color="#fed7aa" />

        <Suspense fallback={null}>
          <Float speed={1.1} rotationIntensity={0.08} floatIntensity={0.15}>
            <CrateCluster crop={crop} crateCount={crateCount} />
          </Float>
        </Suspense>

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minPolarAngle={Math.PI / 6}
          minDistance={2.5}
          maxDistance={6.0}
        />
      </Canvas>
    </div>
  );
}
