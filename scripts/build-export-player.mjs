// Builds the player that ships inside every downloaded presentation.
//
//   node scripts/build-export-player.mjs     (runs before `dev` and `build`)
//
// Output goes to public/export/, which the app serves as-is and the Download
// button fetches and packs into the zip. It is the live Player component (see
// src/export/entry.tsx), bundled as one classic script with Preact inside it.
//
// In `astro dev` this is built once at start — restart dev to pick up changes
// to the player in a download.

import { build } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'export');
mkdirSync(out, { recursive: true });

const logo = readFileSync(join(root, 'public', 'brand', 'bappa-logo.png'));

await build({
  entryPoints: [join(root, 'src', 'export', 'entry.tsx')],
  outfile: join(out, 'player.js'),
  bundle: true,
  format: 'iife', // a classic script: file:// pages can't load modules
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  define: {
    __BRAND_LOGO__: JSON.stringify(`data:image/png;base64,${logo.toString('base64')}`),
  },
});

await build({
  entryPoints: [join(root, 'src', 'export', 'player.css')],
  outfile: join(out, 'player.css'),
  bundle: true,
  minify: true,
});

console.log('export player built → public/export/player.js, player.css');
