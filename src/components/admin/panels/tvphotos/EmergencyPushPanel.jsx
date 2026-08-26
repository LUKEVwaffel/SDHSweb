import { useState, useRef } from 'react';
import { updateTvDailySettings } from '../../../../hooks/useTvDailySettings';
import { uploadTvDailyPhoto, deleteTvDailyPhoto } from '../../../../lib/tvDailyPhotos';
import { P, mono, oswald, inter, fs, sp, radius } from '../../theme';
import { Btn, Label, Input, PanelHeader } from '../../shared/ui';

const TEXT_SIZES = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'huge', label: 'Big Lettering' },
];

// Broadcast feature: push text/photo/both to the live TV instantly, no
// reload, replacing the carousel + everything else with a full-takeover
// urgent treatment (see TvEmergencyOverlay). Open to ANY signed-in DISPATCH
// admin, no PIN/device gate (product decision: speed matters more than
// restriction here — whoever's on-site when practice gets cancelled needs
// to act immediately). Enforced server-side by the tv_daily_settings_guard
// trigger (is_admin()), not just this component being reachable — same
// split as the rest of DISPATCH's admin surfaces.
// Lives as a tab inside TvRemotePanel, so screenSlug tracks whichever
// screen is selected there (Outside/Range) instead of always targeting the
// default screen. `settings` is passed down from TvRemotePanel rather than
// fetched here — TvRemotePanel already holds a live useTvDailySettings
// subscription for the same screenSlug, and a second `useTvDailySettings`
// call here opened a duplicate `tv-daily-settings-live:${screenSlug}`
// channel with the same topic, which crashes ("cannot add postgres_changes
// callbacks... after subscribe()") because Supabase reuses the channel
// object for a topic it's already subscribed on.
export default function EmergencyPushPanel({ screenSlug = 'default', settings }) {
  const [header, setHeader] = useState('');
  const [text, setText] = useState('');
  const [textSize, setTextSize] = useState('huge');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef();

  const active = !!settings?.emergency_active;

  async function onPickPhoto(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadTvDailyPhoto(file);
      setPhotoUrl(url);
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    if (photoUrl) await deleteTvDailyPhoto(photoUrl);
    setPhotoUrl(null);
  }

  async function push() {
    setErr('');
    if (!text.trim() && !photoUrl) { setErr('Add text, a photo, or both before pushing.'); return; }
    setBusy(true);
    try {
      const { error } = await updateTvDailySettings({
        emergency_active: true,
        emergency_text: text.trim() || null,
        emergency_header: header.trim() || null,
        emergency_photo_url: photoUrl,
        emergency_text_size: textSize,
      }, screenSlug);
      if (error) setErr(error.message || 'Push failed.');
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      const { error } = await updateTvDailySettings({ emergency_active: false }, screenSlug);
      if (error) setErr(error.message || 'Clear failed.');
      else { setHeader(''); setText(''); setPhotoUrl(null); setTextSize('huge'); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <PanelHeader title="EMERGENCY PUSH" sub="Instantly replaces the live TV with an urgent message. No reload needed on the kiosk end." />

      {active && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[5],
          padding: sp[4], background: 'rgba(192,57,43,0.12)', border: `1px solid ${P.red}`, borderRadius: radius.md,
        }}>
          <div style={{ flex: 1, fontFamily: mono, fontSize: fs.xs, color: P.red, letterSpacing: '0.08em' }}>
            LIVE ON TV NOW — {settings.emergency_set_by}
          </div>
          <Btn onClick={clear} variant="danger" size="sm" disabled={busy}>CLEAR — BACK TO NORMAL</Btn>
        </div>
      )}

      <Label>HEADER (small, supplementary line)</Label>
      <div style={{ marginBottom: sp[4] }}>
        <Input value={header} onChange={(e) => setHeader(e.target.value)} placeholder={'e.g. "Practice resumes next Monday"'} />
      </div>

      <Label>MESSAGE</Label>
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder={'e.g. "PRACTICE CANCELLED"'}
        style={{
          width: '100%', resize: 'vertical', marginBottom: sp[4], padding: sp[3],
          background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm,
          color: P.cream, fontFamily: inter, fontSize: 15, lineHeight: 1.5,
        }}
      />

      <Label>TEXT SIZE</Label>
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
        {TEXT_SIZES.map((s) => (
          <button
            key={s.value}
            onClick={() => setTextSize(s.value)}
            style={{
              flex: 1, cursor: 'pointer', fontFamily: mono, fontSize: 10, letterSpacing: '0.06em', padding: '10px 6px', borderRadius: 5,
              background: textSize === s.value ? P.gold : 'transparent',
              color: textSize === s.value ? P.ink : P.mute,
              border: `1px solid ${textSize === s.value ? P.gold : P.hair}`,
            }}
          >
            {s.label.toUpperCase()}
          </button>
        ))}
      </div>

      <Label>PHOTO (optional)</Label>
      <div style={{ marginBottom: sp[5] }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickPhoto} />
        {photoUrl ? (
          <div style={{ position: 'relative', width: 200 }}>
            <img src={photoUrl} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 5 }} />
            <button onClick={removePhoto} style={{
              position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 999,
              background: 'rgba(6,16,31,0.8)', border: `1px solid ${P.hairStrong}`, color: P.cream, fontSize: 12, cursor: 'pointer',
            }}>×</button>
          </div>
        ) : (
          <Btn onClick={() => fileRef.current.click()} variant="ghost" size="sm" disabled={uploading}>{uploading ? 'UPLOADING…' : '+ ADD PHOTO'}</Btn>
        )}
      </div>

      {err && <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.red, marginBottom: sp[4], lineHeight: 1.6 }}>{err}</div>}

      <Btn onClick={push} variant="danger" size="md" disabled={busy}>{busy ? 'PUSHING…' : (active ? 'UPDATE LIVE MESSAGE' : 'PUSH TO TV NOW')}</Btn>

      <div style={{ fontFamily: oswald, fontSize: fs.xs, color: P.faint, marginTop: sp[5] }}>
        Preview — how this reads on the kiosk:
      </div>
      <div style={{
        marginTop: sp[2], background: P.ink, border: `1px solid ${P.hairStrong}`, borderRadius: radius.md,
        padding: sp[6], textAlign: 'center',
      }}>
        {header && <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[2] }}>{header.toUpperCase()}</div>}
        <div style={{ fontFamily: oswald, fontWeight: 600, color: P.cream, fontSize: textSize === 'huge' ? 32 : textSize === 'large' ? 24 : 18, lineHeight: 1.15 }}>
          {text || '(message text)'}
        </div>
      </div>
    </div>
  );
}
