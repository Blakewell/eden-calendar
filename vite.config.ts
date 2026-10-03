/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the build works at any URL (e.g. GitHub Pages' /eden-calendar/).
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Tests run as if it's Saturday, Oct 3 2026 in a fixed timezone.
    env: { TZ: 'America/Chicago' },
  },
})
