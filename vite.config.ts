import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    // Split vendor chunks for better long-term caching
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          icons: ['@tabler/icons-react'],
        },
      },
    },
  },
  esbuild: {
    // Strip console.* and debugger statements from production bundles only
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}))
