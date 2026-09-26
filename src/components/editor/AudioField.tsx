import { useState } from 'preact/hooks';
import { api } from '../../lib/client';
import { mediaUrl } from '../../lib/media';

interface Props {
  label: string;
  hint: string;
  value: string | null | undefined; // an R2 key
  canUpload: boolean; // admins only; teachers can only remove a sound a library deck came with
  presentationId: string;
  onChange(key: string | null): void;
}

/** A slide's sound effect or a deck's background music. */
export default function AudioField({ label, hint, value, canUpload, presentationId, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!value && !canUpload) return null;

  async function upload(file: File) {
    setBusy(true);
    setMessage('');
    const res = await api(`/api/audio?presentation=${presentationId}`, { method: 'POST', body: file });
    setBusy(false);
    if (res.ok) {
      onChange(((await res.json()) as { key: string }).key);
      return;
    }
    setMessage(
      res.status === 413 ? 'That file is over 15 MB.' : res.status === 415 ? 'That isn’t an audio file we can use — try MP3, OGG or M4A.' : 'That upload didn’t work. Please try again.'
    );
  }

  return (
    <div class="field">
      <span>{label}</span>
      {value ? <audio class="field__audio" controls preload="none" src={mediaUrl(value)} /> : <p class="hint">{hint}</p>}
      <div class="field__row">
        {canUpload && (
          <label class={`btn-quiet picker__upload${busy ? ' is-disabled' : ''}`}>
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="audio/mpeg,audio/ogg,audio/mp4,.mp3,.ogg,.m4a"
              disabled={busy}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = '';
                if (file) upload(file);
              }}
            />
          </label>
        )}
        {value && (
          <button type="button" class="btn-quiet" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      {message && <p class="hint" role="alert">{message}</p>}
    </div>
  );
}
