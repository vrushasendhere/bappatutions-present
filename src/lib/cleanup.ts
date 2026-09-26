/**
 * Deletes temporary presentations once their 2-day link has actually
 * lapsed — run from the Cron Trigger in worker/entry.ts, once a day.
 *
 * `loadDeck` already hides an expired deck from everyone the moment
 * `expires_at` passes, so this isn't what makes a deck disappear — a
 * teacher's link stops working on schedule either way. This is what
 * reclaims the D1 rows and R2 images behind it, so old copies don't sit
 * there forever.
 *
 * Never touches a slide's `soundEffectR2Key` or a deck's
 * `backgroundMusicR2Key` — those point at admin-owned library audio (or, for
 * a teacher's copy, at audio it inherited by reference from the library deck
 * it was forked from), never at something this deck alone owns. Only rows in
 * `images` — a deck's own uploads — are deleted from R2, the same rule
 * DELETE /api/presentations/:id already follows.
 */
import { and, eq, lt, inArray } from 'drizzle-orm';
import type { db as makeDb } from '../db/client';
import { images, presentations } from '../db/schema';

type Db = ReturnType<typeof makeDb>;

const BATCH_SIZE = 50;
// A safety cap, not an expectation — normal traffic should never come close
// to it. Stops one run from cleaning forever if a backlog ever built up.
const MAX_BATCHES = 40;

export async function cleanupExpiredDecks(database: Db, media: R2Bucket): Promise<{ decks: number; images: number }> {
  let totalDecks = 0;
  let totalImages = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const expired = await database
      .select({ id: presentations.id })
      .from(presentations)
      .where(and(eq(presentations.saved, false), eq(presentations.isLibrary, false), lt(presentations.expiresAt, new Date())))
      .limit(BATCH_SIZE);
    if (!expired.length) break;

    const deckIds = expired.map((d) => d.id);
    const uploads = await database.select().from(images).where(inArray(images.presentationId, deckIds));
    if (uploads.length) await media.delete(uploads.map((u) => u.r2Key));

    await database.delete(images).where(inArray(images.presentationId, deckIds));
    await database.delete(presentations).where(inArray(presentations.id, deckIds));

    totalDecks += deckIds.length;
    totalImages += uploads.length;
    if (expired.length < BATCH_SIZE) break; // fewer than a full batch: done
  }

  return { decks: totalDecks, images: totalImages };
}
