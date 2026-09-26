import SlideChrome from './SlideChrome';
import Reveal from './Reveal';
import type { SlideModel } from '../../lib/slides';

export default function ImageTextSlide({ slide, theme, revealedCount }: { slide: SlideModel; theme: string; revealedCount: number }) {
  return (
    <SlideChrome theme={theme} variant="slide--image-text">
      <Reveal as="div" slide={slide} elementKey="imageUrl" revealedCount={revealedCount} class="slide__image-wrap">
        {slide.content.imageUrl && <img class="slide__image" src={slide.content.imageUrl} alt="" />}
      </Reveal>
      <div class="slide__text-col">
        {slide.content.heading && (
          <Reveal as="h2" slide={slide} elementKey="heading" revealedCount={revealedCount} class="slide__heading">
            {slide.content.heading}
          </Reveal>
        )}
        {slide.content.body && (
          <Reveal as="p" slide={slide} elementKey="body" revealedCount={revealedCount} class="slide__body">
            {slide.content.body}
          </Reveal>
        )}
      </div>
    </SlideChrome>
  );
}
