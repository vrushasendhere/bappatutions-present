/**
 * DELETE /api/images/:id — removes an upload and frees its slot toward the
 * deck's 9-image limit. Owner of the deck only.
 */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { images } from '../../../db/schema';
import { resolveIdentity } from '../../../lib/identity';
import { loadDeck, isOwner, json } from '../../../lib/decks';

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const database = db(locals.runtime.env.DB);
  const [image] = await database.select().from(images).where(eq(images.id, params.id!)).limit(1);
  if (!image) return json({ error: 'not-found' }, 404);

  const deck = await loadDeck(database, image.presentationId);
  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);
  if (!deck || !isOwner(deck, identity)) return json({ error: 'not-yours' }, 403);

  await locals.runtime.env.MEDIA.delete(image.r2Key);
  await database.delete(images).where(eq(images.id, image.id));
  return json({ ok: true });
};
