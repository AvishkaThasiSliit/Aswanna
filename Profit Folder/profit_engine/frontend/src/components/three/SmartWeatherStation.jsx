import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Smart Agriculture IoT Weather & Monitoring Station
 * High-tech farm mast with photovoltaic solar panel, multi-tier radiation shield (Stevenson screen),
 * spinning wind anemometer cups, wind vane, and telemetry LED.
 */
export default function SmartWeatherStation({ position = [1.5, 0.05, -1.5] }) {
  const anemometerRef = useRef();
  const ledRef = useRef();

  useFrame((state, delta) => {
    // 1. Smoothly spin anemometer wind cups
    if (anemometerRef.current) {
      anemometerRef.current.rotation.y += delta * 4.2;
    }
    // 2. Pulse active telemetry LED
    if (ledRef.current) {
      const pulse = (Math.sin(state.clock.getElapsedTime() * 4.5) + 1) / 2;
      ledRef.current.material.emissiveIntensity = 0.6 + pulse * 1.8;
    }
  });

  return (
    <group position={position}>
      {/* 1. Heavy Base Plate & Ground Anchors */}
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.06, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* 4 Corner Anchor Bolts */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
        <mesh
          key={i}
          position={[Math.cos(angle) * 0.17, 0.07, Math.sin(angle) * 0.17]}
          castShadow
        >
          <cylinderGeometry args={[0.02, 0.02, 0.03, 6]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* 2. Main Sleek Aluminum Mast (White powder coated) */}
      <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.06, 0.07, 2.2, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.25} metalness={0.15} />
      </mesh>

      {/* Modern Agritech Green Collar Rings */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.06, 16]} />
        <meshStandardMaterial color="#10b981" roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.08, 16]} />
        <meshStandardMaterial color="#10b981" roughness={0.35} />
      </mesh>

      {/* 3. Photovoltaic Solar Panel Assembly */}
      <group position={[-0.24, 1.45, 0.14]} rotation={[0.42, -0.55, 0.18]}>
        {/* Support Strut */}
        <mesh position={[0.16, -0.12, -0.08]} rotation={[0, 0, 0.5]}>
          <cylinderGeometry args={[0.018, 0.018, 0.28, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} />
        </mesh>
        {/* Weatherproof Battery / Electronics Enclosure */}
        <mesh position={[0, 0, -0.11]} castShadow>
          <boxGeometry args={[0.34, 0.44, 0.16]} />
          <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Solar Panel White Beveled Frame */}
        <mesh position={[0, 0, 0.02]} castShadow>
          <boxGeometry args={[0.5, 0.62, 0.04]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
        </mesh>
        {/* Solar Photovoltaic Cell Face (Glossy dark blue) */}
        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[0.44, 0.56]} />
          <meshStandardMaterial
            color="#1d4ed8"
            roughness={0.12}
            metalness={0.7}
          />
        </mesh>
        {/* White Grid Lines on Solar Panel */}
        <group position={[0, 0, 0.048]}>
          {[-0.11, 0, 0.11].map((x, i) => (
            <mesh key={`v-${i}`} position={[x, 0, 0]}>
              <planeGeometry args={[0.005, 0.55]} />
              <meshBasicMaterial color="#ffffff" opacity={0.65} transparent />
            </mesh>
          ))}
          {[-0.18, -0.09, 0, 0.09, 0.18].map((y, i) => (
            <mesh key={`h-${i}`} position={[0, y, 0]}>
              <planeGeometry args={[0.43, 0.005]} />
              <meshBasicMaterial color="#ffffff" opacity={0.65} transparent />
            </mesh>
          ))}
        </group>
      </group>

      {/* 4. Multi-Tier Radiation Shield (Stevenson Screen Sensor Unit) */}
      <group position={[0.28, 1.3, 0]}>
        {/* Horizontal Mounting Bracket */}
        <mesh position={[-0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.28, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} />
        </mesh>
        {/* 5 Stacked White Cylindrical Louver Discs */}
        {[0, 0.07, 0.14, 0.21, 0.28].map((y, i) => (
          <mesh key={i} position={[0, y - 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.18, 0.035, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
        ))}
        {/* Top Dome Cap */}
        <mesh position={[0, 0.18, 0]}>
          <sphereGeometry args={[0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
        {/* Active Telemetry Status LED */}
        <mesh ref={ledRef} position={[0, -0.2, 0.13]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial
            color="#22c55e"
            emissive="#22c55e"
            emissiveIntensity={1.2}
            roughness={0.1}
          />
        </mesh>
      </group>

      {/* 5. Wind Instruments (Anemometer & Vane) at Top of Mast */}
      <group position={[0, 2.25, 0]}>
        {/* Top Mast Cap */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.08, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.5} />
        </mesh>

        {/* Left Side: Spinning 3-Cup Anemometer */}
        <group ref={anemometerRef} position={[-0.16, 0.16, 0]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.12, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.6} />
          </mesh>
          {/* 3 Cups */}
          {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle, i) => {
            const rad = 0.14;
            const cx = Math.cos(angle) * rad;
            const cz = Math.sin(angle) * rad;
            return (
              <group key={i}>
                <mesh position={[cx / 2, 0.07, cz / 2]} rotation={[0, -angle, Math.PI / 2]}>
                  <cylinderGeometry args={[0.007, 0.007, rad, 6]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.8} />
                </mesh>
                <mesh
                  position={[cx, 0.07, cz]}
                  rotation={[0, angle + Math.PI / 2, 0]}
                  castShadow
                >
                  <sphereGeometry args={[0.048, 12, 8, 0, Math.PI]} />
                  <meshStandardMaterial
                    color="#1e293b"
                    side={THREE.DoubleSide}
                    roughness={0.3}
                    metalness={0.4}
                  />
                </mesh>
              </group>
            );
          })}
        </group>

        {/* Right Side: Directional Wind Vane */}
        <group position={[0.16, 0.16, 0]} rotation={[0, 0.75, 0]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.12, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.7} />
          </mesh>
          {/* Arrow Point */}
          <mesh position={[0.1, 0.07, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.035, 0.12, 6]} />
            <meshStandardMaterial color="#10b981" />
          </mesh>
          {/* Tail Fin */}
          <mesh position={[-0.1, 0.08, 0]}>
            <boxGeometry args={[0.1, 0.1, 0.01]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Vane Shaft */}
          <mesh position={[0, 0.07, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.007, 0.007, 0.25, 6]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
