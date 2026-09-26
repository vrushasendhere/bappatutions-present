/**
 * D1 schema, via Drizzle.
 *
 * One JSON blob per presentation's slide array, not a normalized `slides`
 * table — this app has exactly one editor at a time per presentation, so
 * "fetch the whole doc, edit, PUT the whole doc back" is simpler than a
 * per-slide API and needs far fewer migrations to get right on the first
 * pass. See the plan's Data model section for why.
 *
 * Every `{ mode: 'timestamp' }` column below stores whole SECONDS, not
 * milliseconds — that's Drizzle's own convention for SQLite's `timestamp`
 * mode (mapToDriverValue does `Math.floor(date.getTime() / 1000)`), not a
 * choice made here. App code never touches this directly since it always
 * writes a JS `Date` through Drizzle, which stays internally consistent on
 * its own. Hand-written SQL (seed files, one-off fixes) is the one place
 * this bites: `unixepoch()` is correct, `unixepoch() * 1000` silently writes
 * a timestamp ~1000x too far in the future. Seed data hit exactly this once
 * — see seed/seed.sql's history — so any new raw SQL touching these columns
 * should use plain `unixepoch()`.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const presentations = sqliteTable('presentations', {
  id: text('id').primaryKey(), // nanoid — unguessable, this IS "the weird url"
  title: text('title').notNull(),
  theme: text('theme').notNull().default('classic'), // 'classic' | 'bappa' | 'funky'
  subject: text('subject'), // library decks only — filters the gallery
  standard: text('standard'), // '4'..'10' — library decks only
  slides: text('slides', { mode: 'json' }).notNull(), // SlideModel[]
  backgroundMusicR2Key: text('background_music_r2_key'),
  isLibrary: integer('is_library', { mode: 'boolean' }).notNull().default(false),
  ownerUserId: text('owner_user_id'),
  ownerAnonId: text('owner_anon_id'),
  forkedFrom: text('forked_from'),
  saved: integer('saved', { mode: 'boolean' }).notNull().default(false),
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // set while saved=false
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  // No admin flag here: who is an admin is read from ADMIN_EMAILS on every
  // request (see resolveIdentity), so taking someone off that list takes
  // effect at once rather than at their next sign-in.
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
  // SHA-256 of the token the browser holds — never the token itself, so a
  // copy of the database can't be used to sign in as anyone.
  token: text('token').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

export const images = sqliteTable('images', {
  id: text('id').primaryKey(),
  r2Key: text('r2_key').notNull(),
  presentationId: text('presentation_id').notNull(),
  ownerUserId: text('owner_user_id'),
  ownerAnonId: text('owner_anon_id'),
  byteSize: integer('byte_size').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Rate limits, keyed by whichever identity made the request — `user_id` once
 * logged in, `anon_id` otherwise. The Data model plan calls out `uses_count`
 * (lifetime, gates the "sign in to save" nudge) and `downloads_today`
 * (resets daily UTC, capped at 3 for every identity — logged in or not).
 */
export const usageCounters = sqliteTable('usage_counters', {
  identity: text('identity').primaryKey(),
  usesCount: integer('uses_count').notNull().default(0),
  downloadsToday: integer('downloads_today').notNull().default(0),
  downloadsDate: text('downloads_date').notNull(), // UTC yyyy-mm-dd
  savesThisHour: integer('saves_this_hour').notNull().default(0),
  savesHourWindow: text('saves_hour_window').notNull(), // UTC yyyy-mm-ddTHH
});
