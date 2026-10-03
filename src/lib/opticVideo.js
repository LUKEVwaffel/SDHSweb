// ── OPTIC parent videos. Added for the rainy final comp (2026-10-03): Luke's
// camera stays in the bag in the rain, so parents' phones carry the feed and
// a short clip is often the better shot. Videos ride the photo pipeline: one
// `photos` row, the clip itself at storage_path (<stamp>.mp4 / .mov / .webm),
// and a JPEG poster frame at the usual _t.jpg / _s.jpg thumb keys so every
// grid and feed card keeps rendering an <img>. No schema change: a row is a
// video when its file extension says so (isVideoPhoto).

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm)$/i;

// MIME -> extension the file is stored under. iPhones hand over .mov
// (video/quicktime), Android .mp4. The R2 worker accepts exactly these.
const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};
const EXT_TYPES = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };

// Cloudflare caps a single request body at 100MB on the plan the R2 worker
// runs on, so this sits just under it. Roughly a minute of 1080p phone video.
export const MAX_VIDEO_BYTES = 95 * 1024 * 1024;
export const MAX_VIDEO_LABEL = '95MB';

export const OPTIC_VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm';

const extOf = (name) => (name || '').split('.').pop()?.toLowerCase() || '';

/** Content type + stored extension for a picked video, or null if it isn't one we take. */
export function videoKind(file) {
  if (VIDEO_TYPES[file.type]) return { type: file.type, ext: VIDEO_TYPES[file.type] };
  // iOS sometimes reports camera-roll files with an empty or generic type.
  const ext = extOf(file.name);
  if ((!file.type || file.type === 'application/octet-stream') && EXT_TYPES[ext]) {
    const type = EXT_TYPES[ext];
    return { type, ext: VIDEO_TYPES[type] };
  }
  return null;
}

export const isAllowedVideo = (file) => !!videoKind(file);
export const isVideoTooBig = (file) => file.size > MAX_VIDEO_BYTES;

export const isVideoUrl = (url) => VIDEO_EXT_RE.test((url || '').split('?')[0]);
/** True for a photos row whose file is a video clip. */
export const isVideoPhoto = (p) => isVideoUrl(p?.storage_path) || isVideoUrl(p?.photo_url);

/** File name to save a feed item under, keeping the right extension. */
export function mediaFilename(p) {
  const ext = isVideoPhoto(p) ? extOf((p.storage_path || p.photo_url || '').split('?')[0]) : 'jpg';
  return `optic_${p.id}.${ext || 'jpg'}`;
}

function once(el, event, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { cleanup(); reject(new Error(`${event} timed out`)); }, ms);
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error('video decode failed')); };
    function cleanup() {
      clearTimeout(t);
      el.removeEventListener(event, ok);
      el.removeEventListener('error', bad);
    }
    el.addEventListener(event, ok);
    el.addEventListener('error', bad);
  });
}

function canvasBlob(canvas, quality = 0.82) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('poster encode failed'))), 'image/jpeg', quality);
  });
}

function scaled(source, w, h, max) {
  const k = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// The browser couldn't decode a frame (a codec it doesn't play, or a
// stubborn iOS load): a branded card stands in so the upload still goes.
function placeholderCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 506;
  const g = canvas.getContext('2d');
  g.fillStyle = '#0B1A33';
  g.fillRect(0, 0, 900, 506);
  g.fillStyle = '#C9A961';
  g.beginPath();
  g.arc(450, 230, 74, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0B1A33';
  g.beginPath();
  g.moveTo(425, 190);
  g.lineTo(425, 270);
  g.lineTo(490, 230);
  g.closePath();
  g.fill();
  g.fillStyle = '#F4ECD8';
  g.font = '700 34px Oswald, sans-serif';
  g.textAlign = 'center';
  g.fillText('VIDEO', 450, 370);
  return canvas;
}

/**
 * Grab a JPEG poster frame (feed thumb + grid thumb) from a local video.
 * Never throws: falls back to a placeholder card.
 * @returns {Promise<{thumb: Blob, grid: Blob}>}
 */
export async function videoPoster(file, { thumbMax, gridMax }) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.preload = 'auto';
  let source;
  try {
    video.src = url;
    await once(video, 'loadedmetadata', 10000);
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error('no video frame');
    // A beat in, so the poster isn't a black first frame.
    const at = Number.isFinite(video.duration) ? Math.min(0.5, video.duration / 4) : 0.1;
    const seeked = once(video, 'seeked', 8000);
    video.currentTime = at;
    await seeked;
    source = { el: video, w, h };
  } catch {
    source = null;
  }
  try {
    if (!source) {
      const ph = placeholderCanvas();
      return { thumb: await canvasBlob(ph), grid: await canvasBlob(scaled(ph, 900, 506, gridMax), 0.75) };
    }
    return {
      thumb: await canvasBlob(scaled(source.el, source.w, source.h, thumbMax)),
      grid: await canvasBlob(scaled(source.el, source.w, source.h, gridMax), 0.75),
    };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
