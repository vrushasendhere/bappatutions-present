import { useEffect, useRef } from 'preact/hooks';
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

const randomKey = () => Math.random().toString(36).slice(2);

export default function BulletsSlide({ slide, theme, revealedCount, edit }: Props) {
  const bullets = slide.content.bullets ?? [];

  // Preact needs a stable identity per row, not its array index — with an
  // index key, inserting a point in the middle makes Preact reuse the wrong
  // DOM node for the wrong text (the node "at position 1" gets handed new
  // content, but if that node was mid-edit or about to receive focus, the
  // new point and its old neighbour can end up merged in one box). These
  // keys exist only to prevent that; they're never sent anywhere.
  const keysRef = useRef<string[]>([]);
  const lastSlideId = useRef<string | null>(null);
  if (lastSlideId.current !== slide.id) {
    lastSlideId.current = slide.id; // a different slide entirely — start fresh
    keysRef.current = bullets.map(randomKey);
  } else if (keysRef.current.length !== bullets.length) {
    // Shouldn't happen — every mutation below keeps keys and bullets in
    // lockstep — but if it ever does, fail toward "no crash" over "no key".
    while (keysRef.current.length < bullets.length) keysRef.current.push(randomKey());
    keysRef.current.length = bullets.length;
  }

  const rows = useRef<Record<string, HTMLElement | null>>({});
  const pendingFocusKey = useRef<string | null>(null);
  useEffect(() => {
    if (pendingFocusKey.current) {
      rows.current[pendingFocusKey.current]?.focus();
      pendingFocusKey.current = null;
    }
  });

  function commit(nextBullets: string[], nextKeys: string[]) {
    keysRef.current = nextKeys;
    edit?.onChangeContent({ bullets: nextBullets });
  }

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

      <ul class="slide__bullets">
        {edit
          ? bullets.map((text, i) => {
              const key = keysRef.current[i];
              return (
                <li class="slide__element is-revealed slide__bullet-row" key={key}>
                  <Editable
                    as="span"
                    value={text}
                    placeholder="Click to add a point"
                    maxLength={LIMITS.bullet}
                    innerRef={(el) => (rows.current[key] = el)}
                    onChange={(v) => commit(bullets.map((b, j) => (j === i ? v : b)), keysRef.current)}
                    onEnter={() => {
                      if (bullets.length >= LIMITS.bullets) return;
                      const newKey = randomKey();
                      pendingFocusKey.current = newKey;
                      commit(
                        [...bullets.slice(0, i + 1), '', ...bullets.slice(i + 1)],
                        [...keysRef.current.slice(0, i + 1), newKey, ...keysRef.current.slice(i + 1)]
                      );
                    }}
                    onDeleteWhenEmpty={() => {
                      if (bullets.length <= 1) return; // always one row left to click into
                      pendingFocusKey.current = keysRef.current[Math.max(0, i - 1)];
                      commit(bullets.filter((_, j) => j !== i), keysRef.current.filter((_, j) => j !== i));
                    }}
                  />
                  <button
                    type="button"
                    class="slide__bullet-remove"
                    aria-label="Remove this point"
                    tabIndex={-1}
                    onClick={() => commit(bullets.filter((_, j) => j !== i), keysRef.current.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </li>
              );
            })
          : bullets.map((text, i) => (
              <Reveal as="li" slide={slide} elementKey={`bullet:${i}`} revealedCount={revealedCount} key={i}>
                {text}
              </Reveal>
            ))}
      </ul>

      {edit && bullets.length < LIMITS.bullets && (
        <button
          type="button"
          class="slide__bullet-add"
          onClick={() => {
            const newKey = randomKey();
            pendingFocusKey.current = newKey;
            commit([...bullets, ''], [...keysRef.current, newKey]);
          }}
        >
          + Add a point
        </button>
      )}
    </SlideChrome>
  );
}
