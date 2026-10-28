import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

// Mock SpeechRecognition class
class MockSpeechRecognition {
  constructor() {
    MockSpeechRecognition.instance = this;
    this.continuous = false;
    this.interimResults = false;
    this.lang = 'en-US';
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.onstart = null;
  }
  start() {
    if (this.onstart) this.onstart();
  }
  stop() {
    if (this.onend) this.onend();
  }
  abort() {
    if (this.onend) this.onend();
  }
}

describe('VoiceExpenseEntry Component Tests (TASK V2)', () => {
  const activeCycle = { _id: 'cycle-123', crop: 'Paddy', status: 'active' };
  const activityCodes = [{ _id: 'act-1', code: 'LAND-PREP', nameEn: 'Land Preparation' }];

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage('en');
    localStorage.clear();
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  afterEach(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  const renderComponent = (props = {}) => {
    return render(
      <I18nextProvider i18n={i18n}>
        <VoiceExpenseEntry
          activeCycle={activeCycle}
          activityCodes={activityCodes}
          defaultActivityCode="act-1"
          defaultDate="2026-10-25"
          enabled={true}
          {...props}
        />
      </I18nextProvider>
    );
  };

  it('1. Feature flag off -> renders nothing', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <VoiceExpenseEntry
          activeCycle={activeCycle}
          activityCodes={activityCodes}
          enabled={false}
        />
      </I18nextProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('2. Typed text path (no mic) -> extraction -> pending table', () => {
    renderComponent();

    // Verify unsupported browser message appears when no SpeechRecognition exists
    expect(screen.getByText(/Voice input is not supported in this browser/i)).toBeInTheDocument();

    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: 'Spent 1500 on seed paddy' } });

    const extractBtn = screen.getByRole('button', { name: /extract/i });
    fireEvent.click(extractBtn);

    // Pending table should appear with extracted item
    expect(screen.getByText(/Extracted Expenses Pending Confirmation/i)).toBeInTheDocument();
    const descInputs = screen.getAllByRole('textbox', { name: /description/i });
    expect(descInputs).toHaveLength(1);
    expect(descInputs[0].value).toMatch(/seed paddy/i);
    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('3. Three-expense example from problem statement gives 3 rows and total 4500.00', () => {
    renderComponent();

    const phrase = 'Spent 1500 on seed paddy, paid 2000 for 4 hours of tractor hire and 1000 for urea yesterday';
    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: phrase } });

    const extractBtn = screen.getByRole('button', { name: /extract/i });
    fireEvent.click(extractBtn);

    // Verify 3 rows in pending table
    const descInputs = screen.getAllByRole('textbox', { name: /description/i });
    expect(descInputs).toHaveLength(3);

    // Total displayed is Rs. 4,500
    const matches4500 = screen.getAllByText(/Rs\. 4,500/);
    expect(matches4500.length).toBeGreaterThanOrEqual(1);

    // Category subtotals chips
    expect(screen.getByText(/Category Subtotals/i)).toBeInTheDocument();
    expect(screen.getByText(/seed:/i)).toBeInTheDocument();
    expect(screen.getByText(/machinery:/i)).toBeInTheDocument();
    expect(screen.getByText(/fertilizer:/i)).toBeInTheDocument();

    // All rows are ready (status 'ok')
    const readyBadges = screen.getAllByText('Ready');
    expect(readyBadges).toHaveLength(3);
  });

  it('4. Edit a row -> recalculates total and subtotals', () => {
    renderComponent();

    const phrase = 'Spent 1500 on seed paddy, paid 2000 for 4 hours of tractor hire and 1000 for urea';
    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: phrase } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    const initialTotal = screen.getAllByText(/Rs\. 4,500/);
    expect(initialTotal.length).toBeGreaterThanOrEqual(1);

    // Find the totalAmount inputs (3 rows)
    const totalInputs = screen.getAllByRole('spinbutton', { name: /total/i });
    expect(totalInputs).toHaveLength(3);

    // Change 3rd row (urea: 1000 -> 1500)
    fireEvent.change(totalInputs[2], { target: { value: '1500' } });

    // New total should be Rs. 5,000
    const updatedTotal = screen.getAllByText(/Rs\. 5,000/);
    expect(updatedTotal.length).toBeGreaterThanOrEqual(1);
  });

  it('5. Delete a row -> recalculates', () => {
    renderComponent();

    const phrase = 'Spent 1500 on seed paddy and 1000 for urea';
    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: phrase } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    const initialMatches = screen.getAllByText(/Rs\. 2,500/);
    expect(initialMatches.length).toBeGreaterThanOrEqual(1);

    const deleteButtons = screen.getAllByRole('button', { name: /actions/i });
    expect(deleteButtons).toHaveLength(2);

    // Delete the first row (1500)
    fireEvent.click(deleteButtons[0]);

    // Only 1 row remains with total Rs. 1,000
    const remainingDesc = screen.getAllByRole('textbox', { name: /description/i });
    expect(remainingDesc).toHaveLength(1);
    const matches1000 = screen.getAllByText(/Rs\. 1,000/);
    expect(matches1000.length).toBeGreaterThanOrEqual(1);
  });

  it('6. Row with status needs_review -> Confirm button disabled with warning message', () => {
    renderComponent();

    // Phrase with unresolved category
    const phrase = 'Paid 500 for general supplies';
    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: phrase } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    // Status shows Needs Review badge
    expect(screen.getByText('Needs Review')).toBeInTheDocument();

    // Confirm button is disabled
    const confirmBtn = screen.getByRole('button', { name: /confirm & save/i });
    expect(confirmBtn).toBeDisabled();

    // Warning message is displayed
    expect(screen.getByText(/Items marked 'Needs Review' \(missing category or amount\) must be corrected or deleted before confirming./i)).toBeInTheDocument();

    // Select category 'other' from dropdown
    const catSelect = screen.getByRole('combobox', { name: /category/i });
    fireEvent.change(catSelect, { target: { value: 'other' } });

    // Now status becomes Ready and Confirm button is enabled
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(confirmBtn).toBeEnabled();
  });

  it('7. Repeated tap on Confirm while save is in flight does not POST twice', async () => {
    let resolvePost;
    const delayedPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });

    apiModule.apiFetch.mockReturnValue(delayedPromise);

    renderComponent();

    const phrase = 'Spent 1500 on seed paddy';
    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: phrase } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    const confirmBtn = screen.getByRole('button', { name: /confirm & save/i });
    expect(confirmBtn).toBeEnabled();

    // Tap once
    fireEvent.click(confirmBtn);
    // Tap second time while first is in-flight
    fireEvent.click(confirmBtn);

    expect(apiModule.apiFetch).toHaveBeenCalledTimes(1);

    // Resolve in-flight request
    resolvePost({ success: true });

    await waitFor(() => {
      expect(screen.queryByText(/Extracted Expenses Pending Confirmation/i)).not.toBeInTheDocument();
    });
  });

  it('8. Partial failure: 2 of 3 succeed, 1 fails -> table keeps only the failed row and does not re-save successes on retry', async () => {
    // Setup apiFetch mock: call 1 and 2 succeed, call 3 fails
    apiModule.apiFetch
      .mockResolvedValueOnce({ _id: 'e1' })
      .mockResolvedValueOnce({ _id: 'e2' })
      .mockRejectedValueOnce(new Error('Network error on row 3'));

    renderComponent();

    const phrase = 'Spent 1500 on seed paddy, paid 2000 for tractor hire and 1000 for urea';
    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: phrase } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    expect(screen.getAllByRole('textbox', { name: /description/i })).toHaveLength(3);

    const confirmBtn = screen.getByRole('button', { name: /confirm & save/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Failed to save 1 out of 3 expenses/i)).toBeInTheDocument();
    });

    // Table keeps only the 1 failed row
    const remainingDesc = screen.getAllByRole('textbox', { name: /description/i });
    expect(remainingDesc).toHaveLength(1);
    expect(remainingDesc[0].value).toMatch(/urea/i);

    // Now mock apiFetch to succeed on retry
    apiModule.apiFetch.mockResolvedValueOnce({ _id: 'e3' });

    // Confirm again
    const retryConfirmBtn = screen.getByRole('button', { name: /confirm & save/i });
    fireEvent.click(retryConfirmBtn);

    await waitFor(() => {
      // Exactly 1 new call on retry (total 4 calls: 3 initially + 1 retry)
      expect(apiModule.apiFetch).toHaveBeenCalledTimes(4);
      // Succeeded rows were cleared, table is now empty
      expect(screen.queryByText(/Extracted Expenses Pending Confirmation/i)).not.toBeInTheDocument();
    });
  });

  it('9. SpeechRecognition permission denied -> surfaces error, leaves typed fallback intact', () => {
    window.SpeechRecognition = MockSpeechRecognition;

    renderComponent();

    // Voice button should be present since SpeechRecognition is supported
    const speakBtn = screen.getByRole('button', { name: /speak expense/i });
    expect(speakBtn).toBeInTheDocument();

    // Click mic button
    fireEvent.click(speakBtn);

    // Simulate permission denied error wrapped in act
    act(() => {
      MockSpeechRecognition.instance.onerror({ error: 'not-allowed' });
    });

    // Surfaces error
    expect(screen.getByText(/Microphone permission was denied. Please allow microphone permissions in your browser or type your expense text below./i)).toBeInTheDocument();

    // Typed fallback textarea remains completely intact and usable
    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: '1500 for seed paddy' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
  });

  it('10. Follow-up command: ambiguity never modifies a row until user taps a choice', () => {
    renderComponent();

    // 1. Enter two urea rows
    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: '1000 for urea and 2000 for urea' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    const initialTotals = screen.getAllByRole('spinbutton', { name: /total/i });
    expect(initialTotals).toHaveLength(2);
    expect(initialTotals[0].value).toBe('1000');
    expect(initialTotals[1].value).toBe('2000');

    // 2. Issue ambiguous correction command
    fireEvent.change(textarea, { target: { value: 'Change urea to 5000' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    // Chooser modal/card should appear
    expect(screen.getByText(/Select Row to Update/i)).toBeInTheDocument();
    expect(screen.getByText(/Multiple or ambiguous rows match your command/i)).toBeInTheDocument();

    // Neither row has been modified yet!
    const totalsDuringChoice = screen.getAllByRole('spinbutton', { name: /total/i });
    expect(totalsDuringChoice[0].value).toBe('1000');
    expect(totalsDuringChoice[1].value).toBe('2000');

    // 3. User taps the second candidate card
    const candidateCards = screen.getAllByRole('button', { name: /urea/i });
    // Click candidate
    fireEvent.click(candidateCards[candidateCards.length - 1]);

    // Chooser closes and row 2 is now updated to 5000
    expect(screen.queryByText(/Select Row to Update/i)).not.toBeInTheDocument();
    const totalsAfterChoice = screen.getAllByRole('spinbutton', { name: /total/i });
    expect(totalsAfterChoice[1].value).toBe('5000');
  });

  it('11. Follow-up command: undo restores previous pending rows', () => {
    renderComponent();

    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: 'Spent 1500 on seeds' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();

    // Change seeds to 2500
    fireEvent.change(textarea, { target: { value: 'Change seeds to 2500' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    expect(screen.getByDisplayValue('2500')).toBeInTheDocument();

    // Click Undo
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    expect(undoBtn).toBeInTheDocument();
    fireEvent.click(undoBtn);

    // Value restored to 1500
    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
  });

  it('12. Follow-up command: query displays answer without mutating rows', () => {
    renderComponent();

    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: 'Spent 1500 on seeds and 2000 on fuel' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    expect(screen.getAllByRole('textbox', { name: /description/i })).toHaveLength(2);

    // Ask query
    fireEvent.change(textarea, { target: { value: 'What is the total?' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    // Query result banner is displayed
    expect(screen.getByText(/Total pending expenses: Rs\. 3,500/i)).toBeInTheDocument();

    // Rows are completely intact and unmutated
    expect(screen.getAllByRole('textbox', { name: /description/i })).toHaveLength(2);
  });

  it('13. Follow-up command: add keeps existing pending rows (appends without replacing)', () => {
    renderComponent();

    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: 'Spent 1500 on seed paddy' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    expect(screen.getAllByRole('textbox', { name: /description/i })).toHaveLength(1);

    // Add follow-up item
    fireEvent.change(textarea, { target: { value: 'Add 2000 for fuel' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    // Now 2 rows exist
    const descInputs = screen.getAllByRole('textbox', { name: /description/i });
    expect(descInputs).toHaveLength(2);
    expect(screen.getAllByText(/Rs\. 3,500/).length).toBeGreaterThanOrEqual(1);
  });

  it('14. Unsaved pending rows survive an unrecognized command or notice', () => {
    renderComponent();

    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: 'Spent 1500 on seeds' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    expect(screen.getAllByRole('textbox', { name: /description/i })).toHaveLength(1);

    // Issue saved record reference
    fireEvent.change(textarea, { target: { value: 'Edit yesterday\'s saved expense in tracker' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    // Saved record notice appears
    expect(screen.getByText(/Saved records can only be edited in the Daily Cost Tracker/i)).toBeInTheDocument();

    // Original pending row survives intact
    expect(screen.getAllByRole('textbox', { name: /description/i })).toHaveLength(1);
    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
  });

  it('15. Review UI (TASK V5): displays original transcript card next to extracted rows and shows Rs. with amounts', () => {
    renderComponent();

    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    fireEvent.change(textarea, { target: { value: 'Paid 3500 for weeding' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    // 1. Original transcript panel renders
    const transcriptCard = screen.getByTestId('voice-original-transcript-card');
    expect(transcriptCard).toBeInTheDocument();
    expect(transcriptCard).toHaveTextContent(/Original Transcript/i);
    expect(screen.getByTestId('voice-original-transcript')).toHaveTextContent('Paid 3500 for weeding');

    // 2. Amounts are labelled with Rs.
    expect(screen.getAllByText('Rs.').length).toBeGreaterThanOrEqual(1);

    // 3. Overall total has Rs.
    const overallTotal = screen.getByTestId('voice-overall-total');
    expect(overallTotal).toHaveTextContent(/Rs\.\s*3,500/i);
  });

  it('16. Review UI (TASK V5): highlights needs_review rows with plain-word reasons in English and Sinhala', () => {
    renderComponent();

    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    // Unknown category and missing amount
    fireEvent.change(textarea, { target: { value: 'Spent some money on miscellaneous items' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    // Needs review badge and plain-word reasons appear
    expect(screen.getAllByText(/Needs Review/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Amount could not be determined/i)).toBeInTheDocument();

    // Confirm is strictly blocked
    const confirmBtn = screen.getByRole('button', { name: /confirm & save/i });
    expect(confirmBtn).toBeDisabled();

    // Switch to Sinhala
    act(() => {
      i18n.changeLanguage('si');
    });

    expect(screen.getAllByText(/සමාලෝචනය අවශ්‍යයි/i).length).toBeGreaterThanOrEqual(1);
  });

  it('17. Implausible amount override (TASK V5.1): "accept amount" requires explicit tap and is never applied automatically', () => {
    renderComponent({
      categoryBaselines: { fertilizer: 45000 },
      totalBaseline: 180000
    });

    const textarea = screen.getByRole('textbox', { name: /speak or type your expenses here/i });
    // 150,000 exceeds category baseline (45,000) -> triggers amount_implausible
    fireEvent.change(textarea, { target: { value: 'Bought 10 bags of urea fertilizer for 150000 rupees' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    // 1. Initial status MUST be Needs Review with amount_implausible reason
    expect(screen.getAllByText(/Needs Review/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Amount exceeds expected baseline/i)).toBeInTheDocument();

    // 2. Confirm button is STRICTLY disabled (never automatically enabled)
    const confirmBtn = screen.getByRole('button', { name: /confirm & save/i });
    expect(confirmBtn).toBeDisabled();

    // 3. The "Accept amount" override button is present
    const overrideBtn = screen.getByRole('button', { name: /accept amount/i });
    expect(overrideBtn).toBeInTheDocument();

    // Re-verify that without an explicit tap, Confirm remains disabled
    expect(confirmBtn).toBeDisabled();

    // 4. Farmer explicitly taps the "Accept amount" override button
    fireEvent.click(overrideBtn);

    // 5. After explicit tap only: status changes to Ready and Confirm button is enabled
    expect(screen.getByText(/Ready/i)).toBeInTheDocument();
    expect(confirmBtn).not.toBeDisabled();
  });
});

