import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Em desenvolvimento a API é acessada pelo mesmo endereço do front (sem CORS)
    proxy: {
      '/api': process.env.API_URL ?? 'http://localhost:3333',
    },
  },
});
