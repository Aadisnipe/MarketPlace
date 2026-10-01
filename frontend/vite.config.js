import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Same-origin in dev: browser calls /api/*, Vite forwards to Express.
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
});
