// Plain-English sweep on every screen, plus the negative control that proves the sweep bites.
import { test, expect } from '@playwright/test';
import { appExists, MOCK_URL, tap, depotRows, screenText } from './helpers.js';
import { sweep, findOverclaims, findBanned, findBareUnknowns } from './sweep.js';

test.describe('negative control (no app needed)', () => {
  // "A check that cannot fail measured nothing." The planted page carries one of each defect.
  test('the sweep goes red on the planted page and green on the clean one', async ({ page }) => {
    await page.goto('/app/tests/qa/fixtures/planted.html');
    const planted = await screenText(page);
    expect(findOverclaims(planted)).toEqual(['Every depot takes paint.']);
    expect(findBanned(planted).join('\n')).toMatch(/"null"/);
    expect(findBanned(planted).join('\n')).toMatch(/refillable_beer/);
    expect(findBareUnknowns(planted)).toEqual(['Paper and cardboard: Unknown']);
    expect(() => sweep(planted, { depotPage: true })).toThrow(/overclaim/);

    await page.goto('/app/tests/qa/fixtures/clean.html');
    const clean = await screenText(page);
    expect(sweep(clean, { depotPage: true })).toBe(true);
  });
});

test.describe('plain English on every screen', () => {
  test.skip(!appExists() && !process.env.QA_SWEEP_SELFTEST, 'app/index.html not present yet (c6) — sweep not measured');
  // Point the real sweep at the planted page to watch it go red in the terminal.
  const target = process.env.QA_SWEEP_SELFTEST ? '/app/tests/qa/fixtures/planted.html' : null;

  test('list screen', async ({ page }) => {
    await page.goto(target || MOCK_URL);
    if (!target) await expect(depotRows(page).first()).toBeVisible();
    sweep(await screenText(page));
  });

  test('filters screen', async ({ page }) => {
    await page.goto(target || MOCK_URL);
    if (target) return sweep(await screenText(page));
    const filters = page.getByRole('button', { name: /^Filters?$/i });
    if (await filters.count()) await tap(page, filters.first(), 'Filters');
    await expect(page.getByRole('button', { name: 'Takes paint' })).toBeVisible();
    sweep(await screenText(page));
  });

  test('every depot page (mock)', async ({ page }) => {
    await page.goto(target || MOCK_URL);
    if (target) return sweep(await screenText(page), { depotPage: true });
    const rows = depotRows(page);
    await expect(rows.first()).toBeVisible();
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await page.goto(MOCK_URL);
      await expect(rows.nth(i)).toBeVisible();
      const name = (await rows.nth(i).innerText()).trim().split('\n')[0].trim();
      await tap(page, rows.nth(i), `row "${name}"`);
      await expect(page.getByRole('heading', { name })).toBeVisible();
      // Open every Source disclosure so quoted lines are swept too.
      const sources = page.getByText(/^Source$/).or(page.getByRole('button', { name: /^Source/ }));
      const s = await sources.count();
      for (let j = 0; j < s; j++) await tap(page, sources.nth(j), `Source ${j}`);
      const text = await screenText(page);
      sweep(text, { depotPage: true });
      // Positive path: the mock covers every verdict, so at least one depot says "call to confirm".
      if (/\bUnknown\b/.test(text)) expect(text).toMatch(/call to confirm/i);
    }
  });
});
