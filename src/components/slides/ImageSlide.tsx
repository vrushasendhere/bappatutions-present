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

export default function ImageSlide({ slide, theme, revealedCount, edit }: Props) {
  return (
    <SlideChrome theme={theme}>
      {edit ? (
        <Editable
          as="h2"
          class="slide__heading"
          value={slide.content.heading ?? ''}
          placeholder="Click to add a heading"
          maxLength={LIMITS.heading}
          onChange={(heading) => edit.onChangeContent({ heading })}
        />
      ) : (
        slide.content.heading && (
          <Reveal as="h2" slide={slide} elementKey="heading" revealedCount={revealedCount} class="slide__heading">
            {slide.content.heading}
          </Reveal>
        )
      )}

      {edit ? (
        <button type="button" class="slide__image-wrap slide__element is-revealed editable-image" onClick={edit.onChooseImage}>
          {slide.content.imageUrl ? (
            <>
              <img class="slide__image" src={slide.content.imageUrl} alt="" />
              <span class="editable-image__overlay">Change picture</span>
            </>
          ) : (
            <span class="editable-image__hint">📷 Click to add a picture</span>
          )}
        </button>
      ) : (
        <Reveal as="div" slide={slide} elementKey="imageUrl" revealedCount={revealedCount} class="slide__image-wrap">
          {slide.content.imageUrl && <img class="slide__image" src={slide.content.imageUrl} alt="" />}
        </Reveal>
      )}

      {edit ? (
        <Editable
          as="p"
          class="slide__caption"
          value={slide.content.imageCaption ?? ''}
          placeholder="Click to add a caption (optional)"
          maxLength={LIMITS.caption}
          onChange={(imageCaption) => edit.onChangeContent({ imageCaption })}
        />
      ) : (
        slide.content.imageCaption && (
          <Reveal as="p" slide={slide} elementKey="imageCaption" revealedCount={revealedCount} class="slide__caption">
            {slide.content.imageCaption}
          </Reveal>
        )
      )}
    </SlideChrome>
  );
}
