import { useState } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono } from '../../theme';
import { Btn, Card, PanelHeader } from '../../shared/ui';

const TABLE_CHECKS = ['page_content', 'personnel', 'dispatch_pages', 'dispatch_registry', 'element_styles'];
const STORAGE_CHECKS = ['personnel-photos', 'site-assets'];
// Photos and videos are served from Cloudflare R2 through these Workers.
const R2_CHECKS = [
  { label: 'r2: photos', url: import.meta.env.VITE_OPTIC_R2_URL },
  { label: 'r2: media', url: import.meta.env.VITE_R2_MEDIA_BASE || 'https://r2-media-reader.sdhs-battalion.workers.dev' },
];

export default function HealthPanel() {
  const [checks, setChecks] = useState([]);
  const [running, setRunning] = useState(false);

  async function runChecks() {
    setRunning(true);
    setChecks([]);
    const results = [];
    const add = (label, status, detail) => results.push({ label, status, detail });

    for (const table of TABLE_CHECKS) {
      try {
        const { data, error } = await SB.from(table).select('*').limit(1);
        add(table, error ? 'FAIL' : 'PASS', error ? error.message : `${data?.length} rows`);
      } catch (e) { add(table, 'FAIL', e.message); }
    }

    for (const bucket of STORAGE_CHECKS) {
      try {
        const { error } = await SB.storage.from(bucket).list('', { limit: 1 });
        add(`storage: ${bucket}`, error ? 'FAIL' : 'PASS', error ? error.message : 'accessible');
      } catch (e) { add(`storage: ${bucket}`, 'FAIL', e.message); }
    }

    for (const { label, url } of R2_CHECKS) {
      if (!url) { add(label, 'FAIL', 'URL not set in env'); continue; }
      try {
        // Any answer (even 404 for the bare path) means the Worker is up.
        const res = await fetch(url.replace(/\/+$/, '') + '/', { method: 'HEAD' });
        add(label, res.status < 500 ? 'PASS' : 'FAIL', `HTTP ${res.status}`);
      } catch (e) { add(label, 'FAIL', e.message); }
    }

    setChecks(results);
    setRunning(false);
  }

  return (
    <div>
      <PanelHeader title="SITE HEALTH" action={<Btn onClick={runChecks} variant="gold" disabled={running} style={{ fontSize: 9 }}>{running?'RUNNING…':'RUN CHECKS'}</Btn>} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {checks.map((c, i) => (
          <Card key={i} style={{ padding: '8px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: mono, fontSize: 10, color: P.cream }}>{c.label}</span>
                <span style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginLeft: 10 }}>{c.detail}</span>
              </div>
              <span style={{ fontFamily: mono, fontSize: 9, color: c.status==='PASS' ? P.green : P.red, letterSpacing: '0.1em' }}>{c.status}</span>
            </div>
          </Card>
        ))}
        {!checks.length && !running && (
          <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', marginTop: 40 }}>CLICK RUN CHECKS</div>
        )}
      </div>
    </div>
  );
}
