import type { SlideContent, TemplateKey } from './slides';

/**
 * The themes a deck can use. 'bappa' isn't listed yet — its look depends on
 * a reference the owner hasn't shared, and a guessed placeholder for the
 * one theme meant to carry the brand isn't worth building twice. Add it
 * here the day theme-bappa.css exists; nothing else needs to change.
 */
export const THEMES: Array<{ value: 'classic' | 'funky'; label: string }> = [
  { value: 'classic', label: 'Classic' },
  { value: 'funky', label: 'Funky' },
];

export type Field = 'heading' | 'body' | 'bullets' | 'image' | 'caption';

interface TemplateInfo {
  label: string;
  fields: Field[]; // the order the editor shows them, same as the reveal order
  bodyLabel?: string;
  starter: SlideContent; // what a freshly added slide of this layout holds
}

export const TEMPLATE_INFO: Record<TemplateKey, TemplateInfo> = {
  title: {
    label: 'Title',
    fields: ['heading', 'body'],
    bodyLabel: 'Subtitle',
    starter: { heading: 'New title', body: 'A subtitle' },
  },
  text: {
    label: 'Text',
    fields: ['heading', 'body'],
    starter: { heading: 'Heading', body: 'Write your text here.' },
  },
  bullets: {
    label: 'Bullet points',
    fields: ['heading', 'bullets'],
    starter: { heading: 'Heading', bullets: ['First point', 'Second point'] },
  },
  image: {
    label: 'Picture',
    fields: ['heading', 'image', 'caption'],
    starter: { heading: 'Heading' },
  },
  'image-text': {
    label: 'Picture + text',
    fields: ['heading', 'image', 'body'],
    starter: { heading: 'Heading', body: 'Write about the picture here.' },
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_INFO) as TemplateKey[];

// Same caps the server enforces in lib/validate.ts — shown here so the editor
// stops a teacher before a save would be rejected.
export const LIMITS = {
  slides: 30,
  bullets: 12,
  heading: 200,
  body: 2000,
  bullet: 300,
  caption: 300,
  title: 200,
} as const;
