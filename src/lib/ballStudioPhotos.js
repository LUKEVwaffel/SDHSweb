// Page every source; never silently truncate the extensive archive at 1,000.
async function allRows(client, table, columns, order = 'id') {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from(table).select(columns).order(order).range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function loadStudioPhotos(client) {
  const sources = [
    { table: 'photos', columns: 'id,photo_url,thumb_url,grid_url,event_id,team,uploader_name,status,upload_status,created_at', label: 'Photo archive', normalize: p => ({ url: p.photo_url, thumb: p.grid_url || p.thumb_url || p.photo_url, caption: p.uploader_name || '', team: p.team, eventId: p.event_id, hidden: p.status !== 'live' || (p.upload_status && p.upload_status !== 'done') }) },
    { table: 'tv_photos', columns: 'id,photo_url,title,folders,created_at', label: 'TV collection', normalize: p => ({ url: p.photo_url, thumb: p.photo_url, caption: p.title || '', team: p.folders?.join(' ') || '' }) },
    { table: 'rafting_photos', columns: 'id,url,caption,created_at', label: 'Rafting trip', normalize: p => ({ url: p.url, thumb: p.url, caption: p.caption || 'Rafting trip', team: 'battalion' }) },
    { table: 'gallery', columns: 'id,photo_url,caption,team,created_at', label: 'Curated gallery', normalize: p => ({ url: p.photo_url, thumb: p.photo_url, caption: p.caption || '', team: p.team }) },
    { table: 'ball_gallery', columns: 'id,photo_url,caption,created_at', label: 'Ball gallery', normalize: p => ({ url: p.photo_url, thumb: p.photo_url, caption: p.caption || 'Military Ball', team: 'battalion' }) },
  ];
  const results = await Promise.allSettled([allRows(client, 'events', 'id,title,date'), ...sources.map(s => allRows(client, s.table, s.columns))]);
  const events = results[0].status === 'fulfilled' ? results[0].value : [];
  const eventMap = Object.fromEntries(events.map(e => [e.id,e]));
  const warnings = [];
  if (results[0].status === 'rejected') warnings.push(`Event names: ${results[0].reason.message}`);
  const photos = sources.flatMap((source, i) => {
    const result = results[i + 1];
    if (result.status === 'rejected') { warnings.push(`${source.label}: ${result.reason.message}`); return []; }
    return result.value.map(p => ({ ...source.normalize(p), id: `${source.table}:${p.id}`, source: source.label, date: p.created_at, event: eventMap[p.event_id]?.title || source.label })).filter(p => p.url && !p.hidden && !/\.(mp4|mov|m4v|webm)(\?|$)/i.test(p.url));
  });
  return { photos, events, warnings };
}
