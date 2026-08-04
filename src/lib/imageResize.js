// Client-side image downscaling. Keeps uploads small so the gallery stays fast
// and public uploads don't ship 12MP phone originals. Produces a full-size
// (max 1600px) JPEG plus a 400px thumbnail, both re-encoded.

const FULL_MAX = 1600;
const THUMB_MAX = 400;
const QUALITY = 0.82;

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

/**
 * @param {File} file
 * @returns {Promise<{ full: Blob, thumb: Blob, width: number, height: number }>}
 */
export async function resizeForUpload(file) {
  if (isRawFile(file)) {
    throw new Error('RAW files (.CR2, .NEF, etc.) aren\'t supported — export as JPEG first.');
  }
  const img = await loadImage(file);
  const fullCanvas = drawScaled(img, FULL_MAX);
  const thumbCanvas = drawScaled(img, THUMB_MAX);
  const [full, thumb] = await Promise.all([toBlob(fullCanvas), toBlob(thumbCanvas)]);
  return { full, thumb, width: fullCanvas.width, height: fullCanvas.height };
}
