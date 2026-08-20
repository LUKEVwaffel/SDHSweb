import { useEffect } from 'react';
import { P, fraunces, inter, fs, sp } from '../../../admin/theme.js';
import { RAIDER_CONGRATS_COMPANIES } from './slideRegistry.js';
import { useRaiderCongrats, matchesForCompany } from '../../../../hooks/useRaiderCongrats.js';
import RaiderCongratsBanner from '../RaiderCongratsBanner.jsx';

// Company-scoped version of RaiderCongratsBanner.jsx's Welcome-screen usage —
// same banner, same data source (useRaiderCongrats), but as its own full
// slide in Range's rotation playlist so each company can get one instead of
// only seeing their teammates during their brief welcome window. `config`
// carries the admin-selected company (one slide instance per company);
// staff isn't a selectable option here, matching RAIDER_CONGRATS_COMPANIES.
export default function SlideRaiderCongrats({ config, onEmpty }) {
  const { matches, loading } = useRaiderCongrats();
  const companyCongrats = matchesForCompany(matches, config?.company);
  const companyLabel = RAIDER_CONGRATS_COMPANIES.find((c) => c.id === config?.company)?.label ?? '';

  useEffect(() => {
    if (loading || companyCongrats.length) return undefined;
    const id = setTimeout(() => onEmpty?.(), 1500);
    return () => clearTimeout(id);
  }, [loading, companyCongrats.length, onEmpty]);

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

      <RaiderCongratsBanner matches={companyCongrats} />
    </div>
  );
}
