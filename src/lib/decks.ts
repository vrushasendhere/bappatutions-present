import { eq } from 'drizzle-orm';
import type { db as makeDb } from '../db/client';
import { presentations } from '../db/schema';
import type { Identity } from './identity';

type Db = ReturnType<typeof makeDb>;
export type Deck = typeof presentations.$inferSelect;

/** How long an unsaved (anonymous or not-yet-saved) copy lives. */
export const TEMP_TTL_MS = 2 * 24 * 60 * 60 * 1000;

/** How many decks a signed-in teacher can keep for free. Admins aren't
 *  limited. */
export const SAVED_LIMIT = 5;

/**
 * A deck by id, or null if it doesn't exist OR its 2-day link has lapsed.
 *
 * Expiry is enforced here, on every read, rather than trusted to a cleanup
 * job: a deck past its time is gone to everyone the moment it expires, even
 * if nothing has physically deleted the row yet.
 */
export async function loadDeck(database: Db, id: string): Promise<Deck | null> {
  const [deck] = await database.select().from(presentations).where(eq(presentations.id, id)).limit(1);
  if (!deck) return null;
  if (!deck.saved && deck.expiresAt && deck.expiresAt.getTime() < Date.now()) return null;
  return deck;
}

/** Library decks belong to the admins as a group: an admin opening one
 *  edits it in place (what every teacher sees), where a teacher gets a copy. */
export function isOwner(deck: Deck, identity: Identity | null): boolean {
  if (!identity) return false;
  if (deck.isLibrary) return identity.isAdmin;
  if (identity.userId) return deck.ownerUserId === identity.userId;
  return deck.ownerAnonId === identity.key;
}

/** What the editor receives. Owner ids never leave the server. */
export function toDeckJson(deck: Deck, owned: boolean) {
  return {
    id: deck.id,
    title: deck.title,
    theme: deck.theme,
    slides: deck.slides,
    backgroundMusicR2Key: deck.backgroundMusicR2Key,
    subject: deck.subject,
    standard: deck.standard,
    isLibrary: deck.isLibrary,
    saved: deck.saved,
    expiresAt: deck.expiresAt?.getTime() ?? null,
    owned,
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
