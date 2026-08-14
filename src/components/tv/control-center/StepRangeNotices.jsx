import { useState } from 'react';
import { P, mono, inter, fs, sp, radius, shadow, ease } from '../../admin/theme.js';
import { useTvNotices } from '../../../hooks/useTvNotices.js';
import { createTvNotice, updateTvNotice, deleteTvNotice } from '../../../lib/tvNotices.js';
import RichTextField from '../range/rangeGrid/RichTextField.jsx';
import { RenderRuns, runsToPlainText, runsToStorageString, storageStringToRuns } from '../range/rangeGrid/richText.jsx';

const TITLE_MAX = 80;
const MESSAGE_MAX = 280;

const fieldBaseStyle = {
  width: '100%', padding: sp[3], borderRadius: radius.sm,
  border: `1px solid ${P.hair}`, background: P.deep, color: P.cream,
  fontFamily: inter, fontSize: 14, boxSizing: 'border-box',
};

function NewEntryForm({ onSubmit, saving }) {
  const [title, setTitle] = useState([]);
  const [message, setMessage] = useState([]);

  async function submit() {
    const titlePlain = runsToPlainText(title).trim();
    const messagePlain = runsToPlainText(message).trim();
    if (!titlePlain || !messagePlain) return;
    await onSubmit({ title: runsToStorageString(title), message: runsToStorageString(message) });
    setTitle([]);
    setMessage([]);
  }

  const canSubmit = !!runsToPlainText(title).trim() && !!runsToPlainText(message).trim();

  return (
    <div style={{
      padding: sp[5], borderRadius: radius.lg,
      background: `linear-gradient(160deg, ${P.goldWash}, transparent)`,
      border: `1px solid ${P.hairStrong}`, boxShadow: shadow.md, marginBottom: sp[5],
    }}>
      <label style={{ display: 'block', fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[2] }}>
        TITLE
      </label>
      <RichTextField
        value={title}
        onChange={setTitle}
        maxLength={TITLE_MAX}
        placeholder="Uniform inspection Friday"
        baseStyle={{ ...fieldBaseStyle, marginBottom: sp[4] }}
      />

      <label style={{ display: 'block', fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[2] }}>
        MESSAGE
      </label>
      <RichTextField
        multiline
        value={message}
        onChange={setMessage}
        maxLength={MESSAGE_MAX}
        placeholder="Full Class B uniform inspection this Friday during 6th period."
        baseStyle={{ ...fieldBaseStyle, minHeight: '4.2em', marginBottom: sp[4] }}
      />

      <button
        onClick={submit}
        disabled={saving || !canSubmit}
        style={{
          padding: `${sp[3]}px ${sp[5]}px`, borderRadius: radius.sm, border: 'none',
          background: P.gold, color: P.ink, fontFamily: mono, fontSize: fs.xs,
          letterSpacing: '0.1em', cursor: saving ? 'default' : 'pointer',
          opacity: saving || !canSubmit ? 0.5 : 1,
          transition: `opacity 150ms ${ease}`,
        }}
      >
        {saving ? 'ADDING…' : '+ ADD'}
      </button>
    </div>
  );
}

