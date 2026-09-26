/**
 * POST /api/audio?presentation=<id> — admins only: upload a sound effect or
 * a music track for a deck they're authoring. Body is the raw file. Returns
 * the R2 key, which the editor then sets on a slide or on the deck.
 *
 * Teachers can't add audio; a deck they customise keeps whatever sounds the
 * library deck came with.
 */
import type { APIRoute } from 'astro';
import { nanoid } from 'nanoid';
import { db } from '../../db/client';
import { resolveIdentity } from '../../lib/identity';
import { loadDeck, isOwner, json } from '../../lib/decks';
import { mediaUrl } from '../../lib/media';

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // a few minutes of music

/** The type comes from the bytes, as with images — never the browser's word. */
function sniffAudio(b: Uint8Array): { ext: 'mp3' | 'ogg' | 'm4a'; contentType: string } | null {
  const ascii = (at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
  if (ascii(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: 'mp3', contentType: 'audio/mpeg' };
  if (ascii(0, 4) === 'OggS') return { ext: 'ogg', contentType: 'audio/ogg' };
  if (ascii(4, 4) === 'ftyp') return { ext: 'm4a', contentType: 'audio/mp4' };
  return null;
}

export const POST: APIRoute = async ({ request, locals, url }) => {
  const env = locals.runtime.env;
  const database = db(env.DB);
  const identity = await resolveIdentity(database, request, env.ADMIN_EMAILS);
  if (!identity?.isAdmin) return json({ error: 'admins-only' }, 403);

  const deck = await loadDeck(database, url.searchParams.get('presentation') ?? '');
  if (!deck) return json({ error: 'not-found' }, 404);
  if (!isOwner(deck, identity)) return json({ error: 'not-yours' }, 403);

  if (Number(request.headers.get('content-length') ?? 0) > MAX_AUDIO_BYTES) return json({ error: 'too-large' }, 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_AUDIO_BYTES) return json({ error: 'too-large' }, 413);

  const kind = bytes.length >= 12 ? sniffAudio(bytes) : null;
  if (!kind) return json({ error: 'not-audio' }, 415);

  const key = `library/${nanoid()}.${kind.ext}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: kind.contentType } });
  return json({ key, url: mediaUrl(key) }, 201);
};
