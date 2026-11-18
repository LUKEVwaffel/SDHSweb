import PptxGenJS from 'pptxgenjs';
import { THEMES, LAYOUTS, fileName, downloadFile } from './ballPresentation.js';

const W = 13.333333, H = 7.5;
const hex = color => color.replace('#', '');
const inch = cqw => W * cqw / 100;
const pt = cqw => inch(cqw) * 72;

// Export only a photo's visible crop, keeping it a replaceable PowerPoint image.
export async function preparePptxPhoto(photo, source, box) {
  const response = await fetch(photo.url);
  if (!response.ok) throw new Error(`Could not download a photo (${response.status}).`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.type === 'image/svg+xml') throw new Error('Replace the unsupported image before exporting.');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(box.w * 144);
    canvas.height = Math.ceil(box.h * 144);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not prepare the photos.');
    const { width: w, height: h } = canvas;
    const contain = (photo.fit || source.fit) === 'contain';
    ctx.fillStyle = box.background;
    ctx.fillRect(0, 0, w, h);
    if (contain) {
      const cover = Math.max(w / image.width, h / image.height) * 1.15;
      ctx.filter = 'blur(20px) brightness(55%)';
      ctx.drawImage(image, (w - image.width * cover) / 2, (h - image.height * cover) / 2, image.width * cover, image.height * cover);
      ctx.filter = 'none';
    }
    const scale = (contain ? Math.min : Math.max)(w / image.width, h / image.height) * (photo.zoom ?? 1);
    const x = (photo.focalX ?? source.focalX ?? 50) / 100;
    const y = (photo.focalY ?? source.focalY ?? 50) / 100;
    ctx.drawImage(image, x * (w - image.width * scale), y * (h - image.height * scale), image.width * scale, image.height * scale);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

export function pptxPhotoBoxes(source) {
  const count = LAYOUTS.find(layout => layout.id === source.layout)?.photos || 0;
  if (!count) return [];
  if (source.layout === 'split') return [{ x: W * .48, y: 0, w: W * .52, h: H }];
  if (source.layout === 'photo') return [source.frame === 'matte' ? { x: W * .04, y: H * .05, w: W * .92, h: H * .86 } : { x: 0, y: 0, w: W, h: H }];
  const gap = inch(.8), columns = 2, rows = count === 4 ? 2 : 1;
  const w = (W * .9 - gap) / columns, h = (H * .65 - gap * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, i) => ({ x: W * .05 + (i % columns) * (w + gap), y: H * .25 + Math.floor(i / columns) * (h + gap), w, h }));
}

