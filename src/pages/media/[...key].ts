/**
 * GET /media/<key> — serves an object from the R2 bucket.
 *
 * Only keys this app writes itself are served (MEDIA_KEY). The content type
 * is the one sniffed from the bytes at upload time, `nosniff` stops a browser
 * second-guessing it, and the sandbox CSP means that even opened directly as
 * a page, an upload can't run anything.
 */
import type { APIRoute } from 'astro';
import { MEDIA_KEY } from '../../lib/media';

export const GET: APIRoute = async ({ params, locals }) => {
  const key = params.key ?? '';
  if (!MEDIA_KEY.test(key)) return new Response('Not found', { status: 404 });

  const object = await locals.runtime.env.MEDIA.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      // Every key carries its own random id, so the bytes behind a key never
      // change — this is the one place a year-long cache is honestly right.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
};
