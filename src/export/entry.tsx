/**
 * The entry point of a downloaded presentation's player.js.
 *
 * This is the live app's own Player, bundled by scripts/build-export-player.mjs
 * into a single classic script — not a second, simplified player. A download
 * therefore has the same transitions, reveals, sounds and music as presenting
 * online, and a fix to the player is a fix to every future download.
 *
 * Classic <script> tags (not modules), and the deck as deck.js rather than
 * deck.json, because the folder is opened from disk: browsers refuse module
 * scripts and fetch() for file:// pages.
 */
import { render } from 'preact';
import Player from '../components/Player';
import { configureAssets } from '../lib/assets';
import type { SlideModel } from '../lib/slides';

interface ExportedDeck {
  theme: string;
  slides: SlideModel[];
  music: string | null; // path inside the folder
  media: Record<string, string>; // R2 key → path inside the folder
}

declare global {
  interface Window {
    BT_DECK: ExportedDeck;
  }
}

// Replaced at build time with the brand mark as a data: URI, so the mark is
// part of player.js itself rather than a file in the folder that could simply
// be deleted.
declare const __BRAND_LOGO__: string;

const deck = window.BT_DECK;
configureAssets({
  media: (key) => deck.media[key] ?? '',
  brandLogo: __BRAND_LOGO__,
});

render(
  <Player slides={deck.slides} theme={deck.theme} backgroundMusicUrl={deck.music ?? undefined} />,
  document.getElementById('app')!
);
