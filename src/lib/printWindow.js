// Shared writer for the "browser is the PDF engine" popups (dress code, consent
// status, events calendar, AAR draft). The caller opens the popup itself —
// synchronously, inside the click handler, before any await — so the browser
// does not block it. This helper fills that popup with a full HTML document and
// starts the print / "Save as PDF" flow.
//
// Why the fallback: on Mobile Safari a blank window.open('', '_blank') popup can
// be treated as a cross-origin frame, so reading win.document throws
// DOMException: SecurityError. Before this guard the throw escaped the React
// onClick and the popup showed nothing, with no message to the visitor. When
// document.write is not allowed, point the popup at a Blob URL of the same HTML
// instead. The blob is created on this origin, so the popup loads it same-origin
// and can print itself (the dress code and calendar docs carry a visible
// Print / Save button). If even that fails, tell the visitor rather than fail
// in silence.
export function renderPrintableWindow(win, html, { printDelay = 350, failMessage } = {}) {
  try {
    win.document.write(html);
    win.document.close();
    win.focus();
    // Give the new document a beat to lay out before the print dialog opens.
    setTimeout(() => { try { win.print(); } catch { /* the visitor can still print from the page */ } }, printDelay);
    return true;
  } catch {
    // document.write threw (Mobile Safari cross-origin popup). Navigating the
    // popup you opened is allowed even when reading its document is not.
    try {
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      win.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    } catch {
      try { win.close(); } catch { /* popup may already be gone */ }
      alert(failMessage || 'Could not open the print view on this device. Try a different browser.');
      return false;
    }
  }
}
