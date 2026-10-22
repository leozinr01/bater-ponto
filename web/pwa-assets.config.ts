import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Ícones do app a partir de public/pwa-icon.svg (cantos arredondados): favicon e ícones "any".
// Os ícones maskable (Android) e Apple vêm de public/pwa-maskable.svg, com fundo de ponta a ponta,
// porque esses sistemas recortam o formato sozinhos: veja scripts/generate-icons.mjs.
// Para gerar tudo: npm run icons
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  images: ['public/pwa-icon.svg'],
  preset: {
    ...minimal2023Preset,
    maskable: { sizes: [] },
    apple: { sizes: [] },
  },
});
