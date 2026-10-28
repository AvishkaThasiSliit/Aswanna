/**
 * Vehicle 3D & 2.5D Interactive Hotspots Configuration
 * Stores exact coordinates for Fuel Tank and Cargo Storage
 * with camera focus targets (position, lookAt, distance) for cinematic transitions.
 */

export const VEHICLE_HOTSPOTS = {
  // 1. DIMO Batta HT2 / Small Lorry (1-Ton Workhorse)
  dimo_batta_ht2: {
    id: 'dimo_batta_ht2',
    name: 'DIMO Batta HT2',
    modelFile: 'dimo_batta.glb',
    fuelType: 'Diesel',
    fuelEconomy: '16–18 km/L',
    payloadKg: 1000,
    cargoVolume: '3.4 m³ (20 harvest crates)',
    // 3D Hotspot Targets
    tank: {
      position: [-0.85, 0.35, -0.2],
      lookAt: [-0.85, 0.35, -0.2],
      cameraPos: [-1.8, 0.6, -0.2],
      distance: 1.5,
      label: 'Diesel Fuel Tank',
      description: '30L capacity with lockable fuel cap'
    },
    storage: {
      position: [0.0, 0.75, 0.7],
      lookAt: [0.0, 0.6, 0.7],
      cameraPos: [0.0, 2.2, 1.8],
      distance: 2.2,
      label: 'Cargo Flatbed',
      description: '1,000 kg capacity (1-ton produce)'
    },
    // 2.5D Interactive Marker Positions (% on canvas)
    svgHotspots: {
      tank: { x: 38, y: 64 },
      storage: { x: 70, y: 48 }
    }
  },

  // 2. DIMO Batti / Tata Ace Zip (Small Harvest Loads)
  dimo_batti: {
    id: 'dimo_batti',
    name: 'DIMO Batti / Tata Ace Zip',
    modelFile: 'dimo_batti.glb',
    fuelType: 'Diesel',
    fuelEconomy: '20–24 km/L',
    payloadKg: 600,
    cargoVolume: '2.1 m³ (12 harvest crates)',
    tank: {
      position: [-0.8, 0.3, -0.2],
      lookAt: [-0.8, 0.3, -0.2],
      cameraPos: [-1.6, 0.5, -0.2],
      distance: 1.4,
      label: 'Diesel Fuel Tank',
      description: '25L high-efficiency tank'
    },
    storage: {
      position: [0.0, 0.65, 0.6],
      lookAt: [0.0, 0.5, 0.6],
      cameraPos: [0.0, 1.9, 1.5],
      distance: 1.9,
      label: 'Compact Cargo Bed',
      description: '600 kg smallholder load'
    },
    svgHotspots: {
      tank: { x: 36, y: 65 },
      storage: { x: 68, y: 49 }
    }
  },

  // 3. Tata Ace Gold Diesel
  tata_ace_gold: {
    id: 'tata_ace_gold',
    name: 'Tata Ace Gold Diesel',
    modelFile: 'tata_ace_gold.glb',
    fuelType: 'Diesel',
    fuelEconomy: '16–18 km/L',
    payloadKg: 1000,
    cargoVolume: '3.5 m³ (20 harvest crates)',
    tank: {
      position: [-0.85, 0.35, -0.2],
      lookAt: [-0.85, 0.35, -0.2],
      cameraPos: [-1.8, 0.6, -0.2],
      distance: 1.5,
      label: 'Diesel Fuel Tank',
      description: '30L chassis-mounted tank'
    },
    storage: {
      position: [0.0, 0.75, 0.7],
      lookAt: [0.0, 0.6, 0.7],
      cameraPos: [0.0, 2.2, 1.8],
      distance: 2.2,
      label: 'Reinforced Cargo Deck',
      description: '1,000 kg standard freight deck'
    },
    svgHotspots: {
      tank: { x: 38, y: 64 },
      storage: { x: 70, y: 48 }
    }
  },

  // 4. Suzuki Carry Mini Truck
  suzuki_carry: {
    id: 'suzuki_carry',
    name: 'Suzuki Carry',
    modelFile: 'suzuki_carry.glb',
    fuelType: 'Petrol',
    fuelEconomy: '16.5–18.5 km/L',
    payloadKg: 650,
    cargoVolume: '2.6 m³ (14 harvest crates)',
    tank: {
      position: [-0.8, 0.32, -0.15],
      lookAt: [-0.8, 0.32, -0.15],
      cameraPos: [-1.7, 0.55, -0.15],
      distance: 1.4,
      label: 'Petrol Fuel Tank',
      description: '38L gasoline tank'
    },
    storage: {
      position: [0.0, 0.7, 0.65],
      lookAt: [0.0, 0.55, 0.65],
      cameraPos: [0.0, 2.0, 1.6],
      distance: 2.0,
      label: 'Low Loading Flatbed',
      description: '650 kg fruit & vegetable flatbed'
    },
    svgHotspots: {
      tank: { x: 37, y: 64 },
      storage: { x: 69, y: 48 }
    }
  },

  // 5. Mahindra Bolero Pik-Up (Heavy Crop Loads)
  mahindra_bolero: {
    id: 'mahindra_bolero',
    name: 'Mahindra Bolero Pik-Up',
    modelFile: 'mahindra_bolero.glb',
    fuelType: 'Diesel',
    fuelEconomy: '10.5–12.5 km/L',
    payloadKg: 1750,
    cargoVolume: '4.8 m³ (35 harvest sacks)',
    tank: {
      position: [-0.95, 0.42, -0.3],
      lookAt: [-0.95, 0.42, -0.3],
      cameraPos: [-2.0, 0.75, -0.3],
      distance: 1.7,
      label: 'Heavy Diesel Tank',
      description: '57L high-capacity diesel tank'
    },
    storage: {
      position: [0.0, 0.85, 0.85],
      lookAt: [0.0, 0.7, 0.85],
      cameraPos: [0.0, 2.5, 2.0],
      distance: 2.5,
      label: 'High-Wall Cargo Bed',
      description: '1,750 kg heavy-duty payload'
    },
    svgHotspots: {
      tank: { x: 34, y: 66 },
      storage: { x: 72, y: 46 }
    }
  },

  // 6. Bajaj RE Petrol Three-Wheeler
  bajaj_re_petrol: {
    id: 'bajaj_re_petrol',
    name: 'Bajaj RE 4S (Petrol Tuk-Tuk)',
    modelFile: 'bajaj_re_petrol.glb',
    fuelType: 'Petrol',
    fuelEconomy: '26–29 km/L',
    payloadKg: 300,
    cargoVolume: '1.2 m³ (6 vegetable crates)',
    tank: {
      position: [-0.55, 0.35, -0.1],
      lookAt: [-0.55, 0.35, -0.1],
      cameraPos: [-1.4, 0.55, -0.1],
      distance: 1.2,
      label: 'Petrol Fuel Tank',
      description: '8L under-seat fuel tank'
    },
    storage: {
      position: [0.0, 0.5, 0.45],
      lookAt: [0.0, 0.4, 0.45],
      cameraPos: [0.0, 1.6, 1.2],
      distance: 1.5,
      label: 'Rear Passenger / Cargo Bay',
      description: '300 kg produce crates'
    },
    svgHotspots: {
      tank: { x: 38, y: 62 },
      storage: { x: 62, y: 52 }
    }
  },

  // 7. Bajaj RE Diesel Three-Wheeler
  bajaj_re_diesel: {
    id: 'bajaj_re_diesel',
    name: 'Bajaj RE Diesel Three-Wheeler',
    modelFile: 'bajaj_re_diesel.glb',
    fuelType: 'Diesel',
    fuelEconomy: '26–29 km/L',
    payloadKg: 350,
    cargoVolume: '1.3 m³ (7 vegetable crates)',
    tank: {
      position: [-0.55, 0.35, -0.1],
      lookAt: [-0.55, 0.35, -0.1],
      cameraPos: [-1.4, 0.55, -0.1],
      distance: 1.2,
      label: 'Diesel Fuel Tank',
      description: '8L diesel fuel tank'
    },
    storage: {
      position: [0.0, 0.5, 0.45],
      lookAt: [0.0, 0.4, 0.45],
      cameraPos: [0.0, 1.6, 1.2],
      distance: 1.5,
      label: 'Rear Cargo Bay',
      description: '350 kg heavy smallholder load'
    },
    svgHotspots: {
      tank: { x: 38, y: 62 },
      storage: { x: 62, y: 52 }
    }
  },

  // 8. Bajaj CT100 Motorbike
  bajaj_ct100: {
    id: 'bajaj_ct100',
    name: 'Bajaj CT100 Motorbike',
    modelFile: 'bajaj_ct100.glb',
    fuelType: 'Petrol',
    fuelEconomy: '70–75 km/L',
    payloadKg: 50,
    cargoVolume: '0.2 m³ (2 sacks on rear carrier)',
    tank: {
      position: [0.0, 0.65, -0.15],
      lookAt: [0.0, 0.65, -0.15],
      cameraPos: [-1.2, 0.8, -0.15],
      distance: 1.2,
      label: 'Motorbike Fuel Tank',
      description: '10.5L teardrop petrol tank'
    },
    storage: {
      position: [0.0, 0.6, 0.55],
      lookAt: [0.0, 0.6, 0.55],
      cameraPos: [0.0, 1.4, 1.1],
      distance: 1.3,
      label: 'Rear Carrier Rack',
      description: '50 kg small produce sacks'
    },
    svgHotspots: {
      tank: { x: 44, y: 44 },
      storage: { x: 74, y: 42 }
    }
  },

  // 9. Shared Commercial Lorry (Freight)
  shared_lorry: {
    id: 'shared_lorry',
    name: 'Shared Commercial Freight Lorry',
    modelFile: 'shared_lorry.glb',
    fuelType: 'Diesel',
    fuelEconomy: '4.5–5.5 km/L',
    payloadKg: 8000,
    cargoVolume: '28 m³ (160 harvest crates / sacks)',
    tank: {
      position: [-1.2, 0.5, -0.4],
      lookAt: [-1.2, 0.5, -0.4],
      cameraPos: [-2.4, 0.85, -0.4],
      distance: 2.0,
      label: 'Large Commercial Diesel Tank',
      description: '160L heavy transport tank'
    },
    storage: {
      position: [0.0, 1.2, 1.1],
      lookAt: [0.0, 1.0, 1.1],
      cameraPos: [0.0, 3.2, 2.5],
      distance: 3.2,
      label: 'Full Commercial Freight Bed',
      description: '8,000 kg (8-ton) collective haulage'
    },
    svgHotspots: {
      tank: { x: 32, y: 66 },
      storage: { x: 74, y: 42 }
    }
  }
};

export function getVehicleHotspots(vehicleId) {
  return VEHICLE_HOTSPOTS[vehicleId] || VEHICLE_HOTSPOTS['dimo_batta_ht2'];
}
