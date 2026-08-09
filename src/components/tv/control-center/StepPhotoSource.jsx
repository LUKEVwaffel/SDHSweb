import { useState, useRef } from 'react';
import { P, mono, oswald, inter, sp, radius, shadow, ease } from '../../admin/theme.js';
import { useTvEventOptions } from '../../../hooks/useTvEventOptions.js';
import { uploadTvDailyPhoto, deleteTvDailyPhoto } from '../../../lib/tvDailyPhotos.js';

function ModeButton({ active, label, hint, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'left', padding: sp[4], borderRadius: radius.md,
        border: `1px solid ${active ? P.gold : P.hair}`, background: active ? P.goldWash : 'transparent',
        cursor: 'pointer', transition: `all 150ms ${ease}`,
      }}
    >
      <div style={{ fontFamily: oswald, fontSize: 16, color: active ? P.bright : P.cream, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: inter, fontSize: 12, color: P.mute, lineHeight: 1.4 }}>{hint}</div>
    </button>
  );
}

export default function StepPhotoSource({ featuredTeams, mode, eventId, uploadedUrls, onChange }) {
  const events = useTvEventOptions(featuredTeams);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingUrl, setDeletingUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleFiles = async (files) => {
    setUploadError('');
    setUploading(true);
    try {
      // allSettled, not all — a single RAW/undecodable file throws in the
      // resize step, and Promise.all would reject the whole batch and drop
      // every good photo with it.
      const results = await Promise.allSettled(Array.from(files).map(uploadTvDailyPhoto));
      const urls = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      if (urls.length) onChange({ mode: 'upload', uploadedUrls: [...uploadedUrls, ...urls] });
      const firstFail = results.find((r) => r.status === 'rejected');
      if (firstFail) setUploadError(firstFail.reason?.message || 'Some photos could not be added.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeUrl = async (url) => {
    setDeletingUrl(url);
    try {
      await deleteTvDailyPhoto(url);
    } finally {
      onChange({ uploadedUrls: uploadedUrls.filter((u) => u !== url) });
      setDeletingUrl(null);
    }
  };

  const revertToTeamPhotos = () => onChange({ mode: 'team', uploadedUrls: [] });

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
        PHOTO SOURCE
      </div>
      <div style={{ fontFamily: inter, fontSize: 14, color: P.mute, marginBottom: sp[5], lineHeight: 1.6 }}>
        Not sure? Leave this on "Team Photos" — it just shows what's already on file. You only need the other two if you want something different today.
      </div>

      <div style={{ display: 'flex', gap: sp[3], marginBottom: sp[5] }}>
        <ModeButton
          active={mode === 'team'} onClick={() => onChange({ mode: 'team' })}
          label="Team Photos" hint="Whatever's already on file for the featured team(s). Simplest option."
        />
        <ModeButton
          active={mode === 'event'} onClick={() => onChange({ mode: 'event' })}
          label="One Event" hint="Pick a single past event to show just its photos."
        />
        <ModeButton
          active={mode === 'upload'} onClick={() => onChange({ mode: 'upload' })}
          label="Upload New" hint="Add today's photos directly — drill photos, whatever's on hand."
        />
      </div>

      {mode === 'event' && (
        <select
          value={eventId ?? ''}
          onChange={(e) => onChange({ eventId: e.target.value || null })}
          style={{
            width: '100%', padding: sp[3], borderRadius: radius.md,
            border: `1px solid ${P.hair}`, background: P.deep, color: P.cream,
            fontFamily: inter, fontSize: 15,
          }}
        >
          <option value="">Select an event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.title} — {ev.date}</option>
          ))}
        </select>
      )}

      {mode === 'upload' && (
        <div>
          {uploadedUrls.length > 0 && (
            <button
              onClick={revertToTeamPhotos}
              style={{
                display: 'block', width: '100%', textAlign: 'center', marginBottom: sp[3],
                padding: sp[3], borderRadius: radius.md, border: `1px solid ${P.hair}`,
                background: 'transparent', color: P.gold, fontFamily: inter, fontSize: 13,
                cursor: 'pointer',
              }}
            >
              ↩ Done with these — switch back to Team Photos
            </button>
          )}

          <input
            ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={(e) => e.target.files.length && handleFiles(e.target.files)}
            style={{ display: 'none' }}
            id="tv-daily-upload-input"
          />
          <label
            htmlFor="tv-daily-upload-input"
            style={{
              display: 'block', textAlign: 'center', padding: sp[4], borderRadius: radius.md,
              border: `1px dashed ${P.hairStrong}`, color: P.mute, fontFamily: inter, fontSize: 14,
              cursor: 'pointer', marginBottom: sp[3],
            }}
          >
            {uploading ? 'Uploading…' : '+ Add photos'}
          </label>

          {uploadError && (
            <div style={{ fontFamily: inter, fontSize: 13, color: P.red, marginBottom: sp[3], lineHeight: 1.5 }}>
              {uploadError}
            </div>
          )}

          {uploadedUrls.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: sp[2] }}>
              {uploadedUrls.map((url) => (
                <div key={url} style={{ position: 'relative', aspectRatio: '1', borderRadius: radius.sm, overflow: 'hidden', boxShadow: shadow.sm, opacity: deletingUrl === url ? 0.4 : 1 }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button
                    onClick={() => removeUrl(url)}
                    disabled={deletingUrl === url}
                    aria-label="Remove photo"
                    style={{
                      position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 999,
                      background: 'rgba(6,16,31,0.8)', border: `1px solid ${P.hairStrong}`, color: P.cream,
                      fontSize: 12, lineHeight: 1, cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
