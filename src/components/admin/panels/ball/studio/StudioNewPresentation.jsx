import { useState } from 'react';
import { makeDeck, makeSlide, THEMES } from '../../../../../lib/ballPresentation';
import StudioModal from './StudioModal';

export default function StudioNewPresentation({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [starter, setStarter] = useState('blank');
  const [theme, setTheme] = useState('midnight');

  function create(event) {
    event.preventDefault();
    if (!name.trim()) return;
    const next = { ...makeDeck(), name: name.trim(), theme };
    if (starter === 'blank') {
      next.slides = [makeSlide('title', { title: next.name, subtitle: '', eyebrow: '' })];
    }
    onCreate(next);
  }

  return <StudioModal title="New presentation" onClose={onClose}>
    <form onSubmit={create}>
      <div className="bs-modal-section">
        <label className="bs-field"><span>Presentation name</span><input required maxLength={150} value={name} onChange={event => setName(event.target.value)} placeholder="Team briefing, awards, class project…" /></label>
        <label className="bs-field"><span>Start with</span><select value={starter} onChange={event => setStarter(event.target.value)}><option value="blank">Blank presentation · one title slide</option><option value="ball">Military Ball starter · four slides</option></select></label>
        <label className="bs-field"><span>Theme</span><select value={theme} onChange={event => setTheme(event.target.value)}>{Object.entries(THEMES).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>
        <p className="bs-muted">Add slides, photos and speaker notes for any occasion. Your existing presentations stay saved.</p>
      </div>
      <div className="bs-row"><button type="button" onClick={onClose}>Cancel</button><button className="bs-primary" type="submit" disabled={!name.trim()}>Create presentation</button></div>
    </form>
  </StudioModal>;
}
