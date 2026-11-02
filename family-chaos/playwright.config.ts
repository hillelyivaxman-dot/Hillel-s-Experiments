import { defineConfig } from '@playwright/test';

const PORT = 8790;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    command: `PORT=${PORT} node dist/server/index.js`,
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