function defaultMeasure(text, font, size, bold) {
  if (typeof document === 'undefined') return text.length * size * .52 / 72;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${bold ? 600 : 400} ${size * 96 / 72}px "${font}"`;
  return ctx.measureText(text).width / 96;
}
function lineCount(text, font, size, width, measure, bold) {
  return text.split('\n').reduce((total, line) => {
    if (!line) return total + 1;
    let used = 0, rows = 1;
    for (const word of line.split(/\s+/)) {
      const length = measure(word + ' ', font, size, bold);
      if (used && used + length > width) { rows++; used = 0; }
      if (length > width) { rows += Math.max(0, Math.ceil(length / width) - 1); used = length % width; }
      else used += length;
    }
    return total + rows;
  }, 0);
}

/** Build fully in memory; failed photo preparation never downloads a partial deck. */
export async function createPresentationPptx(deck, { preparePhoto = preparePptxPhoto, measureText = defaultMeasure, onProgress = () => {} } = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = deck.name;
  pptx.author = 'Trojan Battalion';
  pptx.subject = 'Presentation Studio export';
  pptx.lang = 'en-US';
  const theme = THEMES[deck.theme] || THEMES.midnight;
  const fg = hex(theme.foreground), bg = hex(theme.background), accent = hex(theme.accent);
  const rect = (slide, box, color, transparency = 0) => slide.addShape(pptx.ShapeType.rect, { ...box, line: { color, transparency: 100 }, fill: { color, transparency } });
  for (const [index, source] of deck.slides.entries()) {
    onProgress(`Preparing PowerPoint slide ${index + 1}/${deck.slides.length}…`);
    const slide = pptx.addSlide();
    slide.background = { color: bg };
    if (source.notes) slide.addNotes(source.notes);
    const text = (value, box, extra = {}) => {
      if (value) slide.addText(value, { ...box, fontFace: 'Inter', fontSize: pt(2), color: fg, margin: 0, breakLine: false, valign: 'top', align: source.align, fit: 'shrink', ...extra });
    };
    for (const [i, box] of pptxPhotoBoxes(source).entries()) {
      const photo = source.photos[i];
      if (photo) {
        const data = await preparePhoto(photo, source, { ...box, background: theme.background });
        slide.addImage({ data, ...box, altText: photo.caption || 'Presentation photograph' });
        const label = photo.eventLabel ?? photo.event;
        if (label) text(label, { x: box.x + box.w * .04, y: box.y + box.h * .82, w: box.w * .86, h: box.h * .12 }, { color: 'FFFFFF', fontFace: 'Oswald', fontSize: pt(source.layout === 'duo' || source.layout === 'collage' ? 1.65 : 2.25), bold: true });
      } else {
        rect(slide, box, accent, 88);
        text('Add your photo here', { x: box.x + box.w * .1, y: box.y + box.h * .45, w: box.w * .8, h: box.h * .2 }, { color: accent, align: 'center', fontSize: pt(1.6), objectName: `Photo space ${i + 1}` });
      }
    }
    const list = ['agenda', 'recognition'].includes(source.layout);
    const gallery = ['duo', 'collage'].includes(source.layout);
    const split = source.layout === 'split';
    const title = source.layout === 'title' || source.layout === 'closing';
    const quote = source.layout === 'quote';
    const section = source.layout === 'section';
    const photo = source.layout === 'photo';
    const box = { x: W * (split || gallery ? .05 : .08), y: H * .09, w: W * (split ? .38 : gallery ? .9 : .84), h: H * .79 };
    if (gallery) box.y = H * .05;
    if (section) { rect(slide, { x: box.x, y: box.y, w: inch(.4), h: box.h }, accent); box.x += inch(4); box.w -= inch(4); }
    const align = split || section || list ? 'left' : source.align;
    const titleSize = source.titleSize * .75 * (split ? .72 : gallery ? .52 : list ? .75 : quote ? .82 : 1);
    const titleFont = quote ? 'Fraunces' : source.font;
    const bodySize = pt(split ? 1.7 : gallery ? 1.2 : 2);
    const eyebrowSize = pt(gallery ? 1 : 1.35);
    const body = list ? source.subtitle.split('\n').filter(Boolean).map((line, i) => `${source.layout === 'agenda' ? String(i + 1).padStart(2, '0') : '✦'}  ${line}`).join('\n') : source.subtitle;
    const height = (value, font, size, spacing, bold = false) => value ? lineCount(value, font, size, box.w, measureText, bold) * size * spacing / 72 : 0;
    const eyebrowH = height(source.eyebrow, 'JetBrains Mono', eyebrowSize, 1.5);
    const titleH = height(source.title, titleFont, titleSize, 1.15, true);
    const bodyH = height(body, 'Inter', bodySize, 1.55);
    const eyebrowGap = source.eyebrow ? inch(gallery ? .7 : 2.6) : 0;
    const bodyGap = body ? inch(gallery ? .3 : 2.5) : 0;
    const ruleH = title ? inch(3.22) : quote ? inch(6.3) : 0;
    const total = eyebrowH + eyebrowGap + titleH + bodyGap + bodyH + ruleH;
    // Keep crowded text within the same visible copy region as the studio.
    const scale = gallery ? Math.min(1, H * .18 / Math.max(total, .01)) : Math.min(1, box.h / Math.max(total, .01));
    let y = gallery ? box.y : photo ? box.y + box.h - total * scale : box.y + (box.h - total * scale) / 2;
    if (title) { rect(slide, { x: box.x + (box.w - inch(5)) / 2, y, w: inch(5), h: inch(.22) }, accent); y += ruleH * scale; }
    if (quote) { text('“', { x: box.x, y, w: box.w, h: ruleH * scale }, { fontFace: 'Fraunces', fontSize: pt(9) * scale, color: accent, align }); y += ruleH * scale; }
    if (source.eyebrow) {
      text(source.eyebrow.toUpperCase(), { x: box.x, y, w: box.w, h: eyebrowH * scale }, { fontFace: 'JetBrains Mono', fontSize: eyebrowSize * scale, color: accent, align, charSpacing: eyebrowSize * .18 * scale });
      y += (eyebrowH + eyebrowGap) * scale;
    }
    text(source.title, { x: box.x, y, w: box.w, h: titleH * scale }, { fontFace: titleFont, fontSize: titleSize * scale, bold: true, color: title ? accent : photo ? 'FFFFFF' : fg, align, lineSpacingMultiple: 1.08 });
    y += (titleH + bodyGap) * scale;
    text(body, { x: box.x, y, w: box.w, h: bodyH * scale }, { fontSize: bodySize * scale, color: photo ? 'FFFFFF' : fg, align, lineSpacingMultiple: 1.55 });
    text('TROJAN BATTALION', { x: W * .05, y: H * .946, w: W * .65, h: .15 }, { fontFace: 'JetBrains Mono', fontSize: pt(.85), color: photo ? 'FFFFFF' : fg, align: 'left' });
    if (deck.showNumbers) text(String(index + 1).padStart(2, '0'), { x: W * .88, y: H * .946, w: W * .07, h: .15 }, { fontFace: 'JetBrains Mono', fontSize: pt(.85), align: 'right' });
  }
  return pptx;
}

export async function exportPresentationPptx(deck, onProgress) {
  if (typeof document !== 'undefined') {
    await Promise.all(['600 24px Oswald', '400 24px Inter', '600 24px Fraunces', '400 24px "JetBrains Mono"'].map(font => document.fonts.load(font)));
  }
  const pptx = await createPresentationPptx(deck, { onProgress });
  onProgress?.('Packing PowerPoint file…');
  const blob = await pptx.write({ outputType: 'blob', compression: true });
  downloadFile(`${fileName(deck.name)}.pptx`, blob, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
}
