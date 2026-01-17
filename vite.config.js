import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: 'all',
  },
  build: {
    rollupOptions: {
      output: {
        // Let Vite infer chunks from dynamic imports (lazy() calls in App.jsx)
        // Only split out vendor chunks for better caching
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
    // Target modern browsers for smaller output
    target: 'es2020',
    // Use esbuild for minification (default, faster than terser)
    minify: 'esbuild',
  },
})
