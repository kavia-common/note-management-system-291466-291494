import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensure dev server binds to the expected host/port for containerized/tizen envs
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  // Ensure preview (after build) also binds correctly
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
});
