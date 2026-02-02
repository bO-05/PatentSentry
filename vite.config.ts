import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Force include lucide-react to bundle it properly
    // This prevents dynamic loading of individual icon files
    include: ['lucide-react'],
  },
});
