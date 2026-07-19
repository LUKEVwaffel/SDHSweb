import { useState } from 'react';
import { P, mono, inter } from '../../theme';
import { Card, Label, PanelHeader } from '../../shared/ui';

export default function DesignTokensPanel() {
  const colors = [
    { name: 'ink', hex: '#06101F', desc: 'Page BG' },
    { name: 'navy', hex: '#142847', desc: 'Card BG' },
    { name: 'deep', hex: '#0A1628', desc: 'Input BG' },
    { name: 'gold', hex: '#C9A961', desc: 'Primary Accent' },
    { name: 'bright', hex: '#E8C77A', desc: 'Gold Highlight' },
    { name: 'cream', hex: '#F4ECD8', desc: 'Headings' },
    { name: 'red', hex: '#C0392B', desc: 'Danger' },
    { name: 'green', hex: '#27AE60', desc: 'Success' },
  ];

  const fonts = [
    { name: 'Oswald', usage: 'Headlines & UI labels', sample: 'TROJAN BATTALION' },
    { name: 'Inter', usage: 'Body text', sample: 'Battalion members train year-round' },
    { name: 'JetBrains Mono', usage: 'Code, labels, data', sample: 'TB·001 · ALPHA · LET-3' },
  ];

  const spacing = [4, 8, 12, 16, 24, 32, 48, 64];

  const [copied, setCopied] = useState(null);
  function copy(val) { navigator.clipboard.writeText(val); setCopied(val); setTimeout(() => setCopied(null), 1500); }

  return (
    <div>
      <PanelHeader title="DESIGN TOKENS" />
      <Card style={{ marginBottom: 12 }}>
        <Label>COLOR PALETTE</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {colors.map(c => (
            <div key={c.name} onClick={() => copy(c.hex)} style={{ cursor: 'pointer', border: `1px solid ${P.hair}` }}>
              <div style={{ height: 40, background: c.hex, border: copied===c.hex ? `2px solid ${P.bright}` : 'none' }} />
              <div style={{ padding: '4px 6px', background: P.deep }}>
                <div style={{ fontFamily: mono, fontSize: 8, color: P.gold }}>{c.name}</div>
                <div style={{ fontFamily: mono, fontSize: 8, color: P.mute }}>{c.hex}</div>
                <div style={{ fontFamily: inter, fontSize: 8, color: P.mute }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <Label>TYPOGRAPHY</Label>
        {fonts.map(f => (
          <div key={f.name} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${P.hair}` }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, marginBottom: 4 }}>{f.name} · {f.usage}</div>
            <div style={{ fontFamily: `${f.name}, sans-serif`, fontSize: 18, color: P.cream }}>{f.sample}</div>
          </div>
        ))}
      </Card>
      <Card>
        <Label>SPACING SCALE (px)</Label>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          {spacing.map(s => (
            <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: Math.min(s, 40), height: s, background: P.gold, opacity: 0.6 }} />
              <div style={{ fontFamily: mono, fontSize: 8, color: P.mute }}>{s}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
