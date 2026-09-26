import SlideChrome from './SlideChrome';
import Reveal from './Reveal';
import type { SlideModel } from '../../lib/slides';

export default function TitleSlide({ slide, theme, revealedCount }: { slide: SlideModel; theme: string; revealedCount: number }) {
  return (
    <SlideChrome theme={theme} variant="slide--title">
      <div style={{ textAlign: 'center', margin: 'auto' }}>
        <Reveal as="h1" slide={slide} elementKey="heading" revealedCount={revealedCount} class="slide__heading">
          {slide.content.heading}
        </Reveal>
        {slide.content.body && (
          <Reveal as="p" slide={slide} elementKey="body" revealedCount={revealedCount} class="slide__body">
            {slide.content.body}
          </Reveal>
        )}
      </div>
    </SlideChrome>
  );
}
