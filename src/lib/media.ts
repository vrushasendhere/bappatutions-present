/** R2 objects are served by this Worker at /media/<key> (see
 *  src/pages/media/[...key].ts) — same origin, so no bucket needs to be
 *  public and no CORS is involved. */
export function mediaUrl(key: string): string {
  return `/media/${key}`;
}

/** Keys this app writes itself. Anything else stored in a slide as a key is
 *  rejected on save, so a slide can never point the player at an arbitrary
 *  object path. */
export const MEDIA_KEY = /^(uploads|library)\/[A-Za-z0-9_-]{1,64}\.(png|jpg|webp|gif|mp3|ogg|m4a)$/;
