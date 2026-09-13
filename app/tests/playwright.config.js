import { defineConfig, devices } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:6021';
const desktop = process.env.DESKTOP === '1';

// The app's own suite: chromium + webkit at 390x844, mock data, own port 6021.
export default defineConfig({
  testDir: '.',
  testMatch: /app\.spec\.js$/,
  timeout: 60000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: BASE, viewport: { width: 390, height: 844 }, timezoneId: 'America/St_Johns', trace: 'retain-on-failure' },
  webServer: process.env.BASE_URL ? undefined : { command: 'node serve.mjs', url: 'http://127.0.0.1:6021/index.html', reuseExistingServer: false, timeout: 10000 },
  projects: [
    { name: 'chromium', use: desktop ? { browserName: 'chromium', viewport: { width: 1280, height: 800 } } : { ...devices['iPhone 14'], defaultBrowserType: 'chromium', browserName: 'chromium' } },
    { name: 'webkit', use: desktop ? { browserName: 'webkit', viewport: { width: 1280, height: 800 } } : { ...devices['iPhone 14'], browserName: 'webkit' } },
  ],
});
