import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || '4173';
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: {
    command: `npm run serve:option-c -- --port=${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30_000
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'] }
    },
    {
      name: 'chromium-android',
      use: { ...devices['Pixel 7'] }
    }
  ]
});
