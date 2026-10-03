import { defineConfig } from '@playwright/test'

// End-to-end tests in a real browser at phone size, against the app in local
// mode (no Supabase), so no sign-in is needed.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'America/Chicago',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone-light', use: { browserName: 'chromium', colorScheme: 'light' } },
    { name: 'phone-dark', use: { browserName: 'chromium', colorScheme: 'dark' } },
  ],
  webServer: {
    command: 'npx vite --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    // Empty values override .env.local so the app runs in local mode.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
