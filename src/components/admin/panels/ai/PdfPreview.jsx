import { useEffect, useRef, useState } from 'react';

export default function PdfPreview({ base64, title }) {
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let loading;
    (async () => {
      try {
        const lib = await import('pdfjs-dist');
        lib.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        if (cancelled) return;
        loading = lib.getDocument({ data: Uint8Array.from(atob(base64), c => c.charCodeAt(0)), isEvalSupported: false });
        const document = await loading.promise;
        if (cancelled) { document.destroy(); return; }
        setPdf(document);
      } catch { if (!cancelled) { setError('Preview could not load. You can still download the PDF.'); setBusy(false); } }
    })();
    return () => { cancelled = true; loading?.destroy(); };
  }, [base64]);
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let render;
    setBusy(true);
    (async () => {
      try {
        const sheet = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = sheet.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        render = sheet.render({ canvasContext: canvas.getContext('2d'), viewport });
        await render.promise;
        if (!cancelled) setBusy(false);
      } catch (err) { if (!cancelled && err?.name !== 'RenderingCancelledException') { setError('This page could not be previewed. Download the PDF to view it.'); setBusy(false); } }
    })();
    return () => { cancelled = true; render?.cancel(); };
  }, [pdf, page]);
  return <div className="dispatch-pdf-preview" aria-label={`${title} preview`}>
    <div className="dispatch-pdf-preview-toolbar"><button disabled={!pdf || page === 1 || busy} onClick={() => setPage(p => p - 1)} aria-label="Previous PDF page">←</button><span aria-live="polite">{pdf ? `Page ${page} of ${pdf.numPages}` : 'Loading preview…'}</span><button disabled={!pdf || page === pdf.numPages || busy} onClick={() => setPage(p => p + 1)} aria-label="Next PDF page">→</button></div>
    {error && <p role="alert">{error}</p>}
    <div className="dispatch-pdf-canvas-wrap" aria-busy={busy}><canvas ref={canvasRef} aria-label={`PDF page ${page}`} style={{ opacity: busy ? .35 : 1 }} /></div>
  </div>;
}
