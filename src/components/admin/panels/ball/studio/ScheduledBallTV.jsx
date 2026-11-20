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
    async function open() {
      try {
        if (!/^[\da-f-]{36}$/i.test(deckId)) throw new Error('This presentation link is invalid.');
        const { data, error } = await client.from('admin_settings').select('value').eq('key', CLOUD_DECK_PREFIX + deckId).single();
        if (error || !data?.value) throw new Error('Could not open the saved presentation. Check your connection and sign-in.');
        const deck = readDeck(data.value);
        const show = resolveBallShow(deck);
        if (!show?.preshowAt) throw new Error('This presentation has no scheduled preshow.');
        if (active) setLoaded({ deck, pairOnOpen: Date.now() < show.preshowAt });
      } catch (problem) {
        if (active) setError(problem.message);
      }
    }
    void open();
    return () => { active = false; };
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
