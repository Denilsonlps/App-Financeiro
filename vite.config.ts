/// <reference types="vitest" />
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // recharts sozinho tem ~520 kB (150 kB gzip); fica num chunk separado e cacheável
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: { manualChunks: { graficos: ['recharts'] } },
    },
  },
  test: {
    environment: 'node',
  },
});
