import { Zip, ZipPassThrough } from 'npm:fflate@0.8.2';

export function streamArchive(files: { url: string; name: string }[], requestSignal: AbortSignal) {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  const queue: Uint8Array[] = [];
  const zip = new Zip((error, bytes) => {
    if (error) throw error;
    queue.push(bytes);
  });
  async function flush() {
    for (const bytes of queue.splice(0)) await writer.write(bytes);
  }
  void (async () => {
    let pending: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      for (const file of files) {
        const response = await fetch(file.url, { signal: requestSignal });
        if (!response.ok || !response.body) throw new Error('Could not read a selected photo.');
        const entry = new ZipPassThrough(file.name);
        zip.add(entry);
        await flush();
        pending = response.body.getReader();
        while (true) {
          const { done, value } = await pending.read();
          if (done) break;
          entry.push(value);
          await flush();
        }
        pending.releaseLock();
        pending = undefined;
        entry.push(new Uint8Array(), true);
        await flush();
      }
      zip.end();
      await flush();
      await writer.close();
    } catch (error) {
      await pending?.cancel().catch(() => {});
      await writer.abort(error).catch(() => {});
    }
  })();
  return stream.readable;
}
