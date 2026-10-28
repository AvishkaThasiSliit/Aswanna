import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import i18n from '../i18n/i18n.js';
import SchemaFormRenderer from '../components/SchemaFormRenderer.jsx';
import WarningBanner from '../components/WarningBanner.jsx';
import { farmerSchema } from '../../../shared/formSchemas/farmer.js';
import { validateEntity } from '../../../shared/validation/index.js';

describe('Validation UI and i18n Integration', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders inline validation error messages in English', async () => {
    await i18n.changeLanguage('en');
    const errors = {
      name: [{ code: 'REQUIRED', key: 'validation.errors.required', message: 'This field is required' }],
      nic: [{ code: 'NIC_FORMAT', key: 'validation.errors.nicFormat', message: 'NIC must be 9 digits followed by V/X or 12 digits' }],
      phone: [{ code: 'PHONE_FORMAT', key: 'validation.errors.phoneFormat', message: 'Phone must be a 10-digit Sri Lankan number (e.g. 0712345678)' }],
    };

    render(
      <SchemaFormRenderer
        schema={farmerSchema}
        values={{ name: '', nic: 'bad-nic', phone: '123' }}
        onChange={() => {}}
        errors={errors}
        idPrefix="farmer"
      />
    );

    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByText('NIC must be 9 digits followed by V/X or 12 digits')).toBeInTheDocument();
    expect(screen.getByText('Phone must be a 10-digit Sri Lankan number (e.g. 0712345678)')).toBeInTheDocument();
  });

  it('renders inline validation error messages in Sinhala (si)', async () => {
    await i18n.changeLanguage('si');
    const errors = {
      name: [{ code: 'REQUIRED', key: 'validation.errors.required', message: 'This field is required' }],
      nic: [{ code: 'NIC_FORMAT', key: 'validation.errors.nicFormat', message: 'NIC must be 9 digits followed by V/X or 12 digits' }],
      phone: [{ code: 'PHONE_FORMAT', key: 'validation.errors.phoneFormat', message: 'Phone must be a 10-digit Sri Lankan number (e.g. 0712345678)' }],
    };

    render(
      <SchemaFormRenderer
        schema={farmerSchema}
        values={{ name: '', nic: 'bad-nic', phone: '123' }}
        onChange={() => {}}
        errors={errors}
        idPrefix="farmer"
      />
    );

    expect(screen.getByText('මෙම ක්ෂේත්‍රය අනිවාර්ය වේ')).toBeInTheDocument();
    expect(screen.getByText('ජා.හැ. අංකය ඉලක්කම් 9ක් සමග V/X හෝ ඉලක්කම් 12ක් විය යුතුය')).toBeInTheDocument();
    expect(screen.getByText('දුරකථන අංකය 0 න් ආරම්භ වන ඉලක්කම් 10ක් විය යුතුය (උදා. 0712345678)')).toBeInTheDocument();
  });

  it('sets aria-invalid and aria-describedby on inputs with errors', async () => {
    await i18n.changeLanguage('en');
    const errors = {
      name: [{ code: 'REQUIRED', key: 'validation.errors.required', message: 'Name is required' }]
    };

    render(
      <SchemaFormRenderer
        schema={farmerSchema}
        values={{ name: '' }}
        onChange={() => {}}
        errors={errors}
        idPrefix="farmer"
      />
    );

    const nameInput = screen.getByLabelText(/Name/i);
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby', 'farmer-name-error');
  });

  it('sets aria-invalid=false on valid inputs without errors', async () => {
    render(
      <SchemaFormRenderer
        schema={farmerSchema}
        values={{ name: 'Kamal' }}
        onChange={() => {}}
        errors={{}}
        idPrefix="farmer"
      />
    );

    const nameInput = screen.getByLabelText(/Name/i);
    expect(nameInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('sets inputMode and maxLength attributes according to schema rules', () => {
    render(
      <SchemaFormRenderer
        schema={farmerSchema}
        values={{ phone: '' }}
        onChange={() => {}}
        errors={{}}
        idPrefix="farmer"
      />
    );

    const phoneInput = screen.getByLabelText(/Phone/i);
    expect(phoneInput).toHaveAttribute('inputMode', 'tel');
    expect(phoneInput).toHaveAttribute('maxLength', '15');
  });

  it('normalizes pasted Sinhala digits and stripped control chars in text inputs', () => {
    let changedValue = '';
    render(
      <SchemaFormRenderer
        schema={farmerSchema}
        values={{ name: '' }}
        onChange={(k, val) => { changedValue = val; }}
        errors={{}}
        idPrefix="farmer"
      />
    );

    const nameInput = screen.getByLabelText(/Name/i);
    const pasteEvent = {
      clipboardData: {
        getData: () => 'Kamal \u0007Perera \u0DE8\u0DE9', // bell char + Sinhala 2 3
      },
      preventDefault: () => {},
    };

    fireEvent.paste(nameInput, pasteEvent);
    expect(changedValue).toBe('Kamal Perera 23');
  });

  it('renders and dismisses WarningBanner with translated keys', async () => {
    await i18n.changeLanguage('en');
    let dismissed = false;
    const warnings = [
      { code: 'SOLD_EXCEEDS_HARVEST', key: 'validation.warnings.soldExceedsHarvest', message: 'Total sold exceeds harvested' }
    ];

    const { unmount } = render(
      <WarningBanner warnings={warnings} onDismiss={() => { dismissed = true; }} />
    );

    expect(screen.getByText('Total sold quantity exceeds harvested quantity')).toBeInTheDocument();

    const ackButton = screen.getByRole('button', { name: /Acknowledge|Dismiss/i });
    fireEvent.click(ackButton);
    expect(dismissed).toBe(true);
    unmount();

    // Sinhala Warning Banner
    await i18n.changeLanguage('si');
    render(
      <WarningBanner warnings={warnings} onDismiss={() => {}} />
    );
    expect(screen.getByText('විකිණූ ප්‍රමාණය නෙලාගත් මුළු අස්වැන්න ඉක්මවා ඇත')).toBeInTheDocument();
  });
});
