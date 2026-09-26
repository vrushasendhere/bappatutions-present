/**
 * Who is allowed to put this app in an iframe.
 *
 * Only /gallery and /play/<id> are ever meant to be embedded — the Teachers
 * page on bappatutions.in embeds the gallery, and a deck opened from it plays
 * inside that same iframe (see the plan's Architecture section). Every other
 * page — Customize, My presentations, Download, sign-in — opens in its own
 * tab already and must never be frameable at all: those are exactly the
 * pages that hold write access to a teacher's account, and a page that can
 * be embedded can be clickjacked.
 *
 * LIBRARY_ORIGIN doubles as the one site allowed to embed the embeddable
 * pages — bappatutions.in is both where the picture library lives and the
 * only site with a legitimate reason to iframe this app. Its Cloudflare
 * Pages preview deploys get a wildcard so a preview build can be checked
 * before it's promoted to production.
 */
import { defineMiddleware } from 'astro:middleware';

const EMBEDDABLE = (pathname: string) => pathname === '/gallery' || pathname.startsWith('/play/');

export const onRequest = defineMiddleware(async ({ request, locals }, next) => {
  const response = await next();
  const headers = new Headers(response.headers);

  if (EMBEDDABLE(new URL(request.url).pathname)) {
    headers.set(
      'Content-Security-Policy',
      `frame-ancestors ${locals.runtime.env.LIBRARY_ORIGIN} https://*.bappatutions.pages.dev`
    );
  } else {
    headers.set('Content-Security-Policy', "frame-ancestors 'none'");
    headers.set('X-Frame-Options', 'DENY'); // belt and braces for pre-CSP3 clients
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
