import { signIn, signOut, type Me } from '../lib/auth';

interface Props {
  me: Me | null;
  onChange(): void; // signed in or out — the parent reloads what it shows
}

/** Who's signed in, or the button to sign in. Signing in is optional
 *  everywhere; it only lets a teacher keep presentations. */
export default function Account({ me, onChange }: Props) {
  if (!me) return null;
  return (
    <span class="account">
      <a href="/mine">My presentations</a>
      {me.user ? (
        <>
          <span class="account__who" title={me.user.email}>
            {me.user.name}
            {me.user.isAdmin && <span class="account__badge">admin</span>}
          </span>
          <button type="button" class="btn-quiet" onClick={async () => { await signOut(); onChange(); }}>
            Sign out
          </button>
        </>
      ) : (
        <button type="button" class="btn-quiet" onClick={async () => { if (await signIn()) onChange(); }}>
          Sign in with Google
        </button>
      )}
    </span>
  );
}
