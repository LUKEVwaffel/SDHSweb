#!/usr/bin/env node
// Local silent-print helper for /blooddrive. Browsers can't print without a
// dialog, so the page POSTs its slip sheet HTML here; we render it to PDF with
// headless Chrome and hand it to CUPS (`lp`) — no dialog, straight to paper.
//
//   node scripts/blooddrive-print-helper.mjs            # Brother HL-5340D
//   PRINTER=HP_Color_LaserJet_MFP_M480 node scripts/blooddrive-print-helper.mjs

import http from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 17777;
const PRINTER = process.env.PRINTER || 'Brother_HL_5340D_series';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_BODY = 5 * 1024 * 1024;
const RENDER_TIMEOUT_MS = 30_000;
const workDir = mkdtempSync(join(tmpdir(), 'blooddrive-'));

const run = (cmd, args) => new Promise((resolve, reject) => {
  execFile(cmd, args, { timeout: 60_000 }, (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout)));
});

// Headless Chrome writes the PDF but can hang on exit, so "done" = the PDF
// exists and its size has stopped changing; then kill Chrome.
function renderPdf(htmlPath, pdfPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
      `--user-data-dir=${join(workDir, 'chrome')}`,
      `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`,
    ], { stdio: 'ignore' });
    const started = Date.now();
    let lastSize = -1;
    const timer = setInterval(() => {
      const size = existsSync(pdfPath) ? statSync(pdfPath).size : 0;
      if (size > 0 && size === lastSize) {
        clearInterval(timer);
        child.kill();
        return resolve();
      }
      lastSize = size;
      if (Date.now() - started > RENDER_TIMEOUT_MS) {
        clearInterval(timer);
        child.kill();
        reject(new Error('headless Chrome timed out rendering the PDF'));
      }
    }, 300);
  });
}

async function printHtml(html) {
  const stamp = Date.now();
  const htmlPath = join(workDir, `slips-${stamp}.html`);
  const pdfPath = join(workDir, `slips-${stamp}.pdf`);
  writeFileSync(htmlPath, html);
  await renderPdf(htmlPath, pdfPath);
  await run('lp', ['-d', PRINTER, '-o', 'media=Letter', pdfPath]);
  return pdfPath;
}

function send(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
  });
  res.end(JSON.stringify(body));
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, printer: PRINTER });
  if (req.method !== 'POST' || req.url !== '/print') return send(res, 404, { ok: false, error: 'not found' });

  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > MAX_BODY) req.destroy();
  });
  req.on('end', async () => {
    try {
      const { html, label } = JSON.parse(body);
      if (typeof html !== 'string' || !html.includes('bd-slip')) return send(res, 400, { ok: false, error: 'no slips in payload' });
      const pdf = await printHtml(html);
      console.log(`[${new Date().toLocaleTimeString()}] printed ${label ?? ''} -> ${PRINTER} (${pdf})`);
      send(res, 200, { ok: true, printer: PRINTER });
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] print failed:`, e.message);
      send(res, 500, { ok: false, error: e.message });
    }
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Blood drive print helper on http://127.0.0.1:${PORT} -> ${PRINTER}`);
});
