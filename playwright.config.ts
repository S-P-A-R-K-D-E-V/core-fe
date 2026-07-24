import { defineConfig, devices } from '@playwright/test';

// ----------------------------------------------------------------------
// e2e config. There is no reachable backend/DB in this environment, so the
// spec under e2e/ mocks every API call at the network (page.route) level —
// see e2e/cleaning.spec.ts for exactly what is real vs mocked.
// ----------------------------------------------------------------------

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Uses a production build + `next start` rather than `next dev`: under `next
  // dev` in this offline sandbox, React's dev-mode prop-freezing combined with
  // this repo's pinned @mui/system + @emotion versions crashes SSR on every
  // page (reproduced on `/` too, unrelated to anything in this change) —
  // https://github.com/mui/material-ui `attachTheme`/"Cannot assign to read
  // only property 'theme'". Production React doesn't freeze props, so `next
  // start` avoids it. Run `npx next build` once before `npx playwright test`.
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
