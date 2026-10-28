import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CropRecommendation from '../pages/CropRecommendation.jsx';
import en from '../i18n/locales/en.json';

function getNested(obj, keyPath) {
  return keyPath.split('.').reduce((acc, part) => acc?.[part], obj) || keyPath;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => getNested(en, key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('../utils/api.js', () => ({
  apiFetch: vi.fn().mockImplementation((url) => {
    if (url.includes('/api/crop-recommendation')) {
      return Promise.resolve({
        district: 'Kurunegala',
        season: 'Yala',
        irrigation: 'Unspecified',
        items: [
          {
            crop: 'Maize',
            predictedCost: 162000,
            intervalLow: 135000,
            intervalHigh: 190000,
            dataQuality: 'observed',
            low_confidence: false,
            district_policy_used: 'exact',
            expectedYield: 1800,
            costEfficiency: 90,
            meanError: 0.02,
            shrunkError: 0.085,
            reliability: 0.915,
            sampleSize: 3,
            coldStart: false,
            score: 105.3,
            costOnlyRank: 2,
            accuracyRank: 1,
            plainLanguageReason: 'Ranked #1 with 91.5% reliability based on 3 past season(s).'
          },
          {
            crop: 'Chili',
            predictedCost: 428807,
            intervalLow: 345000,
            intervalHigh: 512000,
            dataQuality: 'extrapolated',
            low_confidence: true,
            district_policy_used: 'extrapolated',
            expectedYield: 1200,
            costEfficiency: 357.34,
            meanError: 0.15,
            shrunkError: 0.15,
            reliability: 0.85,
            sampleSize: 0,
            coldStart: true,
            score: 464.54,
            costOnlyRank: 3,
            accuracyRank: 2,
            plainLanguageReason: 'Ranked solely by SO1 predicted cost-efficiency.'
          }
        ],
        unavailable: [
          {
            crop: 'Tomato',
            reason: 'No historical data available for Tomato in Kurunegala.'
          }
        ]
      });
    }
    return Promise.resolve([]);
  }),
}));

function renderWithClient(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CropRecommendation Page Component', () => {
  it('renders recommendation header and all numbered sections', async () => {
    renderWithClient(<CropRecommendation />);
    expect(await screen.findByText('Crop Recommendation')).toBeInTheDocument();
    expect(await screen.findByText('Accuracy-Weighted Crop Ranking')).toBeInTheDocument();
    expect(await screen.findByText(/Baseline Comparison/i)).toBeInTheDocument();
    expect(await screen.findByText('Unavailable Crops')).toBeInTheDocument();
  });

  it('renders ranked crop cards with reliability badges and plain language reasons', async () => {
    renderWithClient(<CropRecommendation />);
    const maizeElements = await screen.findAllByText('Maize');
    expect(maizeElements.length).toBeGreaterThan(0);

    const chiliElements = await screen.findAllByText('Chili');
    expect(chiliElements.length).toBeGreaterThan(0);

    const relElements = await screen.findAllByText(/91\.5%/i);
    expect(relElements.length).toBeGreaterThan(0);

    expect(await screen.findByText(/Ranked #1 with 91.5%/i)).toBeInTheDocument();
  });

  it('renders district, season, and irrigation filter dropdown selectors', async () => {
    renderWithClient(<CropRecommendation />);
    const districtSelect = await screen.findByRole('combobox', { name: /District/i });
    expect(districtSelect).toBeInTheDocument();

    const seasonSelect = screen.getByRole('combobox', { name: /Season/i });
    expect(seasonSelect).toBeInTheDocument();

    const irrigationSelect = screen.getByRole('combobox', { name: /Irrigation/i });
    expect(irrigationSelect).toBeInTheDocument();
  });

  it('renders cost interval and data quality / low confidence badges', async () => {
    renderWithClient(<CropRecommendation />);
    // Predicted Range interval text
    const rangeElements = await screen.findAllByText(/Predicted Interval:/i);
    expect(rangeElements.length).toBeGreaterThan(0);

    // Data quality badges
    expect(await screen.findByText('Observed Data')).toBeInTheDocument();
    expect(await screen.findByText('Extrapolated')).toBeInTheDocument();
    expect(await screen.findByText('Low Confidence')).toBeInTheDocument();
  });

  it('renders Section 3 Unavailable Crops with crop name and failure reason', async () => {
    renderWithClient(<CropRecommendation />);
    expect(await screen.findByText('Unavailable Crops')).toBeInTheDocument();
    expect(await screen.findByText('Tomato')).toBeInTheDocument();
    expect(await screen.findByText(/No historical data available for Tomato/i)).toBeInTheDocument();
  });

  it('does not render Section 3 Unavailable Crops when unavailable array is empty', async () => {
    const { apiFetch } = await import('../utils/api.js');
    apiFetch.mockResolvedValueOnce({
      district: 'Kurunegala',
      season: 'Yala',
      irrigation: 'Unspecified',
      items: [
        {
          crop: 'Maize',
          predictedCost: 162000,
          intervalLow: 135000,
          intervalHigh: 190000,
          dataQuality: 'observed',
          low_confidence: false,
          district_policy_used: 'exact',
          expectedYield: 1800,
          costEfficiency: 90,
          meanError: 0.02,
          shrunkError: 0.085,
          reliability: 0.915,
          sampleSize: 3,
          coldStart: false,
          score: 105.3,
          costOnlyRank: 1,
          accuracyRank: 1,
          plainLanguageReason: 'Ranked #1 with 91.5% reliability based on 3 past season(s).'
        }
      ],
      unavailable: []
    });

    renderWithClient(<CropRecommendation />);
    expect(await screen.findByText('Crop Recommendation')).toBeInTheDocument();
    expect(screen.queryByText('Unavailable Crops')).not.toBeInTheDocument();
  });
});
