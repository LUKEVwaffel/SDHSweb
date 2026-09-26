// Client-side image downscaling. Keeps uploads small so the gallery stays fast
// and public uploads don't ship 12MP phone originals. Produces a full-size
// (max 1600px) JPEG plus a 400px thumbnail, both re-encoded.

const FULL_MAX = 1600;
const THUMB_MAX = 400;
const QUALITY = 0.82;
const BLUR_RADIUS_FRACTION = 0.06; // blur strength relative to the longest image edge

// Camera RAW formats — the browser's <img>/canvas pipeline can't decode these
// (no native codec), so resize would silently fail after the file is already
// queued. Reject upfront with a message that tells the uploader what to do,
// instead of a "Could not read image" dead end from the canvas step.
const RAW_EXTENSIONS = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'pef', 'srw'];

export function isRawFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return RAW_EXTENSIONS.includes(ext);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

function drawScaled(img, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

function toBlob(canvas) {
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', QUALITY)
  );
}

// Fetches the image bytes ourselves rather than pointing an <img crossOrigin>
// at the URL directly. The photo is almost always already sitting in the
// browser's HTTP cache from the plain (non-CORS) <img> the viewer just
// rendered — reusing that cached response taints the canvas silently, with
// no error, which is why blur previously appeared to do nothing. Fetching
// fresh with cache:'reload' and decoding from a same-origin blob: URL avoids
// that entirely.
async function loadImageFromUrl(url) {
  const res = await fetch(url, { mode: 'cors', cache: 'reload' });
  if (!res.ok) throw new Error(`Could not fetch image for editing (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode image for editing'));
    };
    img.src = objectUrl;
  });
}

// Draws `img` scaled to `maxEdge`, then bakes each oval (relative 0..1
// image-space center + radii) in as a real pixel blur — not a CSS overlay —
// so the redaction survives in storage and everywhere the photo is served.
function drawScaledWithBlur(img, maxEdge, ovals) {
  const canvas = drawScaled(img, maxEdge);
  if (!ovals.length) return canvas;
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d');

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bctx = blurCanvas.getContext('2d');
  const blurPx = Math.max(6, Math.round(Math.max(w, h) * BLUR_RADIUS_FRACTION));
  bctx.filter = `blur(${blurPx}px)`;
  bctx.drawImage(img, 0, 0, w, h);

  for (const { cx, cy, rx, ry } of ovals) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx * w, cy * h, Math.max(1, rx * w), Math.max(1, ry * h), 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.restore();
  }
  return canvas;
}

/**
 * Bakes oval blur regions into a photo already in storage, given its public
 * URL. `ovals` are {cx, cy, rx, ry} fractions of image width/height (0..1).
 * @param {string} url
 * @param {{cx:number,cy:number,rx:number,ry:number}[]} ovals
 * @returns {Promise<{ full: Blob, thumb: Blob }>}
 */
export async function applyOvalBlurToUrl(url, ovals) {
  const img = await loadImageFromUrl(url);
  const fullCanvas = drawScaledWithBlur(img, FULL_MAX, ovals);
  const thumbCanvas = drawScaledWithBlur(img, THUMB_MAX, ovals);
  const [full, thumb] = await Promise.all([toBlob(fullCanvas), toBlob(thumbCanvas)]);
  return { full, thumb };
}

/**
 * @param {File} file
 * @returns {Promise<{ full: Blob, thumb: Blob, width: number, height: number }>}
 */
// `thumbMax` lets a caller ask for a bigger thumbnail than the 400px gallery
// default — OPTIC's feed shows its "thumb" full-width on a phone, where 400px
// looks soft, but full-size (1600px) there made scrolling lag and burned
// bandwidth.
export async function resizeForUpload(file, { thumbMax = THUMB_MAX } = {}) {
  if (isRawFile(file)) {
    throw new Error('RAW files (.CR2, .NEF, etc.) aren\'t supported — export as JPEG first.');
  }
  const img = await loadImage(file);
  const fullCanvas = drawScaled(img, FULL_MAX);
  const thumbCanvas = drawScaled(img, thumbMax);
  const [full, thumb] = await Promise.all([toBlob(fullCanvas), toBlob(thumbCanvas)]);
  return { full, thumb, width: fullCanvas.width, height: fullCanvas.height };
}
