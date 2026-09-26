/** DELETE /api/session — sign out: ends the session the caller presents. */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { sessions } from '../../db/schema';
import { sha256hex } from '../../lib/identity';
import { json } from '../../lib/decks';

export const DELETE: APIRoute = async ({ request, locals }) => {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    await db(locals.runtime.env.DB)
      .delete(sessions)
      .where(eq(sessions.token, await sha256hex(auth.slice('Bearer '.length))));
  }
  return json({ ok: true });
};
