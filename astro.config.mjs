// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';

// SSR on Cloudflare Workers — this app is a real backend (D1 + R2), unlike
// the main bappatutions.in site, which is fully static. `platformProxy` gives
// local `astro dev` access to the same D1/R2 bindings wrangler.jsonc declares,
// via miniflare's local emulation — no real Cloudflare resources are touched
// just by running `npm run dev`.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [preact()],
});
