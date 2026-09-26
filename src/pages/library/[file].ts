/**
 * GET /library/<file>.webp — one picture from the shared library on
 * bappatutions.in, passed through this app's own origin.
 *
 * Slides show library pictures straight from bappatutions.in; this exists for
 * the Download button, which has to read each picture's bytes to pack them
 * into the zip — and a script can't read another site's files unless that
 * site sends CORS headers, which bappatutions.in doesn't. Same filename rule
 * as a saved slide (LIBRARY_FILE), so this can only ever fetch a library
 * picture, never an arbitrary URL.
 */
import type { APIRoute } from 'astro';
import { LIBRARY_FILE } from '../../lib/validate';

export const GET: APIRoute = async ({ params, locals }) => {
  const file = params.file ?? '';
  if (!LIBRARY_FILE.test(file)) return new Response('Not found', { status: 404 });

  const upstream = await fetch(`${locals.runtime.env.LIBRARY_ORIGIN}/brand/course/pictures/${file}`);
  if (!upstream.ok) return new Response('Not found', { status: 404 });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
