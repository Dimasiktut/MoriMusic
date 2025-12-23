
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // We remove the 'external' setting to ensure all libraries are bundled.
      // This resolves build-time resolution errors and prevents runtime issues 
      // on mobile browsers that may have restrictive module loading policies.
    },
  },
});
