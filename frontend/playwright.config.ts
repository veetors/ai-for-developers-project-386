import { defineConfig, devices } from '@playwright/test'

const COMPOSE_URL = 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/acceptance',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  globalSetup: './tests/acceptance/global-setup.ts',
  webServer: {
    command: 'docker compose --profile default up -d --build --wait backend frontend db',
    url: COMPOSE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: COMPOSE_URL,
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
