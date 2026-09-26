// Renders the README screenshots (docs/*.png) and the link preview (og.png):  node tools/screenshots.mjs
// Math.random is seeded, so the same paintings come out every time. Needs Playwright, and upng-js from `npm install`.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const UPNG = require('upng-js');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  try { body = await readFile(join(root, path === '/' ? 'index.html' : path)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const SEED = 7;

// Saves a screenshot with a 256-colour palette, which keeps these painterly pictures a fraction of the size.
async function save(shot, path) {
  const img = UPNG.decode(shot);
  await writeFile(join(root, path), Buffer.from(UPNG.encode(UPNG.toRGBA8(img), img.width, img.height, 256)));
}
const browser = await pw.chromium.launch();
await mkdir(join(root, 'docs'), { recursive: true });

async function open(viewport, deviceScaleFactor) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(seed => {
    let a = seed; // mulberry32
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }, SEED);
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { window.happyAccidents.skipIntro(); window.happyAccidents.newCanvas('autumn-blaze'); });
  await settle(page);
  return page;
}

// Waits until nothing is being painted and no splat is still wet.
const settle = (page) => page.waitForFunction(() => !window.happyAccidents.busy && !window.happyAccidents.active.length, null, { timeout: 30000 });

// Splats aimed by hand, one at a time, so the painting comes out the same every run.
async function paint(page) {
  const splats = [
    { x: 520, y: -230, R: 44, vx: 1.3, vy: -0.2, paint: 'titanium-white', hint: 'mountain' },
    { x: 290, y: 110, R: 34, paint: 'titanium-white', hint: 'cloud' },
    { x: 1010, y: 150, R: 30, paint: 'titanium-white', hint: 'cloud' },
    { x: 150, y: 250, R: 44, paint: 'sap-green', hint: 'bank' },
    { x: 1060, y: 280, R: 42, paint: 'sap-green', hint: 'bank' },
    { x: 150, y: 240, R: 40, paint: 'sap-green', hint: 'tree', vx: 0, vy: 1.4 },
    { x: 240, y: 270, R: 36, paint: 'bright-red', hint: 'tree' },
    { x: 1080, y: 250, R: 38, paint: 'phthalo-blue', hint: 'tree', vx: 0, vy: 1.4 },
    { x: 660, y: 110, R: 30, paint: 'van-dyke-brown', hint: 'tree' },
    { x: 760, y: 70, R: 12, paint: 'van-dyke-brown', hint: 'birds' },
  ];
  for (const s of splats) {
    await page.evaluate(async (s) => {
      const S = window.happyAccidents;
      const { PIGMENTS } = await import('./src/schemes.js');
      // y is measured from the horizon when it's below 0 or when the splat is meant for the lake or land.
      const below = ['bank', 'tree'].includes(s.hint);
      const y = s.y < 0 ? S.hy + s.y : below ? S.hy + s.y : s.y;
      let { x } = s;
      if (s.hint === 'tree' && !S.isLand(x, y)) {
        const p = S.findLand();
        if (p) x = p.x;
      }
      S.addSplat({ x, y, R: s.R, vx: s.vx || 0, vy: s.vy || 0, pigment: PIGMENTS.find((p) => p.id === s.paint), hint: s.hint, delay: 80 });
    }, s);
    await page.waitForTimeout(150);
    await settle(page);
  }
}

// Phone: a painting on the easel, a splat still wet, and a signed painting on its label.
{
  const page = await open({ width: 390, height: 844 }, 2);
  await paint(page);
  await save(await page.screenshot(), 'docs/phone-painting.png');

  await page.evaluate(async () => {
    const S = window.happyAccidents;
    const { PIGMENTS } = await import('./src/schemes.js');
    S.addSplat({ x: 900, y: 200, R: 30, vx: 1.6, vy: 0.4, pigment: PIGMENTS.find((p) => p.id === 'phthalo-blue'), delay: 600000 });
  });
  await page.waitForTimeout(400);
  await save(await page.screenshot(), 'docs/phone-splat.png');

  await page.evaluate(() => { window.happyAccidents.newCanvas('golden-hour'); });
  await settle(page);
  await paint(page);
  await page.click('#signBtn');
  await page.fill('#artistName', 'Robin');
  await page.click('#signForm button[type=submit]');
  await page.waitForSelector('#placard:not([hidden])');
  await page.waitForTimeout(500);
  await save(await page.screenshot(), 'docs/phone-signed.png');
  await page.context().close();
}

