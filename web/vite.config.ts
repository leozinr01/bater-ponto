import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/** API que o site publicado no cPanel usa (o cPanel serve só os arquivos do site). */
const CPANEL_API_URL = 'https://ponto-tai.vercel.app';

/** Junta ao build do cPanel o .htaccess com as rotas da SPA, segurança e cache. */
const cpanelHtaccess = (): Plugin => ({
  name: 'cpanel-htaccess',
  apply: 'build',
  closeBundle() {
    copyFileSync('deploy/cpanel.htaccess', 'dist-cpanel/.htaccess');
  },
});

export default defineConfig(({ mode }) => {
  // `vite build --mode cpanel`: site para o cPanel, chamando a API na Vercel
  const cpanel = mode === 'cpanel';
  if (cpanel) process.env.VITE_API_URL ??= CPANEL_API_URL;

  return {
    plugins: [react(), tailwindcss(), ...(cpanel ? [cpanelHtaccess()] : [])],
    build: { outDir: cpanel ? 'dist-cpanel' : 'dist' },
    server: {
      port: 5173,
      // Em desenvolvimento a API é acessada pelo mesmo endereço do front (sem CORS)
      proxy: {
        '/api': process.env.API_URL ?? 'http://localhost:3333',
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': process.env.API_URL ?? 'http://localhost:3333',
      },
    },
  };
});
