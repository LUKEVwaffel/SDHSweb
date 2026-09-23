import { useEffect, useState } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { getDeviceId } from '../lib/fingerprint';
import posthog from '../lib/posthog';

// Public, no-login, one-question poll: what movie should we watch at the
// Halloween Bash? Self-contained route (own chrome, no TopNav/Footer — same
// bypass as /survey and /feedback) reached at /halloweenmovie. Rating is
// restricted to PG / PG-13 via a required dropdown — no other options exist,
// so the constraint is enforced at submission. One suggestion per device via
// device_fp; storage in public.halloween_movie_suggestions
// (supabase/halloween_poll.sql).

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.82)', faint: 'rgba(244,236,216,0.66)',
  hair: 'rgba(201,169,97,0.22)',
};

const RATINGS = ['PG', 'PG-13'];
const DONE_KEY = 'tb_halloween_movie_poll_done';

function hasSubmitted() {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return false; }
}
function markSubmitted() {
  try { localStorage.setItem(DONE_KEY, '1'); } catch { /* non-fatal */ }
}

async function fetchSuggestions() {
  const { data, error } = await SB
    .from('halloween_movie_suggestions')
    .select('movie, rating, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return null;
  return data;
}

export default function HalloweenMoviePoll() {
  const [submitted, setSubmitted] = useState(hasSubmitted());
  const [movie, setMovie] = useState('');
  const [rating, setRating] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | err
  const [errMsg, setErrMsg] = useState('');
  const [suggestions, setSuggestions] = useState(null);

  useEffect(() => {
    if (!submitted) return;
    fetchSuggestions().then(setSuggestions);
  }, [submitted]);

  async function submit(e) {
    e.preventDefault();
    if (state === 'busy' || submitted || !movie.trim() || !RATINGS.includes(rating)) return;
    setState('busy');
    setErrMsg('');
    const fp = await getDeviceId().catch(() => null);
    if (!fp) {
      setState('idle');
      setErrMsg('Could not identify this device — please try again.');
      return;
    }
    const { error } = await SB.from('halloween_movie_suggestions').insert({
      movie: movie.trim(),
      rating,
      device_fp: fp,
    });
    if (error) {
      setState('idle');
      setErrMsg(error.code === '23505' ? 'This device already submitted a suggestion.' : 'Could not submit — please try again.');
      if (error.code === '23505') { markSubmitted(); setSubmitted(true); }
      return;
    }
    posthog.capture('halloween_movie_poll_submitted', { rating });
    markSubmitted();
    setSubmitted(true);
    setState('idle');
  }

  return (
    <Shell>
      <Centered>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: 14 }}>
          BATTALION POLL
        </div>
        <div style={{ fontSize: 34, marginBottom: 14 }}>🎃</div>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(22px, 6.5vw, 30px)', color: P.cream, fontWeight: 600, letterSpacing: '0.01em', margin: '0 0 12px', lineHeight: 1.2 }}>
          What should we watch at the bash?
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: P.cream, maxWidth: 380, lineHeight: 1.65, margin: '0 0 30px' }}>
          Suggest a movie for the Halloween Bash. PG or PG-13 only.
        </p>

        {!submitted ? (
          <form onSubmit={submit} style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              value={movie}
              onChange={(e) => setMovie(e.target.value)}
              maxLength={120}
              placeholder="Movie title"
              style={{
                width: '100%', background: P.deep, border: `1px solid rgba(201,169,97,0.4)`, color: P.cream,
                fontFamily: 'Inter, sans-serif', fontSize: 16, padding: '12px 14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              style={{
                width: '100%', background: P.deep, border: `1px solid rgba(201,169,97,0.4)`, color: rating ? P.cream : P.faint,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: '0.06em', padding: '12px 14px',
                outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
              }}
            >
              <option value="" disabled>RATING — PG OR PG-13</option>
              {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              type="submit"
              disabled={!movie.trim() || !rating || state === 'busy'}
              style={{
                background: movie.trim() && rating ? P.gold : 'transparent',
                border: `1px solid ${movie.trim() && rating ? P.gold : P.hair}`,
                color: movie.trim() && rating ? P.ink : P.faint,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.12em', fontWeight: 600,
                padding: '14px 22px', cursor: movie.trim() && rating ? 'pointer' : 'not-allowed',
              }}
            >
              {state === 'busy' ? 'SENDING…' : 'SUBMIT →'}
            </button>
            {errMsg && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#C0392B' }}>{errMsg}</div>}
          </form>
        ) : (
          <>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, color: P.gold, fontWeight: 600, marginBottom: 22 }}>
              Got it — thanks for the suggestion! 🎬
            </div>
            {suggestions && suggestions.length > 0 && <SuggestionList suggestions={suggestions} />}
          </>
        )}
      </Centered>
    </Shell>
  );
}

function SuggestionList({ suggestions }) {
  return (
    <div style={{ width: '100%', maxWidth: 380, textAlign: 'left' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.faint, letterSpacing: '0.1em', marginBottom: 12 }}>
        {suggestions.length} SUGGESTION{suggestions.length === 1 ? '' : 'S'} SO FAR
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
        {suggestions.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: P.deep, border: `1px solid ${P.hair}` }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.cream }}>{s.movie}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.06em', flexShrink: 0, alignSelf: 'center' }}>{s.rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: P.ink, fontFamily: 'Inter, sans-serif' }}>
      {children}
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      {children}
    </div>
  );
}
