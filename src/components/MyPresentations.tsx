import { useEffect, useState } from 'preact/hooks';
import { api, adoptAnonFromQuery } from '../lib/client';
import { fetchMe, keepDeck, signIn, type Me } from '../lib/auth';
import Account from './Account';

interface DeckRow {
  id: string;
  title: string;
  saved: boolean;
  expiresAt: number | null;
  updatedAt: number;
}

const when = (ms: number) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/** The teacher's own presentations: the ones they've kept, and temporary
 *  copies with the date each one goes. Works signed out too — it then lists
 *  what this browser has made. */
export default function MyPresentations() {
  const [me, setMe] = useState<Me | null>(null);
  const [decks, setDecks] = useState<DeckRow[] | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    // In order: fetchMe finishes any pending claim, which changes the list.
    const who = await fetchMe();
    const list = (await (await api('/api/presentations')).json()) as { decks: DeckRow[] };
    setMe(who);
    setDecks(list.decks);
  }

  useEffect(() => {
    adoptAnonFromQuery();
    load();
  }, []);

  async function keep(deck: DeckRow) {
    setMessage('');
    if (!me?.user && !(await signIn())) return;
    const result = await keepDeck(deck.id);
    if (result === 'limit') setMessage(`You can keep ${me?.savedLimit ?? 5} presentations. Delete one to keep another.`);
    else if (result === 'failed') setMessage('Couldn’t keep that presentation. Please try again.');
    load();
  }

  async function remove(deck: DeckRow) {
    if (!confirm(`Delete “${deck.title}”? This can’t be undone.`)) return;
    const res = await api(`/api/presentations/${deck.id}`, { method: 'DELETE' });
    if (!res.ok) setMessage('Couldn’t delete that presentation. Please try again.');
    load();
  }

  return (
    <main class="mine">
      <header class="mine__head">
        <a href="/gallery" title="Presentation library">
          <img class="mine__logo" src="/brand/bappa-logo.png" alt="BappaTutions" />
        </a>
        <Account me={me} onChange={load} />
      </header>

      <h1>My presentations</h1>

      {me && !me.user && (
        <p class="banner">
          You’re not signed in, so these are kept for two days from when you made them. Sign in with Google to keep up to{' '}
          {me.savedLimit} for good.
          <button type="button" class="btn-primary" onClick={async () => { if (await signIn()) load(); }}>Sign in with Google</button>
        </p>
      )}
      {me?.user && me.savedLimit !== null && (
        <p class="hint">Kept: {me.saved} of {me.savedLimit}. Delete one to make room for another.</p>
      )}
      {message && <p class="banner banner--warn" role="alert">{message}</p>}

      {decks === null && <p class="hint">Loading…</p>}
      {decks?.length === 0 && (
        <p>
          Nothing here yet. Open the <a href="/gallery">presentation library</a> and press Customize, or{' '}
          <a href="/edit/new">start a new one</a>.
        </p>
      )}

      <ul class="mine__list">
        {decks?.map((deck) => (
          <li class="mine__row" key={deck.id}>
            <div class="mine__info">
              <strong>{deck.title}</strong>
              <span class="hint">
                {deck.saved ? 'Kept' : `Temporary — removed ${when(deck.expiresAt!)}`} · edited {when(deck.updatedAt)}
              </span>
            </div>
            <div class="mine__actions">
              <a class="btn-quiet" href={`/edit/${deck.id}`}>Edit</a>
              <a class="btn-quiet" href={`/play/${deck.id}`} target="_blank" rel="noopener">Present</a>
              {!deck.saved && <button type="button" class="btn-quiet" onClick={() => keep(deck)}>Keep</button>}
              <button type="button" class="btn-quiet" onClick={() => remove(deck)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
