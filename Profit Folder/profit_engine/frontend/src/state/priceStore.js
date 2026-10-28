import { create } from 'zustand';
import { forecastPrice } from '../api/priceApi';
import { HORIZON_CONFIGS } from '../data/priceCommoditiesData';

export const usePriceStore = create((set, get) => ({
  // Wizard Navigation
  currentStep: 1, // 1: Commodity, 2: Horizon & Recommended Model, 3: Dynamics & Target
  totalSteps: 3,
  isResultView: false,
  direction: 1, // 1 = forward, -1 = backward

  // Parameters
  selectedCommodity: 'Tomato No1.',
  selectedCategory: 'All',
  selectedHorizon: 4, // 1, 4, 8, 12
  selectedModel: 'selected', // Best Champion Model auto-selected by default
  showAdvancedModelSelector: false,
  farmerTargetPrice: '',

  // API State
  forecastResult: null,
  vegetablesCatalog: [],
  isLoading: false,
  isCatalogLoading: false,
  error: null,

  // Navigation Actions
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
    const { currentStep, isResultView } = get();
    if (isResultView) {
      set({ isResultView: false, currentStep: 3, direction: -1 });
    } else if (currentStep > 1) {
      set({ currentStep: currentStep - 1, direction: -1 });
    }
  },

  goToResults: () => set({ isResultView: true }),

  editParameters: (step = 1) => set({ isResultView: false, currentStep: step, direction: -1 }),

  // Parameter Setters
  setSelectedCommodity: (commodity) => {
    set({ selectedCommodity: commodity });
    get().fetchForecast();
  },

  setSelectedCategory: (category) => {
    set({ selectedCategory: category });
  },

  setSelectedHorizon: (horizon) => {
    // When horizon changes, keep the recommended champion model ('selected') automatically
    set({ selectedHorizon: horizon, selectedModel: 'selected' });
    get().fetchForecast();
  },

  setSelectedModel: (model) => {
    set({ selectedModel: model });
    get().fetchForecast();
  },

  setShowAdvancedModelSelector: (show) => {
    set({ showAdvancedModelSelector: show });
  },

  setFarmerTargetPrice: (price) => {
    set({ farmerTargetPrice: price });
  },

  // API Calls
  fetchVegetablesCatalog: async () => {
    set({ isCatalogLoading: true });
    try {
      const res = await fetch('/api/price/vegetables');
      if (res.ok) {
        const data = await res.json();
        set({ vegetablesCatalog: data, isCatalogLoading: false });
      }
    } catch (err) {
      console.warn("Could not load /api/price/vegetables catalog:", err);
      set({ isCatalogLoading: false });
    }
  },

  fetchForecast: async () => {
    const { selectedCommodity, selectedHorizon, selectedModel } = get();
    set({ isLoading: true, error: null });

    try {
      const data = await forecastPrice({
        commodity: selectedCommodity,
        horizon: selectedHorizon,
        model: selectedModel
      });
      set({ forecastResult: data, isLoading: false });
    } catch (err) {
      console.warn("Forecast fetch error:", err);
      set({ error: err.message || "Failed to load market forecast", isLoading: false });
    }
  },

  // Helper selectors
  getActiveHorizonConfig: () => {
    const { selectedHorizon } = get();
    return HORIZON_CONFIGS.find(c => c.horizon === selectedHorizon) || HORIZON_CONFIGS[1];
  }
}));
