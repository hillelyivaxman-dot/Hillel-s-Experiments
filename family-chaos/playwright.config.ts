import { defineConfig } from '@playwright/test';

// Two servers: the game server (plain HTTP, like LAN mode) and a TLS proxy in front of it
// (HTTPS/WSS with +50 ms per direction, like Render's edge / a player on another network).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8790', trace: 'retain-on-failure', ignoreHTTPSErrors: true },
  webServer: [
    {
      command: 'PORT=8790 node dist/server/index.js',
      url: 'http://localhost:8790/health',
      reuseExistingServer: false,
      timeout: 20_000,
    },
    {
      command: 'node scripts/tls-proxy.mjs --listen 8443 --target 8790 --delay 50',
      url: 'https://localhost:8443/health',
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 20_000,
    },
  ],
});
