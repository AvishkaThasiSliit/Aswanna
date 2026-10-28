import { useEffect, useRef } from 'react';
import { useCalculatorStore } from '../state/calculatorStore';
import { predictAdvisory, checkHealth } from '../api/advisoryApi';

export function useAdvisoryPredict() {
  const selectedCrop = useCalculatorStore(s => s.selectedCrop);
  const selectedDistrict = useCalculatorStore(s => s.selectedDistrict);
  const selectedSeason = useCalculatorStore(s => s.selectedSeason);
  const selectedIrrigation = useCalculatorStore(s => s.selectedIrrigation);
  const acreage = useCalculatorStore(s => s.acreage);
  const customYield = useCalculatorStore(s => s.customYield);
  const selectedVehicleId = useCalculatorStore(s => s.selectedVehicleId);
  const selectedCentreName = useCalculatorStore(s => s.selectedCentreName);
  const dieselPrice = useCalculatorStore(s => s.dieselPrice);
  const petrolPrice = useCalculatorStore(s => s.petrolPrice);
  const postHarvestLossPct = useCalculatorStore(s => s.postHarvestLossPct);
  const enableLeafy = useCalculatorStore(s => s.enableLeafy);
  const selectedLeafyName = useCalculatorStore(s => s.selectedLeafyName);
  const leafyPerches = useCalculatorStore(s => s.leafyPerches);

  const setLiveData = useCalculatorStore(s => s.setLiveData);
  const setIsCalculating = useCalculatorStore(s => s.setIsCalculating);
  const setApiOnline = useCalculatorStore(s => s.setApiOnline);
  const setErrorMessage = useCalculatorStore(s => s.setErrorMessage);

  const timerRef = useRef(null);

  const triggerFetch = async () => {
    setIsCalculating(true);
    try {
      const payload = {
        crop: selectedCrop,
        district: selectedDistrict,
        season: selectedSeason,
        irrigation_type: selectedIrrigation,
        year_start: new Date().getFullYear(),
        usd_lkr_rate: 310.0,
        forecast_horizon_weeks: 4,
        acreage: Math.max(0.25, parseFloat(acreage) || 1.0),
        vehicle_id: selectedVehicleId,
        target_economic_centre: selectedCentreName,
        custom_yield_kg: customYield ? parseFloat(customYield) : null,
        custom_buyer_price: null, // Read-only from market per requirements
        diesel_price: Math.max(0, parseFloat(dieselPrice) || 315.0),
        petrol_price: Math.max(0, parseFloat(petrolPrice) || 360.0),
        post_harvest_loss_pct: Math.max(0, parseFloat(postHarvestLossPct) || 8.0),
        enable_leafy: Boolean(enableLeafy),
        leafy_crop: selectedLeafyName,
        leafy_perches: Math.max(1, parseFloat(leafyPerches) || 5.0)
      };

      const result = await predictAdvisory(payload);
      setLiveData(result);
      setApiOnline(true);
      setErrorMessage(null);
    } catch (err) {
      console.warn("Advisory prediction failed:", err);
      setErrorMessage(err.message || 'Advisory API connection offline');
      // Verify whether health endpoint responds
      checkHealth().catch(() => setApiOnline(false));
    } finally {
      setIsCalculating(false);
    }
  };

  // Debounced effect (~400ms) only on backend-relevant payload dependencies
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      triggerFetch();
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    selectedCrop,
    selectedDistrict,
    selectedSeason,
    selectedIrrigation,
    acreage,
    customYield,
    selectedVehicleId,
    selectedCentreName,
    dieselPrice,
    petrolPrice,
    postHarvestLossPct,
    enableLeafy,
    selectedLeafyName,
    leafyPerches
  ]);

  return { triggerFetch };
}
