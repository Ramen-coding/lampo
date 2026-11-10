const {chromium} = require('playwright');
const fs = require('fs'), path = require('path'), {spawn} = require('child_process');
const dir = __dirname;
const svg = f => fs.readFileSync(path.join(dir, f), 'utf8');
const sized = (s, px) => s.replace('<svg ', `<svg width="${px}" height="${px}" `);
const icon = (inner, size, sw = 1.6) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="${sw}">${inner}</svg>`;
const finder = (x, y) => `<rect x="${x + .75}" y="${y + .75}" width="6.5" height="6.5" rx="1.5" stroke="#fff" stroke-width="1.5" fill="none"/><rect x="${x + 2.75}" y="${y + 2.75}" width="2.5" height="2.5" rx=".5" fill="#fff" stroke="none"/>`;
let html = fs.readFileSync(path.join(dir, 'demo.html'), 'utf8')
  .replaceAll('{{LOGO}}', 'data:image/png;base64,' + fs.readFileSync(path.join(dir, '../../assets/logo-mark.png')).toString('base64'))
  .replace('{{QR_PAIR}}', sized(svg('qr-pair.svg'), 120))
  .replace('{{QR_PAY}}', sized(svg('qr-pay.svg'), 150))
  .replace('{{QR_INV}}', sized(svg('qr-invoice.svg'), 248))
  .replace('{{PASTE}}', icon('<rect x="5" y="4" width="14" height="17" rx="2.5"/><rect x="9" y="2.5" width="6" height="3.5" rx="1.2" fill="#000"/><path d="M9 11h6M9 15h4" stroke-linecap="round"/>', 22))
  .replace('{{CAMERA}}', icon('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5"/>', 22))
  .replace('{{QRICON}}', `<svg width="26" height="26" viewBox="0 0 24 24">${finder(2, 2)}${finder(14, 2)}${finder(2, 14)}<path d="M14 14h3v3h-3zM19 14h3v3h-3zM14 19h3v3h-3zM17 17h2v2h-2zM19 19h3v3h-3z" fill="#fff"/></svg>`);
fs.writeFileSync(path.join(require('os').tmpdir(), 'lampo-demo-built.html'), html);

(async () => {
  const fps = +(process.env.FPS || 30), out = process.argv[2], only = process.env.AT;
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1280, height: 720}, deviceScaleFactor: +(process.env.DPR || 1.5)});
  await page.goto('file://' + path.join(require('os').tmpdir(), 'lampo-demo-built.html'));
  await page.evaluate(() => document.fonts.ready);
  if (only) { // istantanee di controllo
    for (const t of only.split(',')) { await page.evaluate(t => render(t), +t); await page.screenshot({path: path.join(require('os').tmpdir(), `snap-${t}.png`)}); }
    return browser.close();
  }
  if (!out) { console.error('usage: node record.js <out.mp4>  (or AT=5,18 node record.js)'); return browser.close(); }
  const dur = await page.evaluate(() => DURATION);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], {stdio: ['pipe', 'inherit', 'inherit']});
  const n = Math.round(dur * fps);
  for (let i = 0; i <= n; i++) {
    await page.evaluate(t => render(t), i / fps);
    const buf = await page.screenshot({type: 'png'});
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
})();
