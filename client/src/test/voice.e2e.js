// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

function getList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.expenses)) return data.expenses;
  if (Array.isArray(data?.cycles)) return data.cycles;
  if (Array.isArray(data?.alerts)) return data.alerts;
  return [];
}

/**
 * Helper to register a fresh farmer user and create a cycle with SO1 mock baseline.
 */
async function registerUserAndCreateCycle(page, emailPrefix = 'voice-e2e') {
  const rand = Math.floor(10000 + Math.random() * 90000);
  const timestamp = Date.now();
  const email = `${emailPrefix}-${timestamp}-${rand}@example.com`;
  const name = `Voice Farmer ${rand}`;
  const nic = `1990050${rand}`;
  const phone = `077${rand}12`;
  const landCode = `L-${rand}`;

  // 1. Register
  await page.goto(`${BASE}/register`);
  await page.fill('#fullName', name);
  await page.fill('#email', email);
  await page.fill('#password', 'Password123');
  await page.fill('#phone', phone);
  await page.fill('#district', 'Kurunegala');
  await page.click('button[type="submit"]');

  // 2. Wizard Step 1: Profile
  await page.waitForURL(new RegExp(`${BASE}/setup`), { timeout: 15000 });
  await page.locator('#farmer-name').fill(name);
  await page.locator('#farmer-dateOfBirth').fill('1990-01-01');
  await page.locator('#farmer-nic').fill(nic);
  await page.locator('#farmer-phone').fill(phone);
  await page.locator('#farmer-address').fill('Farmer Street, Kurunegala');
  await page.locator('#farmer-district').selectOption('Kurunegala');
  await page.locator('#farmer-divisionalSecretariat').fill('Central');
  await page.locator('#farmer-gnDivision').fill('Division 1');
  await page.locator('button[type="submit"]').click();

  // 3. Wizard Step 2: Machinery
  await page.waitForURL(new RegExp(`${BASE}/setup/machinery`), { timeout: 15000 });
  await page.locator('button', { hasText: /Save & Next|සුරැකීම සහ ඊළඟ/i }).click();

  // 4. Wizard Step 3: Land
  await page.waitForURL(new RegExp(`${BASE}/setup/lands`), { timeout: 15000 });
  await page.locator('#land-0-landCode').fill(landCode);
  await page.locator('#land-0-landType').selectOption('lowland');
  await page.locator('#land-0-district').selectOption('Kurunegala');
  await page.locator('#land-0-tenure').selectOption('freehold');
  await page.locator('#land-0-extentUnit').selectOption('acre');
  await page.locator('#land-0-extentValue').fill('1');
  await page.locator('#land-0-waterSourceType').selectOption('rainfed');
  await page.locator('button', { hasText: /Save & Next|සුරැකීම සහ ඊළඟ/i }).click();

  // 5. Wizard Step 4: Cycle
  await page.waitForURL(new RegExp(`${BASE}/setup/cycle`), { timeout: 15000 });
  await page.locator('#cycleLand').selectOption({ index: 1 });
  await page.locator('#cycleCrop').selectOption('Tomato');
  await page.locator('#cycleSeason').selectOption('Yala');
  await page.locator('#cycleStartDate').fill('2026-04-01');
  await page.locator('button[type="submit"]').click();

  // Active cycle indicator
  await expect(page.getByText(/Active Cultivation Cycle Running|සක්‍රිය වගා කන්නය/i)).toBeVisible({ timeout: 15000 });

  // Navigate to Expense Form
  await page.goto(`${BASE}/tracker/add`);
  await expect(page.locator('#expense-form-page')).toBeVisible({ timeout: 15000 });

  return { email, name };
}

/**
 * Helper to call real API from the page context with the farmer's credentials.
 */
