// Runs only when data/depots.json exists (c5). Real data, real app (no ?mock=1).
import { test, expect } from '@playwright/test';
import { appExists, dataExists, loadData, APP_URL, tap } from './helpers.js';

test.skip(!appExists() || !dataExists(), 'needs app/index.html (c6) and data/depots.json (c5)');

const data = dataExists() ? loadData() : [];
const depots = Array.isArray(data) ? data : data.depots || [];
const apco = depots.find((d) => /apco/i.test(d.name || ''));

async function openDepot(page, name) {
  await page.goto(APP_URL);
  const row = page.getByText(name, { exact: true }).first();
  await expect(row).toBeVisible();
  await tap(page, row, `row "${name}"`);
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test.describe('real data', () => {
  test('APCO Recycling row: phone 709-489-1949 and the exact hours', async ({ page }) => {
    expect(apco, 'APCO Recycling row missing from data/depots.json').toBeTruthy();
    await openDepot(page, apco.name);
    await expect(page.locator('a[href="tel:7094891949"], a[href="tel:+17094891949"], a[href="tel:709-489-1949"]').first()).toBeVisible();
    await expect(page.getByText('709-489-1949').first()).toBeVisible();
    const text = await page.evaluate(() => document.body.innerText);
    // Mon–Sat 10:00–4:30 with the 12:30–1:00 lunch closure; Sunday closed. Accept 12h or 24h rendering.
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      const line = text.split('\n').find((l) => new RegExp(`^${day}`, 'i').test(l.trim()));
      expect(line, `no hours line for ${day}`).toBeTruthy();
      expect(line).toMatch(/10:00/);
      expect(line).toMatch(/12:30/);
      expect(line).toMatch(/\b(1:00|13:00)\b/);
      expect(line).toMatch(/\b(4:30|16:30)\b/);
    }
    const sun = text.split('\n').find((l) => /^Sun/i.test(l.trim()));
    expect(sun).toMatch(/closed/i);
    await page.screenshot({ path: `app/tests/qa/shots/apco-${test.info().project.name}.png` });
  });

});
