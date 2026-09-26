// Paints in Chromium through the real page:  node test/e2e.mjs  (needs Playwright)
// Taps, flicks and pours paint on a phone-sized screen, checks that splats become things, that paint on an
// existing thing changes it, that two wet splats run together, that signing hangs the painting in the gallery
// (and it's still there after a reload), that nothing scrolls sideways, and that it still loads with the network off.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
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

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('requestfailed', (r) => problems.push('failed: ' + r.url()));
page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) problems.push('left the site: ' + r.url()); });

const S = (fn, arg) => page.evaluate(fn, arg);
const settle = () => page.waitForFunction(() => !window.happyAccidents.busy && !window.happyAccidents.active.length, null, { timeout: 20000 });
const total = () => S(() => Object.entries(window.happyAccidents.counts).filter(([k]) => k !== 'sky').reduce((a, [, n]) => a + n, 0));
const box = async () => page.locator('#canvas').boundingBox();

await page.goto(base);
await page.evaluate(() => document.fonts.ready);
assert.equal(await S(() => document.fonts.check('24px Caprasimo')), true, 'the display font loaded from fonts/');
await S(() => { window.happyAccidents.skipIntro(); window.happyAccidents.newCanvas('golden-hour'); });
await settle();

// A tap in the sky becomes something.
let b = await box();
let before = await total();
await page.mouse.click(b.x + b.width * 0.3, b.y + b.height * 0.2);
await page.waitForTimeout(200);
await settle();
assert.ok((await total()) > before, 'a tap turned into something');
assert.equal(await S(() => window.happyAccidents.accidents), 1);

// A flick: press, drag fast, let go.
before = await total();
await page.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.35);
await page.mouse.down();
for (let i = 1; i <= 6; i++) await page.mouse.move(b.x + b.width * (0.55 + i * 0.03), b.y + b.height * (0.35 - i * 0.015));
await page.mouse.up();
await page.waitForTimeout(200);
await settle();
assert.ok((await total()) > before, 'a flick turned into something');

// Press and hold: the paint pools and grows, then lands when you let go.
await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.85);
await page.mouse.down();
await page.waitForTimeout(900);
const poolR = await S(() => window.happyAccidents.pool && window.happyAccidents.pool.R);
assert.ok(poolR > 20, `holding pools the paint (R ${poolR})`);
await page.mouse.up();
await page.waitForTimeout(200);
await settle();
assert.equal(await S(() => window.happyAccidents.accidents), 3);

// Two wet splats that touch run together into one.
await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  st.addSplat({ x: 640, y: st.hy + 200, R: 22, pigment: PIGMENTS[7], delay: 800 });
  st.addSplat({ x: 660, y: st.hy + 205, R: 22, pigment: PIGMENTS[4], delay: 800 });
});
assert.equal(await S(() => window.happyAccidents.splats.filter((s) => s.state === 'merged').length), 1, 'the second splat ran into the first');
await page.waitForTimeout(200);
await settle();

// Paint on something that's already there changes it: white on a mountain is fresh snow.
await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  st.addSplat({ x: 900, y: st.hy - 220, R: 40, pigment: PIGMENTS[0], hint: 'mountain', delay: 50 });
});
await page.waitForTimeout(200);
await settle();
await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  const m = st.elements.find((e) => e.kind === 'mountain');
  st.addSplat({ x: m.meta.peak[0], y: m.meta.peak[1] + m.meta.hgt * 0.3, R: 20, pigment: PIGMENTS.find((p) => p.id === 'titanium-white'), delay: 50 });
});
await page.waitForTimeout(200);
await settle();
assert.equal(await S(() => window.happyAccidents.counts.snowfall), 1, 'white paint on a mountain made fresh snow');

// Fits a phone: nothing scrolls sideways.
assert.equal(await S(() => document.documentElement.scrollWidth <= innerWidth), true, 'the page scrolls sideways on a phone');

// Sign it: the label shows and the painting goes up in the gallery.
await page.click('#signBtn');
await page.fill('#artistName', 'Robin');
await page.fill('#artTitle', 'Test Pattern at Otter Cove');
await page.click('#signForm button[type=submit]');
await page.waitForSelector('#placard:not([hidden])', { timeout: 15000 });
assert.equal(await page.textContent('#plTitle'), 'Test Pattern at Otter Cove');
assert.equal(await page.textContent('#plArtist'), 'Robin');
assert.match(await page.textContent('#plNote'), /happy accidents/);
await page.click('#keepBtn');
assert.equal(await page.textContent('#galleryCount'), '1');

// The gallery survives a reload.
await page.reload();
await page.evaluate(() => document.fonts.ready);
assert.equal(await page.textContent('#galleryCount'), '1', 'the signed painting is still in the gallery after a reload');
await page.keyboard.press('g');
assert.equal(await page.locator('.wall-item').count(), 1);
await page.keyboard.press('Escape');

// Works offline once it has been opened.
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
await ctx.setOffline(true);
await page.reload();
await page.waitForFunction(() => window.happyAccidents && window.happyAccidents.elements.length > 0, null, { timeout: 15000 });
assert.equal(await page.title(), 'Happy Accidents');
await ctx.setOffline(false);

assert.deepEqual(problems.filter((p) => !p.startsWith('failed:')), [], 'problems while painting');
await browser.close();
server.close();
console.log('all good');
