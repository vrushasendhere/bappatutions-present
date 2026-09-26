/**
 * Browser-side identity. No cookies anywhere — see the plan's identity
 * section: this app lives inside a cross-site iframe on bappatutions.in,
 * where cookies are treated as third-party. The id lives in this origin's
 * own localStorage and travels as a request header instead.
 */
const ANON_KEY = 'bt_anon_id';
const ANON_SHAPE = /^[A-Za-z0-9-]{16,64}$/;

// Private browsing and strict settings can make localStorage throw; the tab
// still works, it just forgets its id when closed.
let memoryId: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(ANON_KEY);
  } catch {
    return memoryId;
  }
}

function write(id: string) {
  memoryId = id;
  try {
    localStorage.setItem(ANON_KEY, id);
  } catch {}
}

export function getAnonId(): string {
  let id = read() ?? memoryId;
  if (!id) {
    id = crypto.randomUUID();
    write(id);
  }
  return id;
}

/**
 * Customize opens a new top-level tab from inside the iframe, and a browser
 * may give those two contexts separate storage. The gallery passes its id
 * along as ?anon=; this tab adopts it only if it has none of its own, then
 * removes it from the address bar so it isn't left in history.
 */
export function adoptAnonFromQuery() {
  const url = new URL(location.href);
  const passed = url.searchParams.get('anon');
  if (passed === null) return;
  if (ANON_SHAPE.test(passed) && !read()) write(passed);
  url.searchParams.delete('anon');
  history.replaceState(null, '', url);
}

const SESSION_KEY = 'bt_session';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

/** Every request carries the anonymous id, and the session token once
 *  signed in — the server uses the session when there is one. */
export function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('X-Anon-Id', getAnonId());
  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}
