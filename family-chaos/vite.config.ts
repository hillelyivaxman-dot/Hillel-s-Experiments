import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist/client', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: {
    host: true,
    port: 5173,
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true }, '/api': 'http://localhost:8787' },
  },
});
