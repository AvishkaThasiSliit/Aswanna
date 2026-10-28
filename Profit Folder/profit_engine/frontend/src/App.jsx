import React, { useState, useEffect, Suspense, lazy } from 'react';
import './styles/tokens.css';
import './styles/global.css';

import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Footer from './components/layout/Footer';
import Skeleton from './components/common/Skeleton';
import SplashScreen from './components/layout/SplashScreen';

// Lazy-load page modules for fast initial paint
const ProfitCalculatorPage = lazy(() => import('./pages/ProfitCalculatorPage'));
const CostEstimatorPage = lazy(() => import('./pages/CostEstimatorPage'));
const PriceForecastPage = lazy(() => import('./pages/PriceForecastPage'));
const ModelRegistryPage = lazy(() => import('./pages/ModelRegistryPage'));
const LogisticsPage = lazy(() => import('./pages/LogisticsPage'));
const AdvisoryPage = lazy(() => import('./pages/AdvisoryPage'));

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t) return t;
    }
    return 'calculator';
  });
  const [apiOnline, setApiOnline] = useState(true);
  const [metadata, setMetadata] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('Just now');

  useEffect(() => {
    fetch('/health')
      .then(res => res.json())
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));

    fetch('/api/metadata')
      .then(res => res.json())
      .then(data => setMetadata(data))
      .catch(err => console.warn("Metadata API fetch offline fallback:", err));
  }, []);

  return (
    <>
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}
      <div className="aswenna-layout">
      {/* Sidebar Navigation Shell */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content Workspace */}
      <main className="aswenna-main">
        <Topbar
          isCalculating={false}
          apiOnline={apiOnline}
          lastUpdated={lastUpdated}
        />

        <Suspense fallback={
          <div style={{ padding: '32px' }}>
            <Skeleton height="60px" borderRadius="12px" />
            <Skeleton height="350px" borderRadius="16px" style={{ marginTop: '20px' }} />
          </div>
        }>
          {activeTab === 'calculator' && (
            <ProfitCalculatorPage />
          )}

          {activeTab === 'cost' && (
            <CostEstimatorPage onNavigateTab={setActiveTab} />
          )}

          {activeTab === 'price' && (
            <PriceForecastPage onNavigateTab={setActiveTab} />
          )}

          {activeTab === 'models' && (
            <ModelRegistryPage />
          )}

          {activeTab === 'logistics' && (
            <LogisticsPage />
          )}

          {(activeTab === 'advisory' || activeTab === 'dashboard' || activeTab === 'settings') && (
            <AdvisoryPage onNavigateTab={setActiveTab} />
          )}
        </Suspense>

        <Footer />
      </main>
    </div>
  </>
  );
}
