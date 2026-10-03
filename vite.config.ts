import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the build works at any URL (e.g. GitHub Pages' /eden-calendar/).
  base: './',
  plugins: [react()],
})
