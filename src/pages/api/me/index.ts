/**
 * GET /api/me — who the caller is and where they stand: signed in or not,
 * how many decks they've started (the editor nudges an anonymous teacher to
 * sign in after 3), downloads left today, and saved decks against the limit.
 */
import type { APIRoute } from 'astro';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../db/client';
import { presentations } from '../../../db/schema';
import { resolveIdentity, usageFor } from '../../../lib/identity';
import { json, SAVED_LIMIT } from '../../../lib/decks';

export const GET: APIRoute = async ({ request, locals }) => {
  const database = db(locals.runtime.env.DB);
  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);
  if (!identity) return json({ user: null, usesCount: 0, downloadsLeft: null, saved: 0, savedLimit: SAVED_LIMIT });

  let saved = 0;
  if (identity.userId) {
    [{ saved }] = await database
      .select({ saved: sql<number>`count(*)` })
      .from(presentations)
      .where(and(eq(presentations.ownerUserId, identity.userId), eq(presentations.saved, true), eq(presentations.isLibrary, false)));
  }

  return json({
    user: identity.userId ? { name: identity.name, email: identity.email, isAdmin: identity.isAdmin } : null,
    ...(await usageFor(database, identity)),
    saved,
    savedLimit: identity.isAdmin ? null : SAVED_LIMIT,
  });
};
