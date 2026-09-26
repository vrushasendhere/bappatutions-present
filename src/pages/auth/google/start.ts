/**
 * GET /auth/google/start[?return=/path] — opened in the sign-in popup (or,
 * where popups are blocked, as a full-page trip). Sends the browser to
 * Google, remembering (for ten minutes, in a first-party cookie) the random
 * state and PKCE verifier the callback will check, and where to come back to.
 */
import type { APIRoute } from 'astro';
import {
  OAUTH_COOKIE,
  devLoginAllowed,
  failurePage,
  pkceChallenge,
  randomToken,
  redirectUri,
  safeReturnPath,
} from '../../../lib/auth-server';

export const GET: APIRoute = async ({ url, locals, cookies, redirect }) => {
  const env = locals.runtime.env;
  const back = safeReturnPath(url.searchParams.get('return'));

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    if (devLoginAllowed(env, url)) return redirect(`/auth/dev?return=${encodeURIComponent(back)}`);
    return failurePage('Signing in isn’t switched on yet.', 503);
  }

  const state = randomToken(16);
  const verifier = randomToken(32);
  // base64url tokens never contain ".", so the callback can split off the
  // first two parts and treat the rest as the (encoded) return path.
  cookies.set(OAUTH_COOKIE, `${state}.${verifier}.${encodeURIComponent(back)}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax', // sent on Google's top-level redirect back to us
    path: '/auth/google',
    maxAge: 600,
  });

  const google = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  google.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(url),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return redirect(google.toString());
};
