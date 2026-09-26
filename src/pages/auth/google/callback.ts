/**
 * GET /auth/google/callback — where Google sends the popup back. Checks the
 * state against the cookie set at /start (so the response belongs to a
 * sign-in this browser began), trades the code for the profile, opens a
 * session and hands its token to the opener.
 */
import type { APIRoute } from 'astro';
import { db } from '../../../db/client';
import { OAUTH_COOKIE, exchangeCode, failurePage, landingPage, startSession } from '../../../lib/auth-server';

export const GET: APIRoute = async ({ url, locals, cookies }) => {
  const env = locals.runtime.env;
  const saved = cookies.get(OAUTH_COOKIE)?.value ?? '';
  cookies.delete(OAUTH_COOKIE, { path: '/auth/google' });

  if (url.searchParams.get('error')) return failurePage('Sign-in was cancelled.');

  // state and verifier never contain "."; the return path might, so it's
  // everything after the second one.
  const [state, verifier, ...rest] = saved.split('.');
  const back = rest.join('.');
  const code = url.searchParams.get('code');
  if (!state || !verifier || !code || url.searchParams.get('state') !== state) {
    return failurePage('That sign-in link had expired or didn’t match.');
  }

  const profile = await exchangeCode(env, url, code, verifier);
  if (!profile) return failurePage('Google didn’t confirm the sign-in.');

  let returnPath = '/mine';
  try {
    returnPath = decodeURIComponent(back);
  } catch {} // a mangled cookie just means going to My presentations
  return landingPage(await startSession(db(env.DB), profile), returnPath);
};
