import { useEffect, useRef, useState } from 'preact/hooks';
import { api, adoptAnonFromQuery } from '../../lib/client';
import { downloadDeck } from '../../lib/download';
import { fetchMe, finishPendingClaim, keepDeck, signIn, type KeepResult, type Me } from '../../lib/auth';
import type { SlideContent, SlideModel, TemplateKey } from '../../lib/slides';
import { TEMPLATE_INFO, THEMES, LIMITS } from '../../lib/templates';
import SlideRenderer from '../slides/SlideRenderer';
import Account from '../Account';
import SlideList from './SlideList';
import SlideForm from './SlideForm';
import ImagePicker from './ImagePicker';
import LibraryPanel, { type LibraryFields } from './LibraryPanel';

interface DeckState extends LibraryFields {
  id: string;
  title: string;
  theme: string;
  slides: SlideModel[];
}

// "After 3 uses we ask them to sign in" — from the fourth deck on, an
// anonymous teacher sees the nudge. It never blocks anything.
const NUDGE_AFTER_USES = 3;

type SaveState = 'saved' | 'pending' | 'saving' | 'paused' | 'failed';

const SAVE_DELAY = 3000;

async function createDeck(body: object): Promise<DeckState> {
  const res = await api('/api/presentations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error('Too many new presentations in the last hour. Please try again a little later.');
  if (res.status === 404) throw new Error('That presentation no longer exists, or its 2-day link has expired.');
  if (!res.ok) throw new Error('Could not open the editor. Please try again.');
  return (await res.json()) as DeckState;
}

/** `new` starts a blank deck. Anything else the caller doesn't own — a
 *  library deck, or a link a colleague shared — is copied, never edited in
 *  place; the copy is the caller's own for two days. */
async function openDeck(id: string): Promise<DeckState> {
  if (id === 'new') return createDeck({});
  const res = await api(`/api/presentations/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new Error('This presentation doesn’t exist, or its 2-day link has expired.');
  if (!res.ok) throw new Error('Could not open the editor. Please try again.');
  const deck = (await res.json()) as DeckState & { owned: boolean };
  return deck.owned ? deck : createDeck({ forkFrom: id });
}

const newSlideId = () => crypto.randomUUID().slice(0, 8);

export default function Editor({ id }: { id: string }) {
  const [deck, setDeck] = useState<DeckState | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveMessage, setSaveMessage] = useState('');
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [note, setNote] = useState('');
  const [me, setMe] = useState<Me | null>(null);

  const refreshMe = () => fetchMe().then(setMe).catch(() => {});

  // Autosave bookkeeping lives in refs: every edit bumps `version`, a save
  // records which version it sent, and only one save is ever in flight — so
  // an older write can never land after a newer one.
  const latest = useRef<DeckState | null>(null);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    adoptAnonFromQuery();
    finishPendingClaim()
      .then(() => openDeck(id))
      .then((d) => {
        latest.current = d;
        setDeck(d);
        setSelectedId(d.slides[0]?.id ?? '');
        // Back from a full-page sign-in that began with Keep: finish it.
        const resumeKeep = new URLSearchParams(location.search).get('keep') === '1';
        if (d.id !== id || resumeKeep) history.replaceState(null, '', `/edit/${d.id}`);
        return refreshMe().then(async () => {
          if (resumeKeep) applyKeep(await keepDeck(d.id));
        });
      })
      .catch((e: Error) => setError(e.message));

    const onHide = () => document.visibilityState === 'hidden' && save();
    const onLeave = (e: BeforeUnloadEvent) => {
      if (version.current !== savedVersion.current) e.preventDefault();
    };
    document.addEventListener('visibilitychange', onHide);
    addEventListener('beforeunload', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      removeEventListener('beforeunload', onLeave);
    };
  }, []);

  function save(): Promise<void> {
    clearTimeout(timer.current);
    if (inFlight.current) return inFlight.current.then(save);
    const d = latest.current;
    if (!d || version.current === savedVersion.current) return Promise.resolve();

    const sending = version.current;
    setSaveState('saving');
    inFlight.current = (async () => {
      try {
        const res = await api(`/api/presentations/${d.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: d.title, theme: d.theme, slides: d.slides }),
        });
        if (res.ok) {
          savedVersion.current = sending;
          setSaveMessage('');
          if (version.current !== sending) {
            setSaveState('pending');
            timer.current = setTimeout(save, SAVE_DELAY);
          } else {
            setSaveState('saved');
          }
        } else if (res.status === 429) {
          setSaveState('paused');
          setSaveMessage('Lots of changes at once — saving again in a minute.');
          timer.current = setTimeout(save, 60_000);
        } else {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          setSaveState('failed');
          setSaveMessage(
            err.message ?? (res.status === 404 ? 'This copy has expired and can no longer be saved.' : 'Couldn’t save your last change.')
          );
        }
      } catch {
        setSaveState('failed');
        setSaveMessage('You seem to be offline — trying again shortly.');
        timer.current = setTimeout(save, 10_000);
      } finally {
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }

  // Uses only refs and state setters, so it's safe to call from the load
  // effect (created on the first render) as well as from a click.
  function applyKeep(result: KeepResult) {
    if (result === 'kept') {
      const kept = { ...latest.current!, saved: true, expiresAt: null };
      latest.current = kept;
      setDeck(kept);
      refreshMe();
    } else if (result === 'limit') {
      setNote('You’ve kept as many presentations as you can — delete one in My presentations to keep this one.');
    } else {
      setNote('Couldn’t keep this presentation. Please try again.');
    }
  }

  function change(mutate: (d: DeckState) => DeckState) {
    const next = mutate(latest.current!);
    latest.current = next;
    setDeck(next);
    version.current++;
    setSaveState('pending');
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY);
  }

  const updateSlides = (fn: (slides: SlideModel[]) => SlideModel[]) =>
    change((d) => ({ ...d, slides: fn(d.slides).map((s, i) => ({ ...s, order: i })) }));

  if (error) {
    return (
      <div class="editor-msg">
        <p>{error}</p>
        <a href="/gallery">Back to the presentation library</a>
      </div>
    );
  }
  if (!deck) return <div class="editor-msg"><p>Opening…</p></div>;

  const index = Math.max(0, deck.slides.findIndex((s) => s.id === selectedId));
  const slide = deck.slides[index];

  const updateSelected = (fn: (s: SlideModel) => SlideModel) =>
    updateSlides((slides) => slides.map((s, i) => (i === index ? fn(s) : s)));

  function insertAfter(at: number, s: SlideModel) {
    updateSlides((slides) => [...slides.slice(0, at + 1), s, ...slides.slice(at + 1)]);
    setSelectedId(s.id);
  }

  async function present(e: Event) {
    e.preventDefault();
    // Opened before the save so the browser still counts it as a click, then
    // pointed at the deck once the latest edits are on the server.
    const tab = window.open('about:blank', '_blank');
    await save();
    if (tab) tab.location.href = `/play/${deck!.id}`;
  }

  async function download() {
    setDownloading(true);
    setNote('');
    await save(); // the download is built from what's on screen, saved first
    const result = await downloadDeck(latest.current!);
    setDownloading(false);
    if (!result.ok) setNote(result.message);
    else setNote(result.remaining === null ? 'Downloaded ✓' : `Downloaded ✓ — ${result.remaining} left today`);
  }

  /** Keep this deck beyond two days. Signs in first if needed — signIn()
   *  has to open its popup straight from this click, before any await. */
  async function keep() {
    setNote('');
    if (!me?.user) {
      // If popups are blocked, signIn() leaves this page and comes back to
      // this URL — the marker tells the returning page to finish the keep.
      history.replaceState(null, '', `${location.pathname}?keep=1`);
      const signedIn = await signIn();
      history.replaceState(null, '', location.pathname);
      if (!signedIn) return;
      await refreshMe();
    }
    applyKeep(await keepDeck(latest.current!.id));
  }

  /** Library settings save on their own (they're not part of the autosave),
   *  so they're merged in without marking the deck as changed. */
  function libraryUpdated(fields: LibraryFields) {
    const { isLibrary, subject, standard, backgroundMusicR2Key, saved, expiresAt } = fields;
    const next = { ...latest.current!, isLibrary, subject, standard, backgroundMusicR2Key, saved, expiresAt };
    latest.current = next;
    setDeck(next);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/play/${deck!.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copy this link:', `${location.origin}/play/${deck!.id}`);
    }
  }

  const status: Record<SaveState, string> = {
    saved: 'All changes saved',
    pending: 'Unsaved changes…',
    saving: 'Saving…',
    paused: saveMessage,
    failed: saveMessage,
  };

  return (
    <div class="editor">
      <header class="editor__bar">
        <a class="editor__home" href="/gallery" title="Presentation library">
          <img src="/brand/bappa-logo.png" alt="BappaTutions" />
        </a>
        <input
          class="editor__title"
          value={deck.title}
          maxLength={LIMITS.title}
          aria-label="Presentation title"
          onInput={(e) => {
            const title = e.currentTarget.value;
            change((d) => ({ ...d, title }));
          }}
        />
        <label class="editor__theme">
          <span class="sr-only">Theme</span>
          <select
            value={deck.theme}
            onChange={(e) => {
              const theme = e.currentTarget.value;
              change((d) => ({ ...d, theme }));
            }}
          >
            {THEMES.map((t) => (
              <option value={t.value} key={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <span class={`editor__status is-${saveState}`} role="status">{status[saveState]}</span>
        <div class="editor__actions">
          {note && <span class="editor__note" role="status">{note}</span>}
          {deck.isLibrary ? (
            <span class="editor__kept">In the library</span>
          ) : deck.saved ? (
            <span class="editor__kept">Kept ✓</span>
          ) : (
            <>
              {deck.expiresAt && (
                <span class="editor__expiry">
                  Until {new Date(deck.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              )}
              <button type="button" class="btn-quiet" onClick={keep} title="Keep it beyond two days — needs a Google sign-in">
                Keep
              </button>
            </>
          )}
          <button type="button" class="btn-quiet" onClick={copyLink}>{copied ? 'Link copied ✓' : 'Copy link'}</button>
          <button type="button" class="btn-quiet" onClick={download} disabled={downloading} title="A folder that runs offline — 3 downloads a day">
            {downloading ? 'Preparing…' : '⬇ Download'}
          </button>
          <a class="btn-primary" href={`/play/${deck.id}`} onClick={present}>Present ▶</a>
          <Account me={me} onChange={refreshMe} />
        </div>
      </header>

      <div class="editor__banners">
        {deck.isLibrary && me?.user?.isAdmin && (
          <p class="banner banner--admin">
            You’re editing the published library deck — every change reaches teachers as soon as it saves.
          </p>
        )}
        {me && !me.user && !deck.saved && me.usesCount > NUDGE_AFTER_USES && (
          <p class="banner">
            You’ve started {me.usesCount} presentations. Copies that aren’t kept are removed two days after they’re made —
            sign in with Google to keep up to {me.savedLimit}.
            <button type="button" class="btn-primary" onClick={keep}>Sign in and keep this one</button>
          </p>
        )}
      </div>

      <div class="editor__body">
        <SlideList
          slides={deck.slides}
          selectedId={slide.id}
          onSelect={setSelectedId}
          onMove={(from, to) => {
            if (to < 0 || to >= deck.slides.length) return;
            updateSlides((slides) => {
              const next = [...slides];
              const [moved] = next.splice(from, 1);
              next.splice(to, 0, moved);
              return next;
            });
          }}
          onAdd={(key) =>
            insertAfter(index, { id: newSlideId(), order: 0, templateKey: key, content: { ...TEMPLATE_INFO[key].starter } })
          }
          onDuplicate={(i) => insertAfter(i, { ...deck.slides[i], id: newSlideId() })}
          onDelete={(i) => {
            if (!confirm(`Delete slide ${i + 1}?`)) return;
            const neighbour = deck.slides[i + 1] ?? deck.slides[i - 1];
            updateSlides((slides) => slides.filter((_, j) => j !== i));
            if (deck.slides[i].id === slide.id && neighbour) setSelectedId(neighbour.id);
          }}
        >
          {me?.user?.isAdmin && <LibraryPanel deckId={deck.id} fields={deck} onUpdated={libraryUpdated} />}
        </SlideList>

        <main class="editor__stage">
          <div class="editor__frame">
            <SlideRenderer slide={slide} theme={deck.theme} revealedCount={Infinity} />
          </div>
          <p class="hint">
            Slide {index + 1} of {deck.slides.length}. In class, Next/Prev move between slides and ▲/▼ bring each part in one at a time.
          </p>
        </main>

        <SlideForm
          slide={slide}
          presentationId={deck.id}
          isAdmin={!!me?.user?.isAdmin}
          onChangeSound={(key) => updateSelected((s) => ({ ...s, soundEffectR2Key: key ?? undefined }))}
          onChangeContent={(patch: Partial<SlideContent>) => updateSelected((s) => ({ ...s, content: { ...s.content, ...patch } }))}
          onChangeTemplate={(key: TemplateKey) =>
            // Fields the new layout doesn't use are kept, so switching back
            // loses nothing; fields it needs and doesn't have get a starter.
            updateSelected((s) => ({ ...s, templateKey: key, content: { ...TEMPLATE_INFO[key].starter, ...s.content } }))
          }
          onChangeTransition={(transition) => updateSelected((s) => ({ ...s, transition }))}
          onChooseImage={() => setPicking(true)}
        />
      </div>

      {picking && (
        <ImagePicker
          presentationId={deck.id}
          onClose={() => setPicking(false)}
          onPick={(url) => {
            updateSelected((s) => ({ ...s, content: { ...s.content, imageUrl: url } }));
            setPicking(false);
          }}
          onUploadDeleted={(url) =>
            updateSlides((slides) =>
              slides.map((s) => (s.content.imageUrl === url ? { ...s, content: { ...s.content, imageUrl: undefined } } : s))
            )
          }
        />
      )}
    </div>
  );
}
