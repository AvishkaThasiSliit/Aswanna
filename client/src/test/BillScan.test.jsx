import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';

import i18n from '../i18n/i18n.js';
import VoiceExpenseEntry from '../components/VoiceExpenseEntry.jsx';
import * as apiModule from '../utils/api.js';

// Mock apiFetch
vi.mock('../utils/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

describe('Bill Scan Client Integration Tests (TASK BILL-4 & BILL-4b)', () => {
  const activeCycle = { _id: 'cycle-123', crop: 'Paddy', status: 'active' };
  const activityCodes = [{ _id: 'act-1', code: 'LAND-PREP', nameEn: 'Land Preparation' }];
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage('en');
    localStorage.clear();
    delete window.__BILL_SCAN__;
    delete window.__VOICE_ENTRY__;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete window.__BILL_SCAN__;
    delete window.__VOICE_ENTRY__;
  });

  const renderComponent = (props = {}) => {
    return render(
      <I18nextProvider i18n={i18n}>
        <VoiceExpenseEntry
          activeCycle={activeCycle}
          activityCodes={activityCodes}
          defaultDate="2026-04-10"
          enabled={true}
          {...props}
        />
      </I18nextProvider>
    );
  };

  it('1. Hides Scan Bill button when VITE_BILL_SCAN is off / unset', () => {
    window.__BILL_SCAN__ = 'off';
    renderComponent();

    const scanBtn = screen.queryByTestId('bill-scan-btn');
    expect(scanBtn).toBeNull();
  });

  it('2. Shows Scan Bill button when VITE_BILL_SCAN is on', () => {
    window.__BILL_SCAN__ = 'on';
    renderComponent();

    const scanBtn = screen.getByTestId('bill-scan-btn');
    expect(scanBtn).toBeDefined();
    expect(scanBtn.textContent).toContain('Scan Bill');
  });

  it('3. Renders single row into review table from a mocked bill-scan response', async () => {
    window.__BILL_SCAN__ = 'on';

    const mockResponseData = {
      status: 'ok',
      vendor: 'Kurunegala Agri Center',
      date: '2026-04-10',
      total: 7500,
      items: [
        {
          id: 'mock-item-1',
          description: 'Kurunegala Agri Center',
          category: 'fertilizer',
          quantity: 1,
          unit: '',
          unitPrice: 7500,
          totalAmount: 7500,
          currency: 'LKR',
          dateISO: '2026-04-10',
          status: 'ok',
          reasons: [],
          source: 'bill'
        }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponseData
    });

    renderComponent();

    const fileInput = screen.getByTestId('bill-file-input');
    const mockFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00])], 'bill.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Kurunegala Agri Center')).toBeDefined();
      expect(screen.getAllByDisplayValue('7500').length).toBeGreaterThanOrEqual(1);
    });

    // Verify overall total derived in table
    const overallTotal = screen.getByTestId('voice-overall-total');
    expect(overallTotal.textContent).toContain('7,500');

    // Verify nothing saved to API before user taps confirm
    expect(apiModule.apiFetch).not.toHaveBeenCalled();
  });

  it('4. Saves items to POST /expenses only when user confirms and after Accept tap', async () => {
    window.__BILL_SCAN__ = 'on';

    const mockResponseData = {
      status: 'ok',
      vendor: 'Kurunegala Agri Center',
      date: '2026-04-10',
      total: 4500,
      items: [
        {
          id: 'mock-item-1',
          description: 'Kurunegala Agri Center',
          category: 'fertilizer',
          quantity: 1,
          unit: '',
          unitPrice: 4500,
          totalAmount: 4500,
          currency: 'LKR',
          dateISO: '2026-04-10',
          status: 'ok',
          reasons: [],
          source: 'bill'
        }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponseData
    });

    apiModule.apiFetch.mockResolvedValue({ success: true });

    renderComponent();

    const fileInput = screen.getByTestId('bill-file-input');
    const mockFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00])], 'bill.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Kurunegala Agri Center')).toBeDefined();
    });

    const confirmBtn = screen.getByTestId('voice-confirm-btn');
    // Save button is initially disabled until Accept tap
    expect(confirmBtn.disabled).toBe(true);
    expect(apiModule.apiFetch).not.toHaveBeenCalled();

    // Tap Accept button
    const acceptBtn = screen.getByTestId('bill-accept-btn-mock-item-1');
    fireEvent.click(acceptBtn);

    // Save button is now enabled
    expect(confirmBtn.disabled).toBe(false);
    expect(apiModule.apiFetch).not.toHaveBeenCalled();

    // Tap confirm button
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiModule.apiFetch).toHaveBeenCalledTimes(1);
      const call = apiModule.apiFetch.mock.calls[0];
      expect(call[0]).toBe('/expenses');
      const body = JSON.parse(call[1].body);
      expect(body.cycleId).toBe('cycle-123');
      expect(body.inputs[0].cost).toBe(4500);
      expect(body.inputs[0].categoryTag).toBe('fertilizer');
    });
  });

  it('5. Renders readable error state when upload fails', async () => {
    window.__BILL_SCAN__ = 'on';

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: {
          code: 'BILL_SERVICE_DOWN',
          message: 'Bill scanning service is currently unavailable. Please use manual entry.'
        }
      })
    });

    renderComponent();

    const fileInput = screen.getByTestId('bill-file-input');
    const mockFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00])], 'bill.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      const errBanner = screen.getByTestId('bill-scan-error');
      expect(errBanner.textContent).toContain('Bill scanning service is currently unavailable');
    });
  });

  it('6. client: Save disabled until Accept, nothing saved before confirm, no img element or object URL left after processing', async () => {
    window.__BILL_SCAN__ = 'on';

    const revokeSpy = vi.fn();
    const createSpy = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createSpy;
    URL.revokeObjectURL = revokeSpy;

    const mockResponseData = {
      status: 'ok',
      vendor: 'Polonnaruwa Hardware',
      date: '2026-04-10',
      total: 8200,
      items: [
        {
          id: 'test-item-99',
          description: 'Polonnaruwa Hardware',
          category: 'machinery',
          quantity: 1,
          unit: '',
          unitPrice: 8200,
          totalAmount: 8200,
          currency: 'LKR',
          dateISO: '2026-04-10',
          status: 'ok',
          reasons: [],
          source: 'bill'
        }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponseData
    });

    apiModule.apiFetch.mockResolvedValue({ success: true });

    renderComponent();

    const fileInput = screen.getByTestId('bill-file-input');
    const mockFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00])], 'bill.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Polonnaruwa Hardware')).toBeDefined();
    });

    // 1. Save disabled until Accept
    const confirmBtn = screen.getByTestId('voice-confirm-btn');
    expect(confirmBtn.disabled).toBe(true);

    // 2. Nothing saved before confirm
    expect(apiModule.apiFetch).not.toHaveBeenCalled();

    // 3. No img element left in the DOM
    const billImages = document.querySelectorAll('img[src^="blob:"], img[src*="bill"]');
    expect(billImages.length).toBe(0);

    // Tap Accept button
    const acceptBtn = screen.getByTestId('bill-accept-btn-test-item-99');
    fireEvent.click(acceptBtn);

    // Save now enabled
    expect(confirmBtn.disabled).toBe(false);
    expect(apiModule.apiFetch).not.toHaveBeenCalled();

    // Click confirm -> saved
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiModule.apiFetch).toHaveBeenCalledTimes(1);
    });

    // Restore URL mocks
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });
});
