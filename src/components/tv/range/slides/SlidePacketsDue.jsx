import { P, fraunces, inter, fs, sp } from '../../../admin/theme.js';
import { PACKET_DUE_COMPANIES } from './slideRegistry.js';
import PacketsDueBanner from '../PacketsDueBanner.jsx';

// Company-scoped packets-due reminder as its own full slide in Range's
// rotation playlist — same banner, same data source (useTvConsentDue) as the
// Welcome screen's reminder, but on rotation so it isn't limited to a
// company's brief welcome window. `config` carries the admin-selected
// company (one slide instance per company); staff isn't a selectable option
// here, matching PACKET_DUE_COMPANIES (staff gets its own copy on the Staff
// schedule screen).
export default function SlidePacketsDue({ config }) {
  const companyLabel = PACKET_DUE_COMPANIES.find((c) => c.id === config?.company)?.label ?? '';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: `${sp[12]}px ${sp[16]}px`, boxSizing: 'border-box', gap: sp[6],
    }}>
      <div style={{
        position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 240, pointerEvents: 'none',
        background: `radial-gradient(ellipse, ${P.goldWash} 0%, transparent 70%)`,
      }} />

      <div style={{
        position: 'relative', fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic',
        color: P.gold, fontSize: fs.md, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        {companyLabel} Company
      </div>

      <PacketsDueBanner company={config?.company} />
    </div>
  );
}
