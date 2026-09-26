import { mediaUrl } from './media';

/**
 * Where the player finds its files.
 *
 * Live, they come from this app: media from /media/<key>, the brand mark from
 * /brand/. A downloaded copy is opened from disk, where a path starting with
 * "/" means the root of the drive — so the export's entry point swaps these
 * for its own media/ folder and a brand mark built into player.js.
 */
export const assets = {
  media: (key: string): string => mediaUrl(key),
  brandLogo: '/brand/bappa-logo.png',
};

export function configureAssets(overrides: Partial<typeof assets>) {
  Object.assign(assets, overrides);
}
