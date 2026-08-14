import { useState, useId } from 'react';
import { P, mono, oswald, fs, sp, radius } from '../../../admin/theme.js';
import { uploadTvDailyPhoto, deleteTvDailyPhoto } from '../../../../lib/tvDailyPhotos.js';

function Placeholder({ children }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: sp[3],
      background: `repeating-linear-gradient(135deg, ${P.deep} 0px, ${P.deep} 12px, ${P.navy} 12px, ${P.navy} 13px)`,
    }}>
      <svg width="40" height="40" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.28 }}>
        <rect x="6" y="10" width="36" height="28" rx="2" stroke={P.gold} strokeWidth="1.2" />
        <circle cx="17" cy="20" r="3.5" stroke={P.gold} strokeWidth="1.2" />
        <path d="M6 32 L17 22 L26 30 L34 20 L42 30" stroke={P.gold} strokeWidth="1.2" fill="none" />
      </svg>
      {children}
    </div>
  );
}

/**
 * Single uploaded photo + editable title — distinct from the `photo` kind's
 * team/event/upload-sourced rotating carousel. Storage/state live entirely
 * on the tile itself (`data.photoUrl`/`data.photoTitle`), reusing the same
 * upload helper StepPhotoSource.jsx already uses for daily kiosk photos
 * (src/lib/tvDailyPhotos.js) — same bucket, no new RLS needed.
 */
export default function RangeGridPhotoSingle({ style, data, editable, onUpdateTile }) {
  const [uploading, setUploading] = useState(false);
  const inputId = useId();
  const photoUrl = data?.photoUrl ?? null;
  const title = data?.photoTitle ?? '';

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadTvDailyPhoto(file);
      const prev = data?.photoUrl;
      onUpdateTile?.({ data: { ...data, photoUrl: url } });
      if (prev) deleteTvDailyPhoto(prev);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    if (data?.photoUrl) deleteTvDailyPhoto(data.photoUrl);
    onUpdateTile?.({ data: { ...data, photoUrl: null } });
  }

  const titleStyle = {
    fontFamily: style?.fontFamily ?? oswald, fontSize: style?.fontSize ?? fs.xl,
    fontWeight: style?.bold ? 700 : 600, color: P.cream,
    letterSpacing: '0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.6)',
  };

  if (editable) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {photoUrl ? (
          <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Placeholder>
            <span style={{ fontFamily: mono, fontSize: 9, color: `${P.gold}aa`, letterSpacing: '0.24em' }}>NO PHOTO SET</span>
          </Placeholder>
        )}

        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', gap: sp[2], padding: sp[3],
          background: 'linear-gradient(to top, rgba(6,16,31,0.88) 0%, rgba(6,16,31,0.35) 55%, transparent 80%)',
        }}>
          <input
            value={title}
            onChange={(e) => onUpdateTile?.({ data: { ...data, photoTitle: e.target.value } })}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Widget title…"
            style={{
              width: '100%', background: 'rgba(6,16,31,0.6)', border: `1px solid ${P.hairStrong}`,
              borderRadius: radius.sm, color: P.cream, fontFamily: oswald, fontSize: 13,
              padding: '6px 8px', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: sp[2] }}>
            <input
              id={inputId} type="file" accept="image/*"
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ display: 'none' }}
            />
            <label
              htmlFor={inputId}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                flex: 1, textAlign: 'center', padding: '6px 10px', borderRadius: radius.sm,
                border: `1px dashed ${P.hairStrong}`, color: P.gold, fontFamily: mono, fontSize: 10,
                letterSpacing: '0.1em', cursor: 'pointer',
              }}
            >
              {uploading ? 'UPLOADING…' : photoUrl ? 'REPLACE PHOTO' : '+ UPLOAD PHOTO'}
            </label>
            {photoUrl && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={removePhoto}
                style={{
                  padding: '6px 10px', borderRadius: radius.sm, border: `1px solid ${P.hairStrong}`,
                  background: 'transparent', color: P.mute, fontFamily: mono, fontSize: 10, cursor: 'pointer',
                }}
              >
                REMOVE
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!photoUrl) {
    return <Placeholder>{title && <span style={titleStyle}>{title}</span>}</Placeholder>;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img src={photoUrl} alt={title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {title && (
        <>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(to top, rgba(6,16,31,0.85) 0%, rgba(6,16,31,0.15) 35%, transparent 55%)',
          }} />
          <div style={{ position: 'absolute', bottom: sp[3], left: sp[3], right: sp[3] }}>
            <span style={titleStyle}>{title}</span>
          </div>
        </>
      )}
    </div>
  );
}
