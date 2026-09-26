/**
 * Signing in, browser side. Signing in is never needed to use the tool — it
 * only lets a teacher keep decks beyond two days (see the plan).
 *
 * The sign-in runs in a popup on this app's own origin (Google won't show its
 * page inside an iframe), which hands back a session token by postMessage.
 */
import { api, setSessionToken } from './client';

export interface Me {
  user: { name: string; email: string; isAdmin: boolean } | null;
  usesCount: number;
  downloadsLeft: number | null; // null: not limited (admins)
  saved: number;
  savedLimit: number | null; // null: not limited (admins)
}

const CLAIM_PENDING = 'bt_claim_pending';

async function claim() {
  await api('/api/me/claim', { method: 'POST' }).catch(() => {});
}

/** A full-page sign-in (no popup) lands back on some page with the token
 *  stored but the claim not yet made — finish it before anything else,
 *  above all before the editor decides whether a deck is the teacher's own. */
export async function finishPendingClaim() {
  let pending = false;
  try {
    pending = localStorage.getItem(CLAIM_PENDING) === '1';
    localStorage.removeItem(CLAIM_PENDING);
  } catch {}
  if (pending) await claim();
}

export async function fetchMe(): Promise<Me> {
  await finishPendingClaim();
  const res = await api('/api/me');
  return (await res.json()) as Me;
}

/**
 * Opens the sign-in popup; resolves true once signed in, false if it was
 * closed without signing in. Must be called straight from a click, or the
 * browser blocks the popup.
 *
 * If popups are blocked anyway, sign-in happens as a full-page trip that
 * comes back to this page — the promise never settles, since the page is
 * being left.
 */
export function signIn(): Promise<boolean> {
  const popup = window.open('/auth/google/start', 'bt-sign-in', 'width=500,height=650');
  if (!popup) {
    location.assign(`/auth/google/start?return=${encodeURIComponent(location.pathname + location.search)}`);
    return new Promise(() => {});
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      removeEventListener('message', onMessage);
      clearInterval(watch);
      resolve(ok);
    };
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== popup || e.data?.type !== 'bt-auth') return;
      setSessionToken(String(e.data.token));
      // Whatever this browser made before signing in moves to the account.
      await claim();
      finish(true);
    };
    addEventListener('message', onMessage);
    // The popup closes itself after posting the token; give that message a
    // moment to arrive before deciding the popup was closed by hand.
    const watch = setInterval(() => {
      if (popup.closed) setTimeout(() => finish(false), 400);
    }, 400);
  });
}

export async function signOut() {
  await api('/api/session', { method: 'DELETE' }).catch(() => {});
  setSessionToken(null);
}

export type KeepResult = 'kept' | 'limit' | 'failed';

export async function keepDeck(id: string): Promise<KeepResult> {
  const res = await api(`/api/presentations/${id}/save`, { method: 'POST' });
  if (res.ok) return 'kept';
  return res.status === 409 ? 'limit' : 'failed';
}
