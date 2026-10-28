/**
 * Comprehensive 3D Crop Agronomic Model Registry
 * Maps all 24 Department of Agriculture crops to visually distinct procedural geometries & materials.
 */

import advisoryData from '../../../data/advisory_data.json';

export const CROP_3D_REGISTRY = {
  'Paddy': {
    crop: 'Paddy',
    type: 'flooded',
    water: true,
    rowSpacing: 0.25,
    plantSpacing: 0.18,
    scale: 0.9,
    groundColor: '#1e3a29', // Muddy flooded paddy soil
    waterColor: '#38bdf8',
    stemColor: '#a3e635',
    panicleColor: '#eab308', // Drooping golden-yellow rice panicles
    extras: ['water_reflection', 'bunds'],
    description: 'Flooded paddy plot with reflective water and slender golden-green swaying panicles'
  },
  'Tomato': {
    crop: 'Tomato',
    type: 'staked',
    water: false,
    rowSpacing: 0.65,
    plantSpacing: 0.45,
    scale: 1.0,
    groundColor: '#451a03',
    stemColor: '#15803d',
    fruitColor: '#ef4444', // Red tomato globes
    fruitRadius: 0.12,
    hasStakes: true,
    extras: ['stakes', 'string_support'],
    description: 'Staked tomato plants with vertical bamboo poles and clusters of red fruit'
  },
  'Brinjal': {
    crop: 'Brinjal',
    type: 'bush_fruit',
    water: false,
    rowSpacing: 0.7,
    plantSpacing: 0.5,
    scale: 1.1,
    groundColor: '#3f1f0a',
    stemColor: '#166534',
    fruitColor: '#7c3aed', // Purple aubergines
    fruitRadius: 0.14,
    hasStakes: false,
    extras: ['broad_leaves'],
    description: 'Broad-leaved bushy plants with hanging elongated purple eggplants'
  },
  'Green Chilli': {
    crop: 'Green Chilli',
    type: 'bush_fruit',
    water: false,
    rowSpacing: 0.5,
    plantSpacing: 0.35,
    scale: 0.8,
    groundColor: '#3d1d08',
    stemColor: '#16a34a',
    fruitColor: '#15803d', // Slender upright emerald peppers
    fruitRadius: 0.05,
    hasStakes: false,
    extras: ['tapered_chillies'],
    description: 'Dense small shrub with upright pointed emerald-green chillies'
  },
  'Capsicum': {
    crop: 'Capsicum',
    type: 'staked',
    water: false,
    rowSpacing: 0.55,
    plantSpacing: 0.4,
    scale: 0.9,
    groundColor: '#421e06',
    stemColor: '#15803d',
    fruitColor: '#22c55e', // Blocky bell peppers
    fruitRadius: 0.13,
    hasStakes: true,
    extras: ['bell_fruit'],
    description: 'Short staked plant with plump blocky green bell peppers'
  },
  'Cabbage': {
    crop: 'Cabbage',
    type: 'cabbage_head',
    water: false,
    rowSpacing: 0.5,
    plantSpacing: 0.4,
    scale: 1.0,
    groundColor: '#381a04',
    leafColor: '#10b981',
    innerHeadColor: '#6ee7b7', // Round layered pale green heads
    headRadius: 0.22,
    extras: ['rosette_outer_leaves'],
    description: 'Ground-hugging rosettes with large compact concentric cabbage heads'
  },
  'Carrot': {
    crop: 'Carrot',
    type: 'feathery_root',
    water: false,
    rowSpacing: 0.35,
    plantSpacing: 0.15,
    scale: 0.75,
    groundColor: '#451a03',
    leafColor: '#16a34a', // Fine feathery fern-like tops
    rootCrownColor: '#ea580c', // Orange top crown peeking out of ridge
    extras: ['furrow_ridges', 'orange_crowns'],
    description: 'Raised soil ridges with feathery carrot foliage and peeking orange crowns'
  },
  'Potato': {
    crop: 'Potato',
    type: 'bushy_vine',
    water: false,
    rowSpacing: 0.6,
    plantSpacing: 0.3,
    scale: 0.85,
    groundColor: '#3c1803',
    leafColor: '#15803d',
    flowerColor: '#ffffff', // Small white solanum flowers
    extras: ['hilled_mounds'],
    description: 'Hilled soil ridges with dense bushy compound potato leaves and white blossoms'
  },
  'Sweet Potato': {
    crop: 'Sweet Potato',
    type: 'bushy_vine',
    water: false,
    rowSpacing: 0.6,
    plantSpacing: 0.25,
    scale: 0.7,
    groundColor: '#451a03',
    leafColor: '#65a30d',
    flowerColor: '#d946ef',
    extras: ['sprawling_ground_cover'],
    description: 'Dense heart-shaped sprawling morning-glory vine mound'
  },
  'Big Onion': {
    crop: 'Big Onion',
    type: 'bulb',
    water: false,
    rowSpacing: 0.3,
    plantSpacing: 0.15,
    scale: 0.7,
    groundColor: '#361805',
    bulbColor: '#d97706', // Golden brown bulb partially exposed
    quillColor: '#22c55e', // Hollow vertical green tubular scapes
    extras: ['exposed_bulbs'],
    description: 'Raised nursery beds with protruding golden-brown bulbs and tubular green quills'
  },
  'Red Onion': {
    crop: 'Red Onion',
    type: 'bulb',
    water: false,
    rowSpacing: 0.25,
    plantSpacing: 0.12,
    scale: 0.65,
    groundColor: '#331503',
    bulbColor: '#991b1b', // Clustered purplish-red bulbs
    quillColor: '#16a34a',
    extras: ['cluster_bulbs'],
    description: 'High-density planting bed with exposed ruby-red shallot bulbs'
  },
  'Beetroot': {
    crop: 'Beetroot',
    type: 'bulb',
    water: false,
    rowSpacing: 0.35,
    plantSpacing: 0.18,
    scale: 0.8,
    groundColor: '#3f1704',
    bulbColor: '#be185d', // Deep magenta beetroot globe
    quillColor: '#9d174d', // Red-veined leafy stems
    extras: ['magenta_crown'],
    description: 'Cylindrical root beds with prominent magenta beet crowns and crimson-veined tops'
  },
  'Pole Bean': {
    crop: 'Pole Bean',
    type: 'trellis',
    water: false,
    rowSpacing: 0.8,
    plantSpacing: 0.4,
    scale: 1.3,
    groundColor: '#401b06',
    leafColor: '#15803d',
    podColor: '#84cc16', // Hanging green pods
    hasTrellis: true,
    extras: ['trellis_posts', 'horizontal_wire'],
    description: 'Vertical bamboo A-frame trellis with climbing vines and hanging legume pods'
  },
  'Black Gram': {
    crop: 'Black Gram',
    type: 'legume_bush',
    water: false,
    rowSpacing: 0.35,
    plantSpacing: 0.2,
    scale: 0.65,
    groundColor: '#381a04',
    leafColor: '#1e293b',
    flowerColor: '#eab308',
    extras: ['hairy_pods'],
    description: 'Low-spreading trifoliate dry zone pulse with hairy upright pod clusters'
  },
  'Cowpea': {
    crop: 'Cowpea',
    type: 'legume_bush',
    water: false,
    rowSpacing: 0.45,
    plantSpacing: 0.25,
    scale: 0.8,
    groundColor: '#3d1d08',
    leafColor: '#15803d',
    podColor: '#a3e635',
    extras: ['long_upright_pods'],
    description: 'Semi-erect bushy legume with prominent long green/purple pods borne above canopy'
  },
  'Gingelly': {
    crop: 'Gingelly',
    type: 'tall_stalk',
    water: false,
    rowSpacing: 0.4,
    plantSpacing: 0.2,
    scale: 1.1,
    groundColor: '#4a2508',
    leafColor: '#65a30d',
    flowerColor: '#f8fafc', // White/pale-pink tubular sesame flowers
    extras: ['capsule_clusters'],
    description: 'Slender single upright sesame stalks with axillary white bell flowers and seed capsules'
  },
  'Green Gram': {
    crop: 'Green Gram',
    type: 'legume_bush',
    water: false,
    rowSpacing: 0.35,
    plantSpacing: 0.2,
    scale: 0.7,
    groundColor: '#3b1c06',
    leafColor: '#16a34a',
    podColor: '#14532d',
    extras: ['cluster_pods'],
    description: 'Compact golden-mung pulse bush with dark green drooping clusters of pods'
  },
  'Groundnut': {
    crop: 'Groundnut',
    type: 'legume_bush',
    water: false,
    rowSpacing: 0.4,
    plantSpacing: 0.2,
    scale: 0.6,
    groundColor: '#4c2608',
    leafColor: '#15803d',
    flowerColor: '#f59e0b', // Yellow pea flowers with pegs entering soil
    extras: ['subterranean_pegs'],
    description: 'Low creeping quadrifoliate canopy with yellow flowers and soil-penetrating pegs'
  },
  'Kurakkan': {
    crop: 'Kurakkan',
    type: 'tall_stalk',
    water: false,
    rowSpacing: 0.3,
    plantSpacing: 0.15,
    scale: 0.95,
    groundColor: '#3d1d08',
    leafColor: '#166534',
    panicleColor: '#7f1d1d', // Distinctive finger-like digitate head (finger millet)
    extras: ['finger_heads'],
    description: 'Hardy finger millet tuft with terminal digitate clusters resembling curved fingers'
  },
  'Maize': {
    crop: 'Maize',
    type: 'tall_stalk',
    water: false,
    rowSpacing: 0.75,
    plantSpacing: 0.3,
    scale: 1.6,
    groundColor: '#421d06',
    leafColor: '#15803d',
    tasselColor: '#eab308', // Feathery male tassels at top
    cobColor: '#ca8a04', // Side ears with silk
    extras: ['broad_recurved_leaves', 'top_tassels', 'side_cobs'],
    description: 'Towering robust maize stalks with wide arching leaves, top tassels, and swelling ear cobs'
  },
  'Manioc': {
    crop: 'Manioc',
    type: 'tuber_shrub',
    water: false,
    rowSpacing: 0.9,
    plantSpacing: 0.7,
    scale: 1.4,
    groundColor: '#3e1a05',
    stemColor: '#78350f', // Woody knobby brown stems
    leafColor: '#15803d', // Palmate fan-shaped leaves
    extras: ['palmate_canopy', 'stem_nodes'],
    description: 'Tall woody cassava shrub with prominent nodes and umbrella-like palmate compound leaves'
  },
  'Pumpkin': {
    crop: 'Pumpkin',
    type: 'sprawling_vine',
    water: false,
    rowSpacing: 1.2,
    plantSpacing: 0.8,
    scale: 0.9,
    groundColor: '#3b1a04',
    leafColor: '#15803d',
    fruitColor: '#ea580c', // Large ribbed round pumpkins
    fruitRadius: 0.3,
    extras: ['large_ribbed_fruit', 'creeping_tendrils'],
    description: 'Sprawling carpet of rough hairy leaves with yellow flowers and giant ribbed orange pumpkins'
  },
  'Bitter Gourd': {
    crop: 'Bitter Gourd',
    type: 'trellis',
    water: false,
    rowSpacing: 0.9,
    plantSpacing: 0.5,
    scale: 1.1,
    groundColor: '#401c06',
    leafColor: '#16a34a',
    fruitColor: '#047857', // Warty bumpy green gourds
    fruitRadius: 0.08,
    hasTrellis: true,
    extras: ['pandol_trellis', 'warty_gourds'],
    description: 'Overhead pandol trellis canopy with hanging deeply-warted emerald bitter gourds'
  },
  'Soybean': {
    crop: 'Soybean',
    type: 'legume_bush',
    water: false,
    rowSpacing: 0.45,
    plantSpacing: 0.2,
    scale: 0.85,
    groundColor: '#381804',
    leafColor: '#16a34a',
    podColor: '#ca8a04',
    extras: ['pubescent_pods'],
    description: 'Sturdy bushy soybean with dense foliage and clusters of hairy golden-brown pods'
  }
};

