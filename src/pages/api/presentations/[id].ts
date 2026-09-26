/**
 * GET /api/presentations/:id — a deck, plus whether the caller owns it (the
 *   editor forks anything it doesn't own rather than editing it).
 * PUT /api/presentations/:id — the editor's autosave: title + the whole slide
 *   array, replaced in one write. Owner only.
 * DELETE /api/presentations/:id — a teacher's own deck and its uploads,
 *   gone. Library decks can't be deleted here; an admin takes one out of
 *   the library first.
 */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { images, presentations } from '../../../db/schema';
import { resolveIdentity, checkSaveRate } from '../../../lib/identity';
import { loadDeck, isOwner, toDeckJson, json } from '../../../lib/decks';
import { validateSlides, validateTitle, validateTheme } from '../../../lib/validate';

const MAX_BODY = 256 * 1024; // 30 full slides come to well under half of this

export const GET: APIRoute = async ({ params, request, locals }) => {
  const database = db(locals.runtime.env.DB);
  const deck = await loadDeck(database, params.id!);
  if (!deck) return json({ error: 'not-found' }, 404);
  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);
  return json(toDeckJson(deck, isOwner(deck, identity)));
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const env = locals.runtime.env;
  const database = db(env.DB);

  const deck = await loadDeck(database, params.id!);
  if (!deck) return json({ error: 'not-found' }, 404);

  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);
  if (!isOwner(deck, identity)) return json({ error: 'not-yours' }, 403);
  if (!(await checkSaveRate(database, identity!))) return json({ error: 'too-many-writes' }, 429);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too-large' }, 413);

  let body: { title?: unknown; theme?: unknown; slides?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad-json' }, 400);
  }

  const slides = validateSlides(body.slides, env.LIBRARY_ORIGIN);
  if (typeof slides === 'string') return json({ error: 'invalid', message: slides }, 400);

  const updatedAt = new Date();
  await database
    .update(presentations)
    .set({
      title: validateTitle(body.title) ?? deck.title,
      theme: validateTheme(body.theme) ?? deck.theme,
      slides,
      updatedAt,
    })
    .where(eq(presentations.id, deck.id));

  return json({ ok: true, updatedAt: updatedAt.getTime() });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const env = locals.runtime.env;
  const database = db(env.DB);
  const deck = await loadDeck(database, params.id!);
  if (!deck) return json({ error: 'not-found' }, 404);
  if (deck.isLibrary) return json({ error: 'library-deck' }, 409);

  const identity = await resolveIdentity(database, request, env.ADMIN_EMAILS);
  if (!isOwner(deck, identity)) return json({ error: 'not-yours' }, 403);

  const uploads = await database.select().from(images).where(eq(images.presentationId, deck.id));
  if (uploads.length) await env.MEDIA.delete(uploads.map((u) => u.r2Key));
  await database.delete(images).where(eq(images.presentationId, deck.id));
  await database.delete(presentations).where(eq(presentations.id, deck.id));
  return json({ ok: true });
};
