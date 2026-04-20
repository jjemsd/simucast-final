// ============================================================================
// vite.config.js
// ============================================================================
// Vite is our dev server and build tool.
//
// The proxy rule below forwards any frontend request starting with "/api"
// to our Flask backend on port 5000. That way we can call "/api/stats/..."
// from React code and it just works — no CORS issues during development.
// ============================================================================

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward /api/* → http://localhost:5000/api/*
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // Keep cookies (for Flask-Login sessions)
        cookieDomainRewrite: 'localhost',
      },
    },
  },
})
