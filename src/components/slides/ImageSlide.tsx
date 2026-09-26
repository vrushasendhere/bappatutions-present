import SlideChrome from './SlideChrome';
import Reveal from './Reveal';
import type { SlideModel } from '../../lib/slides';

export default function ImageSlide({ slide, theme, revealedCount }: { slide: SlideModel; theme: string; revealedCount: number }) {
  return (
    <SlideChrome theme={theme}>
      {slide.content.heading && (
        <Reveal as="h2" slide={slide} elementKey="heading" revealedCount={revealedCount} class="slide__heading">
          {slide.content.heading}
        </Reveal>
      )}
      <Reveal as="div" slide={slide} elementKey="imageUrl" revealedCount={revealedCount} class="slide__image-wrap">
        {slide.content.imageUrl && <img class="slide__image" src={slide.content.imageUrl} alt="" />}
      </Reveal>
      {slide.content.imageCaption && (
        <Reveal as="p" slide={slide} elementKey="imageCaption" revealedCount={revealedCount} class="slide__caption">
          {slide.content.imageCaption}
        </Reveal>
      )}
    </SlideChrome>
  );
}