async function callRealApi(page, endpoint) {
  return page.evaluate(async (url) => {
    const token = window.sessionStorage?.getItem('aswanna_session') || window.localStorage?.getItem('aswanna_session');
    const r = await fetch(url.startsWith('/api') ? url : `/api${url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const status = r.status;
    let data = null;
    try {
      data = await r.json();
    } catch {}
    return { status, data };
  }, endpoint);
}

test.describe('TASK V4 Voice Expense Entry Real Stack Verification', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Dismiss first-time voice privacy notice automatically and enforce English
    await page.addInitScript(() => {
      window.localStorage.setItem('aswanna_voice_privacy_dismissed', 'true');
      window.localStorage.setItem('i18nextLng', 'en');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario a: Type 3-expense example, confirm, verify via real API (3 expenses,
  // right cycle, correct categories and amounts, variance reflects them).
  // ─────────────────────────────────────────────────────────────────────────────
  test('Scenario a: Type 3-expense example, confirm, verify through real API and variance', async ({ page }) => {
    await registerUserAndCreateCycle(page, 'v4-a');

    // Retrieve active cycle via real API
    const cyclesRes = await callRealApi(page, '/cycles');
    expect(cyclesRes.status).toBe(200);
    const cycleList = getList(cyclesRes.data);
    const activeCycle = cycleList.find(c => c.status === 'active');
    expect(activeCycle).toBeTruthy();
    const cycleId = activeCycle._id;

    // Verify initial expenses count is 0
    const initialExpRes = await callRealApi(page, `/expenses?cycleId=${cycleId}`);
    expect(getList(initialExpRes.data).length).toBe(0);

    // Type three-expense input into voice/typed input
    const transcriptInput = page.locator('#voice-transcript-input');
    await expect(transcriptInput).toBeVisible({ timeout: 10000 });
    await transcriptInput.fill('Spent 1500 on seed paddy, paid 2000 for 4 hours of tractor hire and 1000 for urea yesterday');

    // Click Extract & Review
    const extractBtn = page.locator('#voice-extract-btn');
    await extractBtn.click();

    // Verify 3 rows in pending table
    const pendingRows = page.locator('#voice-expense-entry-card tbody tr');
    await expect(pendingRows).toHaveCount(3, { timeout: 10000 });

    // Confirm & Save
    const confirmBtn = page.locator('#voice-confirm-btn');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Pending table should be cleared after successful save
    await expect(pendingRows).toHaveCount(0, { timeout: 15000 });

    // Verify through the REAL API that exactly 3 expenses exist under the right cycle
    const savedExpRes = await callRealApi(page, `/expenses?cycleId=${cycleId}`);
    expect(savedExpRes.status).toBe(200);
    const expenses = getList(savedExpRes.data);
    expect(expenses.length).toBe(3);

    for (const exp of expenses) {
      expect(exp.cycleId.toString()).toBe(cycleId.toString());
    }

    // Verify categories and amounts
    // Seed: 1500, Machinery: 2000, Fertilizer: 1000
    const catMap = {};
    for (const exp of expenses) {
      if (exp.inputs && exp.inputs.length > 0) {
        catMap[exp.inputs[0].categoryTag] = exp.inputs[0].cost;
      } else if (exp.machinery && exp.machinery.cost) {
        catMap['machinery'] = exp.machinery.cost;
      }
    }
    expect(catMap['seed']).toBe(1500);
    expect(catMap['machinery']).toBe(2000);
    expect(catMap['fertilizer']).toBe(1000);

    // Verify variance / total endpoint reflects them
    const varianceRes = await callRealApi(page, `/cycles/${cycleId}/variance`);
    expect(varianceRes.status).toBe(200);
    const varianceData = varianceRes.data;

    // Check actual spending reflected in variance
    expect(varianceData.total?.actual).toBe(4500);
    expect(varianceData.categories?.seed?.actual).toBe(1500);
    expect(varianceData.categories?.machinery?.actual).toBe(2000);
    expect(varianceData.categories?.fertilizer?.actual).toBe(1000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario b: Double-click Confirm: still exactly 3 records
  // ─────────────────────────────────────────────────────────────────────────────
  test('Scenario b: Double-click Confirm does not produce duplicate records', async ({ page }) => {
    await registerUserAndCreateCycle(page, 'v4-b');

    const cyclesRes = await callRealApi(page, '/cycles');
    const cycleList = getList(cyclesRes.data);
    const activeCycle = cycleList.find(c => c.status === 'active');
    const cycleId = activeCycle._id;

    // Enter three expenses
    const transcriptInput = page.locator('#voice-transcript-input');
    await transcriptInput.fill('Spent 1500 on seed paddy, paid 2000 for 4 hours of tractor hire and 1000 for urea');

    const extractBtn = page.locator('#voice-extract-btn');
    await extractBtn.click();

    const pendingRows = page.locator('#voice-expense-entry-card tbody tr');
    await expect(pendingRows).toHaveCount(3, { timeout: 10000 });

    const confirmBtn = page.locator('#voice-confirm-btn');
    await expect(confirmBtn).toBeEnabled();

    // Double-click Confirm & Save rapidly
    await confirmBtn.dblclick();

    // Wait until pending items cleared
    await expect(pendingRows).toHaveCount(0, { timeout: 15000 });

    // Verify exactly 3 records exist via real API (not 6)
    const savedExpRes = await callRealApi(page, `/expenses?cycleId=${cycleId}`);
    expect(savedExpRes.status).toBe(200);
    const expenses = getList(savedExpRes.data);
    expect(expenses.length).toBe(3);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario c: A needs_review row blocks Confirm until fixed
  // ─────────────────────────────────────────────────────────────────────────────
  test('Scenario c: A needs_review row blocks Confirm until fixed', async ({ page }) => {
    await registerUserAndCreateCycle(page, 'v4-c');

    // Type ambiguous category expense
    const transcriptInput = page.locator('#voice-transcript-input');
    await transcriptInput.fill('Bought 2 bags for 5000');

    const extractBtn = page.locator('#voice-extract-btn');
    await extractBtn.click();

    const pendingRows = page.locator('#voice-expense-entry-card tbody tr');
    await expect(pendingRows).toHaveCount(1, { timeout: 10000 });

    // Verify row has needs_review status
    await expect(pendingRows.first()).toContainText(/Needs review|සමාලෝචනය/i);

    // Confirm button must be disabled
    const confirmBtn = page.locator('#voice-confirm-btn');
    await expect(confirmBtn).toBeDisabled();

    // Fix the row by choosing category 'fertilizer'
    const categorySelect = pendingRows.locator('select').first();
    await categorySelect.selectOption('fertilizer');

    // Now row should be 'OK' and Confirm enabled
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario d: Ambiguous correction shows chooser, modifies nothing until picked; Undo restores
  // ─────────────────────────────────────────────────────────────────────────────
  test('Scenario d: Ambiguous correction shows chooser and modifies nothing until picked; Undo restores', async ({ page }) => {
    await registerUserAndCreateCycle(page, 'v4-d');

    const transcriptInput = page.locator('#voice-transcript-input');
    const extractBtn = page.locator('#voice-extract-btn');

    // Extract two items with "urea"
    await transcriptInput.fill('Bought 2 bags of urea for 6000 and 1 bag of urea for 3000');
    await extractBtn.click();

    const pendingRows = page.locator('#voice-expense-entry-card tbody tr');
    await expect(pendingRows).toHaveCount(2, { timeout: 10000 });

    // Now submit ambiguous correction command: "change urea to 5000"
    await transcriptInput.fill('change urea to 5000');
    await extractBtn.click();

    // Verify ambiguity chooser appeared
    const chooserCard = page.locator('#voice-ambiguity-chooser');
    await expect(chooserCard).toBeVisible({ timeout: 5000 });

    // Verify NEITHER row has been modified to 5000 yet!
    const amtInput0 = pendingRows.nth(0).locator('input[data-field="totalAmount"]');
    const amtInput1 = pendingRows.nth(1).locator('input[data-field="totalAmount"]');
    await expect(amtInput0).toHaveValue('6000');
    await expect(amtInput1).toHaveValue('3000');

    // Click candidate 1 in chooser card
    const candidateBtn = chooserCard.locator('button[type="button"]').filter({ hasText: /6,000|6000/ }).first();
    await candidateBtn.click();

    // Chooser is dismissed
    await expect(chooserCard).toBeHidden({ timeout: 5000 });

    // Verify row 0 now has 5000
    await expect(amtInput0).toHaveValue('5000');

    // Now click Undo button
    const undoBtn = page.locator('#voice-undo-btn');
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();

    // Verify row 0 restored back to original 6000
    await expect(amtInput0).toHaveValue('6000');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario e: Simulate failed save for one row: others save once, failed stays
  // pending, retry does not duplicate
  // ─────────────────────────────────────────────────────────────────────────────
  test('Scenario e: Partial save failure keeps failed row pending without duplicating on retry', async ({ page }) => {
    await registerUserAndCreateCycle(page, 'v4-e');

    const cyclesRes = await callRealApi(page, '/cycles');
    const cycleList = getList(cyclesRes.data);
    const activeCycle = cycleList.find(c => c.status === 'active');
    const cycleId = activeCycle._id;

    const transcriptInput = page.locator('#voice-transcript-input');
    const extractBtn = page.locator('#voice-extract-btn');

    // Enter 2 distinct items: seed and fertilizer
    await transcriptInput.fill('Spent 1500 on seed paddy and 1000 for urea');
    await extractBtn.click();

    const pendingRows = page.locator('#voice-expense-entry-card tbody tr');
    await expect(pendingRows).toHaveCount(2, { timeout: 10000 });

    // Intercept POST /api/expenses: make the 2nd request return 500
    let postCount = 0;
    await page.route('**/api/expenses', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        postCount++;
        if (postCount === 2) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Simulated 500 Internal Server Error' })
          });
          return;
        }
      }
      await route.continue();
    });

    // Click Confirm & Save
    const confirmBtn = page.locator('#voice-confirm-btn');
    await confirmBtn.click();

    // Wait for save attempt to finish: 1 row succeeded and removed, 1 row failed and remains
    await expect(pendingRows).toHaveCount(1, { timeout: 10000 });

    // Error message displayed
    await expect(page.locator('span', { hasText: /Failed to save 1 of 2|සුරැකීමට නොහැකි විය/i }).first()).toBeVisible();

    // Verify DB: exactly 1 expense saved so far
    let expRes = await callRealApi(page, `/expenses?cycleId=${cycleId}`);
    expect(getList(expRes.data).length).toBe(1);

    // Unroute so subsequent requests succeed normally
    await page.unroute('**/api/expenses');

    // Retry saving the remaining pending row
    await confirmBtn.click();

    // Pending table should now be empty
    await expect(pendingRows).toHaveCount(0, { timeout: 10000 });

    // Verify DB: exactly 2 expenses now exist (1st row was not duplicated)
    expRes = await callRealApi(page, `/expenses?cycleId=${cycleId}`);
    expect(getList(expRes.data).length).toBe(2);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario f: An expense that pushes a category over threshold creates an alert
  // ─────────────────────────────────────────────────────────────────────────────
  test('Scenario f: Expense pushing category over threshold creates an alert via existing path', async ({ page }) => {
    await registerUserAndCreateCycle(page, 'v4-f');

    const cyclesRes = await callRealApi(page, '/cycles');
    const cycleList = getList(cyclesRes.data);
    const activeCycle = cycleList.find(c => c.status === 'active');
    const cycleId = activeCycle._id;

    // Verify initially no alerts exist for this new cycle
    const initialAlerts = await callRealApi(page, `/alerts?cycleId=${cycleId}`);
    expect(getList(initialAlerts.data).length).toBe(0);

    // Enter large fertilizer expense exceeding the baseline/threshold
    // Baseline for fertilizer is 45000; 150000 is 233% over baseline
    const transcriptInput = page.locator('#voice-transcript-input');
    const extractBtn = page.locator('#voice-extract-btn');

    await transcriptInput.fill('Bought 10 bags of urea fertilizer for 150000 rupees');
    await extractBtn.click();

    const pendingRows = page.locator('#voice-expense-entry-card tbody tr');
    await expect(pendingRows).toHaveCount(1, { timeout: 10000 });

    // Farmer override (TASK V5 Requirement 3: farmer overrides implausible amount in review table)
    const overrideBtn = page.locator('[data-testid^="voice-override-btn-"]').first();
    if (await overrideBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await overrideBtn.click();
    }

    const confirmBtn = page.locator('#voice-confirm-btn');
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
    await confirmBtn.click();

    // Pending table cleared
    await expect(pendingRows).toHaveCount(0, { timeout: 15000 });

    // Verify an alert was created via the existing alert path
    const alertsRes = await callRealApi(page, `/alerts?cycleId=${cycleId}`);
    expect(alertsRes.status).toBe(200);
    const alerts = getList(alertsRes.data);
    expect(alerts.length).toBeGreaterThan(0);

    const fertAlert = alerts.find(a => a.category === 'fertilizer');
    expect(fertAlert).toBeTruthy();
    expect(fertAlert.tier).toBe('significant');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Scenario g: Manual entry with voice flag off behaves exactly as before
  // ─────────────────────────────────────────────────────────────────────────────
  test('Scenario g: Manual entry with voice flag off behaves exactly as before', async ({ page }) => {
    await registerUserAndCreateCycle(page, 'v4-g');

    // Navigate to expense form with voice flag turned off
    await page.goto(`${BASE}/tracker/add?voice=off`);
    await expect(page.locator('#expense-form-page')).toBeVisible({ timeout: 15000 });

    // Verify Voice component is completely NOT rendered
    const voiceCard = page.locator('#voice-expense-entry-card');
    await expect(voiceCard).toBeHidden();

    // Perform standard manual entry
    const activitySelect = page.locator('#activityCode');
    await page.waitForFunction(() => {
      const sel = document.querySelector('#activityCode');
      return sel && sel.options.length > 1;
    }, { timeout: 15000 });
    await activitySelect.selectOption({ index: 1 });

    // Fill seed input quantity and cost: 17,000
    const inputQuantity = page.locator('#input-quantity-0');
    await inputQuantity.fill('10');
    const inputCost = page.locator('#input-cost-0');
    await inputCost.fill('17000');

    // Wait for live preview to update
    await expect(page.locator('[data-testid="live-total-preview"]')).not.toHaveText(/Rs\. 0/, { timeout: 5000 });

    // Click Save Expense button
    const saveExpBtn = page.locator('button', { hasText: /Save Expense|වියදම සුරකින්න/i }).first();
    await expect(saveExpBtn).toBeVisible({ timeout: 5000 });
    await saveExpBtn.click();

    // Redirects to records page
    await page.waitForURL(new RegExp(`${BASE}/tracker/records`), { timeout: 15000 });
    await expect(page.locator('#expense-records-page')).toBeVisible();

    // Verify record appears in records list
    await expect(page.locator('#expense-records-page')).toContainText('17,000');
  });
});
