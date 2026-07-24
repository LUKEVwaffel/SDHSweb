import { useRef, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase as SB } from '../../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp, radius, shadow, ease } from '../../../theme';
import { Label } from '../../../shared/ui';
import { BLOCK_TYPES, makeBlock, blockLabel } from './blocks';
import BlockFields from './BlockFields';
import { blocksToHtml } from '../emailRender';

const ATTACH_BUCKET = 'email-attachments';
const MAX_ATTACH = 8 * 1024 * 1024;

// One draggable, editable block row.
function SortableBlock({ block, index, count, update, remove, move, onPickAttachment, uploading, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    background: P.navy, border: `1px solid ${isDragging ? P.gold : P.hair}`,
    borderRadius: radius.md, boxShadow: isDragging ? shadow.lg : 'none',
    opacity: isDragging ? 0.9 : 1, marginBottom: sp[2],
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], padding: `${sp[2]}px ${sp[3]}px`, borderBottom: `1px solid ${P.hair}` }}>
        <span
          {...(disabled ? {} : { ...attributes, ...listeners })}
          style={{ cursor: disabled ? 'default' : 'grab', color: P.faint, fontSize: fs.md, lineHeight: 1, userSelect: 'none', touchAction: 'none' }}
          title="Drag to reorder"
        >⠿</span>
        <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.gold, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{blockLabel(block.type)}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={() => move(index, index - 1)} disabled={disabled || index === 0} style={arrowStyle(disabled || index === 0)} title="Move up">▲</button>
          <button onClick={() => move(index, index + 1)} disabled={disabled || index === count - 1} style={arrowStyle(disabled || index === count - 1)} title="Move down">▼</button>
          <button onClick={() => remove(block.id)} disabled={disabled} style={{ ...arrowStyle(disabled), color: P.red }} title="Delete block">×</button>
        </div>
      </div>
      <div style={{ padding: sp[3] }}>
        <BlockFields block={block} update={(patch) => update(block.id, patch)} onPickAttachment={() => onPickAttachment(block.id)} uploading={uploading === block.id} />
      </div>
    </div>
  );
}

function arrowStyle(disabled) {
  return {
    background: 'transparent', border: `1px solid ${P.hair}`, borderRadius: 4,
    color: disabled ? P.faint : P.mute, cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: fs.micro, width: 22, height: 22, lineHeight: 1, opacity: disabled ? 0.4 : 1,
  };
}

export default function EmailBuilder({ blocks, onChange, subject = '', messageId, disabled = false }) {
  const [uploading, setUploading] = useState(null);
  const pendingBlockId = useRef(null);
  const fileRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const list = blocks || [];

  function add(type) {
    if (disabled) return;
    onChange([...list, makeBlock(type)]);
  }
  function update(id, patch) {
    onChange(list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function remove(id) {
    onChange(list.filter((b) => b.id !== id));
  }
  function move(from, to) {
    if (to < 0 || to >= list.length) return;
    onChange(arrayMove(list, from, to));
  }
  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = list.findIndex((b) => b.id === active.id);
    const to = list.findIndex((b) => b.id === over.id);
    if (from !== -1 && to !== -1) onChange(arrayMove(list, from, to));
  }

  function onPickAttachment(blockId) {
    pendingBlockId.current = blockId;
    fileRef.current?.click();
  }
  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const blockId = pendingBlockId.current;
    if (!file || !blockId) return;
    if (file.size > MAX_ATTACH) { update(blockId, { uploadError: 'File exceeds 8 MB' }); return; }
    setUploading(blockId);
    const path = `${messageId || 'draft'}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const { error } = await SB.storage.from(ATTACH_BUCKET).upload(path, file, { upsert: true });
    if (error) {
      setUploading(null);
      update(blockId, { uploadError: error.message });
      return;
    }
    const url = SB.storage.from(ATTACH_BUCKET).getPublicUrl(path).data.publicUrl;
    setUploading(null);
    update(blockId, { url, filename: file.name, size: file.size, uploadError: undefined });
  }

  const previewHtml = blocksToHtml(list, { subject });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: sp[4], alignItems: 'start' }}>
      {/* ---- composer ---- */}
      <div>
        <Label>Add element</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[2], marginBottom: sp[4] }}>
          {BLOCK_TYPES.map((t) => (
            <button key={t.type} onClick={() => add(t.type)} disabled={disabled} style={{
              display: 'flex', alignItems: 'center', gap: 7, background: P.deep,
              border: `1px solid ${P.hair}`, borderRadius: radius.sm, color: disabled ? P.faint : P.cream,
              cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: mono, fontSize: fs.tiny,
              letterSpacing: '0.08em', padding: '9px 12px', transition: `all 0.14s ${ease}`,
            }}
              onMouseEnter={(ev) => { if (!disabled) { ev.currentTarget.style.borderColor = P.gold; ev.currentTarget.style.color = P.bright; } }}
              onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = P.hair; ev.currentTarget.style.color = disabled ? P.faint : P.cream; }}
            >
              <span style={{ color: P.gold, fontSize: fs.sm, width: 14, textAlign: 'center' }}>{t.icon}</span>
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>

        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onFileChosen}
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt" />

        {list.length === 0 ? (
          <div style={{
            border: `1px dashed ${P.hairStrong}`, borderRadius: radius.md, background: P.goldWash,
            padding: `${sp[10]}px ${sp[6]}px`, textAlign: 'center',
          }}>
            <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, letterSpacing: '0.14em' }}>EMPTY EMAIL</div>
            <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint, marginTop: sp[2] }}>Add elements above to start building. Drag the ⠿ handle to reorder.</div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={list.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {list.map((b, i) => (
                <SortableBlock key={b.id} block={b} index={i} count={list.length}
                  update={update} remove={remove} move={move}
                  onPickAttachment={onPickAttachment} uploading={uploading} disabled={disabled} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ---- live preview ---- */}
      <div style={{ position: 'sticky', top: 0 }}>
        <Label>Live preview · exactly what sends</Label>
        <div style={{ border: `1px solid ${P.hair}`, borderRadius: radius.md, overflow: 'hidden', background: P.ink }}>
          <iframe title="Email preview" srcDoc={previewHtml} style={{ width: '100%', height: 560, border: 'none', display: 'block', background: P.ink }} />
        </div>
      </div>
    </div>
  );
}
