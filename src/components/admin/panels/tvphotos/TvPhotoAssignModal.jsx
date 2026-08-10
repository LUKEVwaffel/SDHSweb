import { useState } from 'react';
import { P, mono, fs, sp } from '../../theme';
import { Btn, Label, Input, Modal } from '../../shared/ui';
import { resolveTvPhotoCaption } from '../../../../lib/tvPhotoCaption';
import FocalPointPicker from './FocalPointPicker';

// One popup per dropped/selected photo, shown in sequence by TvPhotosPanel's
// queue (never bulk-assign-then-edit — each photo gets its own folders +
// title before the next one appears). The photo's storage object already
// exists by the time this renders; onSave persists the tv_photos row,
// onCancel discards the storage object instead (see uploadTvPhotoFile /
// insertTvPhoto / deleteTvPhotoFile in lib/tvPhotosFolders.js — the table has
// no UPDATE policy, so deferring the DB insert until Save avoids needing one).
export default function TvPhotoAssignModal({ photo, folders: FOLDERS, defaultFolder, queuePosition, queueTotal, onSave, onCancel, busy }) {
  const [selected, setSelected] = useState(() => new Set([defaultFolder]));
  const [title, setTitle] = useState('');
  const [focalX, setFocalX] = useState(0.5);
  const [focalY, setFocalY] = useState(0.5);

  function toggleFolder(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const folders = Array.from(selected);
  const canSave = folders.length > 0 && !busy;
  const preview = resolveTvPhotoCaption({ title, folders });

  return (
    <Modal
      open
      onClose={onCancel}
      title={`ASSIGN PHOTO ${queuePosition}/${queueTotal}`}
      width={440}
      footer={
        <>
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy}>DISCARD</Btn>
          <Btn variant="gold" size="sm" onClick={() => onSave({ folders, title, focalX, focalY })} disabled={!canSave}>
            {busy ? 'SAVING…' : 'SAVE & CONTINUE'}
          </Btn>
        </>
      }
    >
      <div style={{ marginBottom: sp[4] }}>
        <Label>CROP <span style={{ color: P.mute, textTransform: 'none', letterSpacing: 0 }}>(shown at the /tv carousel's real aspect ratio)</span></Label>
        <FocalPointPicker src={photo.photoUrl} focalX={focalX} focalY={focalY} onChange={(x, y) => { setFocalX(x); setFocalY(y); }} disabled={busy} />
      </div>

      <Label>FOLDERS <span style={{ color: P.mute, textTransform: 'none', letterSpacing: 0 }}>(select at least one — a photo can belong to more than one)</span></Label>
      <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap', marginBottom: sp[4] }}>
        {FOLDERS.map((f) => {
          const active = selected.has(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => toggleFolder(f.id)}
              disabled={busy}
              style={{
                fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.08em', cursor: busy ? 'not-allowed' : 'pointer',
                padding: '8px 12px', borderRadius: 4,
                border: `1px solid ${active ? P.gold : P.hair}`,
                background: active ? P.gold : 'transparent',
                color: active ? P.ink : P.faint,
              }}
            >
              {active ? '✓ ' : ''}{f.label.toUpperCase()}
            </button>
          );
        })}
      </div>

      <Label>TITLE <span style={{ color: P.mute, textTransform: 'none', letterSpacing: 0 }}>(optional — shown as the caption on the live TV)</span></Label>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Rhea County Competition"
        disabled={busy}
        style={{ marginBottom: sp[3] }}
      />

      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.06em' }}>
        CAPTION PREVIEW: <span style={{ color: P.gold }}>{preview}</span>
      </div>
    </Modal>
  );
}
