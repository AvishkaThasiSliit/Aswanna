import { create } from 'zustand';
import { CROP_DISTRICTS_MAP } from '../data/cropDistricts';
import advisoryData from '../data/advisory_data.json';

// Helper to determine suggested season from current calendar
export function getSuggestedSeason() {
  const month = new Date().getMonth(); // 0 = Jan ... 11 = Dec
  // Maha: Oct (9) – Mar (2)
  if (month >= 9 || month <= 2) {
    return 'Maha';
  }
  // Yala: Apr (3) – Sep (8)
  return 'Yala';
}

// Parse initial URL search params if present (for deep links & verification)
const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const initialStep = urlParams && urlParams.get('step') ? Math.max(1, Math.min(7, parseInt(urlParams.get('step'), 10))) : 1;
const initialCrop = urlParams && urlParams.get('crop') ? urlParams.get('crop') : 'Tomato';
const initialDistrict = urlParams && urlParams.get('district') ? urlParams.get('district') : 'Badulla';
const initialVehicle = urlParams && urlParams.get('vehicle') ? urlParams.get('vehicle') : 'dimo_batta_ht2';
const initialCentre = urlParams && urlParams.get('centre') ? urlParams.get('centre') : 'Keppetipola Economic Centre';
const initialAcreage = urlParams && urlParams.get('acreage') ? Math.max(0.25, Math.min(10.0, parseFloat(urlParams.get('acreage')))) : 1.0;

export const useCalculatorStore = create((set, get) => ({
  // Wizard Navigation
  currentStep: initialStep, // 1 to 7
  direction: 1,   // 1 = next (slide left), -1 = back (slide right)
  isResultView: Boolean(urlParams && urlParams.get('view') === 'results'),
  isCalculatingScreen: false,

  // Step 1: Crop
  selectedCrop: initialCrop,

  // Step 2: District
  selectedDistrict: initialDistrict,

  // Step 3: Conditions
  selectedSeason: getSuggestedSeason(),
  selectedIrrigation: 'Irrigated',
  profitMode: 'economic', // 'economic' (Full Cost) | 'cash' (Out of pocket)

  // Step 4: Field & Harvest
  acreage: initialAcreage,
  customYield: '', // string for text input, parsed when non-empty

  // Step 5: Vehicle & Fuel
  selectedVehicleId: initialVehicle,
  dieselPrice: 315.0,
  petrolPrice: 360.0,

  // Step 6: Location & Economic Centres
  userLocation: null, // { lat, lon, label } or null
  selectedCentreName: initialCentre,
  customDistanceKm: 35.0,
  isDistanceEstimated: true,

  // Step 7: Leafy Greens Side Crop
  enableLeafy: true,
  selectedLeafyName: 'Gotukola',
  leafyPerches: 5.0,

  // Post-Harvest & Channel Mode (Read-only / display in results)
  postHarvestLossPct: 8.0,
  channelMode: 'market', // 'market' (Channel B) | 'buyer' (Channel A)

  // API State
  liveData: null,
  isCalculating: false,
  apiOnline: true,
  lastUpdated: 'Just now',
  errorMessage: null,

  // Navigation Actions
  setStep: (step) => {
    const current = get().currentStep;
    const dir = step > current ? 1 : -1;
    set({ currentStep: step, direction: dir, isResultView: false, isCalculatingScreen: false });
  },

  nextStep: () => {
    const current = get().currentStep;
    if (current < 7) {
      set({ currentStep: current + 1, direction: 1, isResultView: false });
    } else if (current === 7) {
      // Move to calculating screen then results
      set({ isCalculatingScreen: true, direction: 1 });
    }
  },

  prevStep: () => {
    const current = get().currentStep;
    if (current > 1) {
      set({ currentStep: current - 1, direction: -1, isResultView: false, isCalculatingScreen: false });
    }
  },

  finishCalculation: () => {
    set({ isCalculatingScreen: false, isResultView: true });
  },

  startOver: () => {
    set({
      currentStep: 1,
      direction: -1,
      isResultView: false,
      isCalculatingScreen: false
    });
  },

  editInputs: () => {
    set({
      isResultView: false,
      isCalculatingScreen: false,
      direction: -1
    });
  },

  // Input Modifiers with agronomic sync
  setSelectedCrop: (crop) => {
    const validDists = CROP_DISTRICTS_MAP[crop] || advisoryData.crops[crop]?.districts || ['Badulla'];
    const currentDist = get().selectedDistrict;
    const nextDist = validDists.includes(currentDist) ? currentDist : validDists[0];
    set({
      selectedCrop: crop,
      selectedDistrict: nextDist,
      customYield: '' // Reset custom yield when crop changes
    });
  },

  setSelectedDistrict: (district) => {
    set({ selectedDistrict: district });
  },

  setSelectedSeason: (season) => set({ selectedSeason: season }),
  setSelectedIrrigation: (irrigation) => set({ selectedIrrigation: irrigation }),
  setProfitMode: (mode) => set({ profitMode: mode }),
  setChannelMode: (mode) => set({ channelMode: mode }),

  setAcreage: (val) => {
    const num = parseFloat(val);
    set({ acreage: isNaN(num) || num <= 0 ? 0.25 : Math.min(10, Math.max(0.25, num)) });
  },

  setCustomYield: (val) => set({ customYield: val }),
  resetToTypicalYield: () => set({ customYield: '' }),

  setSelectedVehicleId: (id) => set({ selectedVehicleId: id }),
  setDieselPrice: (price) => set({ dieselPrice: Math.max(0, parseFloat(price) || 315.0) }),
  setPetrolPrice: (price) => set({ petrolPrice: Math.max(0, parseFloat(price) || 360.0) }),

  setUserLocation: (loc) => set({ userLocation: loc }),
  setSelectedCentre: ({ name, distanceKm, isEstimated }) => set({
    selectedCentreName: name,
    customDistanceKm: distanceKm,
    isDistanceEstimated: Boolean(isEstimated)
  }),

  setEnableLeafy: (enabled) => set({ enableLeafy: enabled }),
  setSelectedLeafyName: (name) => set({ selectedLeafyName: name }),
  setLeafyPerches: (perches) => {
    const num = parseFloat(perches);
    set({ leafyPerches: isNaN(num) ? 5.0 : Math.min(40, Math.max(1, num)) });
  },

  // Predict API State setters
  setLiveData: (data) => set({ liveData: data, apiOnline: true, errorMessage: null, lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }),
  setIsCalculating: (bool) => set({ isCalculating: bool }),
  setApiOnline: (bool) => set({ apiOnline: bool }),
  setErrorMessage: (msg) => set({ errorMessage: msg })
}));
