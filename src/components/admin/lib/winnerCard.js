// Canvas → PNG "winner share card" export for Raider poll winners.
export async function downloadWinnerCard(photoUrl, catLabel, eventTitle, caption) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const S = 1080;
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#06101F'; ctx.fillRect(0, 0, S, S);
    const scale = Math.max(S / img.width, S / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    const g = ctx.createLinearGradient(0, S * 0.45, 0, S);
    g.addColorStop(0, 'rgba(6,16,31,0)'); g.addColorStop(1, 'rgba(6,16,31,0.96)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#C9A961'; ctx.fillRect(60, 72, 210, 56);
    ctx.fillStyle = '#06101F'; ctx.font = '700 30px Oswald, Arial, sans-serif'; ctx.fillText('🏆 WINNER', 78, 110);
    ctx.fillStyle = '#E8C77A'; ctx.font = '700 92px Oswald, Arial, sans-serif'; ctx.fillText(catLabel, 60, S - 168);
    ctx.fillStyle = '#F4ECD8'; ctx.font = '500 30px Inter, Arial, sans-serif'; ctx.fillText((eventTitle || '').slice(0, 42), 60, S - 116);
    if (caption) { ctx.fillStyle = 'rgba(244,236,216,0.7)'; ctx.font = '400 24px Inter, Arial, sans-serif'; ctx.fillText(`📷 ${caption}`.slice(0, 44), 60, S - 82); }
    ctx.fillStyle = 'rgba(201,169,97,0.85)'; ctx.font = '600 22px monospace'; ctx.fillText('TROJAN BATTALION · RAIDERS', 60, S - 44);
    try {
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = `raider-winner-${catLabel.toLowerCase()}.png`;
      a.click();
    } catch {
      alert('Export blocked by image CORS. Right-click the photo and Save Image instead.');
    }
  };
  img.onerror = () => alert('Could not load image for export.');
  img.src = photoUrl;
}
