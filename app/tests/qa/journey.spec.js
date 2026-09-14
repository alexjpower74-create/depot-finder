// The customer journey against the mock (?mock=1): map loads, filter, open a depot, submit a correction. Every tap is hit-tested and delivered with the real pointer.
import { test, expect } from '@playwright/test';
import { appExists, MOCK_URL, tap, expectMapTiles, depotRows, BEVERAGE_SENTENCE } from './helpers.js';

test.skip(!appExists(), 'app/index.html not present yet (c6) — journey not measured');

test.describe('journey (mock data)', () => {
  test('map loads, filter narrows the list, depot page, source, correction', async ({ page }, info) => {
    const shot = (n) => page.screenshot({ path: `app/tests/qa/shots/${info.project.name}-journey-${n}.png` });
    await page.goto(MOCK_URL);

    // 1. Map renders real tiles.
    await expectMapTiles(page);

    // 2. List is populated from the mock (5 synthetic depots).
    const rows = depotRows(page);
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();
    expect(before, 'mock list should have several depots').toBeGreaterThan(1);
    await shot('01-list');

    // 3. Filter with a real tap; the count must change and not collapse to nothing.
    const openNow = page.getByRole('button', { name: 'Open now' });
    await tap(page, openNow, 'filter chip "Open now"');
    await expect.poll(() => rows.count(), { message: 'filter did not change the list' }).not.toBe(before);
    const after = await rows.count();
    expect(after, 'filter emptied the list; mock must include an open depot').toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
    await shot('02-filtered');

    // 4. Open the first remaining depot by tapping its row.
    const firstRow = rows.first();
    const rowText = (await firstRow.innerText()).trim();
    const name = rowText.split('\n')[0].trim();
    await tap(page, firstRow, `row "${name}"`);
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText(BEVERAGE_SENTENCE).last()).toBeVisible(); // the map screen keeps its own standing line
    await expect(page.getByText(/Last checked/i)).toBeVisible();
    await shot('03-depot');

    // 6. Suggest a correction. Capture the POST if the mock api still goes through fetch.
    let posted = null;
    await page.route('**/correction', async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'qa-1' }) });
    });
    const openForm = page.getByRole('button', { name: /Suggest a correction/i }).or(page.getByRole('link', { name: /Suggest a correction/i })).first();
    if (await openForm.count()) await tap(page, openForm, 'Suggest a correction');
    const form = page.locator('form').filter({ has: page.locator('textarea, input[name="proposed"]') }).first();
    await expect(form).toBeVisible();
    await form.locator('textarea, input[name="proposed"]').first().fill('QA journey: hours look different on the door');
    const submit = form.getByRole('button', { name: /send|submit|suggest/i }).first();
    await tap(page, submit, 'correction submit');
    await expect(page.getByText(/thank|received|sent|submitted/i).first()).toBeVisible();
    if (posted) {
      expect(typeof posted.depot_id).toBe('string');
      expect(typeof posted.field).toBe('string');
      expect(posted.proposed).toContain('QA journey');
    }
    await shot('05-corrected');
  });

  test('every filter chip and every list row is hittable', async ({ page }) => {
    await page.goto(MOCK_URL);
    await expect(depotRows(page).first()).toBeVisible();
    for (const label of ['Open now']) {
      const chip = page.getByRole('button', { name: label });
      await tap(page, chip, `chip "${label}"`); // on
      await tap(page, chip, `chip "${label}" (off)`); // off
    }
    const rows = depotRows(page);
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      // A user scrolls a row into view before tapping it; hit-test it there, not below the fold.
      const row = rows.nth(i);
      await row.scrollIntoViewIfNeeded();
      const box = await row.boundingBox();
      const hit = await row.evaluate((el, [x, y]) => {
        const h = document.elementFromPoint(x, y);
        return !!h && (el === h || el.contains(h));
      }, [box.x + box.width / 2, box.y + box.height / 2]);
      expect(hit, `row ${i} centre is covered or off-screen`).toBe(true);
    }
  });
});
