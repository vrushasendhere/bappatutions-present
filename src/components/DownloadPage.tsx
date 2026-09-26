import { useEffect, useRef, useState } from 'preact/hooks';
import { api, adoptAnonFromQuery } from '../lib/client';
import { downloadDeck } from '../lib/download';
import type { ExportableDeck } from '../lib/export';

type State = 'preparing' | 'done' | 'failed';

/**
 * The page the gallery's Download button opens in a new tab.
 *
 * The gallery lives in a cross-site iframe on bappatutions.in, and Chrome
 * blocks a download that starts inside such a frame once a few seconds have
 * passed since the click — about as long as building a zip takes. A tab of
 * its own has no such limit, and has room to explain how to open the folder.
 */
export default function DownloadPage({ id }: { id: string }) {
  const [state, setState] = useState<State>('preparing');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const deck = useRef<ExportableDeck | null>(null);

  async function run() {
    setState('preparing');
    const result = await downloadDeck(deck.current!);
    if (result.ok) {
      setState('done');
      setMessage(
        result.remaining === null ? '' : `${result.remaining} download${result.remaining === 1 ? '' : 's'} left today.`
      );
    } else {
      setState('failed');
      setMessage(result.message);
      setCanRetry(!result.limitReached);
    }
  }

  useEffect(() => {
    adoptAnonFromQuery();
    api(`/api/presentations/${encodeURIComponent(id)}`).then(async (res) => {
      if (!res.ok) {
        setState('failed');
        setMessage('This presentation doesn’t exist, or its 2-day link has expired.');
        return;
      }
      deck.current = (await res.json()) as ExportableDeck;
      setTitle(deck.current.title);
      run();
    });
  }, []);

  return (
    <main class="dl">
      <img class="dl__logo" src="/brand/bappa-logo.png" alt="BappaTutions" />
      <h1>{title || 'Download'}</h1>

      {state === 'preparing' && <p>Preparing your download…</p>}

      {state === 'done' && (
        <>
          <p class="dl__ok">Your download has started. {message}</p>
          <ol class="dl__steps">
            <li>Unzip the downloaded file.</li>
            <li>Open <strong>index.html</strong> in Chrome, Edge or Firefox — no internet needed.</li>
            <li>Keep the whole folder together: the pictures and sounds are inside it.</li>
          </ol>
        </>
      )}

      {state === 'failed' && (
        <>
          <p class="dl__error" role="alert">{message}</p>
          {canRetry && deck.current && (
            <button type="button" class="dl__btn" onClick={run}>Try again</button>
          )}
        </>
      )}
    </main>
  );
}