/**
 * Dev check to guarantee all crops in advisoryData have an entry,
 * fails if two different crops resolve to the same model and config,
 * and lists any crop in advisoryData.crops missing from the registry.
 */
export function validateCropRegistry() {
  const missing = [];
  const registered = Object.keys(CROP_3D_REGISTRY);

  const advisoryCrops = Object.keys(advisoryData.crops || {});
  for (const c of advisoryCrops) {
    if (!CROP_3D_REGISTRY[c]) {
      missing.push(c);
    }
  }

  // Check for duplicate model/config signatures across distinct crops
  const signatures = new Map();
  const duplicates = [];

  for (const [cropName, cfg] of Object.entries(CROP_3D_REGISTRY)) {
    const sig = JSON.stringify({
      model: cfg.model || null,
      type: cfg.type,
      water: !!cfg.water,
      groundColor: cfg.groundColor,
      stemColor: cfg.stemColor,
      fruitColor: cfg.fruitColor,
      leafColor: cfg.leafColor,
      bulbColor: cfg.bulbColor,
      innerHeadColor: cfg.innerHeadColor,
      podColor: cfg.podColor,
      hasStakes: !!cfg.hasStakes,
      hasTrellis: !!cfg.hasTrellis,
      extras: (cfg.extras || []).slice().sort()
    });

    if (signatures.has(sig)) {
      duplicates.push({ cropA: signatures.get(sig), cropB: cropName });
    } else {
      signatures.set(sig, cropName);
    }
  }

  const isSuccess = missing.length === 0 && duplicates.length === 0;

  if (missing.length > 0) {
    console.error(`[Aswenna Dev Check FAIL] Missing 3D crop configs in registry: ${missing.join(', ')}`);
  }
  if (duplicates.length > 0) {
    duplicates.forEach(d => {
      console.warn(`[Aswenna Dev Check WARNING] Crops '${d.cropA}' and '${d.cropB}' share identical 3D config signatures! Each crop must be visually distinct.`);
    });
  }

  if (isSuccess) {
    console.info(`[Aswenna Dev Check PASS] All ${registered.length} crops verified with unique 3D visual architectures.`);
  }

  return { isValid: isSuccess, missing, duplicates, registeredCount: registered.length };
}

// Auto-run validation check in development
if (typeof window !== 'undefined') {
  validateCropRegistry();
}

export function getCropConfig(cropName) {
  if (CROP_3D_REGISTRY[cropName]) {
    return CROP_3D_REGISTRY[cropName];
  }
  return {
    crop: cropName,
    isMissing: true,
    type: 'unavailable',
    scale: 0.5,
    groundColor: '#451a03',
    description: `3D model not available for ${cropName}`
  };
}
