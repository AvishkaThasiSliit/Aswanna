import React, { useEffect } from 'react';
import '../styles/priceForecast.css';
import { usePriceStore } from '../state/priceStore';
import PriceWizardShell from '../components/price/PriceWizardShell';
import PriceResultsView from '../components/price/PriceResultsView';

export default function PriceForecastPage() {
  const isResultView = usePriceStore(s => s.isResultView);
  const fetchForecast = usePriceStore(s => s.fetchForecast);
  const fetchVegetablesCatalog = usePriceStore(s => s.fetchVegetablesCatalog);

  useEffect(() => {
    fetchVegetablesCatalog();
    fetchForecast();
  }, [fetchForecast, fetchVegetablesCatalog]);

  return (
    <div className={isResultView ? "price-results-page-wrap" : "price-fullscreen-page"}>
      {isResultView ? (
        <PriceResultsView />
      ) : (
        <PriceWizardShell />
      )}
    </div>
  );
}
