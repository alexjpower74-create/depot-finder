// Shared helpers for the QA specs. Real input only: page.mouse, never dispatchEvent.
import { expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

export const APP_URL = '/app/';
export const MOCK_URL = '/app/?mock=1';
export const DATA_PATH = 'data/depots.json';
export const appExists = () => existsSync('app/index.html');
export const dataExists = () => existsSync(DATA_PATH);
export const loadData = () => JSON.parse(readFileSync(DATA_PATH, 'utf8'));

/** The five variables the app must render as chips (list) and sentences (depot page). */
export const VARIABLES = ['refillable_beer', 'iceberg_bottles', 'paper_cardboard', 'paint', 'electronics'];
/** Filter chip labels fixed by PLAN.md. */
export const FILTER_CHIPS = [
  'Takes paint',
  'Takes electronics',
  'Takes paper & cardboard',
  'Takes refillable beer',
  'Takes Iceberg bottles',
  'Open now',
];
export const BEVERAGE_SENTENCE = 'Every Green Depot takes beverage containers.';

/**
 * Hit-test then click with the real pointer.
 * Fails if the centre of the target is covered by something else (a map pane, a sticky bar).
 * `getBoundingClientRect` would say a covered button is fine; `elementFromPoint` says what the finger hits.
 */
export async function tap(page, locator, label = 'target') {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, `${label} has no box (not rendered?)`).not.toBeNull();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const hit = await locator.evaluate((el, [px, py]) => {
    const h = document.elementFromPoint(px, py);
    return { ok: !!h && (h === el || el.contains(h) || h.contains(el)), hit: h ? h.tagName + (h.className ? '.' + String(h.className).split(' ').join('.') : '') : null };
  }, [x, y]);
  expect(hit.ok, `${label} at (${x | 0},${y | 0}) is covered by ${hit.hit}`).toBe(true);
  await page.mouse.click(x, y);
}

/** Wait until at least one OSM tile has actually loaded (not just been requested). */
export async function expectMapTiles(page) {
  await expect(page.locator('.leaflet-container').first()).toBeVisible();
  await expect
    .poll(() => page.locator('.leaflet-tile-loaded').count(), { timeout: 20_000, message: 'no leaflet tile finished loading' })
    .toBeGreaterThan(0);
}

/** Depot rows in the list. Accepts either explicit hooks or the first list of depot names. */
export function depotRows(page) {
  return page.locator('[data-depot-id], [data-testid="depot-row"], .depot-row, li.depot');
}

/** Visible text of the current screen, as a user reads it. */
export const screenText = (page) => page.evaluate(() => document.body.innerText);
