import { useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { SlideModel, TemplateKey } from '../../lib/slides';
import { TEMPLATE_INFO, TEMPLATE_KEYS, LIMITS } from '../../lib/templates';

interface Props {
  slides: SlideModel[];
  selectedId: string;
  onSelect(id: string): void;
  onMove(from: number, to: number): void;
  onAdd(key: TemplateKey): void;
  onDuplicate(index: number): void;
  onDelete(index: number): void;
  children?: ComponentChildren; // shown under "Add a slide" (the admins' library panel)
}

/**
 * The slide list. Reordering works by drag (desktop) and by the ▲/▼ buttons
 * — HTML drag-and-drop does nothing on most touchscreens, and the buttons
 * are also what a keyboard user reaches.
 */
export default function SlideList({ slides, selectedId, onSelect, onMove, onAdd, onDuplicate, onDelete, children }: Props) {
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const full = slides.length >= LIMITS.slides;

  return (
    <aside class="editor__list" aria-label="Slides">
      <ol class="slides">
        {slides.map((s, i) => (
          <li
            key={s.id}
            class={`slides__row${s.id === selectedId ? ' is-selected' : ''}${over === i ? ' is-over' : ''}`}
            draggable
            onDragStart={(e) => {
              dragFrom.current = i;
              e.dataTransfer?.setData('text/plain', String(i));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (dragFrom.current !== null && dragFrom.current !== i) onMove(dragFrom.current, i);
              dragFrom.current = null;
            }}
            onDragEnd={() => {
              setOver(null);
              dragFrom.current = null;
            }}
          >
            <button type="button" class="slides__pick" onClick={() => onSelect(s.id)}>
              <span class="slides__n">{i + 1}</span>
              <span class="slides__label">{s.content.heading || TEMPLATE_INFO[s.templateKey].label}</span>
            </button>
            <div class="slides__tools">
              <button type="button" onClick={() => onMove(i, i - 1)} disabled={i === 0} title="Move up" aria-label={`Move slide ${i + 1} up`}>▲</button>
              <button type="button" onClick={() => onMove(i, i + 1)} disabled={i === slides.length - 1} title="Move down" aria-label={`Move slide ${i + 1} down`}>▼</button>
              <button type="button" onClick={() => onDuplicate(i)} disabled={full} title="Duplicate" aria-label={`Duplicate slide ${i + 1}`}>⧉</button>
              <button type="button" onClick={() => onDelete(i)} disabled={slides.length === 1} title="Delete" aria-label={`Delete slide ${i + 1}`}>✕</button>
            </div>
          </li>
        ))}
      </ol>

      <div class="slides__add">
        <p class="slides__add-label">Add a slide</p>
        <div class="slides__add-grid">
          {TEMPLATE_KEYS.map((key) => (
            <button type="button" key={key} disabled={full} onClick={() => onAdd(key)}>
              {TEMPLATE_INFO[key].label}
            </button>
          ))}
        </div>
        {full && <p class="hint">{LIMITS.slides} slides is the most one presentation can hold.</p>}
      </div>
      {children}
    </aside>
  );
}
