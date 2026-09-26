/**
 * The real Worker entry point — wraps Astro's own generated `fetch` handler
 * (dist/_worker.js/index.js) with a `scheduled` handler for the daily
 * cleanup. Astro's Cloudflare adapter has no way to add a cron handler
 * itself (its output only ever exports `fetch`), so wrangler.jsonc's `main`
 * points here instead of straight at Astro's output; this file exists only
 * to re-export that `fetch` unchanged and add the one thing Astro can't.
 *
 * Import path assumes `astro build` has already run — see package.json's
 * `build`/`deploy` scripts, which always build before this is bundled.
 */
import astroWorker from '../dist/_worker.js/index.js';
import { db } from '../src/db/client';
import { cleanupExpiredDecks } from '../src/lib/cleanup';

export default {
  fetch: astroWorker.fetch,

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      cleanupExpiredDecks(db(env.DB), env.MEDIA).then(
        ({ decks, images }) => console.log(`cleanup: removed ${decks} expired presentation(s), ${images} image(s)`),
        (err) => console.error('cleanup failed:', err)
      )
    );
  },
} satisfies ExportedHandler<Env>;
