// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Aswanna Setup Wizard E2E', () => {
  test.setTimeout(120000);

  test('register → complete 4-step wizard → land on expense form with info bar filled', async ({ page }) => {
    const timestamp = Date.now();
    const uniqueEmail = `farmer-${timestamp}@example.com`;
    const farmerName = `Kasun Wickramasinghe`;

    // ─── 1. Register new user ──────────────────────────────────────────────────
    await page.goto(`${BASE}/register`);
    await page.fill('#fullName', farmerName);
    await page.fill('#email', uniqueEmail);
    await page.fill('#password', 'Password123');
    await page.fill('#phone', '0712345678');
    await page.fill('#district', 'Anuradhapura');
    await page.click('button[type="submit"]');

    // ─── 2. Redirect to /setup (Step 1 Farmer) ──────────────────────────────────
    await page.waitForURL(new RegExp(`${BASE}/setup`), { timeout: 15000 });
    await expect(page.locator('h1', { hasText: /Initial Setup Wizard|මූලික පිහිටුවීම් මඟපෙන්වුම/i })).toBeVisible({ timeout: 10000 });

    // Step 1: Ensure name and fields are filled
    const nameInput = page.locator('#farmer-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(farmerName);

    await page.locator('#farmer-dateOfBirth').fill('1990-05-15');
    await page.locator('#farmer-nic').fill('199012345678');
    await page.locator('#farmer-phone').fill('0712345678');
    await page.locator('#farmer-address').fill('No 45 Temple Road\nAnuradhapura');
    await page.locator('#farmer-district').selectOption('Anuradhapura');
    await page.locator('#farmer-divisionalSecretariat').fill('Nuwaragam Palatha');
    await page.locator('#farmer-gnDivision').fill('Pandulagama');

    // Click "Save & Next" (English or Sinhala)
    await page.locator('button[type="submit"]', { hasText: /Save & Next|සුරැකීම සහ ඊළඟ/i }).click();

    // ─── 3. Step 2: Machinery Owned ───────────────────────────────────────────
    await page.waitForURL(new RegExp(`${BASE}/setup/machinery`), { timeout: 10000 });
    await expect(page.locator('h2', { hasText: /Machinery Owned|කෘෂි යන්ත්‍රෝපකරණ/i })).toBeVisible();

    // Add equipment row
    const addMachBtn = page.locator('button', { hasText: /Add Equipment|උපකරණයක් එක් කරන්න/i });
    await expect(addMachBtn).toBeVisible();
    await addMachBtn.click();

    // Fill machinery row
    const equipInput = page.locator('#machinery-0-equipment');
    await expect(equipInput).toBeVisible();
    await equipInput.fill('Two-wheel Tractor');
    await page.locator('#machinery-0-quantity').fill('1');
    await page.locator('#machinery-0-purchasedOn-year').fill('2022');
    await page.locator('#machinery-0-purchaseValue').fill('350000');
    await page.locator('#machinery-0-annotationNote').fill('Bought second-hand in Anuradhapura');

    // Click "Save & Next"
    await page.locator('button', { hasText: /Save & Next|සුරැකීම සහ ඊළඟ/i }).click();

    // ─── 4. Step 3: Land Details ──────────────────────────────────────────────
    await page.waitForURL(new RegExp(`${BASE}/setup/lands`), { timeout: 10000 });
    await expect(page.locator('h2', { hasText: /Land Details|වගා ඉඩම් විස්තර/i })).toBeVisible();

    // Fill Land Code
    const landCodeInput = page.locator('#land-0-landCode');
    await expect(landCodeInput).toBeVisible();
    await landCodeInput.fill('L-101');
    await page.locator('#land-0-landType').selectOption('lowland');
    await page.locator('#land-0-district').selectOption('Anuradhapura');
    await page.locator('#land-0-tenure').selectOption('freehold');
    await page.locator('#land-0-extentUnit').selectOption('acre');
    await page.locator('#land-0-extentValue').fill('2');

    // Verify computed acres live display
    await expect(page.locator('#land-0-extentAcres')).toContainText('2.00');

    await page.locator('#land-0-waterSourceType').selectOption('irrigated');
    const irrigInput = page.locator('#land-0-irrigationSource');
    await expect(irrigInput).toBeVisible();
    await irrigInput.fill('Nuwarawewa Tank');

    // Click "Save & Next"
    await page.locator('button', { hasText: /Save & Next|සුරැකීම සහ ඊළඟ/i }).click();

    // ─── 5. Step 4: Start Cultivation Cycle ───────────────────────────────────
    await page.waitForURL(new RegExp(`${BASE}/setup/cycle`), { timeout: 10000 });
    await expect(page.locator('h2', { hasText: /Start.*Cycle|වගා කන්නය ආරම්භ කිරීම/i })).toBeVisible();

    // Select Land & Crop
    await page.locator('#cycleLand').selectOption({ index: 1 });
    await page.locator('#cycleCrop').selectOption('Tomato');
    await page.locator('#cycleSeason').selectOption('Yala');

    // Start Cycle
    const startCycleBtn = page.locator('button[type="submit"]', { hasText: /Start Cycle|කන්නය ආරම්භ කරන්න/i });
    await expect(startCycleBtn).toBeVisible();
    await startCycleBtn.click();

    // ─── 6. Verify Active Cycle & Baseline Status ─────────────────────────────
    await expect(page.getByText(/Active Cultivation Cycle Running|සක්‍රිය වගා කන්නය/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/SO1 Baseline Status|SO1 මූලික තත්ත්වය/i)).toBeVisible();

    // Click "Go to Expense Form"
    const goToExpenseBtn = page.locator('button', { hasText: /Go to Expense Form|වියදම් පෝරමයට යන්න/i });
    await expect(goToExpenseBtn).toBeVisible();
    await goToExpenseBtn.click();

    // ─── 7. Land on Expense Form with Cultivation Info Bar Filled ─────────────
    await page.waitForURL(new RegExp(`${BASE}/tracker/add`), { timeout: 15000 });

    // Assert Section 1 Info Bar contains all populated data
    await expect(page.getByText('Kasun Wickramasinghe')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Anuradhapura').first()).toBeVisible();
    await expect(page.getByText(/Tomato \(Yala\)|තක්කාලි \(යල\)/i)).toBeVisible();
    await expect(page.getByText(/2 acre|අක්කර 2/i)).toBeVisible();
  });
});
