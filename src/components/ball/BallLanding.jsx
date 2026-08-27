import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../../lib/supabaseClient';
import { P, mono, oswald, inter } from '../admin/theme';

// Step 0 — public landing page. Reads ball_config directly (anon-readable,
// see ball_signup.sql SECTION 1). Not linked from nav/homepage yet — ball
// date/price aren't finalized, so this shows a "details coming soon" state
// until S-6 fills in ball_config from the admin panel, instead of a broken
// date. Sharp edges, no rounded corners, per the site's dress-code brief.
function fmtDate(d) {
  if (!d) return null;
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BallLanding() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(undefined); // undefined = loading
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: cfg }, { data: photos }] = await Promise.all([
        SB.from('ball_config').select('ball_date, ticket_price, signup_deadline').maybeSingle(),
        SB.from('ball_gallery').select('photo_url, caption').order('sort_order', { ascending: true }),
      ]);
      setConfig(cfg || null);
      setGallery(photos || []);
    })();
  }, []);

  const detailsReady = config && config.ball_date && config.ticket_price != null;

  return (
    <div style={{ minHeight: '100vh', background: P.ink, fontFamily: inter, color: P.cream }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '72px 24px 100px' }}>
        <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.3em', marginBottom: 14 }}>
          TROJAN BATTALION · JROTC
        </div>
        <h1 style={{ fontFamily: oswald, fontSize: 'clamp(2.2rem, 5vw, 3.6rem)', fontWeight: 600, letterSpacing: '0.02em', margin: 0, lineHeight: 1.05 }}>
          Military Ball
        </h1>

        {config === undefined ? (
          <div style={{ fontFamily: mono, fontSize: 13, color: P.mute, marginTop: 32 }}>LOADING…</div>
        ) : detailsReady ? (
          <div style={{ marginTop: 32, border: `1px solid ${P.hairStrong}`, background: P.navy, padding: '28px 28px' }}>
            <Row label="DATE" value={fmtDate(config.ball_date)} />
            <Row label="TICKET" value={`$${Number(config.ticket_price).toFixed(2)}`} />
            {config.signup_deadline && <Row label="SIGN UP BY" value={fmtDate(config.signup_deadline)} last />}
          </div>
        ) : (
          <div style={{ marginTop: 32, border: `1px solid ${P.hair}`, background: P.navy, padding: '28px 28px' }}>
            <div style={{ fontFamily: mono, fontSize: 13, color: P.mute, letterSpacing: '0.05em' }}>
              Details coming soon — date, ticket price, and signup deadline will be posted here.
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/ball/signup')}
          style={{
            marginTop: 28, background: P.gold, color: P.ink, border: 'none', cursor: 'pointer',
            fontFamily: mono, fontSize: 14, letterSpacing: '0.12em', fontWeight: 700,
            padding: '16px 32px',
          }}
        >
          START SIGNUP →
        </button>

        {gallery.length > 0 && (
          <div style={{ marginTop: 64 }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.2em', marginBottom: 14 }}>LAST YEAR</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {gallery.map((g, i) => (
                <div key={i} style={{ border: `1px solid ${P.hair}`, aspectRatio: '4/3', overflow: 'hidden', background: P.navy }}>
                  <img src={g.photo_url} alt={g.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${P.hair}` }}>
      <span style={{ fontFamily: mono, fontSize: 12, color: P.mute, letterSpacing: '0.14em' }}>{label}</span>
      <span style={{ fontFamily: oswald, fontSize: 16, color: P.cream }}>{value}</span>
    </div>
  );
}
