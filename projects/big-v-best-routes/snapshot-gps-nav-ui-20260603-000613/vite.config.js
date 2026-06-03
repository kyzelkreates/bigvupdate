import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // MapLibre GL JS is a large map engine (~1 MB) — expected and normal.
    // Lazily imported via mapLibreAdapter.js so it never blocks initial load.
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        // Keep MapLibre in its own async chunk (rolldown function form)
        manualChunks(id) {
          if (id.includes('maplibre-gl')) return 'maplibre-gl';
        },
      },
    },
  },
});
