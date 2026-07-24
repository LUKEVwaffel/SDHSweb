import { P, mono, inter, fs, sp, radius } from '../../../theme';
import { Label, Input, Btn } from '../../../shared/ui';
import { safeUrl } from '../emailRender';

// Type-specific inline editor for a single block. Pure-ish: mutates via `update`
// (partial patch) provided by the parent builder.
export default function BlockFields({ block, update, onPickAttachment, uploading }) {
  switch (block.type) {
    case 'heading':
      return (
        <div>
          <Input value={block.text} onChange={(e) => update({ text: e.target.value })} placeholder="Heading text" />
          <div style={{ display: 'flex', gap: sp[2], marginTop: sp[2] }}>
            {[1, 2].map((lvl) => (
              <Btn key={lvl} size="sm" variant={block.level === lvl ? 'gold' : 'ghost'} onClick={() => update({ level: lvl })}>
                {lvl === 1 ? 'LARGE' : 'SMALL'}
              </Btn>
            ))}
          </div>
        </div>
      );

    case 'text':
      return <Input multiline value={block.text} onChange={(e) => update({ text: e.target.value })} placeholder="Body text — line breaks are kept." style={{ minHeight: 110 }} />;

    case 'image':
      return (
        <div>
          <Label>Image URL</Label>
          <Input value={block.url} onChange={(e) => update({ url: e.target.value })} placeholder="Paste from Media Library, or a public URL" error={!!block.url && !safeUrl(block.url)} />
          {block.url && safeUrl(block.url) && (
            <img src={block.url} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: radius.sm, margin: `${sp[2]}px 0`, border: `1px solid ${P.hair}` }} />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginTop: sp[2] }}>
            <div><Label>Alt text</Label><Input value={block.alt} onChange={(e) => update({ alt: e.target.value })} placeholder="Describe the image" /></div>
            <div><Label>Link (optional)</Label><Input value={block.href} onChange={(e) => update({ href: e.target.value })} placeholder="https://…" error={!!block.href && !safeUrl(block.href)} /></div>
          </div>
        </div>
      );

    case 'button':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3] }}>
          <div><Label>Label</Label><Input value={block.label} onChange={(e) => update({ label: e.target.value })} placeholder="Learn more" /></div>
          <div><Label>Link</Label><Input value={block.href} onChange={(e) => update({ href: e.target.value })} placeholder="https://…" error={!!block.href && !safeUrl(block.href)} /></div>
        </div>
      );

    case 'divider':
      return <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint, letterSpacing: '0.12em' }}>A thin gold-hairline rule.</div>;

    case 'spacer':
      return (
        <div style={{ display: 'flex', gap: sp[2] }}>
          {['sm', 'md', 'lg'].map((sz) => (
            <Btn key={sz} size="sm" variant={block.size === sz ? 'gold' : 'ghost'} onClick={() => update({ size: sz })}>{sz.toUpperCase()}</Btn>
          ))}
        </div>
      );

    case 'attachment':
      return (
        <div>
          {block.filename ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm, padding: `${sp[2]}px ${sp[3]}px` }}>
              <span style={{ fontFamily: mono, fontSize: fs.sm, color: P.bright }}>📎 {block.filename}</span>
              {block.size ? <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute }}>{(block.size / 1024).toFixed(0)} KB</span> : null}
              <Btn size="sm" variant="ghost" style={{ marginLeft: 'auto' }} onClick={() => update({ url: '', filename: '', size: null })}>REPLACE</Btn>
            </div>
          ) : (
            <div>
              <Btn size="sm" variant="ghost" disabled={uploading} onClick={onPickAttachment}>{uploading ? 'UPLOADING…' : '＋ CHOOSE FILE'}</Btn>
              <div style={{ fontFamily: inter, fontSize: fs.xs, color: P.faint, marginTop: sp[2] }}>PDF, image, or doc. Rides as a real email attachment. Max 8 MB.</div>
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}
