/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/__tests__/setup.js',
    css: false,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.{test,spec}.{js,jsx}', 'src/__tests__/**', 'src/main.jsx'],
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // Allow any host (including the preview/proxy domains)
    allowedHosts: true,
    hmr: {
      clientPort: 443,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
})
