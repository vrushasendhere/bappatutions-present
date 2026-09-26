/**
 * Who is making this request, and what they're allowed.
 *
 * No login is required to use the tool, so every identity is one of two
 * kinds — see the plan's "Identity, auth, and rate limits" section for why
 * neither uses a cookie: a cookie set for present.bappatutions.in is still
 * treated as third-party the moment it's read from inside the
 * bappatutions.in iframe, so both the anon id and the session token travel
 * as request headers, backed by the caller's own localStorage instead.
 *
 *   - Authorization: Bearer <token>  → a signed-in user; wins if valid
 *   - X-Anon-Id: <uuid>              → an anonymous browser otherwise
 *
 * Admins (BappaTutions' own accounts, ADMIN_EMAILS) author the library decks
 * and aren't held to the limits meant for teachers.
 */
import { eq } from 'drizzle-orm';
import type { db as makeDb } from '../db/client';
import { sessions, users, usageCounters } from '../db/schema';

type Db = ReturnType<typeof makeDb>;

export const DOWNLOADS_PER_DAY = 3;

export interface Identity {
  key: string; // user id or anon id — the usage_counters primary key
  userId: string | null;
  isAdmin: boolean;
  email: string | null;
  name: string | null;
}

export async function sha256hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Checked on every request, not stored against the user — so removing an
 *  address from ADMIN_EMAILS takes effect at once. */
export function isAdminEmail(email: string, adminEmails: string | undefined): boolean {
  return (adminEmails ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function resolveIdentity(
  database: Db,
  request: Request,
  adminEmails: string | undefined
): Promise<Identity | null> {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const [session] = await database
      .select()
      .from(sessions)
      .where(eq(sessions.token, await sha256hex(auth.slice('Bearer '.length))))
      .limit(1);
    if (session && session.expiresAt.getTime() > Date.now()) {
      const [user] = await database.select().from(users).where(eq(users.id, session.userId)).limit(1);
      if (user) {
        return {
          key: user.id,
          userId: user.id,
          isAdmin: isAdminEmail(user.email, adminEmails),
          email: user.email,
          name: user.name,
        };
      }
    }
    // Fall through to the anonymous id rather than failing the request — an
    // expired session shouldn't lock anyone out of using the tool.
  }

  const anonId = anonIdFrom(request);
  return anonId ? { key: anonId, userId: null, isAdmin: false, email: null, name: null } : null;
}

export function anonIdFrom(request: Request): string | null {
  const anonId = request.headers.get('x-anon-id');
  return anonId && /^[A-Za-z0-9-]{16,64}$/.test(anonId) ? anonId : null;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // yyyy-mm-dd
}

function hourWindowUTC(): string {
  return new Date().toISOString().slice(0, 13); // yyyy-mm-ddTHH
}

async function getOrInitCounters(database: Db, key: string) {
  let [row] = await database.select().from(usageCounters).where(eq(usageCounters.identity, key)).limit(1);
  if (!row) {
    row = {
      identity: key,
      usesCount: 0,
      downloadsToday: 0,
      downloadsDate: todayUTC(),
      savesThisHour: 0,
      savesHourWindow: hourWindowUTC(),
    };
    await database.insert(usageCounters).values(row).onConflictDoNothing();
  }
  return row;
}

const downloadsUsedToday = (row: { downloadsDate: string; downloadsToday: number }) =>
  row.downloadsDate === todayUTC() ? row.downloadsToday : 0;

/** 3 downloads a day for every teacher, signed in or not. Returns whether
 *  this one is allowed, and records it if so. Admins aren't limited. */
export async function checkAndRecordDownload(
  database: Db,
  identity: Identity
): Promise<{ allowed: boolean; remaining: number | null }> {
  if (identity.isAdmin) return { allowed: true, remaining: null };
  const row = await getOrInitCounters(database, identity.key);
  const used = downloadsUsedToday(row);
  if (used >= DOWNLOADS_PER_DAY) return { allowed: false, remaining: 0 };

  await database
    .update(usageCounters)
    .set({ downloadsToday: used + 1, downloadsDate: todayUTC() })
    .where(eq(usageCounters.identity, identity.key));
  return { allowed: true, remaining: DOWNLOADS_PER_DAY - (used + 1) };
}

/** Lifetime use count — past 3, the editor nudges an anonymous teacher to
 *  sign in. Called once per Customize/Create, not per autosave. */
export async function recordUse(database: Db, key: string): Promise<number> {
  const row = await getOrInitCounters(database, key);
  const next = row.usesCount + 1;
  await database.update(usageCounters).set({ usesCount: next }).where(eq(usageCounters.identity, key));
  return next;
}

export async function usageFor(database: Db, identity: Identity) {
  const row = await getOrInitCounters(database, identity.key);
  return {
    usesCount: row.usesCount,
    downloadsLeft: identity.isAdmin ? null : DOWNLOADS_PER_DAY - downloadsUsedToday(row),
  };
}

/**
 * At sign-in, this browser's anonymous usage moves into the account —
 * otherwise signing in would hand someone a fresh set of three downloads.
 * Moved, not copied: the anonymous row is emptied, so signing in a second
 * time the same day can't count the same downloads twice.
 */
export async function mergeUsage(database: Db, fromAnon: string, toUser: string) {
  const [from, to] = [await getOrInitCounters(database, fromAnon), await getOrInitCounters(database, toUser)];
  await database
    .update(usageCounters)
    .set({
      usesCount: to.usesCount + from.usesCount,
      downloadsToday: Math.min(DOWNLOADS_PER_DAY, downloadsUsedToday(to) + downloadsUsedToday(from)),
      downloadsDate: todayUTC(),
    })
    .where(eq(usageCounters.identity, toUser));
  await database
    .update(usageCounters)
    .set({ usesCount: 0, downloadsToday: 0, downloadsDate: todayUTC() })
    .where(eq(usageCounters.identity, fromAnon));
}

/** Coarse write throttle — an abuse guard, not a UX limit; the editor
 *  debounces well under this. Admins aren't limited. */
export async function checkSaveRate(database: Db, identity: Identity, maxPerHour = 60): Promise<boolean> {
  if (identity.isAdmin) return true;
  const row = await getOrInitCounters(database, identity.key);
  const window = hourWindowUTC();
  const count = row.savesHourWindow === window ? row.savesThisHour : 0;
  if (count >= maxPerHour) return false;

  await database
    .update(usageCounters)
    .set({ savesThisHour: count + 1, savesHourWindow: window })
    .where(eq(usageCounters.identity, identity.key));
  return true;
}
