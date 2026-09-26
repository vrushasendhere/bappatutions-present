/**
 * GET /api/library-images — the shared picture library's file list, fetched
 * server-side from bappatutions.in (/library-images.json) so the browser
 * never needs a cross-origin request for it. The pictures themselves are
 * then shown straight from bappatutions.in as ordinary <img> tags.
 */
import type { APIRoute } from 'astro';
import { json } from '../../lib/decks';

export const GET: APIRoute = async ({ locals }) => {
  const origin = locals.runtime.env.LIBRARY_ORIGIN;
  try {
    const res = await fetch(`${origin}/library-images.json`);
    if (!res.ok) throw new Error(String(res.status));
    const files = (await res.json()) as string[];
    return new Response(JSON.stringify({ base: `${origin}/brand/course/pictures/`, files }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return json({ base: `${origin}/brand/course/pictures/`, files: [], unavailable: true }, 502);
  }
};