// Laptop: the whole studio.
{
  const page = await open({ width: 1280, height: 800 }, 1);
  await paint(page);
  await save(await page.screenshot(), 'docs/desktop.png');
  await page.context().close();
}

// Link preview, 1200 x 630: the name and one line on the left, a painting on its easel on the right,
// with one fresh splat still wet. Saved with a 256-colour palette to keep the file small.
{
  const page = await open({ width: 1440, height: 900 }, 1);
  await paint(page);
  await page.evaluate(async () => {
    const S = window.happyAccidents;
    const { PIGMENTS } = await import('./src/schemes.js');
    S.addSplat({ x: 800, y: 150, R: 28, vx: 1.6, vy: 0.5, pigment: PIGMENTS.find((p) => p.id === 'phthalo-blue'), delay: 600000 });
  });
  await page.waitForTimeout(400);
  const painting = await page.evaluate(() => document.getElementById('canvas').toDataURL('image/png'));
  const font = async (f) => `data:font/woff2;base64,${(await readFile(join(root, 'fonts', f))).toString('base64')}`;
  const dabs = ['#f4f2ea', '#f2c21a', '#c48a33', '#df8a17', '#c9321f', '#7e1b2e', '#3f5c23', '#15418a', '#12294a', '#3e2b1d'];
  const card = await page.context().newPage();
  await card.setViewportSize({ width: 1200, height: 630 });
  await card.setContent(`<!doctype html><style>
    @font-face { font-family: Caprasimo; src: url(${await font('caprasimo.woff2')}); }
    @font-face { font-family: Figtree; font-weight: 400 700; src: url(${await font('figtree.woff2')}); }
    body { margin: 0; width: 1200px; height: 630px; overflow: hidden; position: relative; color: #f1e9dc; font-family: Figtree;
      background: radial-gradient(ellipse 620px 480px at 870px 300px, rgba(255,226,180,.10), transparent 70%), #15110e; }
    .text { position: absolute; left: 66px; top: 0; bottom: 0; width: 460px; display: flex; flex-direction: column; justify-content: center; gap: 26px; }
    h1 { margin: 0; font: 400 88px/.98 Caprasimo; }
    p { margin: 0; font-size: 29px; line-height: 1.32; font-weight: 500; color: #d8cab6; }
    .dabs { display: flex; gap: 9px; margin-top: 6px; }
    .dab { width: 30px; height: 26px; border-radius: 52% 48% 60% 40% / 55% 60% 40% 45%; box-shadow: inset 0 -3px 4px rgba(0,0,0,.25), 0 2px 2px rgba(0,0,0,.35);
      background: radial-gradient(circle at 34% 30%, rgba(255,255,255,.6) 0 7%, transparent 20%), var(--c); }
    .easel { position: absolute; left: 574px; top: 84px; width: 568px; }
    .easel img { display: block; width: 568px; height: 426px; border-radius: 2px;
      box-shadow: 0 0 0 1px rgba(0,0,0,.5), 5px 5px 0 0 #d8d1c2, 5px 5px 0 1px rgba(0,0,0,.45), 0 34px 70px -24px rgba(0,0,0,.95); }
    .clamp { position: absolute; left: 50%; top: -16px; width: 24px; height: 28px; transform: translateX(-50%); z-index: 2; border-radius: 3px 3px 0 0;
      background: linear-gradient(90deg, #5a3d24, #b08455 45%, #86603a 70%, #5a3d24); }
    .ledge { position: relative; z-index: 2; height: 16px; margin: -3px -18px 0; border-radius: 2px;
      background: linear-gradient(180deg, #b08455, #86603a 45%, #5a3d24); box-shadow: 0 12px 24px -8px rgba(0,0,0,.8); }
  </style>
  <div class="text">
    <h1>Happy Accidents</h1>
    <p>Flick paint at a canvas. A gentle painter turns every splat into part of the landscape.</p>
    <div class="dabs">${dabs.map((c) => `<span class="dab" style="--c:${c}"></span>`).join('')}</div>
  </div>
  <div class="easel"><div class="clamp"></div><img src="${painting}"><div class="ledge"></div></div>`);
  await card.evaluate(() => document.fonts.ready);
  await save(await card.screenshot(), 'og.png');
  await page.context().close();
}

await browser.close();
server.close();
console.log('screenshots written');
