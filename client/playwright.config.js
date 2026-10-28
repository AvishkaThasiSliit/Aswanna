import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/test',
  testMatch: '**/*.e2e.js',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node ../server/src/index.js',
      port: 4000,
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        SO1_MODE: 'mock',
      },
    },
    {
      command: 'npx vite --port 3000',
      port: 3000,
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        VITE_VOICE_ENTRY: 'on',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
