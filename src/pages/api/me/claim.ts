/**
 * POST /api/me/claim — called right after signing in, with both the new
 * session token and this browser's anonymous id. Everything the browser made
 * anonymously (its temporary decks and their uploads) moves to the account,
 * and its usage joins the account's, so signing in never loses work and
 * never resets today's downloads.
 */
import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { images, presentations } from '../../../db/schema';
import { anonIdFrom, mergeUsage, resolveIdentity } from '../../../lib/identity';
import { json } from '../../../lib/decks';

export const POST: APIRoute = async ({ request, locals }) => {
  const database = db(locals.runtime.env.DB);
  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);
  if (!identity?.userId) return json({ error: 'not-signed-in' }, 401);

  const anonId = anonIdFrom(request);
  if (!anonId) return json({ claimed: 0 });

  const moved = await database
    .update(presentations)
    .set({ ownerUserId: identity.userId, ownerAnonId: null })
    .where(and(eq(presentations.ownerAnonId, anonId), eq(presentations.isLibrary, false)))
    .returning({ id: presentations.id });
  await database
    .update(images)
    .set({ ownerUserId: identity.userId, ownerAnonId: null })
    .where(eq(images.ownerAnonId, anonId));
  await mergeUsage(database, anonId, identity.userId);

  return json({ claimed: moved.length });
};
