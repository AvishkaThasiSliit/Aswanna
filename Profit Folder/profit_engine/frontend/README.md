# Aswenna (අස්වැන්න) — Frontend Architecture & Farmer Profit Calculator

This directory contains the modernized, modular React + Vite frontend for **Aswenna**, an agricultural decision-support system designed for Sri Lankan smallholder farmers and researchers.

---

## 1. New Dependencies

The refactor introduces a focused modern stack for high-performance animation, 3D simulation, and state management:

- **`zustand` (`^5.0.15`)**: Lightweight, in-memory state management for the 7-step wizard (no `localStorage` persistence).
- **`framer-motion` (`^14.0.0`)**: Smooth direction-aware slide/fade transitions, micro-interactions, layout animations, and spring physics.
- **`three` (`^0.186.1`)**, **`@react-three/fiber` (`^9.8.1`)**, **`@react-three/drei` (`^10.7.9`)**: Interactive 3D field plot with instanced crop rows, ambient wind swaying, and 3D vehicle inspection with animated camera focus rig.
- **`canvas-confetti` (`^1.9.4`)**: Micro-celebration effect upon computing profitable harvest scenarios.
- **`lucide-react` (`^1.52.0`)**: Comprehensive icons throughout the interface.

---

## 2. Modular Folder Map (All Files < 300 Lines)

```
src/
├── main.jsx                     # Application bootstrap
├── App.jsx                      # Router & tab shell (<85 lines)
├── styles/
│   ├── tokens.css               # Design tokens (emerald brand, slate, radii, glassmorphism)
│   └── global.css               # Comprehensive UI design system & responsive styling
├── i18n/
│   └── en.js                    # UI strings with Sinhala translations
├── data/
│   ├── advisory_data.json       # Core advisory benchmarks & route matrices
│   ├── cropDistricts.js         # Verified DOA crop-district map & special command schemes
│   ├── cropsData.js             # 24 crops categorized (Vegetables, Grains, Pulses, Tubers, Spices)
│   ├── centres.js               # 14 Economic Centres with GPS coordinates (lat, lon)
│   └── vehiclesData.js          # 8 transport vehicles with 3D model paths & camera targets
├── api/
│   ├── advisoryApi.js           # Client for /api/advisory-predict, /health, /api/metadata
│   ├── costApi.js               # Client for /api/cost/predict
│   └── priceApi.js              # Client for /api/price/forecast
├── hooks/
│   ├── useAdvisoryPredict.js    # Debounced (~400ms) prediction hook
│   ├── useGeolocation.js        # Browser Geolocation API wrapper with fallback
│   └── useCountUp.js            # Smooth number count-up animation hook
├── state/
│   └── calculatorStore.js       # Zustand in-memory store for wizard & inputs
├── utils/
│   ├── format.js                # LKR currency, kg, and percentage formatters
│   ├── geo.js                   # Haversine distance, road winding factor, freight preview
│   └── metrics.js               # Combined econometric calculations & donut math
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx          # Collapsible responsive navigation sidebar
│   │   ├── Topbar.jsx           # Top header with ML API status pill
│   │   └── Footer.jsx           # Clean footer branding
│   ├── common/
│   │   ├── Button.jsx           # Unified button component
│   │   ├── Card.jsx             # Glassmorphic elevated card
│   │   ├── AnimatedNumber.jsx   # Counting KPI component
│   │   ├── ReadOnlyBadge.jsx    # Locked badge for live CBSL/DOA market data
│   │   └── Skeleton.jsx         # Loading shimmer skeleton
│   ├── wizard/
│   │   ├── WizardShell.jsx      # Progress, summary bar, step transition orchestrator
│   │   ├── ProgressHeader.jsx   # 7-step numbered navigation bar with progress fill
│   │   ├── SelectionSummary.jsx # Live clickable selection chip bar
│   │   ├── StepTransition.jsx   # Direction-aware AnimatePresence wrapper
│   │   ├── WizardFooter.jsx     # Sticky Back/Next buttons with shake hint
│   │   └── CalculatingScreen.jsx# Growing seedling SVG animation
│   ├── steps/
│   │   ├── StepCrop.jsx         # Step 1: 24 crop cards, search, category chips, info strip
│   │   ├── StepDistrict.jsx     # Step 2: Interactive Sri Lanka map & verified zones
│   │   ├── StepConditions.jsx   # Step 3: Illustrated toggle cards (Season, Irrigation, Mode)
│   │   ├── StepField.jsx        # Step 4: 3D field plot, acreage slider, sacks indicator
│   │   ├── StepVehicle.jsx      # Step 5: 3D vehicle viewer, camera hotspots, fuel price
│   │   ├── StepLocation.jsx     # Step 6: GPS location, ranked Economic Centres
│   │   └── StepLeafy.jsx        # Step 7: Leafy greens toggle, animated nursery bed
│   ├── three/
│   │   ├── FieldScene.jsx       # R3F instanced crop rows & wind sway (with 2D fallback)
│   │   └── VehicleScene.jsx     # 3D low-poly vehicle models with camera hotspot rig
│   ├── map/
│   │   ├── SriLankaMap.jsx      # SVG interactive 25-district map
│   │   └── CentresMap.jsx       # SVG geo-projection map with dynamic route lines
│   └── results/
│       ├── ResultsDashboard.jsx # Results coordinator with print & recalculate
│       ├── KpiCards.jsx         # Count-up KPI cards, confetti, locked market badges
│       ├── ChannelComparison.jsx# Channel A vs Channel B cards with AI recommendation
│       ├── CostDonut.jsx        # Interactive SVG donut chart with hover readout
│       ├── ProfitTrendChart.jsx # 4-week cumulative profit trajectory curves
│       ├── FinancialTable.jsx   # Comprehensive audit statement
│       └── AiRecommendations.jsx# AI decision insight cards
└── pages/
    ├── ProfitCalculatorPage.jsx # Full-screen 7-step wizard + results dashboard
    ├── CostEstimatorPage.jsx    # Standalone 23-crop ML cost engine (unaltered backend)
    ├── PriceForecastPage.jsx    # Standalone 32-vegetable AutoARIMA price forecaster
    ├── LogisticsPage.jsx        # Dedicated Economic Centres directory & fleet table
    └── AdvisoryPage.jsx         # Research decision support system hub
```

