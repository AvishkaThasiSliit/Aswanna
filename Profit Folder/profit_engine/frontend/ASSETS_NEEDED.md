# Aswenna Assets Needed: 3D Vehicle Models Specification

This document lists the exact 3D models required for the Aswenna Logistics & Vehicle Selection module (Step 5 of the Farmer Profit Calculator).
The application is pre-wired to load these exact filenames via `@react-three/drei`'s `useGLTF`. While awaiting downloaded assets, the application provides an interactive 2.5D vector illustration fallback with the same camera & hotspot UI so user workflows are never blocked.

---

## 1. Vehicles Fleet Models Required

### 1.1 DIMO Batta HT2 / Tata Ace Mini Truck
- **Target Filename:** `src/assets/models/vehicles/dimo_batta.glb`
- **Target Size:** < 1.5 MB (Draco compressed)
- **Suggested Search Terms:** "Tata Ace", "mini truck low poly", "kei truck flatbed", "light commercial truck"
- **Recommended Sources:** c (by Kenney / Quaternius), Sketchfab (CC-BY downloadable)
- **Visual Features:** Cab-over front with split headlights, two passenger front cab with windows, open flatbed wooden/steel cargo deck with drop-side panels, four standard wheels with rubber tires.

### 1.2 DIMO Batti / Tata Ace Zip
- **Target Filename:** `src/assets/models/vehicles/dimo_batti.glb`
- **Target Size:** < 1.2 MB
- **Suggested Search Terms:** "Tata Ace Zip", "micro truck", "compact kei truck"
- **Recommended Sources:** Poly Pizza, Kenney Car Kit
- **Visual Features:** Very compact micro-truck cab, rounded front bumper, small payload flatbed.

### 1.3 Tata Ace Gold Diesel
- **Target Filename:** `src/assets/models/vehicles/tata_ace_gold.glb`
- **Target Size:** < 1.5 MB
- **Suggested Search Terms:** "commercial mini truck", "Tata Ace Gold", "flatbed delivery truck"
- **Recommended Sources:** Poly Pizza, Quaternius
- **Visual Features:** Classic white/blue cab, 1-ton reinforced cargo deck, fuel tank mounted on passenger-side chassis.

### 1.4 Suzuki Carry Mini Truck
- **Target Filename:** `src/assets/models/vehicles/suzuki_carry.glb`
- **Target Size:** < 1.4 MB
- **Suggested Search Terms:** "Suzuki Carry", "Japanese Kei truck", "Daihatsu Hijet"
- **Recommended Sources:** Poly Pizza, Kenney
- **Visual Features:** Square Japanese Kei cab, large front windshield, white or silver body, low flatbed.

### 1.5 Mahindra Bolero Pik-Up
- **Target Filename:** `src/assets/models/vehicles/mahindra_bolero.glb`
- **Target Size:** < 1.5 MB
- **Suggested Search Terms:** "Mahindra Bolero Pickup", "rugged utility truck", "heavy duty pickup"
- **Recommended Sources:** Sketchfab (CC-BY), Poly Pizza
- **Visual Features:** Front engine bonnet/hood with vertical grille, 2-door cab, high-walled metal cargo box bed, robust suspension clearance.

### 1.6 Bajaj RE Three-Wheeler (Tuk-Tuk) - Petrol & Diesel
- **Target Filename:** `src/assets/models/vehicles/bajaj_re_petrol.glb` and `bajaj_re_diesel.glb`
- **Target Size:** < 1.2 MB
- **Suggested Search Terms:** "tuk tuk", "auto rickshaw", "three wheeler low poly", "bajaj auto"
- **Recommended Sources:** Poly Pizza (Quaternius Tuk-Tuk), Kenney
- **Visual Features:** Single front fork wheel with mudguard, windshield with single wiper, black canvas/vinyl canopy roof, passenger cabin with rear luggage space, twin rear wheels.

### 1.7 Bajaj CT100 Motorbike
- **Target Filename:** `src/assets/models/vehicles/bajaj_ct100.glb`
- **Target Size:** < 1.0 MB
- **Suggested Search Terms:** "commuter motorcycle", "100cc motorcycle", "standard motorbike low poly"
- **Recommended Sources:** Poly Pizza, Kenney
- **Visual Features:** Teardrop petrol tank, flat 2-person commuter seat, circular or rectangular headlight, chrome rear luggage carrier rack for produce sacks.

### 1.8 Shared Commercial Freight Lorry
- **Target Filename:** `src/assets/models/vehicles/shared_lorry.glb`
- **Target Size:** < 1.8 MB
- **Suggested Search Terms:** "commercial truck", "medium lorry", "Tata 1613 truck", "Ashok Leyland lorry"
- **Recommended Sources:** Poly Pizza, Kenney Car Kit
- **Visual Features:** Heavy-duty 6-wheel commercial chassis, high driver cab, extended wooden/steel stake cargo body for multi-ton wholesale transport.

---

## 2. Model Preparation Command

Run downloaded models through `gltf-transform` before saving to `src/assets/models/vehicles/`:
```bash
npx @gltf-transform/cli optimize input.glb src/assets/models/vehicles/<target_filename>.glb --draco --texture-resize 1024
```
