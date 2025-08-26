import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          dfinity: ['@dfinity/agent', '@dfinity/auth-client', '@dfinity/candid', '@dfinity/identity', '@dfinity/principal'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  define: {
    global: 'globalThis',
  },
})