---

## 3. How Each Wizard Step Maps to the Backend Payload

When the user completes Step 7 and triggers calculation, `useAdvisoryPredict.js` sends the following JSON payload to `POST /api/advisory-predict`:

| Wizard Step | User Selection / Component | Payload Key | Example Value |
|---|---|---|---|
| **Step 1** | Primary Crop Card | `crop` | `"Tomato"` |
| **Step 2** | Interactive Map District | `district` | `"Badulla"` |
| **Step 3** | Season Card (Maha / Yala) | `season` | `"Maha"` |
| **Step 3** | Irrigation Card | `irrigation_type` | `"Irrigated"` |
| **Step 3** | Automated Calendar | `year_start` | `2026` (`new Date().getFullYear()`) |
| **Step 4** | Acreage Slider (0.25–10 ac) | `acreage` | `1.5` |
| **Step 4** | Custom Yield Override (optional)| `custom_yield_kg` | `12500` or `null` |
| **Step 5** | Vehicle Carousel Selector | `vehicle_id` | `"dimo_batta_ht2"` |
| **Step 5** | Fuel Price Input | `diesel_price` / `petrol_price` | `315.0` / `360.0` |
| **Step 6** | Selected Economic Centre | `target_economic_centre` | `"Keppetipola Economic Centre"` |
| **Step 7** | Leafy Greens Toggle | `enable_leafy` | `true` |
| **Step 7** | Leafy Crop Variety | `leafy_crop` | `"Gotukola"` |
| **Step 7** | Nursery Bed Perches | `leafy_perches` | `5.0` |
| **Fixed** | Read-Only Live Market Buyer Price | `custom_buyer_price` | `null` (uses CBSL live clearing) |
| **Fixed** | Post-Harvest Handling Loss Rate | `post_harvest_loss_pct` | `8.0` (from national benchmarks) |
| **Fixed** | Central Bank Exchange Rate | `usd_lkr_rate` | `310.0` |
| **Fixed** | Forward Planning Horizon | `forecast_horizon_weeks`| `4` |

*Note: `profitMode` (`economic` vs `cash`) and `channelMode` (`market` vs `buyer`) are client-side econometric display switches that format the output instantly without unnecessary network refetches.*

---

## 4. Assets to Replace with Production Media

The application includes high-fidelity programmatic vector assets and stylized 3D procedural primitives out of the box. You can replace them with photographic or binary glTF assets at any time:

1. **Crop Illustrations / Photos**:
   - Directory: `src/assets/crops/`
   - Files: `tomato.svg`, `paddy.svg`, `potato.svg`, `big_onion.svg`, etc.
   - *Current fallback: Rich Unicode emojis + color palettes in `cropsData.js`.*
2. **Vehicle 3D glTF / GLB Models**:
   - Directory: `src/assets/models/`
   - Files: `dimo_batta.glb`, `isuzu_elf.glb`, `suzuki_carry.glb`, `bolero.glb`, `tuktuk.glb`, `bike.glb`, `heavy_lorry.glb`.
   - *Current fallback: Lightweight procedural low-poly Three.js models with clickable interactive hotspots (`VehicleScene.jsx`).*
3. **Leafy Green Images**:
   - Directory: `src/assets/leafy/`
   - Files: `gotukola.png`, `kankun.png`, `mukunuwenna.png`, etc.

---

## 5. Architectural Improvements & Bug Fixes Resolved

1. **Unified Source of Truth for Crop & District**:
   - Eliminated redundant double-syncing in `onChange` and `useEffect`. District validation and fallback now run via `setSelectedCrop` in `calculatorStore.js`.
2. **Debounced Network Effect**:
   - Replaced immediate re-fetch with a **400ms debounced** lifecycle hook in `useAdvisoryPredict.js`. Display-only properties (`profitMode`, `channelMode`) no longer trigger backend requests.
3. **Elimination of Infinite Route Sync Loops**:
   - Replaced static circular route lookups with derived GPS/district centroid calculations in `geo.js`.
4. **Removal of Hardcoded Fallback Numbers**:
   - Eradicated hardcoded fallback figures (`42000`, `38000`, `50400`, fabricated weekly lines). If the backend is unreachable, the system displays an explicit "Offline / Estimated" banner with a **Retry Connection** button.
5. **Locked Read-Only Market Values**:
   - Per Section 3, Buyer Price and Post-Harvest Loss (%) are non-editable read-only badges sourced from live CBSL/DOA data.
6. **Graceful 3D Degradation & Accessibility**:
   - Step 4 and Step 5 include a **2D Low-Power Mode** toggle and full `prefers-reduced-motion` CSS/JS compliance for low-end mobile devices used in rural areas.
