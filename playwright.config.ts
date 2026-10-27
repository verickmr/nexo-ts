import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 60000,
  expect: { timeout: 15000 }, reporter: [['list']],
  use: { baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {} },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
