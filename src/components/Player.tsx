import { useEffect, useRef, useState } from 'preact/hooks';
import SlideRenderer from './slides/SlideRenderer';
import { defaultRevealedCount, revealOrder, type SlideModel } from '../lib/slides';
import { assets } from '../lib/assets';

interface Props {
  slides: SlideModel[];
  theme: string;
  backgroundMusicUrl?: string;
}

// Must match the animation duration in player.css.
const TRANSITION_MS = 450;

interface Leaving {
  index: number;
  revealed: number;
  dir: 1 | -1;
}

/**
 * Present mode — what a teacher actually uses in class. Two independent
 * navigation axes (see the plan's Present mode section):
 *
 *   - Next/Previous (buttons, Right/Left, PageDown/PageUp) move between
 *     SLIDES outright, with the incoming slide's transition.
 *   - Up/Down (buttons, ArrowUp/ArrowDown) reveal/hide ELEMENTS within the
 *     current slide, one at a time — the "build" a teacher uses to bring up
 *     one bullet while talking, without showing the whole slide at once.
 *
 * The same component runs in a downloaded copy (see src/export/entry.tsx),
 * which is what guarantees the download behaves exactly like this.
 */
export default function Player({ slides, theme, backgroundMusicUrl }: Props) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [revealedCount, setRevealedCount] = useState(() => defaultRevealedCount(slides[0]));
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const sfxRef = useRef<HTMLAudioElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Where the presentation is *now*, updated the instant a key is handled —
  // not on the next render. A presenter's clicker can send two presses
  // faster than a frame; reading state would see the same slide twice and
  // advance only once.
  const at = useRef({ index: 0, revealed: revealedCount });

  const slide = slides[slideIndex];
  const transition = slide.transition ?? 'fade';
  const maxRevealed = revealOrder(slide).length;

  function setRevealed(n: number) {
    at.current.revealed = n;
    setRevealedCount(n);
  }

  function goToSlide(index: number) {
    const from = at.current.index;
    const target = Math.max(0, Math.min(slides.length - 1, index));
    if (target === from) return;
    // The outgoing slide stays on screen underneath while the incoming one
    // arrives over it, so a fade is a true crossfade rather than a dip
    // through the black background.
    clearTimeout(leaveTimer.current);
    const kind = slides[target].transition ?? 'fade';
    setLeaving(kind === 'none' ? null : { index: from, revealed: at.current.revealed, dir: target > from ? 1 : -1 });
    if (kind !== 'none') leaveTimer.current = setTimeout(() => setLeaving(null), TRANSITION_MS);
    at.current.index = target;
    setSlideIndex(target);
    setRevealed(defaultRevealedCount(slides[target]));
  }
  const nextSlide = () => goToSlide(at.current.index + 1);
  const prevSlide = () => goToSlide(at.current.index - 1);
  const revealUp = () =>
    setRevealed(Math.min(revealOrder(slides[at.current.index]).length, at.current.revealed + 1));
  const revealDown = () => setRevealed(Math.max(0, at.current.revealed - 1));

  // A slide's own sound effect plays once, each time it's newly entered —
  // not on every element reveal within it.
  useEffect(() => {
    const key = slide.soundEffectR2Key;
    if (key && sfxRef.current) {
      sfxRef.current.src = assets.media(key);
      sfxRef.current.currentTime = 0;
      sfxRef.current.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex]);

  // Attached once; everything it calls reads `at`, so nothing goes stale.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prevSlide();
          break;
        case 'ArrowUp':
          e.preventDefault();
          revealUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          revealDown();
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
      // Background music needs a user gesture to start with sound — this
      // click is that gesture.
      musicRef.current?.play().catch(() => {});
    }
  }

  const direction = leaving?.dir === -1 ? 'is-back' : 'is-fwd';
  const moving = leaving ? ` t-${transition} ${direction}` : '';

  return (
    <div class="player" ref={containerRef} data-theme={theme}>
      <div class="player__stage">
        {leaving && (
          <div class={`player__layer is-leaving${moving}`} key={`leave-${leaving.index}`} aria-hidden="true">
            <SlideRenderer slide={slides[leaving.index]} theme={theme} revealedCount={leaving.revealed} />
          </div>
        )}
        <div class={`player__layer is-entering${moving}`} key={`slide-${slideIndex}`}>
          <SlideRenderer slide={slide} theme={theme} revealedCount={revealedCount} />
        </div>
      </div>

      <div class="player__controls" role="group" aria-label="Presentation controls">
        <button type="button" class="player__btn" onClick={prevSlide} disabled={slideIndex === 0} aria-label="Previous slide">
          ◀ Prev
        </button>
        <div class="player__stack">
          <button type="button" class="player__btn player__btn--small" onClick={revealUp} disabled={revealedCount >= maxRevealed} aria-label="Reveal next element">
            ▲ Up
          </button>
          <button type="button" class="player__btn player__btn--small" onClick={revealDown} disabled={revealedCount <= 0} aria-label="Hide last element">
            ▼ Down
          </button>
        </div>
        <button type="button" class="player__btn" onClick={nextSlide} disabled={slideIndex === slides.length - 1} aria-label="Next slide">
          Next ▶
        </button>
        <button type="button" class="player__btn player__btn--fullscreen" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
          {isFullscreen ? '⤡ Exit' : '⤢ Fullscreen'}
        </button>
      </div>

      <p class="player__progress">{slideIndex + 1} / {slides.length}</p>

      {backgroundMusicUrl && <audio ref={musicRef} src={backgroundMusicUrl} loop />}
      <audio ref={sfxRef} />
    </div>
  );
}
