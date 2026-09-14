import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mockDepots } from '../data.mock.js';

// Works under both layouts: this suite serves app/ as root (6021); c8's runner serves the repo root (6009).
let APP = '/index.html?mock=1';
const shotsDir = () => path.join(path.dirname(test.info().file), 'shots');

test.beforeAll(async ({ request, baseURL }) => {
  const r = await request.get(baseURL + '/app/index.html');
  if (r.ok()) APP = '/app/index.html?mock=1';
});

// Hit-test then tap with the real pointer. Fails if anything covers the element's centre.
async function tap(page, locator, label = '') {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, `${label} has a box`).toBeTruthy();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const hit = await locator.evaluate((el, [x, y]) => {
    const at = document.elementFromPoint(x, y);
    return { ok: at === el || el.contains(at), at: at ? `${at.tagName.toLowerCase()}.${at.className}` : 'nothing' };
  }, [x, y]);
  expect(hit.ok, `${label || 'element'} at (${x | 0},${y | 0}) is covered by ${hit.at}`).toBe(true);
  await page.mouse.click(x, y);
}

async function hitTestAll(page, locator, label) {
  const n = await locator.count();
  expect(n, `${label}: something to hit-test`).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const el = locator.nth(i);
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    expect(box, `${label} #${i} has a box`).toBeTruthy();
    expect(Math.min(box.width, box.height), `${label} #${i} is big enough to tap`).toBeGreaterThanOrEqual(24);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const ok = await el.evaluate((e, [x, y]) => { const a = document.elementFromPoint(x, y); return a === e || e.contains(a); }, [x, y]);
    expect(ok, `${label} #${i} is hit at its centre`).toBe(true);
  }
  return n;
}

async function open(page, hash = '') {
  await page.goto(APP + hash);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'mock');
}

test('map renders OpenStreetMap tiles with attribution', async ({ page }) => {
  await open(page);
  await expect.poll(() => page.locator('.leaflet-tile-loaded').count(), { timeout: 20000 }).toBeGreaterThan(3);
  await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
  expect(await page.locator('.depot-pin').count()).toBe(5);
});

test('list shows all five mock depots with an open-now spread', async ({ page }) => {
  await open(page);
  await expect(page.locator('#list-count')).toHaveText('5 depots');
  const states = await page.locator('#list .pill').evaluateAll((els) => els.map((e) => e.className.replace('pill ', '')));
  for (const s of ['open', 'closes-soon', 'closed', 'unknown']) expect(states, `a ${s} pill`).toContain(s);
  await expect(page.locator('#list .next', { hasText: /^Opens / }).first()).toBeVisible();
  await expect(page.locator('#list .pill.unknown')).toHaveText('Hours unknown, call to confirm');
  await expect(page.locator('#list .row[data-depot-id]')).toHaveCount(5);
  // no per-depot "also takes" chips any more: the list is about where and when, not extras
  await expect(page.locator('#list .vchip')).toHaveCount(0);
  await page.screenshot({ path: path.join(shotsDir(), `${test.info().project.name}-home.png`) });
});

test('the Open now chip filters to the depots whose pill says open (real tap)', async ({ page }) => {
  await open(page);
  const count = page.locator('#list-count');
  await expect(count).toHaveText('5 depots');
  const openPills = await page.locator('#list .pill.open, #list .pill.closes-soon').count();
  expect(openPills).toBeGreaterThan(0);
  expect(openPills).toBeLessThan(5);
  const openChip = page.locator('.chip[data-filter="open_now"]');
  await tap(page, openChip, 'Open now chip');
  await expect(openChip).toHaveAttribute('aria-pressed', 'true');
  await expect(count).toHaveText(`${openPills} of 5 depots`);
  expect(await page.locator('#list .row').count()).toBe(openPills);
  await tap(page, openChip, 'Open now chip (off)');
  await expect(count).toHaveText('5 depots');
  await page.screenshot({ path: path.join(shotsDir(), `${test.info().project.name}-filter-open.png`) });
});

test('tapping a row opens the depot page; beverage line, no extras list', async ({ page }) => {
  await open(page);
  for (const d of mockDepots()) {
    await page.goto(APP);
    const row = page.locator(`#list .row-link[data-id="${d.id}"]`);
    await tap(page, row, `row ${d.id}`);
    await expect(page).toHaveURL(new RegExp(`#/depot/${d.id}$`));
    await expect(page.locator('#depot h1')).toHaveText(d.name);
    await expect(page.locator('#home')).toBeHidden();
    await expect(page.locator('#depot .standing-line')).toHaveText('Every Green Depot takes beverage containers.');
    await expect(page.locator('#depot .verdict-list')).toHaveCount(0);
    await expect(page.locator('#depot')).toContainText(`Last checked: ${d.last_checked}`);
  }
});

