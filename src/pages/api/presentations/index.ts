/**
 * GET /api/presentations — the caller's own decks (My presentations): kept
 *   ones, plus temporary copies that haven't expired yet.
 *
 * POST /api/presentations — start a new deck for the caller.
 *
 *   { forkFrom: "<id>" }  → a private copy of that deck (Customize)
 *   {}                    → a blank one-slide deck (Create new)
 *
 * Either way the result belongs to the caller, is unsaved, and lives for two
 * days (see TEMP_TTL_MS) until signing in makes it permanent — Phase 4.
 */
import type { APIRoute } from 'astro';
import { and, desc, eq, gt, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../../db/client';
import { presentations } from '../../../db/schema';
import { resolveIdentity, recordUse, checkSaveRate } from '../../../lib/identity';
import { loadDeck, toDeckJson, json, TEMP_TTL_MS, type Deck } from '../../../lib/decks';
import type { SlideModel } from '../../../lib/slides';

const BLANK: SlideModel[] = [
  { id: 's0', order: 0, templateKey: 'title', content: { heading: 'Untitled presentation' } },
];

export const GET: APIRoute = async ({ request, locals }) => {
  const database = db(locals.runtime.env.DB);
  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);
  if (!identity) return json({ decks: [] });

  const mine = identity.userId ? eq(presentations.ownerUserId, identity.userId) : eq(presentations.ownerAnonId, identity.key);
  const decks = await database
    .select({
      id: presentations.id,
      title: presentations.title,
      saved: presentations.saved,
      expiresAt: presentations.expiresAt,
      updatedAt: presentations.updatedAt,
    })
    .from(presentations)
    .where(and(mine, eq(presentations.isLibrary, false), or(eq(presentations.saved, true), gt(presentations.expiresAt, new Date()))))
    .orderBy(desc(presentations.updatedAt));

  return json({
    decks: decks.map((d) => ({ ...d, expiresAt: d.expiresAt?.getTime() ?? null, updatedAt: d.updatedAt.getTime() })),
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const database = db(locals.runtime.env.DB);
  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);
  if (!identity) return json({ error: 'no-identity' }, 400);

  // Creating is a write like any other — the same hourly cap stops a script
  // from filling the database with copies.
  if (!(await checkSaveRate(database, identity))) return json({ error: 'too-many-writes' }, 429);

  const body = (await request.json().catch(() => ({}))) as { forkFrom?: unknown };

  let source: Deck | null = null;
  if (typeof body.forkFrom === 'string') {
    source = await loadDeck(database, body.forkFrom);
    if (!source) return json({ error: 'not-found' }, 404);
  }

  const now = new Date();
  const row: Deck = {
    id: nanoid(), // unguessable — this is the link a teacher shares
    title: source?.title ?? 'Untitled presentation',
    theme: source?.theme ?? 'classic',
    subject: source?.subject ?? null,
    standard: source?.standard ?? null,
    slides: source?.slides ?? BLANK,
    backgroundMusicR2Key: source?.backgroundMusicR2Key ?? null,
    isLibrary: false,
    ownerUserId: identity.userId,
    ownerAnonId: identity.userId ? null : identity.key,
    forkedFrom: source?.id ?? null,
    saved: false,
    expiresAt: new Date(now.getTime() + TEMP_TTL_MS),
    createdAt: now,
    updatedAt: now,
  };
  await database.insert(presentations).values(row);
  await recordUse(database, identity.key);

  return json(toDeckJson(row, true), 201);
};
