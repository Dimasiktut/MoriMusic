
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Mark @google/genai as external since we are loading it via importmap/CDN in the browser
      external: ['@google/genai'],
    },
  },
});
