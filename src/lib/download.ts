import { api } from './client';
import { buildExport, type ExportableDeck } from './export';

export type DownloadResult =
  | { ok: true; remaining: number | null } // null: not limited (admins)
  | { ok: false; message: string; limitReached?: boolean };

/**
 * Build the zip, then record the download against today's limit (3 a day,
 * signed in or not), then hand the file to the browser.
 *
 * Recorded after building rather than before, so a build that fails — a
 * dropped connection halfway through fetching pictures — never uses up one
 * of someone's three downloads.
 */
export async function downloadDeck(deck: ExportableDeck): Promise<DownloadResult> {
  let built: { filename: string; zip: Uint8Array };
  try {
    built = await buildExport(deck, location.origin);
  } catch {
    return { ok: false, message: 'Couldn’t prepare the download — check your connection and try again.' };
  }

  const res = await api('/api/downloads/check', { method: 'POST' });
  if (res.status === 429) {
    return { ok: false, limitReached: true, message: 'You’ve used today’s 3 downloads. You can download again tomorrow.' };
  }
  if (!res.ok) return { ok: false, message: 'The download didn’t work. Please try again.' };
  const { remaining } = (await res.json()) as { remaining: number | null };

  const url = URL.createObjectURL(new Blob([built.zip as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = built.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { ok: true, remaining };
}
