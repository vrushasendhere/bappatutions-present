/**
 * PATCH /api/presentations/:id/library — admins only. Publish a deck to the
 * library (or take it out), set the subject and standard teachers browse by,
 * and set the deck's background music.
 *
 * A deck taken out of the library is kept, and becomes the admin's own, so
 * it isn't left belonging to nobody.
 */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { presentations } from '../../../../db/schema';
import { resolveIdentity } from '../../../../lib/identity';
import { loadDeck, isOwner, json, toDeckJson } from '../../../../lib/decks';
import { MEDIA_KEY } from '../../../../lib/media';

const STANDARDS = new Set(['4', '5', '6', '7', '8', '9', '10']);

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const database = db(locals.runtime.env.DB);
  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);
  if (!identity?.isAdmin) return json({ error: 'admins-only' }, 403);

  const deck = await loadDeck(database, params.id!);
  if (!deck) return json({ error: 'not-found' }, 404);
  if (!isOwner(deck, identity)) return json({ error: 'not-yours' }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    isLibrary?: unknown;
    subject?: unknown;
    standard?: unknown;
    backgroundMusicR2Key?: unknown;
  };
  const change: Partial<typeof presentations.$inferInsert> = {};

  if ('subject' in body) {
    const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 60) : '';
    change.subject = subject || null;
  }
  if ('standard' in body) {
    if (body.standard !== null && !STANDARDS.has(String(body.standard))) return json({ error: 'bad-standard' }, 400);
    change.standard = body.standard === null ? null : String(body.standard);
  }
  if ('backgroundMusicR2Key' in body) {
    const key = body.backgroundMusicR2Key;
    if (key !== null && (typeof key !== 'string' || !MEDIA_KEY.test(key))) return json({ error: 'bad-music' }, 400);
    change.backgroundMusicR2Key = key as string | null;
  }
  if (typeof body.isLibrary === 'boolean' && body.isLibrary !== deck.isLibrary) {
    change.isLibrary = body.isLibrary;
    change.saved = true;
    change.expiresAt = null;
    if (!body.isLibrary) {
      change.ownerUserId = identity.userId;
      change.ownerAnonId = null;
    }
  }

  await database.update(presentations).set(change).where(eq(presentations.id, deck.id));
  const updated = (await loadDeck(database, deck.id))!;
  return json(toDeckJson(updated, isOwner(updated, identity)));
};
