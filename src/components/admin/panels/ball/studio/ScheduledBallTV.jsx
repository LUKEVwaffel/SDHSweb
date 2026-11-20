import { useCallback, useEffect, useState } from 'react';
import { supabase as SB } from '../../../../../lib/supabaseClient';
import { readDeck } from '../../../../../lib/ballPresentation';
import { CLOUD_DECK_PREFIX } from '../../../../../lib/ballStudioCloud';
import { resolveBallShow } from '../../../../../lib/ballPlayback';
import StudioPlayer from './StudioPlayer';

export default function ScheduledBallTV({ deckId, client = SB }) {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  const exit = useCallback(() => {
    const page = new URL(window.location.href);
    page.searchParams.delete('show');
    window.location.assign(page.href);
  }, []);

  useEffect(() => {
    let active = true;
    let busy = false;
    let revision = null;
    async function sync() {
      if (busy) return;
      busy = true;
      try {
        if (!/^[\da-f-]{36}$/i.test(deckId)) throw new Error('This presentation link is invalid.');
        const query = client.from('admin_settings').select('value,updated_at').eq('key', CLOUD_DECK_PREFIX + deckId);
        const { data, error } = await (revision ? query.gt('updated_at', revision).maybeSingle() : query.single());
        if (!active) return;
        if (error || (!revision && !data?.value)) throw new Error('Could not open the saved presentation. Check your connection and sign-in.');
        if (!data?.value) return;
        const deck = readDeck(data.value, { preserveSlideIds: true });
        const show = resolveBallShow(deck);
        if (!show?.preshowAt) throw new Error('This presentation has no scheduled preshow.');
        revision = data.updated_at;
        setLoaded(previous => ({ deck, pairOnOpen: previous?.pairOnOpen ?? (Date.now() < show.preshowAt) }));
        setError('');
      } catch (problem) {
        // Keep the last valid deck playing when the connection drops.
        if (active && !revision) setError(problem.message);
      } finally {
        busy = false;
      }
    }
    void sync();
    const interval = setInterval(sync, 5000);
    window.addEventListener('online', sync);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('online', sync);
    };
  }, [attempt, client, deckId]);

  if (loaded) return <StudioPlayer deck={loaded.deck} runShow scheduledTv pairOnOpen={loaded.pairOnOpen} onClose={exit} />;

  return <section className="ball-studio bs-scheduled-status">
    <h1>Scheduled Ball TV</h1>
    {error ? <>
      <p role="alert">{error}</p>
      <div className="bs-row"><button onClick={() => { setError(''); retry(value => value + 1); }}>Try again</button><button onClick={exit}>Back to Studio</button></div>
    </> : <p role="status">Opening the scheduled presentation…</p>}
  </section>;
}
