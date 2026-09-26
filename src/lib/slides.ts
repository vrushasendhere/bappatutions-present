/**
 * The slide data model — see the plan's Data model section.
 *
 * Five layouts to start (not the 14+ a full-featured version could have):
 * enough range for a lesson deck without the editor complexity a bigger set
 * would need. `TemplateKey` is a closed union so a 6th layout is additive,
 * never a migration.
 */
export type TemplateKey = 'title' | 'text' | 'image' | 'image-text' | 'bullets';

export type Transition = 'fade' | 'slide' | 'none';

export interface SlideContent {
  heading?: string;
  body?: string;
  bullets?: string[];
  imageUrl?: string; // an R2 URL (uploaded) or a site-library path
  imageCaption?: string;
}

export interface SlideModel {
  id: string;
  order: number;
  templateKey: TemplateKey;
  transition?: Transition; // how this slide arrives on screen; unset means 'fade'
  soundEffectR2Key?: string; // plays once, on entering this slide
  content: SlideContent;
}

/**
 * The Up/Down "build" order for a slide — one element revealed per press.
 *
 * v1 derives a fixed order from the content shape itself rather than letting
 * a teacher hand-author per-element ordering (a reasonable editor
 * enhancement later, not needed now). Each entry is a stable key used only to
 * count how many elements are currently revealed — the renderer decides what
 * "revealed" looks like per template.
 */
export function revealOrder(slide: SlideModel): string[] {
  const c = slide.content;
  switch (slide.templateKey) {
    case 'title':
      return ['heading', 'body'].filter((k) => c[k as keyof SlideContent]);
    case 'text':
      return ['heading', 'body'].filter((k) => c[k as keyof SlideContent]);
    case 'image':
      return ['heading', 'imageUrl', 'imageCaption'].filter(
        (k) => c[k as keyof SlideContent]
      );
    case 'image-text':
      return ['heading', 'imageUrl', 'body'].filter(
        (k) => c[k as keyof SlideContent]
      );
    case 'bullets':
      return [
        ...(c.heading ? ['heading'] : []),
        ...(c.bullets ?? []).map((_, i) => `bullet:${i}`),
      ];
  }
}

/** A slide's default reveal count when it's first navigated to — the heading
 *  alone (if it has one), never the whole slide at once. */
export function defaultRevealedCount(slide: SlideModel): number {
  return revealOrder(slide).length ? 1 : 0;
}

/** Whether a specific element (by its revealOrder key) is currently shown,
 *  given how many elements have been revealed so far. */
export function isRevealed(slide: SlideModel, key: string, revealedCount: number): boolean {
  const order = revealOrder(slide);
  const index = order.indexOf(key);
  return index !== -1 && index < revealedCount;
}
