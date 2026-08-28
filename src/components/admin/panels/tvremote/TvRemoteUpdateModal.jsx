import { createPortal } from 'react-dom';
import { P, mono, oswald, inter, fs, sp, radius, shadow } from '../../theme';
import { Btn } from '../../shared/ui';
import { changelogSince } from '../../../../data/tvRemoteChangelog';

// "What's new" popup. Shows every changelog entry newer than the BC's
// last-seen version, newest first. Dismissing it acknowledges up to the
// latest version (handled by the caller's onAck).
export default function TvRemoteUpdateModal({ sinceVersion, onAck }) {
  const entries = changelogSince(sinceVersion);
  if (!entries.length) return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100, padding: sp[4],
      background: 'rgba(6,16,31,0.8)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 520, maxHeight: '86vh', overflowY: 'auto',
        background: P.navy, border: `1px solid ${P.gold}`, borderRadius: radius.lg,
        boxShadow: shadow.lg,
      }}>
        <div style={{ padding: `${sp[6]}px ${sp[6]}px ${sp[4]}px` }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[3] }}>
            TV REMOTE - WHAT&apos;S NEW
          </div>
          <div style={{ fontFamily: oswald, fontSize: fs.xl, color: P.cream, fontWeight: 600 }}>
            {entries.length === 1 ? 'A new update' : `${entries.length} new updates`}
          </div>
        </div>

        <div style={{ padding: `0 ${sp[6]}px ${sp[5]}px` }}>
          {entries.map((e) => (
            <div key={e.version} style={{
              padding: sp[5], marginBottom: sp[3], borderRadius: radius.md,
              background: P.deep, border: `1px solid ${P.hair}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: sp[3], marginBottom: sp[3] }}>
                <span style={{ fontFamily: inter, fontSize: fs.md, fontWeight: 700, color: P.bright }}>
                  {e.title}
                </span>
                <span style={{ fontFamily: mono, fontSize: 9, color: P.faint, letterSpacing: '0.1em', flexShrink: 0 }}>
                  {e.date}
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: sp[5], display: 'grid', gap: sp[2] }}>
                {e.points.map((p, idx) => (
                  <li key={idx} style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, lineHeight: 1.6 }}>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: sp[2],
          padding: `${sp[3]}px ${sp[6]}px`, borderTop: `1px solid ${P.hair}`, background: P.deep,
        }}>
          <Btn onClick={onAck} variant="gold" size="sm">GOT IT</Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
