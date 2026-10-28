import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StatusBadge from '../components/StatusBadge.jsx';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = {
        'statuses.recorded':    'Recorded',
        'statuses.pending':     'Pending',
        'statuses.no_work':     'No Work',
        'statuses.attention':   'Attention',
        'statuses.significant': 'Significant',
      };
      return map[key] || key;
    },
    i18n: { language: 'en' },
  }),
}));

describe('StatusBadge', () => {
  it('renders "recorded" badge with correct label', () => {
    render(<StatusBadge status="recorded" />);
    expect(screen.getByText('Recorded')).toBeInTheDocument();
  });

  it('renders "pending" badge', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders "no_work" badge', () => {
    render(<StatusBadge status="no_work" />);
    expect(screen.getByText('No Work')).toBeInTheDocument();
  });

  it('renders "attention" badge', () => {
    render(<StatusBadge status="attention" />);
    expect(screen.getByText('Attention')).toBeInTheDocument();
  });

  it('renders "significant" badge', () => {
    render(<StatusBadge status="significant" />);
    expect(screen.getByText('Significant')).toBeInTheDocument();
  });

  it('defaults to "recorded" style for unknown status', () => {
    render(<StatusBadge status="unknown_status" />);
    // Should render without crashing; label falls back to key
    const span = screen.getByText(/unknown_status/i);
    expect(span).toBeInTheDocument();
  });

  it('applies the correct emerald classes for recorded', () => {
    const { container } = render(<StatusBadge status="recorded" />);
    const badge = container.querySelector('span');
    expect(badge.className).toMatch(/emerald/);
  });

  it('applies the correct rose classes for significant', () => {
    const { container } = render(<StatusBadge status="significant" />);
    const badge = container.querySelector('span');
    expect(badge.className).toMatch(/rose/);
  });
});
