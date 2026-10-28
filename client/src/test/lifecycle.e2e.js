// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Aswanna Full Lifecycle SO3 E2E', () => {
  test.setTimeout(180000); // 3 minutes total

  test('register → finish setup wizard → add expense → add harvest & sale → add notes → open summary & calendar → close cycle → see profit', async ({ page }) => {
    const timestamp = Date.now();
    const uniqueEmail = `lifecycle-${timestamp}@example.com`;
    const farmerName = `Anura Kumara ${timestamp}`;

    // ─── 1. Register new user ──────────────────────────────────────────────────
    await page.goto(`${BASE}/register`);
    await page.fill('#fullName', farmerName);
    await page.fill('#email', uniqueEmail);
    await page.fill('#password', 'Password123');
    await page.fill('#phone', '0771234567');
    await page.fill('#district', 'Anuradhapura');
    await page.click('button[type="submit"]');

    // ─── 2. Setup Wizard Step 1: Farmer Profile ───────────────────────────────
    await page.waitForURL(new RegExp(`${BASE}/setup`), { timeout: 15000 });
    await expect(page.locator('h1', { hasText: /Initial Setup Wizard|මූලික පිහිටුවීම්/i })).toBeVisible({ timeout: 10000 });

    const nameInput = page.locator('#farmer-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(farmerName);
    await page.locator('#farmer-dateOfBirth').fill('1988-03-20');
    await page.locator('#farmer-nic').fill('198812345678');
    await page.locator('#farmer-phone').fill('0771234567');
    await page.locator('#farmer-address').fill('Main Street, Anuradhapura');
    await page.locator('#farmer-district').selectOption('Anuradhapura');
    await page.locator('#farmer-divisionalSecretariat').fill('Central Nuwaragam');
    await page.locator('#farmer-gnDivision').fill('Division 1');

    await page.locator('button[type="submit"]', { hasText: /Save & Next|සුරැකීම සහ ඊළඟ/i }).click();

    // ─── 3. Setup Wizard Step 2: Machinery Owned ──────────────────────────────
    await page.waitForURL(new RegExp(`${BASE}/setup/machinery`), { timeout: 10000 });
    await expect(page.locator('h2', { hasText: /Machinery Owned|කෘෂි යන්ත්‍රෝපකරණ/i })).toBeVisible();
    // Proceed directly (machinery is optional)
    await page.locator('button', { hasText: /Save & Next|සුරැකීම සහ ඊළඟ/i }).click();

    // ─── 4. Setup Wizard Step 3: Land Details ─────────────────────────────────
    await page.waitForURL(new RegExp(`${BASE}/setup/lands`), { timeout: 10000 });
    await expect(page.locator('h2', { hasText: /Land Details|වගා ඉඩම් විස්තර/i })).toBeVisible();

    await page.locator('#land-0-landCode').fill('L-SO3');
    await page.locator('#land-0-landType').selectOption('lowland');
    await page.locator('#land-0-district').selectOption('Anuradhapura');
    await page.locator('#land-0-tenure').selectOption('freehold');
    await page.locator('#land-0-extentUnit').selectOption('acre');
    await page.locator('#land-0-extentValue').fill('2');
    await page.locator('#land-0-waterSourceType').selectOption('rainfed');

    await page.locator('button', { hasText: /Save & Next|සුරැකීම සහ ඊළඟ/i }).click();

    // ─── 5. Setup Wizard Step 4: Start Cultivation Cycle ──────────────────────
    await page.waitForURL(new RegExp(`${BASE}/setup/cycle`), { timeout: 10000 });
    await expect(page.locator('h2', { hasText: /Start.*Cycle|වගා කන්නය ආරම්භ කිරීම/i })).toBeVisible();

    await page.locator('#cycleLand').selectOption({ index: 1 });
    await page.locator('#cycleCrop').selectOption('Tomato');
    await page.locator('#cycleSeason').selectOption('Yala');

    await page.locator('button[type="submit"]', { hasText: /Start Cycle|කන්නය ආරම්භ කරන්න/i }).click();

    await expect(page.getByText(/Active Cultivation Cycle Running|සක්‍රිය වගා කන්නය/i)).toBeVisible({ timeout: 15000 });

    // Go to expense form
    const goToExpenseBtn = page.locator('button', { hasText: /Go to Expense Form|වියදම් පෝරමයට යන්න/i });
    await expect(goToExpenseBtn).toBeVisible();
    await page.waitForTimeout(500);
    await goToExpenseBtn.click();

    // ─── 6. Add Expense ───────────────────────────────────────────────────────
    try {
      await page.waitForURL(new RegExp(`${BASE}/tracker/add`), { timeout: 8000 });
    } catch {
      await goToExpenseBtn.click();
      await page.waitForURL(new RegExp(`${BASE}/tracker/add`), { timeout: 10000 });
    }
    await expect(page.locator('#expense-form-page')).toBeVisible();

    // Select activity code
    const activitySelect = page.locator('#activityCode');
    await page.waitForFunction(() => {
      const sel = document.querySelector('#activityCode');
      return sel && sel.options.length > 1;
    }, { timeout: 15000 });
    await activitySelect.selectOption({ index: 1 });

    // Fill seed or input quantity and cost: Rs. 17,000
    const inputQuantity = page.locator('#input-quantity-0');
    await inputQuantity.fill('10');
    const inputCost = page.locator('#input-cost-0');
    await inputCost.fill('17000');

    // Wait for live preview to reflect the cost (data-testid="live-total-preview")
    await expect(page.locator('[data-testid="live-total-preview"]')).not.toHaveText(/Rs\. 0/, { timeout: 5000 });

    // Save expense
    const saveExpBtn = page.locator('button', { hasText: /Save Expense|වියදම සුරකින්න/i }).first();
    await expect(saveExpBtn).toBeVisible({ timeout: 5000 });
    await saveExpBtn.click();

    // Redirect to records
    await page.waitForURL(new RegExp(`${BASE}/tracker/records`), { timeout: 15000 });
    await expect(page.locator('#expense-records-page')).toBeVisible();

    // ─── 7. Add Harvest and Sale ──────────────────────────────────────────────
    await page.locator('#sidebar--tracker-harvest-sales, a[href="/tracker/harvest-sales"]').first().click();
    await page.waitForURL(new RegExp(`${BASE}/tracker/harvest-sales`), { timeout: 10000 });
    await expect(page.locator('#harvest-sales-page')).toBeVisible();

    // Wait until cycle is resolved and button enabled
    const saveHarvestBtn = page.locator('#save-harvest-btn');
    await expect(saveHarvestBtn).toBeEnabled({ timeout: 10000 });

    // Fill harvest: 800 kg
    const harvestYield = page.locator('#harvest-yield');
    await expect(harvestYield).toBeVisible();
    await harvestYield.fill('800');
    await saveHarvestBtn.click();

    // Verify total harvest displays 800 kg
    await expect(page.locator('#total-harvest-display')).toContainText('800', { timeout: 10000 });

    // Wait until sale button is enabled
    const saveSaleBtn = page.locator('#save-sale-btn');
    await expect(saveSaleBtn).toBeEnabled({ timeout: 10000 });

    // Fill sale: 600 kg, Rs. 62,000, buyer Keells
    const saleQty = page.locator('#sale-quantitySold');
    await expect(saleQty).toBeVisible();
    await saleQty.fill('600');
    await page.locator('#sale-income').fill('62000');
    await page.locator('#sale-soldTo').fill('Keells Super');
    await saveSaleBtn.click();

    // Verify total income displays 62,000
    await expect(page.locator('#total-income-display')).toContainText('62,000', { timeout: 10000 });

    // ─── 8. Add Notes ─────────────────────────────────────────────────────────
    await page.locator('#sidebar--tracker-notes, a[href="/tracker/notes"]').first().click();
    await page.waitForURL(new RegExp(`${BASE}/tracker/notes`), { timeout: 10000 });
    await expect(page.locator('#cycle-notes-page')).toBeVisible();

    await page.locator('#notes-pestsAndDiseases').fill('Minimal pests detected');
    await page.locator('#notes-other').fill('Good weather throughout season');
    await page.locator('#notes-save-btn').click();
    await page.waitForTimeout(1000);

    // ─── 9. Open Calendar ─────────────────────────────────────────────────────
    await page.locator('#sidebar--tracker-calendar, a[href="/tracker/calendar"]').first().click();
    await page.waitForURL(new RegExp(`${BASE}/tracker/calendar`), { timeout: 10000 });
    await expect(page.locator('#activity-calendar-page')).toBeVisible();
    await expect(page.locator('#activity-calendar-table')).toBeVisible();

    // ─── 10. Open Summary ─────────────────────────────────────────────────────
    await page.locator('#sidebar--tracker-summary, a[href="/tracker/summary"]').first().click();
    await page.waitForURL(new RegExp(`${BASE}/tracker/summary`), { timeout: 10000 });
    await expect(page.locator('#cycle-summary-page')).toBeVisible();

    // Verify Cost Rs. 17,000 and Profit card rendered beside cost
    await expect(page.locator('#summary-total-cost')).toContainText('17,000', { timeout: 10000 });
    await expect(page.locator('#summary-profit-card')).toBeVisible();

    // Cost 17,000, Income 62,000 -> Profit 45,000
    await expect(page.locator('#summary-profit-value')).toContainText('45,000');

    // ─── 11. Close Cycle ──────────────────────────────────────────────────────
    const closeCycleBtn = page.locator('#close-cycle-btn');
    await expect(closeCycleBtn).toBeVisible();
    await closeCycleBtn.click();

    // Confirm dialog
    const confirmCloseBtn = page.locator('div[role="dialog"] button, div.fixed button', { hasText: /Close Cycle|කන්නය අවසන් කරන්න/i }).last();
    await expect(confirmCloseBtn).toBeVisible({ timeout: 5000 });
    await confirmCloseBtn.click();

    // Verify cycle closed banner / state
    await expect(page.locator('#cycle-closed-banner')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Cycle Closed|කන්නය සංවෘත|සංවෘත/i).first()).toBeVisible();

    // Verify profit is still clearly visible beside cost
    await expect(page.locator('#summary-profit-value')).toContainText('45,000');
  });
});
