import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';

interface Props {
  value: string;
  placeholder: string;
  onChange(value: string): void;
  as?: 'h1' | 'h2' | 'p' | 'span' | 'div';
  class?: string;
  multiline?: boolean;
  maxLength: number;
  /** Enter moves to the next bullet instead of just blurring — see BulletsSlide. */
  onEnter?: () => void;
  /** Backspace on an empty field removes it — see BulletsSlide. */
  onDeleteWhenEmpty?: () => void;
  innerRef?: (el: HTMLElement | null) => void;
}

/**
 * A piece of slide text, editable in place — click it, type, done. This is
 * the whole point of the redesign: the slide a teacher looks at *is* the
 * editor, not a preview next to a form.
 *
 * contentEditable's usual trap with a framework is the DOM and the
 * framework fighting over the text: set `textContent` from a prop on every
 * render and the cursor jumps to the start on each keystroke. So the DOM is
 * the source of truth while a field is being typed into — this only writes
 * `value` into the element when it *isn't* focused (a slide switch, another
 * teacher's edit, undo), never while the person is mid-word.
 */
export default function Editable({
  value,
  placeholder,
  onChange,
  as = 'div',
  class: className,
  multiline = false,
  maxLength,
  onEnter,
  onDeleteWhenEmpty,
  innerRef,
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value) {
      el.textContent = value;
    }
  }, [value]);

  const Tag = as as any;
  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        ref.current = el as any;
        innerRef?.(el);
      }}
      // slide__element + is-revealed match what Reveal renders in present
      // mode (src/components/slides/Reveal.tsx) — the editor always shows
      // everything, so an edited slide is styled identically to a played one.
      class={`slide__element is-revealed editable ${value ? '' : 'is-empty'} ${className ?? ''}`}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      role="textbox"
      aria-multiline={multiline}
      aria-label={placeholder}
      onMouseDown={(e: JSX.TargetedMouseEvent<HTMLElement>) => {
        // A completely empty contenteditable — nothing but the CSS
        // placeholder, no real text node — isn't reliable to click into:
        // there's no content for the browser's native "place the caret
        // here" hit-testing to resolve against, so a click can silently do
        // nothing. Forcing focus here doesn't touch caret placement (there's
        // no text to place it within anyway), so it only helps.
        if (!value) e.currentTarget.focus();
      }}
      onInput={(e: JSX.TargetedEvent<HTMLElement>) => {
        const text = (e.currentTarget.textContent ?? '').slice(0, maxLength);
        if (text !== e.currentTarget.textContent) e.currentTarget.textContent = text; // hard stop at the cap
        onChange(text);
      }}
      onKeyDown={(e: JSX.TargetedKeyboardEvent<HTMLElement>) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault();
          if (onEnter) onEnter();
          else e.currentTarget.blur();
        } else if (e.key === 'Backspace' && !e.currentTarget.textContent && onDeleteWhenEmpty) {
          e.preventDefault();
          onDeleteWhenEmpty();
        }
      }}
      onPaste={(e: JSX.TargetedEvent<HTMLElement, ClipboardEvent>) => {
        // Plain text only — a theme's look is ours, never a font or color
        // pasted in from somewhere else.
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') ?? '';
        document.execCommand('insertText', false, text);
      }}
    />
  );
}
