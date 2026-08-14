import { useState, useEffect, useCallback } from 'react';
import { P, MONO, DISPLAY, BODY } from './creedShared';
import { GoldButton } from './CreedUi';
import ConfettiBurst from './ConfettiBurst';
import { COMPANIES, submitLeaderboardEntry, fetchLeaderboard, verifyCreedEligibility } from '../../lib/creedLeaderboard';

// Plausibility pre-filter, checked client-side before the real check below.
// Catches obviously-wrong birthdates without a round trip.
const MIN_AGE = 10;
const MAX_AGE = 20;

function ageFromBirthdate(isoDate) {
  const dob = new Date(isoDate);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Shown inside a game's ResultPanel when the run was a 100% clear — fires
// confetti once and offers a name+company leaderboard entry. LET level is a
// fixed constant sent by the client (see supabase/creed_leaderboard.sql for
// why: LET 1 is who this drill is for, LET 2-4 already know the creed).
export function PerfectScorePanel({ gameKey, gameLabel, metricLabel, metricValue }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [status, setStatus] = useState('idle'); // idle | verifying | saving | done | error | blocked
  const [ageError, setAgeError] = useState(false);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    if (!name.trim() || !company || !birthdate) return;
    const age = ageFromBirthdate(birthdate);
    if (age === null || age < MIN_AGE || age > MAX_AGE) {
      setAgeError(true);
      return;
    }
    setAgeError(false);
    setStatus('verifying');
    try {
      const eligible = await verifyCreedEligibility({ name, company, birthdate });
      if (!eligible) {
        setStatus('blocked');
        return;
      }
    } catch {
      setStatus('error');
      return;
    }
    setStatus('saving');
    try {
      await submitLeaderboardEntry({ cadetName: name, company, gameKey, gameLabel, metricLabel, metricValue });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, [name, company, birthdate, gameKey, gameLabel, metricLabel, metricValue]);

  return (
    <div style={{
      margin: '8px auto 48px', border: `1px solid ${P.hairlineStrong}`, background: P.navyDeep,
      padding: '22px 24px', maxWidth: 420, textAlign: 'center',
    }}>
      <ConfettiBurst active />
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.28em', color: P.gold, marginBottom: 8 }}>
        🎉 PERFECT SCORE
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, color: P.cream, marginBottom: 4 }}>
        MAKE THE LEADERBOARD
      </div>
      <div style={{
        display: 'inline-block', fontFamily: MONO, fontSize: 8, letterSpacing: '0.18em',
        color: P.gold, border: `1px solid ${P.hairline}`, padding: '3px 8px', margin: '8px 0 14px',
      }}>LET 1 CADETS ONLY</div>
      <div style={{ fontFamily: BODY, fontSize: 12, color: P.mute, marginBottom: 16, lineHeight: 1.5 }}>
        This board is for incoming LET 1 cadets learning the creed for the first time — LET 2-4 already know it.
      </div>

      {status === 'done' ? (
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', color: P.correct }}>
          ✓ ADDED TO THE LEADERBOARD
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            maxLength={60}
            style={{
              background: 'rgba(0,0,0,0.3)', border: `1px solid ${P.hairlineStrong}`,
              color: P.cream, fontFamily: BODY, fontSize: 14, padding: '10px 12px', outline: 'none',
            }}
          />
          <select
            value={company}
            onChange={e => setCompany(e.target.value)}
            style={{
              background: 'rgba(0,0,0,0.3)', border: `1px solid ${P.hairlineStrong}`,
              color: company ? P.cream : P.mute, fontFamily: BODY, fontSize: 14, padding: '10px 12px', outline: 'none',
            }}
          >
            <option value="">Company…</option>
            {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontFamily: MONO, fontSize: 8, letterSpacing: '0.14em', color: P.mute, marginBottom: 4 }}>
              VERIFY YOUR BIRTHDATE
            </label>
            <input
              type="date"
              value={birthdate}
              onChange={e => { setBirthdate(e.target.value); setAgeError(false); }}
              style={{
                width: '100%', background: 'rgba(0,0,0,0.3)', border: `1px solid ${P.hairlineStrong}`,
                color: P.cream, fontFamily: BODY, fontSize: 14, padding: '10px 12px', outline: 'none',
              }}
            />
          </div>
          <GoldButton disabled={!name.trim() || !company || !birthdate || status === 'verifying' || status === 'saving'}>
            {status === 'verifying' ? 'VERIFYING…' : status === 'saving' ? 'SAVING…' : 'ADD ME'}
          </GoldButton>
          {ageError && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: P.red }}>
              That birthdate doesn't look like a LET 1 cadet — double check it.
            </div>
          )}
          {status === 'blocked' && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: P.red }}>
              Dispatch records show you're LET 2-4 — this board is for LET 1 cadets only.
            </div>
          )}
          {status === 'error' && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: P.red }}>Couldn't save — try again.</div>
          )}
        </form>
      )}
    </div>
  );
}

// Full leaderboard listing — opened from the hub.
export default function CreedLeaderboardBoard({ onBack }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchLeaderboard().then(setEntries).catch(() => setError(true));
  }, []);

  return (
    <div style={{ background: P.ink, minHeight: '100vh' }}>
      <div style={{
        background: `linear-gradient(180deg, ${P.navy} 0%, ${P.navyDeep} 100%)`,
        borderBottom: `1px solid ${P.hairline}`, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: P.gold, fontFamily: MONO, fontSize: 10, letterSpacing: '0.28em', padding: 0,
        }}>← GAMES</button>
        <div style={{ width: 1, height: 20, background: P.hairline }} />
        <div style={{ color: P.cream, fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, letterSpacing: '0.14em' }}>
          LEADERBOARD · LET 1
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 64px' }}>
        {error && (
          <div style={{ fontFamily: BODY, fontSize: 13, color: P.mute }}>Couldn't load the leaderboard.</div>
        )}
        {!error && entries === null && (
          <div style={{ fontFamily: BODY, fontSize: 13, color: P.mute }}>Loading…</div>
        )}
        {entries && entries.length === 0 && (
          <div style={{ fontFamily: BODY, fontSize: 13, color: P.mute }}>No perfect scores yet — be the first.</div>
        )}
        {entries && entries.map(e => (
          <div key={e.id} style={{
            border: `1px solid ${P.hairline}`, background: P.navyDeep,
            padding: '14px 16px', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, color: P.cream }}>{e.cadet_name}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: P.gold, opacity: 0.7, marginTop: 2 }}>
                {e.company} · {e.game_label.toUpperCase()}
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: P.correct, whiteSpace: 'nowrap' }}>
              {e.metric_value} {e.metric_label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
