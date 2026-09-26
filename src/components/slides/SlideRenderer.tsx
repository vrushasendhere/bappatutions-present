import type { SlideModel } from '../../lib/slides';
import TitleSlide from './TitleSlide';
import TextSlide from './TextSlide';
import ImageSlide from './ImageSlide';
import ImageTextSlide from './ImageTextSlide';
import BulletsSlide from './BulletsSlide';

interface Props {
  slide: SlideModel;
  theme: string;
  revealedCount: number;
}

/** One component per templateKey, dispatched here — the single place that
 *  knows the full set of layouts. Adding a 6th is adding a case, not
 *  touching the player or the data model. */
export default function SlideRenderer({ slide, theme, revealedCount }: Props) {
  switch (slide.templateKey) {
    case 'title':
      return <TitleSlide slide={slide} theme={theme} revealedCount={revealedCount} />;
    case 'text':
      return <TextSlide slide={slide} theme={theme} revealedCount={revealedCount} />;
    case 'image':
      return <ImageSlide slide={slide} theme={theme} revealedCount={revealedCount} />;
    case 'image-text':
      return <ImageTextSlide slide={slide} theme={theme} revealedCount={revealedCount} />;
    case 'bullets':
      return <BulletsSlide slide={slide} theme={theme} revealedCount={revealedCount} />;
  }
}
