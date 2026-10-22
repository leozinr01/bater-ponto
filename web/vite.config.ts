import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // O app pergunta antes de atualizar (componente PwaPrompts), em vez de recarregar sozinho
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Sistema de Ponto · TAI Project',
        short_name: 'Ponto TAI',
        description: 'Registro de ponto e acompanhamento da jornada da equipe TAI Project.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#080d1a',
        theme_color: '#080d1a',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Bater ponto', url: '/', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Registros', url: '/registros', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Só o app (HTML, JS, CSS, fontes, ícones) fica em cache. A API nunca é cacheada:
        // o ponto precisa do horário do servidor e os dados são de cada usuário.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    // Em desenvolvimento a API é acessada pelo mesmo endereço do front (sem CORS)
    proxy: {
      '/api': process.env.API_URL ?? 'http://localhost:3333',
    },
  },
  // `npm run preview` testa o PWA de verdade (service worker não roda no modo dev)
  preview: {
    port: 4173,
    proxy: {
      '/api': process.env.API_URL ?? 'http://localhost:3333',
    },
  },
});
