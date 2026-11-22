const east = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  timeZoneName: 'longOffset',
});

export function captureTimestamp(metadata) {
  const stamp = metadata?.DateTimeOriginal || metadata?.CreateDate;
  if (typeof stamp !== 'string') return null;
  const match = stamp.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!match) return null;
  const [,year,month,day,hours,minutes,seconds,embeddedFraction,embeddedOffset] = match;
  const fraction = String(embeddedFraction || metadata.SubSecTimeOriginal || '').match(/^\d+/)?.[0]?.padEnd(3,'0').slice(0,3) || '000';
  const iso = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${fraction}`;
  const base = new Date(iso+'Z');
  if (!Number.isFinite(+base) || base.toISOString().slice(0,19)!==iso.slice(0,19)) return null;
  const recorded = embeddedOffset || (metadata.DateTimeOriginal ? metadata.OffsetTimeOriginal : metadata.OffsetTimeDigitized);
  const offset = /^(Z|[+-]\d{2}:?\d{2})$/.test(recorded || '') ? recorded
    : east.formatToParts(base).find(part=>part.type==='timeZoneName')?.value.replace('GMT','') || '-05:00';
  const date = new Date(iso+offset);
  return Number.isFinite(+date) ? date.toISOString() : null;
}

const time = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});
export const photoTime = timestamp => timestamp ? time.format(new Date(timestamp)) : 'Time unavailable';
