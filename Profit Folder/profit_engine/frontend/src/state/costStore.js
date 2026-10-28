import { create } from 'zustand';
import { CROP_DISTRICTS_MAP } from '../data/cropDistricts';
import { predictCost } from '../api/costApi';

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

export const useCostStore = create((set, get) => ({
  // Wizard Navigation
  currentStep: 1, // 1: Crop, 2: District/Map, 3: Regimes, 4: 3D Field, 5: Yield
  totalSteps: 5,
  isResultView: false,
  direction: 1, // 1 = next, -1 = back

  // Parameters
  selectedCrop: 'Tomato',
  selectedDistrict: 'Badulla',
  selectedSeason: getSuggestedSeason(),
  selectedIrrigation: 'Irrigated',
  acreage: 1.0,
  customYield: '',

  // Prediction State
  costResult: null,
  isLoading: false,
  error: null,

  // Actions
  setStep: (step) => set({ currentStep: Math.max(1, Math.min(get().totalSteps, step)) }),

  nextStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep < totalSteps) {
      set({ currentStep: currentStep + 1, direction: 1 });
    } else {
      set({ isResultView: true });
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (get().isResultView) {
      set({ isResultView: false, currentStep: 5, direction: -1 });
    } else if (currentStep > 1) {
      set({ currentStep: currentStep - 1, direction: -1 });
    }
  },

  goToResults: () => set({ isResultView: true }),

  editParameters: (step = 1) => set({ isResultView: false, currentStep: step, direction: -1 }),

  setSelectedCrop: (crop) => {
    const validDists = CROP_DISTRICTS_MAP[crop] || ['Badulla'];
    const currentDist = get().selectedDistrict;
    const newDist = validDists.includes(currentDist) ? currentDist : validDists[0];
    set({ selectedCrop: crop, selectedDistrict: newDist });
    get().fetchCostPrediction();
  },

  setSelectedDistrict: (district) => {
    set({ selectedDistrict: district });
    get().fetchCostPrediction();
  },

  setSelectedSeason: (season) => {
    set({ selectedSeason: season });
    get().fetchCostPrediction();
  },

  setSelectedIrrigation: (irrigation) => {
    set({ selectedIrrigation: irrigation });
    get().fetchCostPrediction();
  },

  setAcreage: (acreage) => {
    set({ acreage: Math.max(0.25, Math.min(10.0, parseFloat(acreage) || 1.0)) });
    get().fetchCostPrediction();
  },

  setCustomYield: (customYield) => {
    set({ customYield });
    get().fetchCostPrediction();
  },

  fetchCostPrediction: async () => {
    const { selectedCrop, selectedDistrict, selectedSeason, selectedIrrigation, acreage, customYield } = get();
    set({ isLoading: true, error: null });

    try {
      const payload = {
        crop: selectedCrop,
        district: selectedDistrict,
        season: selectedSeason,
        irrigation_type: selectedIrrigation,
        year_start: 2025,
        usd_lkr_rate: 310.0,
        acreage: acreage,
        custom_yield_kg: customYield ? parseFloat(customYield) : null
      };

      const result = await predictCost(payload);
      set({ costResult: result, isLoading: false });
    } catch (err) {
      console.warn("Cost inference error in costStore:", err);
      set({ error: err.message || "Failed to predict cultivation cost", isLoading: false });
    }
  }
}));
