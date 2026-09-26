import SlideChrome from './SlideChrome';
import Reveal from './Reveal';
import type { SlideModel } from '../../lib/slides';

export default function BulletsSlide({ slide, theme, revealedCount }: { slide: SlideModel; theme: string; revealedCount: number }) {
  return (
    <SlideChrome theme={theme}>
      {slide.content.heading && (
        <Reveal as="h2" slide={slide} elementKey="heading" revealedCount={revealedCount} class="slide__heading">
          {slide.content.heading}
        </Reveal>
      )}
      <ul class="slide__bullets">
        {(slide.content.bullets ?? []).map((text, i) => (
          <Reveal as="li" slide={slide} elementKey={`bullet:${i}`} revealedCount={revealedCount} key={i}>
            {text}
          </Reveal>
        ))}
      </ul>
    </SlideChrome>
  );
}
