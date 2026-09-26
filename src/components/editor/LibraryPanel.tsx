import { useEffect, useState } from 'preact/hooks';
import { api } from '../../lib/client';
import AudioField from './AudioField';

export interface LibraryFields {
  isLibrary: boolean;
  subject: string | null;
  standard: string | null;
  backgroundMusicR2Key: string | null;
  saved: boolean;
  expiresAt: number | null;
}

interface Props {
  deckId: string;
  fields: LibraryFields;
  onUpdated(fields: LibraryFields): void;
}

const STANDARDS = ['4', '5', '6', '7', '8', '9', '10'];

/** Admins only: put a deck in the teachers' library, file it under a subject
 *  and standard, and give it background music. Each change saves at once. */
export default function LibraryPanel({ deckId, fields, onUpdated }: Props) {
  const [subject, setSubject] = useState(fields.subject ?? '');
  const [message, setMessage] = useState('');
  useEffect(() => setSubject(fields.subject ?? ''), [fields.subject]);

  async function update(change: Partial<LibraryFields>) {
    setMessage('');
    const res = await api(`/api/presentations/${deckId}/library`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(change),
    });
    if (res.ok) onUpdated((await res.json()) as LibraryFields);
    else setMessage('Couldn’t update the library settings.');
  }

  return (
    <section class="libpanel">
      <p class="slides__add-label">Library · admins</p>
      <label class="check">
        <input type="checkbox" checked={fields.isLibrary} onChange={(e) => update({ isLibrary: e.currentTarget.checked })} />
        Show in the teachers’ library
      </label>
      <label class="field">
        <span>Subject</span>
        <input
          value={subject}
          maxLength={60}
          placeholder="e.g. Science"
          onInput={(e) => setSubject(e.currentTarget.value)}
          onBlur={() => subject !== (fields.subject ?? '') && update({ subject })}
        />
      </label>
      <label class="field">
        <span>Standard</span>
        <select value={fields.standard ?? ''} onChange={(e) => update({ standard: e.currentTarget.value || null })}>
          <option value="">—</option>
          {STANDARDS.map((s) => (
            <option value={s} key={s}>Std {s}</option>
          ))}
        </select>
      </label>
      <AudioField
        label="Background music"
        hint="Plays quietly under the whole presentation once the teacher goes full screen."
        value={fields.backgroundMusicR2Key}
        canUpload
        presentationId={deckId}
        onChange={(key) => update({ backgroundMusicR2Key: key })}
      />
      {message && <p class="hint" role="alert">{message}</p>}
    </section>
  );
}
