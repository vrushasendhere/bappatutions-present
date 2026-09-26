// `astro build` puts its own server bundle at dist/_worker.js/ — worker/entry.ts
// imports it directly (see that file), but it must never be served as a public
// static file by the assets layer, which shares the same dist/ directory.
// wrangler refuses to deploy until dist/.assetsignore says so explicitly.
//
// A plain file rather than an inline shell redirect, since dist/ is rebuilt
// (and this file wiped) on every `astro build` — cross-platform is one less
// thing to get wrong here than a shell one-liner would be.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
writeFileSync(join(dist, '.assetsignore'), '_worker.js\n');
console.log('dist/.assetsignore written (excludes _worker.js from public assets)');
