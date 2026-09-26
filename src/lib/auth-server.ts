/**
 * Signing in with Google, server side.
 *
 * The flow runs in a popup that is a top-level window on this app's own
 * origin — never inside the bappatutions.in iframe, where Google refuses to
 * show its sign-in page at all. That also means the one cookie used here
 * (the OAuth state, for ten minutes) is an ordinary first-party cookie.
 *
 * When it's done, the popup hands a session token to the window that opened
 * it with postMessage and closes. The token lives in that window's
 * localStorage and travels as `Authorization: Bearer` — see lib/identity.ts
 * for why sessions aren't cookies.
 */
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { db as makeDb } from '../db/client';
import { sessions, users } from '../db/schema';
import { sha256hex } from './identity';

type Db = ReturnType<typeof makeDb>;

const SESSION_DAYS = 30;
export const OAUTH_COOKIE = 'bt_oauth';

export function redirectUri(url: URL): string {
  return `${url.origin}/auth/google/callback`;
}

/** Where to go after a full-page sign-in (used when a popup isn't possible).
 *  Only a path on this site — never another origin, and never "//host",
 *  which a browser reads as another origin — so this can't be used to bounce
 *  someone off to a lookalike page. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/mine';
  return value.slice(0, 300);
}

/**
 * The local stand-in for Google's sign-in screen, for development only. Two
 * locks: the DEV_LOGIN setting (only ever in .dev.vars, which is gitignored
 * and never deployed) AND the request arriving on localhost. Production runs
 * on present.bappatutions.in, so even a stray DEV_LOGIN there does nothing.
 */
export function devLoginAllowed(env: Env, url: URL): boolean {
  return env.DEV_LOGIN === 'on' && ['localhost', '127.0.0.1'].includes(url.hostname);
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

/**
 * Trade the authorization code for Google's ID token and read the profile
 * out of it.
 *
 * The token arrives straight from Google's token endpoint over TLS, in
 * exchange for our client secret, so its signature doesn't need separate
 * checking (OpenID Connect Core §3.1.3.7) — but the audience, issuer, expiry
 * and verified-email claims still do.
 */
export async function exchangeCode(env: Env, url: URL, code: string, verifier: string): Promise<GoogleProfile | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(url),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (!res.ok) return null;
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;

  const payload = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    )
  ) as { iss?: string; aud?: string; exp?: number; sub?: string; email?: string; email_verified?: boolean; name?: string };

  const issuerOk = payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com';
  if (!issuerOk || payload.aud !== env.GOOGLE_CLIENT_ID) return null;
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  if (!payload.sub || !payload.email || payload.email_verified !== true) return null;
  return { sub: payload.sub, email: payload.email, name: payload.name || payload.email };
}

/** Find or create the user, and open a session for them. Returns the token
 *  for the browser; only its hash is stored. */
export async function startSession(database: Db, profile: GoogleProfile): Promise<string> {
  let [user] = await database.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1);
  if (!user) {
    user = { id: nanoid(), googleSub: profile.sub, email: profile.email, name: profile.name, createdAt: new Date() };
    await database.insert(users).values(user);
  } else if (user.email !== profile.email || user.name !== profile.name) {
    await database.update(users).set({ email: profile.email, name: profile.name }).where(eq(users.id, user.id));
  }

  const token = randomToken();
  await database.insert(sessions).values({
    token: await sha256hex(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
}

const PAGE_HEAD = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>BappaTutions — sign in</title><style>body{font-family:system-ui,sans-serif;display:grid;place-content:center;min-height:100vh;margin:0;padding:1rem;text-align:center;color:#1f2937}</style></head><body>`;

/**
 * Sign-in's last page. In a popup: hand the token to the window that opened
 * it (same origin only — postMessage's target origin makes sure of that) and
 * close; that window then claims the browser's anonymous decks.
 *
 * With no opener — popups blocked, so sign-in ran as a full-page trip — keep
 * the token in this origin's storage, mark the claim as pending for the next
 * page to finish (see finishPendingClaim), and go back where the teacher was.
 */
export function landingPage(token: string, returnPath: string): Response {
  // JSON inside an inline script: escape "<" so no value can end the script.
  const data = JSON.stringify({ type: 'bt-auth', token, back: safeReturnPath(returnPath) }).replace(/</g, '\\u003c');
  const html = `${PAGE_HEAD}<p>Signed in. You can close this window.</p><script>
const data = ${data};
if (window.opener) { window.opener.postMessage({ type: data.type, token: data.token }, location.origin); window.close(); }
else {
  try { localStorage.setItem('bt_session', data.token); localStorage.setItem('bt_claim_pending', '1'); } catch (e) {}
  location.replace(data.back);
}
</script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export function failurePage(message: string, status = 400): Response {
  const safe = message.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return new Response(`${PAGE_HEAD}<p>${safe}</p><p>Close this window and try again.</p></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function devLoginPage(returnPath: string): Response {
  const back = safeReturnPath(returnPath).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return new Response(
    `${PAGE_HEAD}<form method="post" style="display:grid;gap:.6rem;min-width:18rem">
<p><strong>Local test sign-in</strong><br><small>Stands in for Google on localhost only.</small></p>
<input type="hidden" name="return" value="${back}">
<input name="email" type="email" required placeholder="email" value="teacher@example.com">
<input name="name" required placeholder="name" value="Test Teacher">
<button>Sign in</button></form></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}
