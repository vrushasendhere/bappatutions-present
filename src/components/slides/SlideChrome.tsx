import type { ComponentChildren } from 'preact';
import { assets } from '../../lib/assets';

interface Props {
  theme: string;
  variant?: string; // extra class, e.g. 'slide--image-text'
  children: ComponentChildren;
}

/**
 * Shared wrapper every template renders through — theme attribute, base
 * layout class, and the brand mark. The mark is placed here, not inside any
 * template's own markup, and never reads from `content`, so there is no path
 * through the editor that can remove or replace it.
 */
export default function SlideChrome({ theme, variant, children }: Props) {
  return (
    <div class={`slide ${variant ?? ''}`} data-theme={theme}>
      {children}
      <div class="slide__brand" aria-hidden="true">
        <img src={assets.brandLogo} alt="" />
        <span>BappaTutions</span>
      </div>
    </div>
  );
}
