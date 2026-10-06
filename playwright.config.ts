import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

/**
 * Projects
 *  - api       REST tests (*.api.spec.ts). No browser is launched.
 *  - chromium  every browser test (UI, network, accessibility, UI regressions)
 *  - firefox / webkit  @smoke journeys only (`npm run test:cross-browser`). `npm test` runs
 *    api + chromium, which keeps the default run small for the rate-limited shared environment.
 */
const API_SPECS = /.*\.api\.spec\.ts/;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: env.isCI,
  // Retries are a CI safety net only. Locally a flaky test should fail loudly so it gets fixed.
  retries: env.isCI ? 1 : 0,
  workers: env.workers,
  // Generous budget: a test may wait on the POST throttle (see src/support/PostThrottle.ts).
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [
    [env.isCI ? 'github' : 'list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  use: {
    baseURL: env.baseUrl,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testMatch: API_SPECS },
    { name: 'chromium', testIgnore: API_SPECS, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testIgnore: API_SPECS, grep: /@smoke/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testIgnore: API_SPECS, grep: /@smoke/, use: { ...devices['Desktop Safari'] } },
  ],
});
