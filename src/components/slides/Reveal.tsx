import type { ComponentChildren } from 'preact';
import type { SlideModel } from '../../lib/slides';
import { isRevealed } from '../../lib/slides';

interface Props {
  slide: SlideModel;
  elementKey: string;
  revealedCount: number;
  as?: string;
  class?: string;
  children: ComponentChildren;
}

/** Wraps one element of a slide so it fades in only once Up/Down navigation
 *  has revealed it — see the plan's "Element reveal (Up/Down)" note. */
export default function Reveal({ slide, elementKey, revealedCount, as = 'div', class: className, children }: Props) {
  const Tag = as as any;
  const shown = isRevealed(slide, elementKey, revealedCount);
  return (
    <Tag class={`slide__element ${className ?? ''} ${shown ? 'is-revealed' : ''}`}>
      {children}
    </Tag>
  );
}
