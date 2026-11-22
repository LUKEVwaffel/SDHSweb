import { useStayAwake } from '../../hooks/useStayAwake.js';
import TvPreviewBadge from './TvPreviewBadge.jsx';
import TvRefreshNotice from './TvRefreshNotice.jsx';

/** Public /tv Veterans Day tribute. Keep wake lock and remote preview support. */
export default function TvKiosk() {
  useStayAwake();

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: '#071426' }}>
        <img
          src="/images/tv/veterans-thank-you.png"
          alt="Thank you, veterans. For your service. For your sacrifice. For our freedom. Veterans Day, November 11. Trojan Battalion."
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
      <TvPreviewBadge />
      <TvRefreshNotice />
    </>
  );
}
