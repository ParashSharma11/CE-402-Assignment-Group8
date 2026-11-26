/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // three.js is only reached through the lazy 3D view, so it must not be forced into a shared chunk
    chunkSizeWarningLimit: 1200,
  },
  test: { globals: true, include: ['tests/**/*.test.ts'] },
});
