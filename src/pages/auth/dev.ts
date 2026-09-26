/**
 * /auth/dev — a local stand-in for Google's sign-in screen, so the whole
 * sign-in flow (popup, token hand-off, claiming decks) can be exercised
 * without a Google client. Does not exist anywhere but localhost with
 * DEV_LOGIN=on; see devLoginAllowed.
 */
import type { APIRoute } from 'astro';
import { db } from '../../db/client';
import { devLoginAllowed, devLoginPage, landingPage, startSession } from '../../lib/auth-server';

const notFound = () => new Response('Not found', { status: 404 });

export const GET: APIRoute = ({ url, locals }) =>
  devLoginAllowed(locals.runtime.env, url) ? devLoginPage(url.searchParams.get('return') ?? '') : notFound();

export const POST: APIRoute = async ({ url, locals, request }) => {
  if (!devLoginAllowed(locals.runtime.env, url)) return notFound();
  const form = await request.formData();
  const back = String(form.get('return') ?? '');
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const name = String(form.get('name') ?? '').trim() || email;
  if (!email.includes('@')) return devLoginPage(back);
  const token = await startSession(db(locals.runtime.env.DB), { sub: `dev:${email}`, email, name });
  return landingPage(token, back);
};
