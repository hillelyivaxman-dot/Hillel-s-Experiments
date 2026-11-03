import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    // Transpile for the browsers people actually have on phones/TVs: iOS Safari 14+, Chrome/Edge 90+, Firefox 90+.
    target: ['es2020', 'safari14', 'ios14', 'chrome90', 'edge90', 'firefox90'],
  },
  server: {
    host: true,
    port: 5173,
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true }, '/api': 'http://localhost:8787' },
  },
});
