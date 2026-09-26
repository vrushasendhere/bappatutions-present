/**
 * Builds a presentation's download: one folder that runs from a double-click,
 * offline, exactly like Play mode.
 *
 *   <title>/
 *     index.html   loads the two scripts below
 *     deck.js      the slides, as `window.BT_DECK = {...}`
 *     player.js    the live Player itself (see src/export/entry.tsx)
 *     player.css
 *     media/       every picture, sound effect and music track, by content hash
 *     README.txt
 *
 * Nothing here is browser-only (fetch, WebCrypto, fflate all exist in Node
 * too), so the same code can be run against a dev server to check a real
 * package from disk.
 */
import { zipSync, strToU8, type Zippable } from 'fflate';
import type { SlideModel } from './slides';

export interface ExportableDeck {
  title: string;
  theme: string;
  slides: SlideModel[];
  backgroundMusicR2Key?: string | null;
}

const LIBRARY_PICTURE = /\/brand\/course\/pictures\/([a-z0-9-]+\.webp)$/;

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
};

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A folder/file name from the title — letters in any script are kept, so a
 *  Marathi title stays Marathi. */
export function folderName(title: string): string {
  const name = title
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return name || 'presentation';
}

/** Library pictures are read through this app's /library pass-through,
 *  because bappatutions.in doesn't send the CORS headers that reading
 *  another site's bytes requires. Everything else is already same-origin. */
function sourceFor(url: string): string {
  const library = url.match(LIBRARY_PICTURE);
  return library ? `/library/${library[1]}` : url;
}

export async function buildExport(deck: ExportableDeck, origin: string): Promise<{ filename: string; zip: Uint8Array }> {
  const media: Zippable = {};
  const packed = new Map<string, string>(); // source URL → path in the folder

  async function pack(url: string): Promise<string> {
    const known = packed.get(url);
    if (known) return known;
    const res = await fetch(new URL(sourceFor(url), origin));
    if (!res.ok) throw new Error(`Couldn't fetch ${url} (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    const ext = EXTENSIONS[type] ?? url.split('.').pop() ?? 'bin';
    const name = `${hex(await crypto.subtle.digest('SHA-1', bytes)).slice(0, 12)}.${ext}`;
    // Pictures and audio are already compressed; zipping them again only
    // costs time.
    media[name] = [bytes, { level: 0 }];
    packed.set(url, `media/${name}`);
    return `media/${name}`;
  }

  const soundMap: Record<string, string> = {};
  const slides: SlideModel[] = [];
  for (const slide of deck.slides) {
    const content = { ...slide.content };
    if (content.imageUrl) content.imageUrl = await pack(content.imageUrl);
    if (slide.soundEffectR2Key) soundMap[slide.soundEffectR2Key] = await pack(`/media/${slide.soundEffectR2Key}`);
    slides.push({ ...slide, content });
  }
  const music = deck.backgroundMusicR2Key ? await pack(`/media/${deck.backgroundMusicR2Key}`) : null;

  const [playerJs, playerCss] = await Promise.all(
    ['/export/player.js', '/export/player.css'].map(async (path) => {
      const res = await fetch(new URL(path, origin));
      if (!res.ok) throw new Error(`Couldn't fetch ${path} (${res.status})`);
      return new Uint8Array(await res.arrayBuffer());
    })
  );

  const title = escapeHtml(deck.title);
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — BappaTutions</title>
<link rel="stylesheet" href="player.css" />
</head>
<body>
<div id="app"></div>
<noscript>This presentation needs JavaScript turned on.</noscript>
<script src="deck.js"></script>
<script src="player.js"></script>
</body>
</html>
`;

  const deckJs = `window.BT_DECK = ${JSON.stringify({ theme: deck.theme, slides, music, media: soundMap })};\n`;

  const readme = `${deck.title}
Made with BappaTutions — https://bappatutions.in

To present, open index.html in Chrome, Edge or Firefox. No internet needed.

  Next / Prev   (or the → and ← keys)  move between slides
  ▲ Up / ▼ Down (or the ↑ and ↓ keys)  bring each part of a slide in one at a time
  Fullscreen                           fill the screen; Esc to leave

Keep this whole folder together: the pictures and sounds are in media/.
`;

  const folder = folderName(deck.title);
  const zip = zipSync(
    {
      [folder]: {
        'index.html': strToU8(indexHtml),
        'deck.js': strToU8(deckJs),
        'player.js': playerJs,
        'player.css': playerCss,
        'README.txt': strToU8(readme),
        media,
      },
    },
    { level: 6 }
  );
  return { filename: `${folder}.zip`, zip };
}
