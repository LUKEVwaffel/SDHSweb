// Printable Halloween bash movie recommendations from the public /halloween
// poll (supabase/halloween_poll.sql). Same window.open + document.write +
// print() pattern as eventsPdfPrint.js — the browser is the PDF engine.
//
// Suggestions are free text, so titles are merged case/space/punctuation-
// insensitively and ranked by how many people suggested them. White paper
// with orange/black accents so it prints cheaply.

const INK = '#1a1a1a';
const ORANGE = '#E8751A';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function movieKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// rows: halloween_movie_suggestions rows ({ movie, rating, created_at }).
// Returns [{ movie, rating, count }] sorted by count desc, then title.
export function tallyMovieSuggestions(rows) {
  const byKey = new Map();
  for (const r of rows || []) {
    const key = movieKey(r.movie);
    if (!key) continue;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { movie: String(r.movie).trim(), ratings: {}, count: 0 };
      byKey.set(key, entry);
    }
    entry.count += 1;
    entry.ratings[r.rating] = (entry.ratings[r.rating] || 0) + 1;
  }
  return [...byKey.values()]
    .map(({ movie, ratings, count }) => ({
      movie,
      count,
      // Most-reported rating wins; ties lean to the stricter PG-13.
      rating: Object.entries(ratings).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0],
    }))
    .sort((a, b) => b.count - a.count || a.movie.localeCompare(b.movie));
}

const DOC_STYLE = `
  @page { size: letter; margin: 0.55in; }
  * { box-sizing: border-box; }
  html, body { background: #ffffff; color: ${INK}; margin: 0; }
  body { font-family: 'Inter', Arial, sans-serif; }
  .sheet { max-width: 7.4in; margin: 0 auto; }
  .head { border-bottom: 4px solid ${ORANGE}; padding: 18px 24px 14px; }
  .head .org { font-family: Arial, Helvetica, sans-serif; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #777; }
  .head .title { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 24px; margin-top: 4px; }
  .meta-row { display: flex; justify-content: space-between; font-family: 'Courier New', monospace; font-size: 9.5px; color: #666; padding: 9px 24px; border-bottom: 1px solid #ddd; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 0.1em; color: #888; font-weight: 400; padding: 8px 24px 6px; border-bottom: 1.5px solid ${INK}; }
  td { padding: 9px 24px; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: middle; }
  tr { page-break-inside: avoid; }
  td.rank { width: 56px; font-family: Georgia, serif; font-weight: 700; font-size: 16px; color: ${ORANGE}; }
  td.movie { font-weight: 600; }
  td.rating { width: 80px; font-family: 'Courier New', monospace; font-size: 10px; }
  td.votes { width: 80px; text-align: right; font-family: 'Courier New', monospace; font-size: 11px; }
  th.votes { text-align: right; }
  tr.top td { background: #fdf3ea; }
  .empty { padding: 40px 24px; font-family: 'Courier New', monospace; font-size: 11px; color: #999; text-align: center; }
  .foot { text-align: center; padding: 16px; font-family: 'Courier New', monospace; font-size: 8px; color: #aaa; }
`;

export function openHalloweenMoviesPrint(rows) {
  const win = window.open('', '_blank');
  if (!win) { alert('Popup blocked, allow popups to print the list.'); return; }

  const tally = tallyMovieSuggestions(rows);
  const total = tally.reduce((n, t) => n + t.count, 0);
  const body = tally.length === 0
    ? '<div class="empty">NO MOVIE SUGGESTIONS YET</div>'
    : `<table>
        <thead><tr><th>#</th><th>MOVIE</th><th>RATING</th><th class="votes">VOTES</th></tr></thead>
        <tbody>${tally.map((t, i) => `
          <tr class="${i < 3 ? 'top' : ''}">
            <td class="rank">${i + 1}</td>
            <td class="movie">${escapeHtml(t.movie)}</td>
            <td class="rating">${escapeHtml(t.rating)}</td>
            <td class="votes">${t.count}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>Halloween Movie Recommendations</title>
<style>${DOC_STYLE}</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="org">Trojan Battalion JROTC · Halloween Bash</div>
      <div class="title">🎃 Movie Recommendations</div>
    </div>
    <div class="meta-row">
      <span>Generated ${escapeHtml(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}</span>
      <span>${tally.length} movie${tally.length === 1 ? '' : 's'} · ${total} suggestion${total === 1 ? '' : 's'}</span>
    </div>
    ${body}
    <div class="foot">Ranked by number of suggestions from the /halloween poll. All titles rated PG or PG-13.</div>
  </div>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
