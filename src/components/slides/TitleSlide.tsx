import SlideChrome from './SlideChrome';
import Reveal from './Reveal';
import Editable from '../editor/Editable';
import type { SlideModel, SlideEditHandlers } from '../../lib/slides';
import { LIMITS } from '../../lib/templates';

interface Props {
  slide: SlideModel;
  theme: string;
  revealedCount: number;
  edit?: SlideEditHandlers;
}

export default function TitleSlide({ slide, theme, revealedCount, edit }: Props) {
  return (
    <SlideChrome theme={theme} variant="slide--title">
      <div style={{ textAlign: 'center', margin: 'auto' }}>
        {edit ? (
          <Editable
            as="h1"
            class="slide__heading"
            value={slide.content.heading ?? ''}
            placeholder="Click to add a title"
            maxLength={LIMITS.heading}
            onChange={(heading) => edit.onChangeContent({ heading })}
          />
        ) : (
          <Reveal as="h1" slide={slide} elementKey="heading" revealedCount={revealedCount} class="slide__heading">
            {slide.content.heading}
          </Reveal>
        )}
        {edit ? (
          <Editable
            as="p"
            class="slide__body"
            value={slide.content.body ?? ''}
            placeholder="Click to add a subtitle (optional)"
            maxLength={LIMITS.body}
            multiline
            onChange={(body) => edit.onChangeContent({ body })}
          />
        ) : (
          slide.content.body && (
            <Reveal as="p" slide={slide} elementKey="body" revealedCount={revealedCount} class="slide__body">
              {slide.content.body}
            </Reveal>
          )
        )}
      </div>
    </SlideChrome>
  );
}
