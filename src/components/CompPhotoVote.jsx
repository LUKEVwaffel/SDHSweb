import { useState, useEffect } from 'react';
import { getDeviceId } from '../lib/fingerprint';
import posthog from '../lib/posthog';
import { useCompPhotoPoll } from '../hooks/useCompPhotoPoll';
import {
  castCompVote, rankedCandidates, hasVotedComp, markVotedComp, COMP_POLL_EVENT_TITLE,
} from '../lib/compPhotoVote';
import { CONGRATS_MEET } from '../lib/tvCongratsData';

// Public, no-login "Picture of the Comp" ballot at /vote. Self-contained route
// (own chrome, no TopNav/Footer — same bypass as /survey). Luke picks ~15
// finalist photos in DISPATCH; the public taps one and submits with a name.
// One vote per device (fingerprint), enforced server-side by
// cast_comp_photo_vote. After voting closes Friday the winner is declared in
// DISPATCH and this page shows the podium.

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)', green: '#7EC87E', red: '#C0392B',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';
const inter = 'Inter, sans-serif';

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: P.ink, fontFamily: inter }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '52px 24px 96px' }}>{children}</div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{
      minHeight: '70vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12,
    }}>
      {children}
    </div>
  );
}

function Kicker({ children }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.32em', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function Standings({ candidates, highlightId }) {
  const ranked = rankedCandidates(candidates);
  const total = ranked.reduce((s, c) => s + c.voteCount, 0);
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.28em', marginBottom: 14 }}>
        // STANDINGS · {total} VOTE{total === 1 ? '' : 'S'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {ranked.map((c, i) => (
          <div key={c.id} style={{
            border: `1px solid ${c.id === highlightId ? P.gold : P.hair}`,
            background: P.navy, position: 'relative',
          }}>
            <div style={{ aspectRatio: '1 / 1', overflow: 'hidden', background: P.deep }}>
              <img src={c.thumbUrl} alt="" loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>#{i + 1}</span>
              <span style={{ fontFamily: oswald, fontSize: 16, color: P.cream }}>
                {c.voteCount}<span style={{ fontFamily: mono, fontSize: 8, color: P.mute }}> VOTES</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompPhotoVote() {
  const { poll, candidates, winner, isOpen, isClosed, loading, error, refresh } = useCompPhotoPoll();
  const [deviceId, setDeviceId] = useState(null);
  const [pick, setPick] = useState(null);
  const [name, setName] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | ok | err
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => { getDeviceId().then(setDeviceId).catch(() => setDeviceId(null)); }, []);

  // Re-checked on every render (cheap localStorage read) so it reflects a vote
  // cast this session. The state==='ok' branch renders before this is consulted.
  const alreadyVoted = hasVotedComp(poll?.id);

  async function submit(e) {
    e.preventDefault();
    if (!pick || !name.trim() || state === 'busy' || !poll) return;
    setState('busy');
    setErrMsg('');
    const { ok, error: voteErr } = await castCompVote({
      pollId: poll.id, candidateId: pick, name, deviceFp: deviceId,
    });
    if (!ok) {
      // Server says this device already voted — treat as a soft success so the
      // page moves on instead of trapping the visitor.
      if (/already voted/i.test(voteErr || '')) {
        markVotedComp(poll.id);
        setState('ok');
        await refresh();
        return;
      }
      setState('err');
      setErrMsg(voteErr || 'Could not record your vote — try again in a minute.');
      return;
    }
    posthog.capture('comp_photo_vote_cast', { poll_id: poll.id });
    markVotedComp(poll.id);
    setState('ok');
    await refresh();
  }

  if (loading) {
    return <Shell><Centered><div style={{ fontFamily: mono, fontSize: 10, color: P.mute, letterSpacing: '0.2em' }}>LOADING…</div></Centered></Shell>;
  }

  if (error) {
    return (
      <Shell><Centered>
        <Kicker>PICTURE OF THE COMP</Kicker>
        <div style={{ fontFamily: oswald, fontSize: 20, color: P.cream }}>Couldn&apos;t load the ballot</div>
        <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, maxWidth: 360 }}>{error}</div>
      </Centered></Shell>
    );
  }

  if (!poll || !candidates.length) {
    return (
      <Shell><Centered>
        <Kicker>PICTURE OF THE COMP</Kicker>
        <div style={{ fontFamily: oswald, fontSize: 22, color: P.cream }}>Voting isn&apos;t open yet</div>
        <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, maxWidth: 380, lineHeight: 1.6 }}>
          The finalist photos from {COMP_POLL_EVENT_TITLE} are still being chosen. Check back soon.
        </div>
      </Centered></Shell>
    );
  }

  // ── Closed ──────────────────────────────────────────────────────────────
  if (isClosed) {
    return (
      <Shell>
        <Kicker>PICTURE OF THE COMP · {CONGRATS_MEET.label.toUpperCase()}</Kicker>
        {winner ? (
          <>
            <h1 style={{ fontFamily: oswald, fontSize: 34, color: P.cream, fontWeight: 700, margin: '0 0 6px' }}>
              The winner
            </h1>
            <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: 20 }}>
              Voted Picture of the Comp — {winner.voteCount} vote{winner.voteCount === 1 ? '' : 's'}
              {winner.uploaderName ? ` · 📷 ${winner.uploaderName}` : ''}
            </div>
            <img src={winner.photoUrl || winner.thumbUrl} alt="Winning photo"
              style={{ width: '100%', maxHeight: '64vh', objectFit: 'contain', border: `1px solid ${P.hairStrong}`, background: P.deep }} />
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: oswald, fontSize: 30, color: P.cream, fontWeight: 700, margin: '0 0 6px' }}>
              Voting&apos;s closed
            </h1>
            <div style={{ fontFamily: inter, fontSize: 13, color: P.mute }}>
              The winner is being finalized — it&apos;ll show up here, on the home page, and on the JROTC TV.
            </div>
          </>
        )}
        <Standings candidates={candidates} highlightId={winner?.id} />
      </Shell>
    );
  }

  // ── Already voted on this device ────────────────────────────────────────
  if (state !== 'ok' && alreadyVoted) {
    return (
      <Shell>
        <Kicker>PICTURE OF THE COMP</Kicker>
        <h1 style={{ fontFamily: oswald, fontSize: 26, color: P.cream, fontWeight: 700, margin: '0 0 6px' }}>
          You&apos;ve already voted
        </h1>
        <div style={{ fontFamily: inter, fontSize: 13, color: P.mute }}>
          One vote per device. Here&apos;s where it stands right now.
        </div>
        <Standings candidates={candidates} />
      </Shell>
    );
  }

  // ── Thanks (just voted this session) ───────────────────────────────────
  if (state === 'ok') {
    return (
      <Shell>
        <Centered>
          <div style={{ fontSize: 34 }}>✓</div>
          <div style={{ fontFamily: oswald, fontSize: 22, color: P.cream, fontWeight: 600 }}>
            Vote counted{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ''}.
          </div>
          <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, maxWidth: 380, lineHeight: 1.6 }}>
            Voting closes Friday. The winning photo goes on the home page and every TV in the JROTC room.
          </div>
        </Centered>
        <Standings candidates={candidates} />
      </Shell>
    );
  }

  // ── Open ballot ────────────────────────────────────────────────────────
  const canSubmit = !!pick && !!name.trim() && state !== 'busy';

  return (
    <Shell>
      <Kicker>PICTURE OF THE COMP · {COMP_POLL_EVENT_TITLE.toUpperCase()}</Kicker>
      <h1 style={{ fontFamily: oswald, fontSize: 'clamp(30px, 5vw, 46px)', color: P.cream, fontWeight: 700, letterSpacing: '0.02em', margin: '0 0 12px', lineHeight: 1.05 }}>
        Pick the shot of the day
      </h1>
      <p style={{ fontFamily: inter, fontSize: 14.5, color: P.mute, lineHeight: 1.65, maxWidth: 560, margin: '0 0 8px' }}>
        {candidates.length} finalists from the competition. Tap your favorite, add your name, and submit.
        One vote per device — voting closes Friday.
      </p>
      {!isOpen && (
        <div style={{ fontFamily: mono, fontSize: 11, color: P.bright, letterSpacing: '0.06em', margin: '10px 0' }}>
          Voting is paused right now.
        </div>
      )}

      <form onSubmit={submit} style={{ marginTop: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {candidates.map((c) => {
            const on = pick === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setPick(c.id)}
                aria-pressed={on}
                style={{
                  border: `2px solid ${on ? P.gold : 'transparent'}`,
                  outline: on ? 'none' : `1px solid ${P.hair}`,
                  background: P.navy, padding: 0, cursor: 'pointer',
                  aspectRatio: '1 / 1', overflow: 'hidden', position: 'relative',
                }}
              >
                <img src={c.thumbUrl} alt="" loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {on && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6, background: P.gold, color: P.ink,
                    fontFamily: mono, fontSize: 9, letterSpacing: '0.08em', padding: '3px 7px',
                  }}>PICKED</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 26, maxWidth: 420 }}>
          <label htmlFor="voter-name" style={{ display: 'block', fontFamily: oswald, fontSize: 14, color: P.cream, marginBottom: 8 }}>
            Your name <span style={{ color: P.gold }}>*</span>
          </label>
          <input
            id="voter-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="First and last"
            autoComplete="name"
            style={{
              width: '100%', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
              fontFamily: inter, fontSize: 14, padding: '11px 13px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {errMsg && (
          <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: 14 }}>{errMsg}</div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            marginTop: 20, maxWidth: 420, width: '100%',
            background: canSubmit ? P.gold : 'transparent',
            border: `1px solid ${canSubmit ? P.gold : P.hair}`,
            color: canSubmit ? P.ink : 'rgba(244,236,216,0.4)',
            fontFamily: mono, fontSize: 12, letterSpacing: '0.16em', fontWeight: 700,
            padding: '15px 22px', cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {state === 'busy' ? 'SUBMITTING…' : 'SUBMIT VOTE →'}
        </button>
        {!pick && (
          <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(244,236,216,0.4)', letterSpacing: '0.06em', marginTop: 10 }}>
            Tap a photo first.
          </div>
        )}
      </form>
    </Shell>
  );
}
