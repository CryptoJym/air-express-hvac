import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';

const PORT = process.env.PORT || '4173';
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const darwinMajor = process.platform === 'darwin' ? Number(os.release().split('.')[0]) : 0;
// Bundled Playwright Firefox is killed by macOS 26/Darwin 25 before tests run.
// Keep it opt-in there while preserving Firefox coverage on launchable hosts.
const includeFirefox =
  process.env.AIR_EXPRESS_ENABLE_FIREFOX_E2E === '1' ||
  !(process.platform === 'darwin' && darwinMajor >= 25);

const projects = [
  {
    name: 'chromium-desktop',
    use: { ...devices['Desktop Chrome'] }
  },
  ...(includeFirefox
    ? [
        {
          name: 'firefox-desktop',
          use: { ...devices['Desktop Firefox'] }
        }
      ]
    : []),
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
];

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
  projects
});
