import type { SlideModel, TemplateKey, Transition } from '../../lib/slides';
import { TEMPLATE_INFO, TEMPLATE_KEYS } from '../../lib/templates';
import AudioField from './AudioField';

interface Props {
  slide: SlideModel;
  presentationId: string;
  isAdmin: boolean;
  onChangeTemplate(key: TemplateKey): void;
  onChangeTransition(t: Transition): void;
  onChangeSound(key: string | null): void;
}

const TRANSITIONS: Array<{ value: Transition; label: string }> = [
  { value: 'fade', label: 'Fade in' },
  { value: 'slide', label: 'Slide in' },
  { value: 'none', label: 'Appear instantly' },
];

/**
 * Everything about a slide that isn't content a teacher clicks and types —
 * layout, how it arrives, and (admins only) its sound. Deliberately thin:
 * this is what's left over once text and pictures moved onto the slide
 * itself (see Editable and the slide templates' `edit` prop) — a strip, not
 * a form.
 */
export default function SlideToolbar({ slide, presentationId, isAdmin, onChangeTemplate, onChangeTransition, onChangeSound }: Props) {
  return (
    <div class="slide-toolbar">
      <label class="slide-toolbar__item">
        <span>Layout</span>
        <select value={slide.templateKey} onChange={(e) => onChangeTemplate(e.currentTarget.value as TemplateKey)}>
          {TEMPLATE_KEYS.map((key) => (
            <option value={key} key={key}>{TEMPLATE_INFO[key].label}</option>
          ))}
        </select>
      </label>
      <label class="slide-toolbar__item">
        <span>Arrives</span>
        <select value={slide.transition ?? 'fade'} onChange={(e) => onChangeTransition(e.currentTarget.value as Transition)}>
          {TRANSITIONS.map((t) => (
            <option value={t.value} key={t.value}>{t.label}</option>
          ))}
        </select>
      </label>
      {(isAdmin || slide.soundEffectR2Key) && (
        <div class="slide-toolbar__item slide-toolbar__sound">
          <AudioField
            label="Sound"
            hint="Plays once as this slide comes on screen."
            value={slide.soundEffectR2Key}
            canUpload={isAdmin}
            presentationId={presentationId}
            onChange={onChangeSound}
          />
        </div>
      )}
    </div>
  );
}
