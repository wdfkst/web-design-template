import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const API_TARGET = 'http://127.0.0.1:4300'

/**
 * The proxy is not just convenience. Preview responses carry
 * `frame-ancestors 'self'`, so the console and the previewed dist must look
 * same-origin to the browser; proxying /preview through the dev server is what
 * makes that true in development.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/tasks': API_TARGET,
      // Settings live under /api; without this the config page 404s in dev.
      '/api': API_TARGET,
      '/preview': API_TARGET,
      '/health': API_TARGET,
    },
  },
  test: {
    environment: 'jsdom',
  },
})
