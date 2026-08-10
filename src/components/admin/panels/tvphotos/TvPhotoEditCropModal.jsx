import { useState } from 'react';
import { sp } from '../../theme';
import { Btn, Modal } from '../../shared/ui';
import FocalPointPicker from './FocalPointPicker';

// Crop-only editor for an already-assigned photo — separate from
// TvPhotoAssignModal (which also collects folders/title on first upload) so
// re-cropping an existing tile is a one-click, one-field action instead of
// re-running the full assignment flow.
export default function TvPhotoEditCropModal({ photo, onSave, onCancel }) {
  const [focalX, setFocalX] = useState(photo.focal_x ?? 0.5);
  const [focalY, setFocalY] = useState(photo.focal_y ?? 0.5);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(focalX, focalY);
    setSaving(false);
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title="EDIT CROP"
      width={440}
      footer={
        <>
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={saving}>CANCEL</Btn>
          <Btn variant="gold" size="sm" onClick={handleSave} disabled={saving}>{saving ? 'SAVING…' : 'SAVE CROP'}</Btn>
        </>
      }
    >
      <div style={{ marginBottom: sp[1] }}>
        <FocalPointPicker src={photo.photo_url} focalX={focalX} focalY={focalY} onChange={(x, y) => { setFocalX(x); setFocalY(y); }} disabled={saving} />
      </div>
    </Modal>
  );
}
