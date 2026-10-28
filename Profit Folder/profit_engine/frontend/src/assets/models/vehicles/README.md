# Aswenna 3D Vehicle Assets Directory

This directory hosts low-poly / stylized `.glb` 3D vehicle models for the Aswenna Agricultural Decision Support System.
Each model is loaded asynchronously using `@react-three/drei`'s `useGLTF`. When a model is absent or downloading, the app displays a high-quality 2.5D vector illustration fallback with the same camera & hotspot interaction.

## Required Models List

| Vehicle Name | Target Filename | Suggested Search Terms | Target Source |
|---|---|---|---|
| DIMO Batta HT2 (1-Ton Mini Truck) | `dimo_batta.glb` | "Tata Ace mini truck", "mini truck low poly", "pickup flatbed" | Poly Pizza / Kenney / Quaternius |
| DIMO Batti / Tata Ace Zip | `dimo_batti.glb` | "small delivery truck", "micro truck", "kei truck" | Poly Pizza / Kenney |
| Tata Ace Gold Diesel | `tata_ace_gold.glb` | "commercial mini truck", "flatbed lorry", "utility truck" | Poly Pizza / Sketchfab CC-BY |
| Suzuki Carry Mini Truck | `suzuki_carry.glb` | "Suzuki Carry", "Japanese Kei truck", "subaru sambar" | Poly Pizza / Kenney |
| Mahindra Bolero Pik-Up | `mahindra_bolero.glb` | "Mahindra Bolero", "heavy duty pickup", "work pickup truck" | Poly Pizza / Sketchfab CC-BY |
| Bajaj RE Three-Wheeler (Petrol) | `bajaj_re_petrol.glb` | "tuk tuk", "auto rickshaw", "three wheeler low poly" | Poly Pizza / Quaternius / Kenney |
| Bajaj RE Three-Wheeler (Diesel) | `bajaj_re_diesel.glb` | "diesel tuk tuk", "cargo rickshaw", "delivery three wheeler" | Poly Pizza / Quaternius |
| Bajaj CT100 Motorbike | `bajaj_ct100.glb` | "commuter motorcycle", "100cc motorbike", "delivery bike" | Poly Pizza / Kenney |
| Shared Commercial Freight Lorry | `shared_lorry.glb` | "commercial truck", "medium lorry", "cargo truck low poly" | Poly Pizza / Kenney Car Kit |

## Optimization Guidelines
Before placing `.glb` files into this folder:
1. Ensure the model is optimized: `npx @gltf-transform/cli optimize input.glb output.glb --draco --texture-resize 1024`
2. Keep individual model file size under **1.5 MB**.
3. Align the model origin $(0, 0, 0)$ to the ground center between the front and rear axles.
