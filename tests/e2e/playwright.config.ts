import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const WEB_BASE = process.env.TM_WEB_BASE || 'http://localhost:9013';
const API_BASE = process.env.TM_API_BASE || 'http://localhost:8080';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        baseURL: API_BASE,
      },
    },
    {
      name: 'ui-chromium',
      testMatch: /.*\.ui\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: WEB_BASE,
      },
    },
    {
      name: 'ui-mobile',
      testMatch: /.*\.ui\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
        baseURL: WEB_BASE,
      },
    },
  ],
});
