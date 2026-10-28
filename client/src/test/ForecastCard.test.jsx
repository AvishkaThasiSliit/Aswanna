import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ForecastCard from '../components/ForecastCard.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      if (options?.tau !== undefined && options?.minTau !== undefined) {
        return `${key} tau=${options.tau} minTau=${options.minTau}`;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

describe('ForecastCard Component', () => {
  it('renders loading skeleton when isLoading is true', () => {
    render(<ForecastCard isLoading={true} />);
    expect(screen.getByTestId('forecast-loading')).toBeInTheDocument();
  });

  it('renders nothing when forecast is null or error is present', () => {
    const { container: c1 } = render(<ForecastCard forecast={null} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<ForecastCard forecast={null} error={new Error('404')} />);
    expect(c2.firstChild).toBeNull();
  });

  it('renders nothing when forecast feature is disabled ({ enabled: false })', () => {
    const { container } = render(<ForecastCard forecast={{ enabled: false }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders too_early state when status is too_early', () => {
    const forecast = {
      status: 'too_early',
      method: 'prior',
      tau: 0.15,
      minTau: 0.30,
      spendToDate: 30000,
      baselineTotal: 200000,
    };
    render(<ForecastCard forecast={forecast} />);
    expect(screen.getByTestId('forecast-too-early')).toBeInTheDocument();
    expect(screen.getByTestId('forecast-method-badge')).toHaveTextContent('forecast.priorMethod');
    expect(screen.getByText(/forecast\.tooEarlyDesc tau=15 minTau=30/)).toBeInTheDocument();
  });

  it('renders insufficient_data state when status is insufficient_data', () => {
    const forecast = {
      status: 'insufficient_data',
      message: 'Baseline data not ready or missing for this cycle',
    };
    render(<ForecastCard forecast={forecast} />);
    expect(screen.getByTestId('forecast-insufficient-data')).toBeInTheDocument();
    expect(screen.getByText('Baseline data not ready or missing for this cycle')).toBeInTheDocument();
  });

  it('renders ready forecast metrics, 80% conformal interval, and caveats', () => {
    const forecast = {
      status: 'ready',
      method: 'learned',
      tau: 0.50,
      spendToDate: 125000,
      forecastFinal: 250000,
      interval: {
        low: 234525,
        high: 265475,
        level: 0.8,
      },
      baselineTotal: 240000,
      projectedOverspendPct: 4.2,
      notes: ['Advisory projection only; not a financial guarantee.'],
    };
    render(<ForecastCard forecast={forecast} />);

    expect(screen.getByTestId('forecast-ready')).toBeInTheDocument();
    expect(screen.getByTestId('forecast-method-badge')).toHaveTextContent('forecast.learnedMethod');
    expect(screen.getByTestId('forecast-final-cost')).toHaveTextContent('250,000');
    expect(screen.getByTestId('forecast-interval')).toHaveTextContent('Rs. 234,525 – Rs. 265,475');
    expect(screen.getByTestId('forecast-spend-to-date')).toHaveTextContent('125,000');
    expect(screen.getByTestId('forecast-overspend-pct')).toHaveTextContent('+4.2%');
    expect(screen.getByTestId('forecast-caveats')).toBeInTheDocument();
    expect(screen.getByTestId('forecast-derived-curves-notice')).toHaveTextContent('forecast.derivedCurvesNotice');
    expect(screen.getByTestId('forecast-sudden-shocks-notice')).toHaveTextContent('forecast.suddenShocksNotice');
  });
});
