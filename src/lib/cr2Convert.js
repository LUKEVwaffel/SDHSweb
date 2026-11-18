const CR2_EXTENSION = /\.cr2$/i;
export const isCr2 = file => CR2_EXTENSION.test(file.name);

async function decodeCr2(file) {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (header[8] !== 0x43 || header[9] !== 0x52 || header[10] !== 2) {
    throw new Error('This file is not a readable Canon CR2 photo.');
  }

  const { default: LibRaw } = await import('libraw-wasm');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoder = new LibRaw();
  let timeout;
  try {
    const decode = async () => {
      await decoder.open(bytes, { useCameraWb: true, outputColor: 1, outputBps: 8 });
      return decoder.imageData();
    };
    // A worker that cannot load its script or WASM may never send a reply.
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('The RAW decoder did not respond. Try again.')), 60000);
    });
    return await Promise.race([decode(), deadline]);
  } finally {
    clearTimeout(timeout);
    decoder.dispose();
  }
}

export async function convertCr2ToPng(file) {
  const decoded = await decodeCr2(file);
  const { width, height, colors, bits, data } = decoded ?? {};
  if (!width || !height || bits !== 8 || colors !== 3 || data?.length !== width * height * colors) {
    throw new Error('Could not convert the RAW pixels to an RGB image.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('This browser could not open a canvas for the RAW photo.');
    const image = ctx.createImageData(width, height);
    for (let src = 0, dst = 0; src < data.length; src += 3, dst += 4) {
      image.data[dst] = data[src];
      image.data[dst + 1] = data[src + 1];
      image.data[dst + 2] = data[src + 2];
      image.data[dst + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png?.size) throw new Error('Could not save this RAW photo as PNG.');
    return new File([png], file.name.replace(CR2_EXTENSION, '.png'), { type: 'image/png', lastModified: file.lastModified });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
