/**
 * Uploaded images for one presentation.
 *
 *   GET  /api/images?presentation=<id>   → the owner's uploads for that deck
 *   POST /api/images?presentation=<id>   → body is the raw file
 *
 * A teacher's own deck takes at most 9 uploads (BappaTutions' library decks
 * are uncapped); every identity gets 50 MB in total. Picking an image from
 * the shared library or re-using one of your uploads on another slide costs
 * nothing — only a new upload counts.
 */
import type { APIRoute } from 'astro';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../../db/client';
import { images } from '../../../db/schema';
import { resolveIdentity, checkSaveRate, type Identity } from '../../../lib/identity';
import { loadDeck, isOwner, json } from '../../../lib/decks';
import { cleanImage, MAX_IMAGE_BYTES } from '../../../lib/image';
import { mediaUrl } from '../../../lib/media';

const MAX_UPLOADS_PER_DECK = 9;
const MAX_BYTES_PER_IDENTITY = 50 * 1024 * 1024;

function ownerFilter(identity: Identity) {
  return identity.userId ? eq(images.ownerUserId, identity.userId) : eq(images.ownerAnonId, identity.key);
}

async function authorize(locals: App.Locals, request: Request, presentationId: string | null) {
  const database = db(locals.runtime.env.DB);
  const refuse = (error: string, status: number) => ({ ok: false as const, response: json({ error }, status) });
  if (!presentationId) return refuse('no-presentation', 400);
  const deck = await loadDeck(database, presentationId);
  if (!deck) return refuse('not-found', 404);
  const identity = await resolveIdentity(database, request, locals.runtime.env.ADMIN_EMAILS);
  if (!isOwner(deck, identity)) return refuse('not-yours', 403);
  return { ok: true as const, database, deck, identity: identity! };
}

export const GET: APIRoute = async ({ request, locals, url }) => {
  const auth = await authorize(locals, request, url.searchParams.get('presentation'));
  if (!auth.ok) return auth.response;

  const rows = await auth.database
    .select()
    .from(images)
    .where(eq(images.presentationId, auth.deck.id))
    .orderBy(images.createdAt);

  return json({
    images: rows.map((r) => ({ id: r.id, url: mediaUrl(r.r2Key), byteSize: r.byteSize })),
    limit: auth.deck.isLibrary ? null : MAX_UPLOADS_PER_DECK,
  });
};

export const POST: APIRoute = async ({ request, locals, url }) => {
  const auth = await authorize(locals, request, url.searchParams.get('presentation'));
  if (!auth.ok) return auth.response;
  const { database, deck, identity } = auth;

  // Refuse an oversized body before reading it, when the client says how big
  // it is; the length is checked again after reading, since that header is
  // only a claim.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_IMAGE_BYTES) return json({ error: 'too-large' }, 413);

  if (!deck.isLibrary) {
    const [{ count }] = await database
      .select({ count: sql<number>`count(*)` })
      .from(images)
      .where(eq(images.presentationId, deck.id));
    if (count >= MAX_UPLOADS_PER_DECK) return json({ error: 'image-limit', limit: MAX_UPLOADS_PER_DECK }, 409);
  }

  const [{ total }] = await database
    .select({ total: sql<number>`coalesce(sum(${images.byteSize}), 0)` })
    .from(images)
    .where(ownerFilter(identity));

  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.length > MAX_IMAGE_BYTES) return json({ error: 'too-large' }, 413);
  if (total + raw.length > MAX_BYTES_PER_IDENTITY) return json({ error: 'storage-limit' }, 409);

  const image = cleanImage(raw);
  if (!image) return json({ error: 'not-an-image' }, 415);

  if (!(await checkSaveRate(database, identity))) return json({ error: 'too-many-writes' }, 429);

  const id = nanoid();
  const r2Key = `uploads/${id}.${image.ext}`;
  await locals.runtime.env.MEDIA.put(r2Key, image.bytes, {
    httpMetadata: { contentType: image.contentType },
  });
  await database.insert(images).values({
    id,
    r2Key,
    presentationId: deck.id,
    ownerUserId: identity.userId,
    ownerAnonId: identity.userId ? null : identity.key,
    byteSize: image.bytes.length,
    createdAt: new Date(),
  });

  return json({ id, url: mediaUrl(r2Key), byteSize: image.bytes.length }, 201);
};
