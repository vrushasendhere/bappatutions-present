import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../../lib/client';

interface Upload {
  id: string;
  url: string;
  byteSize: number;
}

interface Library {
  base: string;
  files: string[];
  unavailable?: boolean;
}

interface Props {
  presentationId: string;
  onPick(url: string): void;
  onClose(): void;
  onUploadDeleted(url: string): void;
}

const MAX_BYTES = 3 * 1024 * 1024;
const SHOWN = 120; // the library has ~1,200 pictures; search narrows it

const UPLOAD_ERRORS: Record<string, string> = {
  'image-limit': 'This presentation already has 9 uploaded pictures. Delete one to add another.',
  'too-large': 'That picture is over 3 MB. Please choose a smaller one.',
  'not-an-image': 'That file isn’t a picture we can use. Try a PNG, JPG, WebP or GIF.',
  'storage-limit': 'You’ve used all your upload space. Delete some pictures first.',
  'too-many-writes': 'Too many changes in a short time. Wait a minute and try again.',
};

// One fetch per page load, however many times the picker is opened.
let libraryRequest: Promise<Library> | null = null;

export default function ImagePicker({ presentationId, onPick, onClose, onUploadDeleted }: Props) {
  const [tab, setTab] = useState<'library' | 'uploads'>('library');
  const [library, setLibrary] = useState<Library | null>(null);
  const [query, setQuery] = useState('');
  const [uploads, setUploads] = useState<Upload[] | null>(null);
  const [limit, setLimit] = useState<number | null>(9);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // `autofocus` is only honoured for elements present at page load, and this
  // dialog is inserted later — so focus the search box explicitly.
  useEffect(() => {
    if (tab === 'library') searchRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    libraryRequest ??= api('/api/library-images').then((r) => r.json() as Promise<Library>);
    libraryRequest.then(setLibrary).catch(() => setLibrary({ base: '', files: [], unavailable: true }));

    api(`/api/images?presentation=${presentationId}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ images: Upload[]; limit: number | null }>) : null))
      .then((d) => {
        if (!d) return;
        setUploads(d.images);
        setLimit(d.limit);
      });

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const matches = useMemo(() => {
    if (!library) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return library.files;
    return library.files.filter((f) => {
      const name = f.replace(/-/g, ' ');
      return words.every((w) => name.includes(w));
    });
  }, [library, query]);

  async function upload(file: File) {
    setMessage('');
    if (file.size > MAX_BYTES) {
      setMessage(UPLOAD_ERRORS['too-large']);
      return;
    }
    setBusy(true);
    try {
      const res = await api(`/api/images?presentation=${presentationId}`, { method: 'POST', body: file });
      if (res.ok) {
        const image = (await res.json()) as Upload;
        setUploads((u) => [...(u ?? []), image]);
        onPick(image.url);
        return;
      }
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(UPLOAD_ERRORS[err.error ?? ''] ?? 'That upload didn’t work. Please try again.');
    } catch {
      setMessage('That upload didn’t work — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(image: Upload) {
    if (!confirm('Delete this picture? Any slide using it will lose it.')) return;
    const res = await api(`/api/images/${image.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setMessage('Couldn’t delete that picture. Please try again.');
      return;
    }
    setUploads((u) => (u ?? []).filter((x) => x.id !== image.id));
    onUploadDeleted(image.url);
  }

  const atLimit = limit !== null && (uploads?.length ?? 0) >= limit;

  return (
    <div class="picker" role="dialog" aria-modal="true" aria-label="Choose a picture">
      <div class="picker__backdrop" onClick={onClose} />
      <div class="picker__card">
        <header class="picker__head">
          <div class="picker__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'library'} class={tab === 'library' ? 'is-on' : ''} onClick={() => setTab('library')}>
              Picture library
            </button>
            <button type="button" role="tab" aria-selected={tab === 'uploads'} class={tab === 'uploads' ? 'is-on' : ''} onClick={() => setTab('uploads')}>
              Your uploads{limit !== null && uploads ? ` (${uploads.length}/${limit})` : ''}
            </button>
          </div>
          <button type="button" class="picker__close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {message && <p class="picker__message" role="alert">{message}</p>}

        {tab === 'library' ? (
          <div class="picker__body">
            <input
              class="picker__search"
              type="search"
              placeholder="Search pictures — e.g. rice, bus, tea"
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
              ref={searchRef}
            />
            {!library && <p class="hint">Loading pictures…</p>}
            {library?.unavailable && <p class="hint">The picture library can’t be reached right now. You can still upload your own.</p>}
            {library && !library.unavailable && (
              <p class="hint">
                {matches.length > SHOWN
                  ? `Showing ${SHOWN} of ${matches.length} — type to narrow down.`
                  : `${matches.length} picture${matches.length === 1 ? '' : 's'}`}
              </p>
            )}
            <div class="picker__grid">
              {library &&
                matches.slice(0, SHOWN).map((file) => (
                  <button type="button" class="picker__item" key={file} title={file.replace(/-/g, ' ').replace(/\.webp$/, '')} onClick={() => onPick(library.base + file)}>
                    <img src={library.base + file} alt="" loading="lazy" />
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <div class="picker__body">
            <label class={`btn-primary picker__upload${atLimit || busy ? ' is-disabled' : ''}`}>
              {busy ? 'Uploading…' : 'Upload a picture'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={atLimit || busy}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (file) upload(file);
                }}
              />
            </label>
            <p class="hint">
              {atLimit
                ? 'This presentation has used all 9 uploads. Delete one to add another.'
                : 'PNG, JPG, WebP or GIF, up to 3 MB. Location data inside photos is removed.'}
            </p>
            <div class="picker__grid">
              {uploads?.map((image) => (
                <div class="picker__item picker__item--upload" key={image.id}>
                  <button type="button" onClick={() => onPick(image.url)} aria-label="Use this picture">
                    <img src={image.url} alt="" loading="lazy" />
                  </button>
                  <button type="button" class="picker__delete" onClick={() => remove(image)} aria-label="Delete this picture">✕</button>
                </div>
              ))}
            </div>
            {uploads?.length === 0 && <p class="hint">Nothing uploaded yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
