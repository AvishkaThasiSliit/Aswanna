// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const EMAIL    = 'sunil@aswanna.lk';
const PASSWORD = 'Password123';

test.describe('Aswanna smoke test', () => {
  test.setTimeout(120000); // 2 minutes total

  test('login → language switch → filter → expand → delete → undo → create expense → edit expense → alert resolve and recommendation', async ({ page }) => {
    // ─── 1. Login ─────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/tracker/records`, { timeout: 15000 });
    await expect(page.locator('#expense-records-page')).toBeVisible();

    // ─── 2. Language switch ───────────────────────────────────────────────────
    // Ensure we start in English; the button shows "සිං" when in English (meaning "click to switch to Sinhala")
    // or shows "EN" when in Sinhala (meaning "click to switch to English")
    const langBtn = page.locator('button', { hasText: /සිං|EN/i }).first();
    await expect(langBtn).toBeVisible({ timeout: 5000 });
    const initialText = await langBtn.innerText();

    // Switch language
    await langBtn.click();
    await page.waitForTimeout(500);
    const toggledText = initialText.trim().includes('EN') ? 'සිං' : 'EN';
    await expect(langBtn).toContainText(new RegExp(toggledText.replace('.', '\\.'), 'i'), { timeout: 5000 });

    // Switch back to original language
    await langBtn.click();
    await page.waitForTimeout(500);
    await expect(langBtn).toContainText(new RegExp(initialText.trim().replace('.', '\\.'), 'i'), { timeout: 5000 });

    // ─── Explicitly ensure English mode for the rest of the test ─────────────
    const btnText = await langBtn.innerText();
    if (!btnText.includes('සිං')) {
      // We're in Sinhala, switch to English
      await langBtn.click();
      await page.waitForTimeout(600);
    }

    // ─── 3. Filter by category ────────────────────────────────────────────────
    const categorySelect = page.locator('select').first();
    await categorySelect.selectOption('machinery');
    await page.waitForTimeout(1000);

    // ─── 4. Clear filter and verify records appear ─────────────────────────────
    const clearBtn = page.locator('button', { hasText: /Clear Filters/i });
    await expect(clearBtn).toBeVisible({ timeout: 5000 });
    await clearBtn.click();
    await page.waitForTimeout(800);

    // ─── 5. Expand a row ──────────────────────────────────────────────────────
    const expandBtn = page.locator('button[title="Expand row"]').first();
    await expect(expandBtn).toBeVisible({ timeout: 5000 });
    await expandBtn.click();
    await page.waitForTimeout(500);

    // ─── 6. Delete an expense ─────────────────────────────────────────────────
    const deleteBtn = page.locator('button[title="Delete"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();
    await expect(page.locator('text=Delete Expense Record')).toBeVisible({ timeout: 5000 });
    await page.locator('button', { hasText: 'Delete Record' }).click();
    await expect(page.locator('text=Expense record deleted.')).toBeVisible({ timeout: 5000 });

    // ─── 7. Undo delete ───────────────────────────────────────────────────────
    const undoBtn = page.locator('button', { hasText: 'Undo' });
    await expect(undoBtn).toBeVisible({ timeout: 5000 });
    await undoBtn.click();
    await expect(
      page.locator('text=Expense record restored successfully.')
    ).toBeVisible({ timeout: 5000 });

    // ─── 8. Create a new Expense Record ───────────────────────────────────────
    await page.click('#btn-add-expense');
    await page.waitForURL(`${BASE}/tracker/add`, { timeout: 10000 });
    await expect(page.locator('#expense-form-page')).toBeVisible();

    // Wait for activity codes to load (options > 1 means loaded)
    const activitySelect = page.locator('#activityCode');
    await page.waitForFunction(() => {
      const sel = document.querySelector('#activityCode');
      return sel && sel.options.length > 1;
    }, { timeout: 15000 });
    await activitySelect.selectOption({ index: 1 });

    // Fill Input quantity and cost
    const inputQuantity = page.locator('#input-quantity-0');
    await inputQuantity.fill('10');
    const inputCost = page.locator('#input-cost-0');
    await inputCost.fill('15000');

    // Wait for live preview to reflect the cost (data-testid="live-total-preview")
    await expect(page.locator('[data-testid="live-total-preview"]')).not.toHaveText(/Rs\. 0/, { timeout: 5000 });

    // Click Save Expense (English or Sinhala)
    const saveBtn = page.locator('button', { hasText: /Save Expense|වියදම සුරකින්න/ }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();

    await page.waitForURL(`${BASE}/tracker/records`, { timeout: 15000 });
    await expect(page.locator('#expense-records-page')).toBeVisible();

    // ─── 9. Edit the created Expense Record ────────────────────────────────────
    const allEditBtns = page.locator('a[title="Edit"], button[title="Edit"]');
    await expect(allEditBtns.first()).toBeVisible({ timeout: 5000 });
    await allEditBtns.first().click();

    await page.waitForURL(/\/tracker\/edit\//, { timeout: 10000 });
    await expect(page.locator('#expense-form-page')).toBeVisible();

    // Wait for expense data to load (cost field should have a non-zero value)
    await page.waitForTimeout(1500);

    // Update cost to 20000
    const editInputCost = page.locator('#input-cost-0');
    await editInputCost.fill('20000');

    // Wait for live preview to update
    await page.waitForTimeout(500);

    // Save update (English or Sinhala)
    const updateBtn = page.locator('button', { hasText: /Save Expense|Update Expense|වියදම සුරකින්න/ }).first();
    await expect(updateBtn).toBeVisible({ timeout: 5000 });
    await updateBtn.click();

    await page.waitForURL(`${BASE}/tracker/records`, { timeout: 15000 });
    await expect(page.locator('#expense-records-page')).toBeVisible();

    // ─── 10. Threshold Crossing & Alert Resolution Flow ───────────────────────
    await page.click('#btn-add-expense');
    await page.waitForURL(`${BASE}/tracker/add`, { timeout: 10000 });
    await expect(page.locator('#expense-form-page')).toBeVisible();

    // Wait for activity codes to load
    await page.waitForFunction(() => {
      const sel = document.querySelector('#activityCode');
      return sel && sel.options.length > 1;
    }, { timeout: 15000 });
    await page.locator('#activityCode').selectOption({ index: 1 });

    // Input high seed cost to cross threshold (35,000 LKR)
    await page.locator('#input-quantity-0').fill('15');
    await page.locator('#input-cost-0').fill('35000');
    await page.waitForTimeout(500);

    // Save expense
    const thresholdSaveBtn = page.locator('button', { hasText: /Save Expense|වියදම සුරකින්න/ }).first();
    await thresholdSaveBtn.click();
    await page.waitForURL(`${BASE}/tracker/records`, { timeout: 15000 });

    // Navigate to Alerts Page
    const alertsNav = page.locator('a[href="/alerts"]');
    await expect(alertsNav).toBeVisible({ timeout: 5000 });
    await alertsNav.click();
    await page.waitForURL(`${BASE}/alerts`, { timeout: 10000 });
    await expect(page.locator('#alerts-page')).toBeVisible({ timeout: 10000 });

    // Verify overspend alert is displayed
    const alertCard = page.locator('#alerts-page').locator('text=Significant Overspend').first();
    await expect(alertCard).toBeVisible({ timeout: 10000 });

    // Click Resolve button
    const resolveBtn = page.locator('button[id^="resolve-alert-"]').first();
    await expect(resolveBtn).toBeVisible({ timeout: 5000 });
    const resolveBtnId = await resolveBtn.getAttribute('id');
    await resolveBtn.click();

    // Assert the alert resolve button is gone from active unresolved view
    await expect(page.locator(`#${resolveBtnId}`)).not.toBeVisible({ timeout: 10000 });

    // Switch to Resolved filter and assert the Resolved filter lists it
    const resolvedFilterSelect = page.locator('#alert-resolved-filter');
    await expect(resolvedFilterSelect).toBeVisible({ timeout: 5000 });
    await resolvedFilterSelect.selectOption('true');
    await expect(page.locator('#alerts-page').locator('.rounded-xl', { hasText: /Resolved/i }).first()).toBeVisible({ timeout: 10000 });

    // ─── 11. Crop Recommendation Flow ──────────────────────────────────────────
    const recNav = page.locator('a[href="/recommendation"], a[href="/crop-recommendation"]').first();
    await expect(recNav).toBeVisible({ timeout: 5000 });
    await recNav.click();
    await page.waitForURL(/\/recommendation/, { timeout: 10000 });
    await expect(page.locator('#crop-recommendation-page')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Accuracy-Weighted Crop Ranking')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Baseline Comparison')).toBeVisible({ timeout: 5000 });

    // Assert at least 2 ranked crop cards are visible
    await expect(page.locator('#crop-recommendation-page').locator('text="#1"').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#crop-recommendation-page').locator('text="#2"').first()).toBeVisible({ timeout: 5000 });

    // Assert baseline comparison table is visible
    const comparisonTable = page.locator('#crop-recommendation-page table');
    await expect(comparisonTable).toBeVisible({ timeout: 5000 });
    const tableRows = page.locator('#crop-recommendation-page table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 5000 });
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });
});
