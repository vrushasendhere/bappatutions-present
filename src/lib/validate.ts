/**
 * What a save is allowed to contain.
 *
 * Every slide is rebuilt field by field from the posted JSON rather than
 * stored as sent — unknown fields are dropped, every string is length-capped,
 * and an image can only come from two places: an upload this app stored
 * itself (/media/...), or the shared picture library on bappatutions.in. That
 * last rule is what stops a deck from pointing a classroom projector at an
 * arbitrary image on the internet.
 */
import type { SlideContent, SlideModel, TemplateKey, Transition } from './slides';
import { MEDIA_KEY } from './media';

export const MAX_SLIDES = 30;
const MAX_BULLETS = 12;

const TEMPLATES = new Set<TemplateKey>(['title', 'text', 'image', 'image-text', 'bullets']);
const TRANSITIONS = new Set<Transition>(['fade', 'slide', 'none']);
export const LIBRARY_FILE = /^[a-z0-9-]{1,120}\.webp$/;

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.slice(0, max);
  return trimmed.length ? trimmed : undefined;
}

export function isAllowedImageUrl(url: string, libraryOrigin: string): boolean {
  if (url.startsWith('/media/')) return MEDIA_KEY.test(url.slice('/media/'.length));
  const libraryPrefix = `${libraryOrigin}/brand/course/pictures/`;
  return url.startsWith(libraryPrefix) && LIBRARY_FILE.test(url.slice(libraryPrefix.length));
}

function content(raw: any, libraryOrigin: string): SlideContent {
  const out: SlideContent = {
    heading: str(raw?.heading, 200),
    body: str(raw?.body, 2000),
    imageCaption: str(raw?.imageCaption, 300),
  };
  if (Array.isArray(raw?.bullets)) {
    // A point left empty in the editor is dropped rather than saved — in
    // class it would reveal as a bare dot.
    const bullets = raw.bullets
      .slice(0, MAX_BULLETS)
      .map((b: unknown) => (typeof b === 'string' ? b.slice(0, 300) : ''))
      .filter((b: string) => b.trim());
    if (bullets.length) out.bullets = bullets;
  }
  const imageUrl = str(raw?.imageUrl, 500);
  if (imageUrl && isAllowedImageUrl(imageUrl, libraryOrigin)) out.imageUrl = imageUrl;
  return out;
}

export function validateSlides(raw: unknown, libraryOrigin: string): SlideModel[] | string {
  if (!Array.isArray(raw)) return 'slides must be an array';
  if (raw.length === 0) return 'a presentation needs at least one slide';
  if (raw.length > MAX_SLIDES) return `a presentation can have at most ${MAX_SLIDES} slides`;

  const seen = new Set<string>();
  const slides: SlideModel[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i] as any;
    if (!TEMPLATES.has(s?.templateKey)) return `slide ${i + 1} has an unknown layout`;
    const id = typeof s.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s.id) ? s.id : `s${i}`;
    if (seen.has(id)) return `slide ${i + 1} repeats an id`;
    seen.add(id);

    const slide: SlideModel = {
      id,
      order: i, // array position is the truth; any posted `order` is ignored
      templateKey: s.templateKey,
      content: content(s.content, libraryOrigin),
    };
    if (TRANSITIONS.has(s.transition)) slide.transition = s.transition;
    if (typeof s.soundEffectR2Key === 'string' && MEDIA_KEY.test(s.soundEffectR2Key)) {
      slide.soundEffectR2Key = s.soundEffectR2Key;
    }
    slides.push(slide);
  }
  return slides;
}

export function validateTitle(raw: unknown): string | null {
  const title = str(raw, 200)?.trim();
  return title ? title : null;
}

// Kept in step with lib/templates.ts's THEMES — 'bappa' joins both together
// the day its stylesheet exists.
const THEME_KEYS = new Set(['classic', 'funky']);

export function validateTheme(raw: unknown): string | null {
  return typeof raw === 'string' && THEME_KEYS.has(raw) ? raw : null;
}
