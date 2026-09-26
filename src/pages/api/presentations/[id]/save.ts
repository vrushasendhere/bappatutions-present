/**
 * POST /api/presentations/:id/save — keep a deck permanently: it stops
 * expiring after two days. Needs a signed-in owner; a teacher can keep up to
 * SAVED_LIMIT decks (deleting one frees a place). Admins aren't limited.
 */
import type { APIRoute } from 'astro';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { presentations } from '../../../../db/schema';
import { resolveIdentity } from '../../../../lib/identity';
import { loadDeck, isOwner, json, SAVED_LIMIT } from '../../../../lib/decks';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const database = db(locals.runtime.env.DB);
  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);
  if (!identity?.userId) return json({ error: 'not-signed-in' }, 401);

  const deck = await loadDeck(database, params.id!);
  if (!deck) return json({ error: 'not-found' }, 404);
  if (!isOwner(deck, identity)) return json({ error: 'not-yours' }, 403);
  if (deck.saved) return json({ ok: true });

  if (!identity.isAdmin) {
    const [{ count }] = await database
      .select({ count: sql<number>`count(*)` })
      .from(presentations)
      .where(and(eq(presentations.ownerUserId, identity.userId), eq(presentations.saved, true), eq(presentations.isLibrary, false)));
    if (count >= SAVED_LIMIT) return json({ error: 'save-limit', limit: SAVED_LIMIT }, 409);
  }

  await database.update(presentations).set({ saved: true, expiresAt: null }).where(eq(presentations.id, deck.id));
  return json({ ok: true });
};
