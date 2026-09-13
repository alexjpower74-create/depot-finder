// Whole-suite runner for Depot Finder.
// Every *.spec.js under app/tests (c6's app specs + c8's QA specs) runs on
// chromium + webkit at phone (390x844) and desktop (1280x800).
// The static server serves the REPO ROOT on 6009 so app/index.html can reach ../data/depots.json.
import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.QA_PORT || 6009);
export const BASE = `http://127.0.0.1:${PORT}`;

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };

export default defineConfig({
  testDir: 'app/tests',
  testMatch: /.*\.spec\.js$/,
  testIgnore: ['**/node_modules/**'],
  outputDir: 'app/tests/qa/shots/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'app/tests/qa/shots/report' }]],
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Same clock for everyone: America/St_Johns is the app's home zone.
    timezoneId: 'America/St_Johns',
    locale: 'en-CA',
  },
  projects: [
    { name: 'chromium-phone', use: { browserName: 'chromium', ...phone } },
    { name: 'webkit-phone', use: { browserName: 'webkit', ...phone } },
    { name: 'chromium-desktop', use: { browserName: 'chromium', ...desktop } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', ...desktop } },
  ],
  webServer: {
    command: `node app/tests/qa/serve.mjs --port ${PORT}`,
    url: `${BASE}/PLAN.md`,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
