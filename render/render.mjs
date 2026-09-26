// Offline renderer: drives index.html in headless Chromium, captures every
// frame with supersampled motion blur, and encodes with ffmpeg.
//
//   node render/render.mjs                      full render to dist/showreel.mp4
//   node render/render.mjs --stills 0,300,600   write PNG stills to dist/stills
//   options: --subs 4 --workers 4 --ffmpeg /path/to/ffmpeg
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright'))); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const SUBS = +(args.subs || 4);
const WORKERS = +(args.workers || Math.max(1, Math.min(4, os.cpus().length)));
const FFMPEG = args.ffmpeg || process.env.FFMPEG || 'ffmpeg';
const OUT = path.resolve(ROOT, args.out || 'dist/showreel.mp4');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff': 'font/woff', '.wav': 'audio/wav', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html?render`;

const browser = await chromium.launch({ args: ['--disable-web-security', '--force-color-profile=srgb'] });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto(URL_);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  return page;
}
const grab = (page, f, subs) => page.evaluate(([f, subs]) => {
  window.renderFrameAt(f, subs);
  return document.getElementById('c').toDataURL('image/png').split(',')[1];
}, [f, subs]);

const total = await (await openPage()).evaluate(() => Reel.frames);

if (args.stills) {
  const dir = path.join(ROOT, 'dist/stills'); fs.mkdirSync(dir, { recursive: true });
  const page = await openPage();
  for (const f of String(args.stills).split(',').map(Number)) {
    fs.writeFileSync(path.join(dir, `f${String(f).padStart(4, '0')}.png`), Buffer.from(await grab(page, f, SUBS), 'base64'));
    console.log('still', f);
  }
} else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
  const per = Math.ceil(total / WORKERS);
  const t0 = Date.now();
  let done = 0;
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const a = w * per, b = Math.min(total, a + per);
    if (a >= b) return;
    const page = await openPage();
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '10', '-pix_fmt', 'yuv444p', path.join(tmp, `part${w}.mkv`)], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const buf = Buffer.from(await grab(page, f, SUBS), 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 30 === 0) console.log(`${done}/${total} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise((r, j) => ff.on('close', c => c ? j(new Error('ffmpeg ' + c)) : r()));
  }));
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, Array.from({ length: WORKERS }, (_, w) => `file '${path.join(tmp, `part${w}.mkv`)}'`).filter((_, w) => w * per < total).join('\n'));
  const audio = path.join(ROOT, 'dist/soundtrack.wav');
  const ffArgs = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (fs.existsSync(audio)) ffArgs.push('-i', audio);
  ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'film', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart');
  if (fs.existsSync(audio)) ffArgs.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
  ffArgs.push(OUT);
  execFileSync(FFMPEG, ffArgs, { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${OUT} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
server.close();
