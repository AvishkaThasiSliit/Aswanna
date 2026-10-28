import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './utils/auth.jsx';
import AppShell from './layouts/AppShell.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ExpenseRecords from './pages/ExpenseRecords.jsx';
import ExpenseForm from './pages/ExpenseForm.jsx';
import BudgetOverview from './pages/BudgetOverview.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import DailyCostTrackerHub from './pages/DailyCostTrackerHub.jsx';
import CropRecommendation from './pages/CropRecommendation.jsx';
import SetupWizard from './pages/SetupWizard.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import HarvestSales from './pages/HarvestSales.jsx';
import CycleNotesPage from './pages/CycleNotesPage.jsx';
import CycleSummaryPage from './pages/CycleSummaryPage.jsx';
import ActivityCalendarPage from './pages/ActivityCalendarPage.jsx';
import VoiceDatasetCollectionPage from './pages/VoiceDatasetCollectionPage.jsx';
import VoiceDatasetReviewerPage from './pages/VoiceDatasetReviewerPage.jsx';

const VoiceCapturePage = import.meta.env.VITE_VOICE_CAPTURE === 'on'
  ? React.lazy(() => import('./dev/VoiceCapturePage.jsx'))
  : null;

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/tracker" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        {import.meta.env.VITE_VOICE_CAPTURE === 'on' && VoiceCapturePage && (
          <Route
            path="/dev/voice-capture"
            element={
              <React.Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
                <VoiceCapturePage />
              </React.Suspense>
            }
          />
        )}
        
        <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route index element={<Navigate to="/tracker" replace />} />
          <Route path="setup" element={<SetupWizard />} />
          <Route path="setup/farmer" element={<SetupWizard />} />
          <Route path="setup/machinery" element={<SetupWizard />} />
          <Route path="setup/lands" element={<SetupWizard />} />
          <Route path="setup/cycle" element={<SetupWizard />} />

          <Route path="tracker" element={<DailyCostTrackerHub />} />
          <Route path="tracker/records" element={<ExpenseRecords />} />
          <Route path="tracker/add" element={<ExpenseForm />} />
          <Route path="tracker/edit/:id" element={<ExpenseForm />} />
          <Route path="tracker/harvest-sales" element={<HarvestSales />} />
          <Route path="tracker/notes" element={<CycleNotesPage />} />
          <Route path="tracker/summary" element={<CycleSummaryPage />} />
          <Route path="tracker/calendar" element={<ActivityCalendarPage />} />
          
          <Route path="dashboard" element={<ComingSoon />} />
          <Route path="prediction" element={<BudgetOverview />} />
          <Route path="recommendation" element={<CropRecommendation />} />
          <Route path="crop-recommendation" element={<CropRecommendation />} />
          <Route path="simulation" element={<ComingSoon />} />
          {import.meta.env.VITE_VOICE_DATASET_COLLECTION === 'on' && (
            <>
              <Route path="dataset-collection" element={<VoiceDatasetCollectionPage />} />
              <Route path="dataset-collection/review" element={<VoiceDatasetReviewerPage />} />
            </>
          )}
          <Route path="reports" element={<ComingSoon />} />
          <Route path="history" element={<ComingSoon />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="settings" element={<ComingSoon />} />
          <Route path="support" element={<ComingSoon />} />
          
          <Route path="*" element={<Navigate to="/tracker/records" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
