import RankInsignia from '../RankInsignia';
import { RANKS } from '../../../lib/boardRules';

// Grid of every rank with its insignia. Used before a board (RANKS tab) and
// as the first step of a sheet when a cadet has no rank on file.
const ENLISTED = RANKS.filter((r) => r.kind === 'enlisted');
const OFFICER = RANKS.filter((r) => r.kind === 'officer');

function Group({ title, ranks, value, onPick }) {
  return (
    <div>
      <div className="tb-label" style={{ margin: '4px 0 10px' }}>{title}</div>
      <div className="tb-promo" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}>
        {ranks.map((r) => (
          <button key={r.code} type="button" aria-pressed={value === r.code} onClick={() => onPick(r.code)} title={r.name}>
            <RankInsignia rank={r.code} size={30} title={false} />
            {r.code}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RankPicker({ value, onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Group title="Enlisted" ranks={ENLISTED} value={value} onPick={onPick} />
      <Group title="Officer" ranks={OFFICER} value={value} onPick={onPick} />
    </div>
  );
}
