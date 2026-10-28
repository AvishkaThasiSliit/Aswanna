import React from 'react';
import * as THREE from 'three';

/**
 * Single Fleshy Curved 3D Leaf
 * Recreates the plump, stylized organic clay look from the reference illustration.
 */
export function StylizedLeaf({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  color = '#22c55e'
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Plump Curved Leaf Body */}
      <mesh position={[0, 0.02, 0.14]} rotation={[0.18, 0, 0]} scale={[0.46, 0.09, 1.0]} castShadow>
        <sphereGeometry args={[0.20, 16, 12]} />
        <meshStandardMaterial
          color={color}
          roughness={0.32}
          metalness={0.04}
        />
      </mesh>
      {/* Subtle Central Midrib Vein Crease */}
      <mesh position={[0, 0.035, 0.12]} rotation={[0.18, 0, 0]} scale={[0.05, 0.03, 0.75]}>
        <cylinderGeometry args={[0.06, 0.08, 0.26, 6]} />
        <meshStandardMaterial color="#15803d" roughness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * Stylized Agronomic Crop Plant
 * Procedurally generates realistic, clean 3D plants matching the reference photo
 * with distinctive produce (Tomatoes, Cabbage, Carrot, Onion, Maize, Paddy, etc.).
 */
export default function StylizedCropPlant({
  crop = 'Tomato',
  cropConfig,
  yieldFactor = 1.0,
  randomSeed = 1
}) {
  const type = cropConfig?.type || 'bush_fruit';
  const leafColor = cropConfig?.leafColor || '#22c55e';
  const fruitColor = cropConfig?.fruitColor || '#ef4444';

  // 1. CABBAGE HEAD VARIATION (Compact layered head on mound)
  if (type === 'cabbage_head') {
    return (
      <group position={[0, 0.04, 0]}>
        {/* Central Dense Cabbage Ball */}
        <mesh position={[0, 0.16, 0]} scale={[1, 0.88, 1]} castShadow>
          <sphereGeometry args={[0.22 * yieldFactor, 16, 14]} />
          <meshStandardMaterial
            color={cropConfig.innerHeadColor || '#86efac'}
            roughness={0.4}
          />
        </mesh>
        {/* Outer Curved Ruffled Wrapping Leaves */}
        {[0, 1.2, 2.4, 3.6, 4.8].map((angle, i) => (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh
              position={[0.12, 0.12, 0.1]}
              rotation={[0.6, 0.2, 0.3]}
              scale={[0.7, 0.1, 1.0]}
              castShadow
            >
              <sphereGeometry args={[0.18, 12, 10]} />
              <meshStandardMaterial
                color={cropConfig.headColor || '#4ade80'}
                roughness={0.35}
              />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  // 2. CARROT VARIATION (Feathery fronds + protruding orange crown)
  if (type === 'feathery_root') {
    return (
      <group position={[0, 0.03, 0]}>
        {/* Crown of Orange Carrot Top Protruding from Soil */}
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.07 * yieldFactor, 0.09 * yieldFactor, 0.14, 12]} />
          <meshStandardMaterial color="#ea580c" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.13, 0]} castShadow>
          <sphereGeometry args={[0.07 * yieldFactor, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#ea580c" roughness={0.4} />
        </mesh>
        {/* Upward Feathery Fern Fronds */}
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle, i) => (
          <group key={i} rotation={[0, angle, 0]} position={[0, 0.12, 0]}>
            <mesh position={[0.06, 0.16, 0]} rotation={[0, 0, -0.25]} castShadow>
              <cylinderGeometry args={[0.015, 0.02, 0.36, 6]} />
              <meshStandardMaterial color="#16a34a" roughness={0.4} />
            </mesh>
            <StylizedLeaf
              position={[0.1, 0.3, 0]}
              rotation={[0.3, 0.4, 0.5]}
              scale={[0.65, 0.65, 0.8]}
              color="#16a34a"
            />
          </group>
        ))}
      </group>
    );
  }

  // 3. BULB VARIATION (Big Onion / Red Onion with green tubular scapes)
  if (type === 'bulb') {
    return (
      <group position={[0, 0.04, 0]}>
        {/* Onion Bulb Body Resting in Soil Center */}
        <mesh position={[0, 0.1, 0]} scale={[1, 0.9, 1]} castShadow>
          <sphereGeometry args={[0.14 * yieldFactor, 16, 12]} />
          <meshStandardMaterial
            color={cropConfig.bulbColor || '#d97706'}
            roughness={0.3}
          />
        </mesh>
        {/* Neck */}
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.06, 0.1, 10]} />
          <meshStandardMaterial color="#65a30d" roughness={0.4} />
        </mesh>
        {/* Upright Slender Tubular Scapes / Leaves */}
        {[-0.04, 0, 0.04].map((offset, i) => (
          <mesh
            key={i}
            position={[offset, 0.38 + i * 0.04, (i % 2 === 0 ? 0.02 : -0.02)]}
            rotation={[0.05 * (i - 1), 0, 0.08 * (i - 1)]}
            castShadow
          >
            <cylinderGeometry args={[0.012, 0.022, 0.38, 6]} />
            <meshStandardMaterial color="#22c55e" roughness={0.35} />
          </mesh>
        ))}
      </group>
    );
  }

  // 4. MAIZE / TALL STALK VARIATION
  if (type === 'tall_stalk') {
    return (
      <group position={[0, 0.04, 0]}>
        {/* Sturdy Corn Stalk */}
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.05, 0.82, 8]} />
          <meshStandardMaterial color="#16a34a" roughness={0.4} />
        </mesh>
        {/* Broad Alternating Corn Leaves */}
        <StylizedLeaf position={[0, 0.25, 0]} rotation={[0.4, 0.2, 0.7]} scale={[1.2, 0.9, 1.4]} color="#22c55e" />
        <StylizedLeaf position={[0, 0.38, 0]} rotation={[0.4, Math.PI, -0.7]} scale={[1.2, 0.9, 1.4]} color="#22c55e" />
        <StylizedLeaf position={[0, 0.55, 0]} rotation={[0.5, 0.8, 0.6]} scale={[1.1, 0.8, 1.3]} color="#22c55e" />
        {/* Ear of Corn (Cob) with golden kernels peeking out */}
        <group position={[0.06, 0.36, 0]} rotation={[0, 0, -0.45]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.04 * yieldFactor, 0.05 * yieldFactor, 0.24, 10]} />
            <meshStandardMaterial color="#eab308" roughness={0.35} />
          </mesh>
          <mesh position={[-0.015, -0.04, 0]} scale={[1.1, 1.0, 1.1]}>
            <cylinderGeometry args={[0.045, 0.055, 0.16, 8]} />
            <meshStandardMaterial color="#15803d" roughness={0.4} />
          </mesh>
        </group>
      </group>
    );
  }

  // 5. PADDY / RICE (Flooded grass tillers with golden panicles)
  if (type === 'flooded') {
    return (
      <group position={[0, 0.03, 0]}>
        {/* Cluster of Slender Rice Stems */}
        {[0, 1.3, 2.6, 3.9].map((rot, i) => (
          <group key={i} rotation={[0, rot, 0]}>
            <mesh position={[0.03, 0.28, 0]} rotation={[0, 0, -0.15]} castShadow>
              <cylinderGeometry args={[0.012, 0.02, 0.55, 5]} />
              <meshStandardMaterial color="#84cc16" roughness={0.4} />
            </mesh>
            {/* Golden Drooping Grain Panicle */}
            <mesh position={[0.07, 0.54, 0]} rotation={[0, 0, -0.55]} castShadow>
              <coneGeometry args={[0.035 * yieldFactor, 0.24, 6]} />
              <meshStandardMaterial color="#eab308" roughness={0.35} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  // 6. DEFAULT / TOMATO / VEGETABLE BUSH (Lush, Stylized Seedling as in Reference Photo)
  return (
    <group position={[0, 0.04, 0]}>
      {/* Central Curved Stem */}
      <mesh position={[0, 0.22, 0]} rotation={[0.04, 0, -0.03]} castShadow>
        <cylinderGeometry args={[0.032, 0.048, 0.44, 8]} />
        <meshStandardMaterial color="#15803d" roughness={0.38} />
      </mesh>

      {/* --- LOWER PAIR OF CURVED BROAD LEAVES --- */}
      <StylizedLeaf
        position={[-0.04, 0.18, 0.02]}
        rotation={[0.35, -0.8, -0.55]}
        scale={[1.1, 1.0, 1.15]}
        color={leafColor}
      />
      <StylizedLeaf
        position={[0.04, 0.18, -0.02]}
        rotation={[0.35, 0.8, 0.55]}
        scale={[1.1, 1.0, 1.15]}
        color={leafColor}
      />

      {/* --- UPPER PAIR OF LEAVES (Opposing & Angled) --- */}
      <StylizedLeaf
        position={[0.01, 0.32, -0.05]}
        rotation={[-0.45, 0.2, 0.25]}
        scale={[1.0, 0.95, 1.1]}
        color={leafColor}
      />
      <StylizedLeaf
        position={[-0.01, 0.32, 0.05]}
        rotation={[0.45, Math.PI - 0.2, -0.25]}
        scale={[1.0, 0.95, 1.1]}
        color={leafColor}
      />

      {/* --- APICAL TOP LEAF SPROUT --- */}
      <StylizedLeaf
        position={[0, 0.42, 0]}
        rotation={[0.1, 0.4, 0.1]}
        scale={[0.75, 0.75, 0.85]}
        color="#4ade80"
      />

      {/* --- CROP PRODUCE: TOMATOES / PEPPERS / BERRIES --- */}
      {(crop === 'Tomato' || type === 'staked') && (
        <group position={[0.08, 0.24, 0.04]}>
          {/* Main Red Tomato Globe */}
          <mesh position={[0, 0, 0]} castShadow>
            <sphereGeometry args={[0.09 * yieldFactor, 16, 14]} />
            <meshStandardMaterial
              color={fruitColor}
              roughness={0.25}
              metalness={0.08}
            />
          </mesh>
          {/* Green Calyx Star at stem node */}
          <mesh position={[0, 0.085 * yieldFactor, 0]} rotation={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.035, 0.02, 0.015, 5]} />
            <meshStandardMaterial color="#16a34a" roughness={0.4} />
          </mesh>
          {/* Second Smaller Ripening Tomato */}
          <mesh position={[-0.14, -0.03, 0.06]} castShadow>
            <sphereGeometry args={[0.065 * yieldFactor, 14, 12]} />
            <meshStandardMaterial
              color={fruitColor}
              roughness={0.25}
              metalness={0.08}
            />
          </mesh>
        </group>
      )}

      {/* Other Vegetable Berries / Pods (Chilli / Brinjal / Capsicum) */}
      {crop !== 'Tomato' && type === 'bush_fruit' && (
        <group position={[0.07, 0.22, 0.04]}>
          <mesh position={[0, 0, 0]} scale={cropConfig.type === 'bush_fruit' ? [0.6, 1.2, 0.6] : [1, 1, 1]} castShadow>
            <sphereGeometry args={[0.08 * yieldFactor, 14, 12]} />
            <meshStandardMaterial
              color={fruitColor}
              roughness={0.3}
              metalness={0.05}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