test('depot page: hours, links (sample-four)', async ({ page }) => {
  const d = mockDepots().find((x) => x.id === 'sample-four');
  await open(page, '#/depot/sample-four');
  await expect(page.locator('#depot h1')).toHaveText(d.name);
  await expect(page.locator('#depot a.btn', { hasText: 'Directions' })).toHaveAttribute('href', `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`);
  await expect(page.locator('#depot a.btn[href^="tel:"]')).toHaveAttribute('href', 'tel:7090000004');
  expect(await page.locator('#depot table.hours tr').count()).toBe(7);
  await expect(page.locator('#depot table.hours tr.today')).toHaveCount(1);
  await expect(page.locator('#depot table.hours td').first()).toHaveText('Unknown, call to confirm');
  await expect(page.locator('#depot .pill')).toHaveText('Hours unknown, call to confirm');
  await page.screenshot({ path: path.join(shotsDir(), `${test.info().project.name}-depot.png`), fullPage: true });
});

test('hours table highlights today and shows a split lunch (sample-five)', async ({ page }) => {
  await open(page, '#/depot/sample-five');
  const today = page.locator('#depot table.hours tr.today');
  await expect(today).toHaveCount(1);
  await expect(today.locator('td')).toHaveText(/^\d\d:\d\d–\d\d:\d\d, \d\d:\d\d–\d\d:\d\d$/);
  await expect(page.locator('#depot')).toContainText('Goose Bay');
});

test('correction form posts to the mock API', async ({ page }) => {
  await open(page, '#/depot/sample-two');
  const form = page.locator('#correction-form');
  await form.locator('#c-field').selectOption('hours');
  await tap(page, form.locator('#c-proposed'), 'proposed field');
  await page.keyboard.type('Open until 5 on Saturdays now.');
  await tap(page, form.locator('#c-note'), 'note field');
  await page.keyboard.type('Sign on the door.');
  await tap(page, form.locator('#c-contact'), 'contact field');
  await page.keyboard.type('someone@example.invalid');
  await tap(page, form.locator('button[type=submit]'), 'Send correction');
  await expect(page.locator('#form-msg')).toHaveClass(/ok/);
  await expect(page.locator('#form-msg')).toContainText('reference mock-1');
  const sent = await page.evaluate(() => window.__mockCorrections);
  expect(sent).toEqual([{ id: 'mock-1', depot_id: 'sample-two', field: 'hours', proposed: 'Open until 5 on Saturdays now.', note: 'Sign on the door.', contact: 'someone@example.invalid' }]);
  await expect(form.locator('#c-proposed')).toHaveValue('');
});

test('every tappable thing is hit at its centre (home and depot page)', async ({ page }) => {
  await open(page);
  await hitTestAll(page, page.locator('.chip'), 'filter chip');
  await hitTestAll(page, page.locator('#locate'), 'sort button');
  await hitTestAll(page, page.locator('.leaflet-control-zoom a'), 'zoom control');
  await hitTestAll(page, page.locator('.depot-pin'), 'map pin');
  await hitTestAll(page, page.locator('#list .row-link'), 'list row');
  await hitTestAll(page, page.locator('.brand'), 'brand link');

  await page.goto(APP + '#/depot/sample-one');
  await expect(page.locator('#depot h1')).toHaveText('Sample Depot One');
  await hitTestAll(page, page.locator('#depot .back'), 'back link');
  await hitTestAll(page, page.locator('#depot a.btn'), 'action button');
  await hitTestAll(page, page.locator('#correction-form select, #correction-form textarea, #correction-form input, #correction-form button'), 'form control');
  // back link works with a real tap
  await tap(page, page.locator('#depot .back'), 'back');
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#list-count')).toHaveText('5 depots');
});

test('map pin popup links to the depot page', async ({ page }) => {
  await open(page);
  const pin = page.locator('.depot-pin[title="Sample Depot One"]');
  await tap(page, pin, 'pin');
  const link = page.locator('.leaflet-popup a', { hasText: 'Open depot page' });
  await expect(link).toBeVisible();
  await tap(page, link, 'popup link');
  await expect(page.locator('#depot h1')).toHaveText('Sample Depot One');
});
