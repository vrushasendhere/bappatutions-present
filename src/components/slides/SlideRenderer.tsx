import type { SlideEditHandlers, SlideModel } from '../../lib/slides';
import TitleSlide from './TitleSlide';
import TextSlide from './TextSlide';
import ImageSlide from './ImageSlide';
import ImageTextSlide from './ImageTextSlide';
import BulletsSlide from './BulletsSlide';

interface Props {
  slide: SlideModel;
  theme: string;
  revealedCount: number;
  /** Present only in the editor — see lib/slides.ts's SlideEditHandlers for
   *  why its mere presence is what switches a template from plain content
   *  to something a teacher clicks and types into directly. */
  edit?: SlideEditHandlers;
}

/** One component per templateKey, dispatched here — the single place that
 *  knows the full set of layouts. Adding a 6th is adding a case, not
 *  touching the player or the data model. */
export default function SlideRenderer({ slide, theme, revealedCount, edit }: Props) {
  switch (slide.templateKey) {
    case 'title':
      return <TitleSlide slide={slide} theme={theme} revealedCount={revealedCount} edit={edit} />;
    case 'text':
      return <TextSlide slide={slide} theme={theme} revealedCount={revealedCount} edit={edit} />;
    case 'image':
      return <ImageSlide slide={slide} theme={theme} revealedCount={revealedCount} edit={edit} />;
    case 'image-text':
      return <ImageTextSlide slide={slide} theme={theme} revealedCount={revealedCount} edit={edit} />;
    case 'bullets':
      return <BulletsSlide slide={slide} theme={theme} revealedCount={revealedCount} edit={edit} />;
  }
}