function ExistingEntry({ entry, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(() => storageStringToRuns(entry.title));
  const [message, setMessage] = useState(() => storageStringToRuns(entry.message));
  const [busy, setBusy] = useState(false);

  function startEditing() {
    setTitle(storageStringToRuns(entry.title));
    setMessage(storageStringToRuns(entry.message));
    setEditing(true);
  }

  async function save() {
    const titlePlain = runsToPlainText(title).trim();
    const messagePlain = runsToPlainText(message).trim();
    if (!titlePlain || !messagePlain) return;
    setBusy(true);
    await onSave(entry.id, { title: runsToStorageString(title), message: runsToStorageString(message) });
    setBusy(false);
    setEditing(false);
  }

  async function remove() {
    setBusy(true);
    await onDelete(entry.id);
    setBusy(false);
  }

  if (editing) {
    return (
      <div style={{ padding: sp[4], borderRadius: radius.md, border: `1px solid ${P.hairStrong}`, marginBottom: sp[3] }}>
        <RichTextField value={title} onChange={setTitle} maxLength={TITLE_MAX} baseStyle={{ ...fieldBaseStyle, marginBottom: sp[3] }} />
        <RichTextField multiline value={message} onChange={setMessage} maxLength={MESSAGE_MAX} baseStyle={{ ...fieldBaseStyle, minHeight: '4.2em', marginBottom: sp[3] }} />
        <div style={{ display: 'flex', gap: sp[2] }}>
          <button onClick={save} disabled={busy || !runsToPlainText(title).trim() || !runsToPlainText(message).trim()} style={{
            padding: `${sp[2]}px ${sp[4]}px`, borderRadius: radius.sm, border: 'none',
            background: P.gold, color: P.ink, fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em', cursor: 'pointer',
          }}>
            SAVE
          </button>
          <button onClick={() => setEditing(false)} style={{
            padding: `${sp[2]}px ${sp[4]}px`, borderRadius: radius.sm, border: `1px solid ${P.hair}`,
            background: 'transparent', color: P.mute, fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em', cursor: 'pointer',
          }}>
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: sp[3],
      padding: sp[4], borderRadius: radius.md, border: `1px solid ${P.hair}`, marginBottom: sp[3],
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: inter, fontSize: fs.base, fontWeight: 700, color: P.cream, marginBottom: 2 }}>
          <RenderRuns runs={storageStringToRuns(entry.title)} />
        </div>
        <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, lineHeight: 1.5 }}>
          <RenderRuns runs={storageStringToRuns(entry.message)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: sp[2], flexShrink: 0 }}>
        <button onClick={startEditing} disabled={busy} style={{
          padding: `${sp[2]}px ${sp[3]}px`, borderRadius: radius.sm, border: `1px solid ${P.hair}`,
          background: 'transparent', color: P.mute, fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em', cursor: 'pointer',
        }}>
          EDIT
        </button>
        <button onClick={remove} disabled={busy} style={{
          padding: `${sp[2]}px ${sp[3]}px`, borderRadius: radius.sm, border: `1px solid ${P.red}`,
          background: 'transparent', color: P.red, fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em', cursor: 'pointer',
        }}>
          DELETE
        </button>
      </div>
    </div>
  );
}

/**
 * Add/edit/delete UI for tv_notices, reused for both Announcements and Staff
 * Notes (same shape, see supabase/tv_notices.sql) — `category` is the only
 * thing that differs between the two tabs in TvRemotePanel.jsx. Writes
 * immediately on each action (not batched into TV Remote's Save button) since
 * this is a list with its own per-row lifecycle, not a scalar settings patch —
 * useTvNotices' realtime subscription reflects every change straight back.
 *
 * title/message are stored as rich-text run JSON (richText.js) inside the
 * existing `text` columns — no schema change, since a text column happily
 * holds a JSON string. storageStringToRuns falls back to plain text for any
 * notice written before this shipped, so nothing existing breaks.
 */
export default function StepRangeNotices({ screenSlug, category, heading, blurb }) {
  const { notices, loading } = useTvNotices(screenSlug);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const entries = notices.filter((n) => n.category === category);

  async function handleCreate({ title, message }) {
    setAdding(true);
    setError(null);
    const { error: err } = await createTvNotice({ screenSlug, category, title, message });
    setAdding(false);
    if (err) setError(err.message || 'Could not add — try again.');
  }

  async function handleSave(id, patch) {
    const { error: err } = await updateTvNotice(id, patch);
    if (err) setError(err.message || 'Could not save — try again.');
  }

  async function handleDelete(id) {
    const { error: err } = await deleteTvNotice(id);
    if (err) setError(err.message || 'Could not delete — try again.');
  }

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
        {heading}
      </div>
      <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[5], lineHeight: 1.5 }}>
        {blurb} Select any text below to bold, italicize, underline, or color it.
      </div>

      <NewEntryForm onSubmit={handleCreate} saving={adding} />

      {error && (
        <div style={{ marginBottom: sp[4], fontFamily: inter, fontSize: 13, color: P.red }}>{error}</div>
      )}

      {loading ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute }}>LOADING…</div>
      ) : entries.length ? (
        entries.map((entry) => (
          <ExistingEntry key={entry.id} entry={entry} onSave={handleSave} onDelete={handleDelete} />
        ))
      ) : (
        <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint, fontStyle: 'italic' }}>Nothing posted yet.</div>
      )}
    </div>
  );
}
