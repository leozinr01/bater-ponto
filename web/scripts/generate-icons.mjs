// Gera os ícones maskable (Android) e Apple a partir de public/pwa-maskable.svg.
// Os demais ícones vêm do pwa-assets-generator (pwa-assets.config.ts).
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../public/pwa-maskable.svg', import.meta.url));

const outputs = [
  ['../public/maskable-icon-512x512.png', 512],
  ['../public/apple-touch-icon-180x180.png', 180],
];

for (const [file, size] of outputs) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(new URL(file, import.meta.url).pathname.slice(1));
  console.log('gerado', file.replace('../', ''));
}
