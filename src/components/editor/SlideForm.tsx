import type { SlideContent, SlideModel, TemplateKey, Transition } from '../../lib/slides';
import { TEMPLATE_INFO, TEMPLATE_KEYS, LIMITS } from '../../lib/templates';
import AudioField from './AudioField';

interface Props {
  slide: SlideModel;
  presentationId: string;
  isAdmin: boolean;
  onChangeContent(patch: Partial<SlideContent>): void;
  onChangeTemplate(key: TemplateKey): void;
  onChangeTransition(transition: Transition): void;
  onChangeSound(key: string | null): void;
  onChooseImage(): void;
}

const TRANSITIONS: Array<{ value: Transition; label: string }> = [
  { value: 'fade', label: 'Fade in' },
  { value: 'slide', label: 'Slide in' },
  { value: 'none', label: 'Appear instantly' },
];

/** The fields for the selected slide — only the ones its layout uses, in the
 *  order they reveal during a presentation. Plain text fields throughout:
 *  no rich text means no HTML ever reaches a slide. */
export default function SlideForm({
  slide,
  presentationId,
  isAdmin,
  onChangeContent,
  onChangeTemplate,
  onChangeTransition,
  onChangeSound,
  onChooseImage,
}: Props) {
  const info = TEMPLATE_INFO[slide.templateKey];
  const c = slide.content;
  const bullets = c.bullets ?? [];

  const setBullet = (i: number, text: string) =>
    onChangeContent({ bullets: bullets.map((b, j) => (j === i ? text : b)) });

  return (
    <aside class="editor__panel" aria-label="Slide details">
      <label class="field">
        <span>Layout</span>
        <select value={slide.templateKey} onChange={(e) => onChangeTemplate(e.currentTarget.value as TemplateKey)}>
          {TEMPLATE_KEYS.map((key) => (
            <option value={key} key={key}>{TEMPLATE_INFO[key].label}</option>
          ))}
        </select>
      </label>

      <label class="field">
        <span>How it arrives</span>
        <select value={slide.transition ?? 'fade'} onChange={(e) => onChangeTransition(e.currentTarget.value as Transition)}>
          {TRANSITIONS.map((t) => (
            <option value={t.value} key={t.value}>{t.label}</option>
          ))}
        </select>
      </label>

      <AudioField
        label="Sound when it arrives"
        hint="A short sound played once as this slide comes on screen."
        value={slide.soundEffectR2Key}
        canUpload={isAdmin}
        presentationId={presentationId}
        onChange={onChangeSound}
      />

      {info.fields.map((field) => {
        switch (field) {
          case 'heading':
            return (
              <label class="field" key={field}>
                <span>Heading</span>
                <input
                  value={c.heading ?? ''}
                  maxLength={LIMITS.heading}
                  onInput={(e) => onChangeContent({ heading: e.currentTarget.value })}
                />
              </label>
            );
          case 'body':
            return (
              <label class="field" key={field}>
                <span>{info.bodyLabel ?? 'Text'}</span>
                <textarea
                  rows={5}
                  value={c.body ?? ''}
                  maxLength={LIMITS.body}
                  onInput={(e) => onChangeContent({ body: e.currentTarget.value })}
                />
              </label>
            );
          case 'caption':
            return (
              <label class="field" key={field}>
                <span>Caption</span>
                <input
                  value={c.imageCaption ?? ''}
                  maxLength={LIMITS.caption}
                  onInput={(e) => onChangeContent({ imageCaption: e.currentTarget.value })}
                />
              </label>
            );
          case 'bullets':
            return (
              <fieldset class="field" key={field}>
                <legend>Points <small>(appear one at a time with ▲ Up)</small></legend>
                {bullets.map((text, i) => (
                  <div class="bullet-row" key={i}>
                    <input
                      value={text}
                      maxLength={LIMITS.bullet}
                      aria-label={`Point ${i + 1}`}
                      onInput={(e) => setBullet(i, e.currentTarget.value)}
                    />
                    <button
                      type="button"
                      aria-label={`Remove point ${i + 1}`}
                      onClick={() => onChangeContent({ bullets: bullets.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  class="btn-quiet"
                  disabled={bullets.length >= LIMITS.bullets}
                  onClick={() => onChangeContent({ bullets: [...bullets, ''] })}
                >
                  + Add a point
                </button>
              </fieldset>
            );
          case 'image':
            return (
              <div class="field" key={field}>
                <span>Picture</span>
                {c.imageUrl ? (
                  <img class="field__thumb" src={c.imageUrl} alt="" />
                ) : (
                  <p class="hint">No picture yet.</p>
                )}
                <div class="field__row">
                  <button type="button" class="btn-primary" onClick={onChooseImage}>
                    {c.imageUrl ? 'Change picture' : 'Choose picture'}
                  </button>
                  {c.imageUrl && (
                    <button type="button" class="btn-quiet" onClick={() => onChangeContent({ imageUrl: undefined })}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
        }
      })}
    </aside>
  );
}
