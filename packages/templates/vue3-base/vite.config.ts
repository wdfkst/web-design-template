import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Relative base so the built dist can be served from any preview path.
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: { outDir: 'dist', emptyOutDir: true },
})
