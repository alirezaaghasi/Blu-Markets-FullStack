import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: 'all',
  },
  build: {
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and smaller initial load
        manualChunks: {
          // Vendor chunks (always needed)
          'react-vendor': ['react', 'react-dom'],

          // Feature chunks (lazy-loaded tabs) - let Vite handle dynamic imports
          'portfolio': ['./src/components/PortfolioHome.jsx'],
          'history': ['./src/components/HistoryPane.jsx'],
          'protection': ['./src/components/Protection.jsx'],
          'loans': ['./src/components/Loans.jsx'],

          // Modals (rarely used, defer loading)
          'modals': [
            './src/components/ResetConfirmModal.jsx',
            './src/components/ExecutionSummary.jsx',
            './src/components/ConfirmModal.jsx',
          ],

          // Risk profiling data (loaded during onboarding)
          'risk-profiling': [
            './src/engine/riskScoring.js',
            './src/data/questionnaire.v2.fa.json',
          ],
        },
      },
    },
    // Target modern browsers for smaller output
    target: 'es2020',
    // Use esbuild for minification (default, faster than terser)
    minify: 'esbuild',
  },
})
