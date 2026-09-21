import { useEffect, useState } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { getDeviceId } from '../lib/fingerprint';
import posthog from '../lib/posthog';

// Public, no-login, one-question poll: does the battalion want a Halloween
// Bash (costume party) this year? Self-contained route (own chrome, no
// TopNav/Footer — same bypass as /survey and /feedback) reached at
// /halloween. One vote per device via device_fp; storage in
// public.halloween_poll_votes (supabase/halloween_poll.sql).

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.82)', faint: 'rgba(244,236,216,0.66)',
  hair: 'rgba(201,169,97,0.22)',
};

const DONE_KEY = 'tb_halloween_poll_done';
const COMMENT_DONE_KEY = 'tb_halloween_poll_comment_done';

function hasVoted() {
  try { return localStorage.getItem(DONE_KEY); } catch { return null; }
}
function markVoted(choice) {
  try { localStorage.setItem(DONE_KEY, choice); } catch { /* non-fatal */ }
}
function hasCommented() {
  try { return localStorage.getItem(COMMENT_DONE_KEY) === '1'; } catch { return false; }
}
function markCommented() {
  try { localStorage.setItem(COMMENT_DONE_KEY, '1'); } catch { /* non-fatal */ }
}

async function fetchTally() {
  const { data, error } = await SB.from('halloween_poll_votes').select('choice');
  if (error || !data) return null;
  const yes = data.filter((r) => r.choice === 'yes').length;
  const no = data.filter((r) => r.choice === 'no').length;
  return { yes, no, total: yes + no };
}

export default function HalloweenPoll() {
  const [choice, setChoice] = useState(hasVoted());
  const [state, setState] = useState('idle'); // idle | busy | err
  const [errMsg, setErrMsg] = useState('');
  const [tally, setTally] = useState(null);
  const [comment, setComment] = useState('');
  const [commentSent, setCommentSent] = useState(hasCommented());
  const [commentState, setCommentState] = useState('idle'); // idle | busy | err
  const [commentErr, setCommentErr] = useState('');

  useEffect(() => {
    if (!choice) return;
    fetchTally().then(setTally);
  }, [choice]);

  async function vote(pick) {
    if (state === 'busy' || choice) return;
    setState('busy');
    setErrMsg('');
    const fp = await getDeviceId().catch(() => null);
    if (!fp) {
      setState('err');
      setErrMsg('Could not identify this device — please try again.');
      return;
    }
    const { error } = await SB.from('halloween_poll_votes').insert({ choice: pick, device_fp: fp });
    if (error) {
      setState('idle');
      setErrMsg(error.code === '23505' ? 'This device already voted.' : 'Could not submit — please try again.');
      if (error.code === '23505') { markVoted(pick); setChoice(pick); }
      return;
    }
    posthog.capture('halloween_poll_voted', { choice: pick });
    markVoted(pick);
    setChoice(pick);
    setState('idle');
  }

  async function sendComment(e) {
    e.preventDefault();
    if (commentState === 'busy' || commentSent || !comment.trim()) return;
    setCommentState('busy');
    setCommentErr('');
    const fp = await getDeviceId().catch(() => null);
    const { error } = await SB.from('halloween_poll_comments').insert({ comment: comment.trim(), device_fp: fp });
    if (error) {
      setCommentState('idle');
      setCommentErr(error.code === '23505' ? 'Already sent a comment from this device.' : 'Could not send — please try again.');
      if (error.code === '23505') { markCommented(); setCommentSent(true); }
      return;
    }
    posthog.capture('halloween_poll_commented');
    markCommented();
    setCommentSent(true);
    setCommentState('idle');
  }

  return (
    <Shell>
      <Centered>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: 14 }}>
          BATTALION POLL
        </div>
        <div style={{ fontSize: 34, marginBottom: 14 }}>🎃</div>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(22px, 6.5vw, 30px)', color: P.cream, fontWeight: 600, letterSpacing: '0.01em', margin: '0 0 12px', lineHeight: 1.2 }}>
          Do you want a Halloween Bash this year?
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: P.cream, maxWidth: 380, lineHeight: 1.65, margin: '0 0 30px' }}>
          Just a costume party — nothing fancy. Vote yes or no.
        </p>

        {!choice ? (
          <>
            <div style={{ display: 'flex', gap: 14 }}>
              <button type="button" disabled={state === 'busy'} onClick={() => vote('yes')} style={voteBtn(true)}>
                YES →
              </button>
              <button type="button" disabled={state === 'busy'} onClick={() => vote('no')} style={voteBtn(false)}>
                NO
              </button>
            </div>
            {errMsg && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#C0392B', marginTop: 16 }}>{errMsg}</div>}
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, color: P.gold, fontWeight: 600, marginBottom: 22 }}>
              You voted {choice === 'yes' ? 'YES ✓' : 'NO'}. Thanks!
            </div>
            {tally && tally.total > 0 && <ResultBar tally={tally} />}

            <div style={{ width: '100%', maxWidth: 380, marginTop: 34, paddingTop: 28, borderTop: `1px solid ${P.hair}` }}>
              {commentSent ? (
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.mute }}>
                  Got it — thanks for the idea! 🎉
                </div>
              ) : (
                <form onSubmit={sendComment}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: P.cream, fontWeight: 500, marginBottom: 10 }}>
                    What do you want to see at the bash? <span style={{ color: P.faint, fontWeight: 400, fontSize: 12 }}>(optional)</span>
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Music, games, food, costume contest…"
                    style={{
                      width: '100%', background: P.deep, border: `1px solid rgba(201,169,97,0.4)`, color: P.cream,
                      fontFamily: 'Inter, sans-serif', fontSize: 16, padding: '11px 13px', outline: 'none',
                      boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5,
                    }}
                  />
                  {commentErr && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#C0392B', marginTop: 10 }}>{commentErr}</div>}
                  <button
                    type="submit"
                    disabled={!comment.trim() || commentState === 'busy'}
                    style={{
                      marginTop: 14,
                      background: comment.trim() ? P.gold : 'transparent',
                      border: `1px solid ${comment.trim() ? P.gold : P.hair}`,
                      color: comment.trim() ? P.ink : P.faint,
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', fontWeight: 600,
                      padding: '11px 22px', cursor: comment.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {commentState === 'busy' ? 'SENDING…' : 'SEND IDEA →'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </Centered>
    </Shell>
  );
}

function ResultBar({ tally }) {
  const yesPct = Math.round((tally.yes / tally.total) * 100);
  return (
    <div style={{ width: '100%', maxWidth: 340 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.mute, marginBottom: 8, letterSpacing: '0.04em' }}>
        <span>YES {yesPct}%</span>
        <span>NO {100 - yesPct}%</span>
      </div>
      <div style={{ height: 10, background: P.hair, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: `${yesPct}%`, background: P.gold, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.faint, marginTop: 10, letterSpacing: '0.06em' }}>
        {tally.total} vote{tally.total === 1 ? '' : 's'} so far
      </div>
    </div>
  );
}

function voteBtn(isYes) {
  return {
    background: isYes ? P.gold : 'transparent',
    border: `1px solid ${isYes ? P.gold : P.hair}`,
    color: isYes ? P.ink : P.cream,
    fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: '0.12em', fontWeight: 600,
    padding: '15px 32px', cursor: 'pointer', minWidth: 120,
  };
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
