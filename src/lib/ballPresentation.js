export const STUDIO_VERSION = 1;
export const LAYOUTS = [
  { id: 'title', label: 'Title', hint: 'A grand opening', photos: 0 },
  { id: 'section', label: 'Chapter', hint: 'Introduce a new moment', photos: 0 },
  { id: 'photo', label: 'Full photo', hint: 'Let the image speak', photos: 1 },
  { id: 'split', label: 'Photo + story', hint: 'Image and text side by side', photos: 1 },
  { id: 'duo', label: 'Two photos', hint: 'A pair of memories', photos: 2 },
  { id: 'collage', label: 'Four photos', hint: 'A wall of highlights', photos: 4 },
  { id: 'quote', label: 'Quote', hint: 'Words worth remembering', photos: 0 },
  { id: 'agenda', label: 'Program', hint: 'The order of the evening', photos: 0 },
  { id: 'recognition', label: 'Recognition', hint: 'Celebrate your people', photos: 0 },
  { id: 'closing', label: 'Closing', hint: 'End on a high note', photos: 0 },
];
export const THEMES = {
  midnight: { name: 'Midnight & gold', background: '#081729', foreground: '#f7f0df', accent: '#e5c37e' },
  ivory: { name: 'Ivory formal', background: '#f3efe5', foreground: '#16243a', accent: '#856520' },
  crimson: { name: 'Crimson ceremony', background: '#260e17', foreground: '#fff2e3', accent: '#e8bc7a' },
  black: { name: 'Black tie', background: '#090909', foreground: '#f4f4ef', accent: '#ccccb8' },
};
export const uid = () => crypto.randomUUID();
export function makeSlide(layout = 'title', patch = {}) {
  const defaults = {
    title: { title: 'Military Ball', subtitle: 'An evening of tradition, honor & celebration', eyebrow: 'Soddy-Daisy High School · Trojan Battalion' },
    section: { title: 'Our year. Our story.', subtitle: 'The moments that brought us together', eyebrow: 'Trojan Battalion' },
    photo: { title: '', subtitle: '', eyebrow: '' },
    split: { title: 'A year to remember', subtitle: 'Add your story here.', eyebrow: 'Our battalion' },
    duo: { title: 'Better together', subtitle: '', eyebrow: 'Moments that matter' },
    collage: { title: 'Made of memories', subtitle: '', eyebrow: 'The year in pictures' },
    quote: { title: 'Leadership starts with service.', subtitle: 'Trojan Battalion', eyebrow: 'Words to carry with us' },
    agenda: { title: 'The evening', subtitle: 'Welcome & opening remarks\nPresentation of colors\nDinner\nAwards & recognition\nCelebration', eyebrow: 'Tonight’s program' },
    recognition: { title: 'Excellence, recognized.', subtitle: 'Add award recipients\nAdd their achievements', eyebrow: 'Awards & recognition' },
    closing: { title: 'Forever a Trojan.', subtitle: 'Thank you for an unforgettable evening.', eyebrow: 'Trojan Battalion' },
  };
  return { id: uid(), layout, ...defaults[layout], photos: [], duration: 8, transition: 'fade', align: 'center', font: 'Oswald', titleSize: 76, overlay: 45, fit: 'cover', motion: 'none', frame: 'edge', focalX: 50, focalY: 50, notes: '', ...patch };
}
export function makeDeck() {
  return { version: STUDIO_VERSION, id: uid(), name: 'Military Ball · The evening', theme: 'midnight', loop: false, showNumbers: false, slides: [makeSlide('title'), makeSlide('agenda'), makeSlide('section'), makeSlide('closing')], updatedAt: new Date().toISOString() };
}
export function moveSlide(slides, from, to) {
  if (from < 0 || to < 0 || from >= slides.length || to >= slides.length) return slides;
  const next = [...slides];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
export const totalDuration = deck => deck.slides.reduce((sum, slide) => sum + slide.duration, 0);
const text = (value, max = 10000) => typeof value === 'string' ? value.slice(0, max) : '';
const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export function safePhotoUrl(value) {
  if (typeof value !== 'string') return '';
  if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  try { const url = new URL(value, 'https://local.invalid'); return ['http:', 'https:'].includes(url.protocol) ? value : ''; } catch { return ''; }
}
export function readDeck(input) {
  if (!input || input.version !== STUDIO_VERSION || !Array.isArray(input.slides) || input.slides.length < 1 || input.slides.length > 1000) throw new Error('Choose a Ball Studio deck with 1–1,000 slides.');
  return { version: STUDIO_VERSION, id: uid(), name: text(input.name, 150) || 'Imported deck', theme: Object.hasOwn(THEMES, input.theme) ? input.theme : 'midnight', loop: !!input.loop, showNumbers: !!input.showNumbers, updatedAt: new Date().toISOString(), slides: input.slides.map(s => {
    if (!s || !LAYOUTS.some(l => l.id === s.layout)) throw new Error('This file contains an unsupported slide layout.');
    const base = makeSlide(s.layout);
    return { ...base, title: text(s.title, 500), subtitle: text(s.subtitle), eyebrow: text(s.eyebrow, 200), notes: text(s.notes), duration: number(s.duration, 8, 1, 600), titleSize: number(s.titleSize, 76, 30, 120), overlay: number(s.overlay, 45, 0, 90), focalX: number(s.focalX, 50, 0, 100), focalY: number(s.focalY, 50, 0, 100), transition: ['fade','rise','cut'].includes(s.transition) ? s.transition : 'fade', font: ['Oswald','Inter','Fraunces'].includes(s.font) ? s.font : 'Oswald', align: ['left','center','right'].includes(s.align) ? s.align : 'center', fit: s.fit === 'contain' ? 'contain' : 'cover', motion: ['zoom','pan'].includes(s.motion) ? s.motion : 'none', frame: s.frame === 'matte' ? 'matte' : 'edge', photos: Array.isArray(s.photos) ? Array.from(s.photos.slice(0,4), p => p && safePhotoUrl(p.url) ? ({ id: text(p?.id, 200), url: safePhotoUrl(p?.url), thumb: safePhotoUrl(p?.thumb), caption: text(p?.caption, 500) }) : null) : [] };
  }) };
}
export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export const fileName = name => name.replace(/[^a-z0-9 -]/gi, '').trim().slice(0,80) || 'Military Ball';
