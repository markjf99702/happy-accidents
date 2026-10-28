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
// From here on (until the next reload), every line the painter says is kept in window.said, emptied on each call.
const listen = () => S(() => {
  const st = window.happyAccidents;
  window.said = [];
  if (st.hooks.listening) return;
  const narrate = st.hooks.onNarrate;
  st.hooks.onNarrate = (n) => {
    window.said.push(n.line);
    narrate(n);
  };
  st.hooks.listening = true;
});

await page.goto(base);
await page.evaluate(() => document.fonts.ready);
assert.equal(await S(() => document.fonts.check('24px Caprasimo')), true, 'the display font loaded from fonts/');
await S(() => window.happyAccidents.skipIntro());

// On a phone the header line wraps, but the mood's name stays in one piece (not WINTER / HUSH).
for (const id of await S(async () => (await import('./src/schemes.js')).SCHEMES.map((s) => s.id))) {
  await S((id) => window.happyAccidents.newCanvas(id), id);
  assert.equal(await S(() => document.getElementById('schemeName').getClientRects().length), 1, `the mood's name is split across lines (${id})`);
}

await S(() => window.happyAccidents.newCanvas('golden-hour'));
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

// Two wet splats that touch run together into one, and their paints mix like paint: yellow into blue is green,
// and green in the lake makes land.
before = await total();
await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  const paint = (id) => PIGMENTS.find((p) => p.id === id);
  st.addSplat({ x: 640, y: st.hy + 200, R: 22, pigment: paint('cadmium-yellow'), delay: 800 });
  st.addSplat({ x: 660, y: st.hy + 205, R: 22, pigment: paint('phthalo-blue'), delay: 800 });
});
assert.equal(await S(() => window.happyAccidents.splats.filter((s) => s.state === 'merged').length), 1, 'the second splat ran into the first');
assert.equal(await S(() => window.happyAccidents.splats.find((s) => s.mixPigment).mixPigment.family), 'green', 'yellow and blue mixed into green');
await page.waitForTimeout(300);
assert.match(await page.textContent('#line'), /green/, 'the painter says what color it made');
await page.waitForTimeout(200);
await settle();
const made = await S(() => ['bank', 'island'].reduce((n, k) => n + (window.happyAccidents.counts[k] || 0), 0));
assert.ok(made >= 1, 'the green mix in the lake became land');

// Picking another paint keeps a fresh splat wet long enough to hit it again.
await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  st.addSplat({ x: 300, y: st.hy * 0.3, R: 20, pigment: PIGMENTS[0], delay: 300 });
});
await page.click('[data-id="bright-red"]');
await page.waitForTimeout(900);
assert.equal(await S(() => window.happyAccidents.splats.filter((s) => s.state === 'wet').length), 1, 'the splat is still wet after picking a new paint');
await page.click('[data-id="surprise"]');
await page.waitForTimeout(2000);
await settle();

// One finger paints at a time: a finger that comes down while another is painting is ignored. Two fingers tapped
// together make one splat, where the first one landed, and a second finger can't move a puddle the first is pouring.
// And if the canvas loses hold of a finger without hearing it lift, the next touch still paints.
const cdp = await ctx.newCDPSession(page);
const finger = (u, v, id) => ({ x: b.x + b.width * u, y: b.y + b.height * v, id });
const touch = (type, touchPoints = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
const splatsAt = () => S(() => window.happyAccidents.splats.map((s) => Math.round(s.x)));
await S(() => window.happyAccidents.newCanvas('golden-hour'));
await settle();
b = await box();
await touch('touchStart', [finger(0.25, 0.3, 0)]);
await touch('touchStart', [finger(0.25, 0.3, 0), finger(0.75, 0.3, 1)]);
await touch('touchEnd');
await page.waitForTimeout(200);
assert.deepEqual(await splatsAt(), [300], 'a two-finger tap made one splat, where the first finger landed');
await S(() => window.happyAccidents.newCanvas('golden-hour'));
await settle();
await touch('touchStart', [finger(0.2, 0.8, 0)]);
await page.waitForTimeout(600);
await touch('touchStart', [finger(0.2, 0.8, 0), finger(0.8, 0.8, 1)]);
await page.waitForTimeout(500);
assert.equal(await S(() => Math.round(window.happyAccidents.pool?.x)), 240, 'a second finger moved the puddle the first was pouring');
await touch('touchEnd');
await page.waitForTimeout(200);
assert.deepEqual(await splatsAt(), [240], 'the puddle landed somewhere other than where the first finger poured it');
await settle();
await S(() => document.getElementById('canvas').addEventListener('pointerdown', (e) => (window.downId = e.pointerId), { once: true }));
await touch('touchStart', [finger(0.5, 0.3, 0)]);
await touch('touchMove', [finger(0.51, 0.3, 0)]); // the canvas has hold of the finger from its first move
await S(() => document.getElementById('canvas').releasePointerCapture(window.downId));
await touch('touchMove', [{ x: b.x + b.width * 0.5, y: b.y - 30, id: 0 }]);
await touch('touchEnd');
before = await S(() => window.happyAccidents.accidents);
await touch('touchStart', [finger(0.5, 0.3, 1)]);
await touch('touchEnd');
await page.waitForTimeout(200);
assert.equal(await S(() => window.happyAccidents.accidents), before + 1, 'after the canvas lost hold of a finger, the next touch didn’t paint');
assert.equal(await S(() => window.happyAccidents.pool), null, 'the lost finger left a puddle on the canvas');
await settle();

// Paint on something that's already there changes it: white on a mountain is fresh snow.
await S(() => window.happyAccidents.newCanvas('golden-hour'));
await settle();
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

// A tree with no ground beside it (on an island, or at the tip of a bank) can't get company. Paint that isn't white or
// warm catches the light on it instead, just once, and the painter doesn't say a friend showed up.
await S(() => window.happyAccidents.newCanvas('golden-hour'));
await settle();
await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  st.addSplat({ x: st.W * 0.5, y: st.hy + (st.H - st.hy) * 0.5, R: 40, pigment: PIGMENTS.find((p) => p.id === 'sap-green'), hint: 'tree', delay: 50 });
});
await page.waitForTimeout(200);
await settle();
await S(() => {
  const st = window.happyAccidents;
  st.mctx.clearRect(0, 0, st.mask.width, st.mask.height); // no ground anywhere beside the island's tree now
});
await listen();
for (let i = 0; i < 2; i++) {
  await S(async () => {
    const { PIGMENTS } = await import('./src/schemes.js');
    const st = window.happyAccidents;
    const tree = st.elements.find((e) => ['evergreen', 'deciduous', 'bush'].includes(e.kind));
    let spot = st.spotOn(tree);
    for (let k = 0; k < 30 && st.elementAt(spot.x, spot.y, spot.R) !== tree; k++) spot = st.spotOn(tree);
    st.addSplat({ ...spot, pigment: PIGMENTS.find((p) => p.id === 'phthalo-blue'), delay: 50 });
  });
  await page.waitForTimeout(200);
  await settle();
}
const lonely = await S(async () => {
  const { LINES } = await import('./src/words.js');
  return { glows: window.happyAccidents.counts.treeGlow || 0, company: window.said.filter((l) => LINES.company.includes(l)) };
});
assert.deepEqual(lonely.company, [], 'the painter said a tree got company, but no friend grew');
assert.equal(lonely.glows, 1, `light caught a tree with no ground beside it once, not again and again (${lonely.glows})`);

// At night it's the moon up there, and the painter calls it the moon: warm paint on it lights up the sky around it,
// and other paint drifts a cloud across it.
await S(() => window.happyAccidents.newCanvas('northern-night'));
await settle();
await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  st.addSplat({ x: st.W * 0.3, y: st.hy * 0.3, R: 24, pigment: PIGMENTS.find((p) => p.id === 'titanium-white'), hint: 'sun', delay: 50 });
});
await page.waitForTimeout(200);
await settle();
await listen();
for (const id of ['cadmium-yellow', 'phthalo-blue']) {
  await S(async (id) => {
    const { PIGMENTS } = await import('./src/schemes.js');
    const st = window.happyAccidents;
    st.addSplat({ ...st.spotOn(st.elements.find((e) => e.kind === 'moon')), pigment: PIGMENTS.find((p) => p.id === id), delay: 50 });
  }, id);
  await page.waitForTimeout(200);
  await settle();
}
const night = await S(() => ({ said: window.said, glow: window.happyAccidents.counts.sunset || 0 }));
assert.equal(night.glow, 1, 'warm paint on the moon lit up the sky');
assert.ok(night.said.length >= 2 && night.said.every((l) => !/\bsun\b/.test(l)), `the painter called the moon the sun (${night.said.join(' / ')})`);

// Land laid over the lake covers whatever was floating there: a sailboat under the new ground goes behind it (the tip
// of its sail can still show over the top) instead of sitting on the grass.
await S(() => window.happyAccidents.newCanvas('golden-hour'));
await settle();
await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  st.addSplat({ x: st.W * 0.6, y: st.hy + (st.H - st.hy) * 0.5, R: 24, pigment: PIGMENTS.find((p) => p.id === 'titanium-white'), delay: 50 });
});
await page.waitForTimeout(200);
await settle();
await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  const { meta } = st.elements.find((e) => e.kind === 'sailboat');
  st.addSplat({ x: meta.x, y: meta.y, R: 44, pigment: PIGMENTS.find((p) => p.id === 'sap-green'), hint: 'bank', delay: 50 });
});
await page.waitForTimeout(200);
await settle();
const ashore = await S(() => {
  const st = window.happyAccidents;
  const boat = st.elements.find((e) => e.kind === 'sailboat');
  const land = st.elements.find((e) => e.kind === 'bank');
  return { underLand: st.isLand(boat.meta.x, boat.meta.y - 2), inFront: st.elements.indexOf(boat) > st.elements.indexOf(land) };
});
assert.ok(ashore.underLand, 'the land was laid over the sailboat');
assert.equal(ashore.inFront, false, 'the sailboat sat on the grass, in front of the land laid over it');

// The paint's color decides what a splat becomes. Each check starts on a clean canvas and reports what got painted.
// where: { sky: 0..1 } is from the top of the canvas down to the horizon; { lake: 0..1 } from the horizon down;
// 'land' is a spot on a bank of Sap Green land laid down first.
async function paintWith(id, where, R, hint) {
  await S(() => window.happyAccidents.newCanvas('golden-hour'));
  await settle();
  if (where === 'land') {
    await S(async () => {
      const { PIGMENTS } = await import('./src/schemes.js');
      const st = window.happyAccidents;
      st.addSplat({ x: st.W * 0.2, y: st.hy + (st.H - st.hy) * 0.6, R: 40, pigment: PIGMENTS.find((p) => p.id === 'sap-green'), hint: 'bank', delay: 50 });
    });
    await page.waitForTimeout(200);
    await settle();
  }
  const before = await S(() => ({ ...window.happyAccidents.counts }));
  await S(async ({ id, where, R, hint }) => {
    const { PIGMENTS } = await import('./src/schemes.js');
    const st = window.happyAccidents;
    let x = st.W * (where.x ?? 0.5);
    let y = where.sky !== undefined ? where.sky * st.hy : st.hy + (where.lake ?? 0) * (st.H - st.hy);
    if (where === 'land') {
      const spots = st.elements.find((e) => e.kind === 'bank').meta.spots;
      [x, y] = spots[Math.floor(spots.length / 2)];
    }
    st.addSplat({ x, y, R, pigment: PIGMENTS.find((p) => p.id === id), hint, delay: 50 });
  }, { id, where, R, hint });
  await page.waitForTimeout(200);
  await settle();
  const after = await S(() => ({ ...window.happyAccidents.counts }));
  return Object.keys(after).filter((k) => (after[k] || 0) > (before[k] || 0));
}
const lastCloudLum = () => S(() => {
  const c = window.happyAccidents.elements.filter((e) => e.kind === 'cloud').pop().meta.light;
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
});

assert.ok((await paintWith('titanium-white', { lake: 0.4 }, 24)).includes('sailboat'), 'white out on the lake is a sailboat');
assert.ok((await paintWith('bright-red', { lake: 0.45 }, 20)).includes('canoe'), 'red on the lake is a canoe');
assert.ok((await paintWith('yellow-ochre', { x: 0.12, lake: 0.6 }, 36)).includes('bank'), 'ochre by the shore is land');
let kinds = await paintWith('van-dyke-brown', { sky: 0.25 }, 34);
assert.ok(kinds.includes('cloud') && (await lastCloudLum()) < 0.5, `brown high in the sky is a dark cloud, not a white one (${kinds})`);
kinds = await paintWith('titanium-white', { sky: 0.3, x: 0.3 }, 30);
assert.ok(kinds.includes('sun') || (kinds.includes('cloud') && (await lastCloudLum()) > 0.8), `white high in the sky is a white cloud or the sun (${kinds})`);
assert.deepEqual(await paintWith('van-dyke-brown', { sky: 0.3 }, 12), ['birds'], 'a small brown fleck up high is birds');
kinds = await paintWith('phthalo-blue', { sky: 0.8 }, 40);
assert.ok(kinds.length && kinds.every((k) => ['mountain', 'cloud', 'birds'].includes(k)), `blue low in the sky is a mountain, a cloud or birds (${kinds})`);
kinds = await paintWith('sap-green', 'land', 30, 'tree');
assert.ok(['evergreen', 'deciduous', 'bush'].some((k) => kinds.includes(k)), `green on land is a tree (${kinds})`);
kinds = await paintWith('titanium-white', 'land', 30, 'tree');
assert.ok(kinds.includes('treeSnow') || kinds.includes('deciduous'), `white on land is a snowy tree or a birch (${kinds})`);
kinds = await paintWith('phthalo-blue', 'land', 30, 'tree');
assert.ok(kinds.includes('evergreen'), `blue on land is a blue spruce (${kinds})`);

// Let it happen aims the loaded paint where it makes sense. Yellow Ochre makes land, so some of its accidents go to the
// shore; Cadmium Yellow doesn't, so none of its do.
const aimed = await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  const hints = (id) =>
    Array.from({ length: 30 }, () => {
      st.newCanvas('golden-hour');
      return st.randomAccident({ pigment: PIGMENTS.find((p) => p.id === id) }).hint;
    });
  return { ochre: hints('yellow-ochre'), cadmium: hints('cadmium-yellow') };
});
assert.ok(aimed.ochre.includes('bank'), `Let it happen never aimed Yellow Ochre at the shore (${aimed.ochre})`);
assert.ok(!aimed.cadmium.includes('bank'), `Let it happen aimed Cadmium Yellow at the shore (${aimed.cadmium})`);

// Things painted near the edges stay on the canvas: the sun or moon from paint at the very top, the bush beside a
// cabin built at the edge of a bank, and the trees climbing a green mountain near a side.
const outside = await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const { makeSplat } = await import('./src/splat.js');
  const { decide } = await import('./src/decide.js');
  const st = window.happyAccidents;
  const paint = (id) => PIGMENTS.find((p) => p.id === id);
  const out = [];
  const off = (what, x0, x1, y0 = 0) => (x0 < 0 || x1 > st.W || y0 < 0) && out.push(`${what} at ${Math.round(x0)}..${Math.round(x1)}`);
  for (let i = 0; i < 12; i++) {
    st.newCanvas(i % 2 ? 'northern-night' : 'golden-hour');
    const x = i % 3 === 0 ? 4 : i % 3 === 1 ? st.W - 4 : st.W * 0.5;
    const { meta: m } = decide(st, makeSplat({ x, y: 6, R: 60, pigment: paint('titanium-white'), hint: 'sun' }))[0].make();
    off('the sun', m.x - m.r, m.x + m.r, m.y - m.r);
  }
  let cabins = 0;
  for (let i = 0; i < 16; i++) {
    st.newCanvas('golden-hour');
    const left = i % 2 === 0;
    st.lightDir = left ? 1 : -1; // the bush's shady side faces the near edge
    const bank = decide(st, makeSplat({ x: st.W * (left ? 0.1 : 0.9), y: st.hy + (st.H - st.hy) * 0.4, R: 40, pigment: paint('sap-green'), hint: 'bank' }))[0].make();
    const spot = bank.meta.spots.find(([sx, sy]) => (left ? sx < 60 : sx > st.W - 60) && st.isLand(sx, sy));
    if (!spot) continue;
    const plan = decide(st, makeSplat({ x: spot[0], y: spot[1], R: 30, pigment: paint('van-dyke-brown'), hint: 'cabin' }));
    if (plan[0].kind !== 'cabin') continue;
    cabins++;
    const cabin = plan[0].make();
    const bush = plan[1].make(cabin);
    off('a cabin’s bush', bush.meta.x, bush.meta.x);
  }
  for (let i = 0; i < 24; i++) {
    st.newCanvas('golden-hour');
    const plan = decide(st, makeSplat({ x: i % 2 ? 30 : st.W - 30, y: st.hy - st.H * 0.25, R: 50, pigment: paint('sap-green'), hint: 'mountain' }));
    const hill = plan[0].make();
    const trees = plan[1].make(hill);
    off('a green mountain’s trees', trees.bbox.x + trees.bbox.w / 2, trees.bbox.x + trees.bbox.w / 2);
  }
  return { out, cabins };
});
assert.ok(outside.cabins >= 8, `only ${outside.cabins} cabins were built at the edge of a bank`);
assert.deepEqual(outside.out, [], 'something was painted off the canvas');

// A cabin's layer leaves room for its chimney smoke instead of cutting it off flat. At golden hour a cabin has its
// lights on and smoke going from the start; on a misty morning, yellow on it does that. Nothing reaches the top edge.
// (The bank goes halfway down the lake. A cabin only fits less than 0.62 of the way down, and the bank's middle spot
// sits a little below the bank; from 0.55 it now and then landed past that and grew a tree, about 1 run in 100.)
for (const mood of ['golden-hour', 'misty-morning']) {
  await S((mood) => window.happyAccidents.newCanvas(mood), mood);
  await settle();
  await S(async () => {
    const { PIGMENTS } = await import('./src/schemes.js');
    const st = window.happyAccidents;
    st.addSplat({ x: st.W * 0.3, y: st.hy + (st.H - st.hy) * 0.5, R: 48, pigment: PIGMENTS.find((p) => p.id === 'sap-green'), hint: 'bank', delay: 50 });
  });
  await page.waitForTimeout(200);
  await settle();
  await S(async () => {
    const { PIGMENTS } = await import('./src/schemes.js');
    const st = window.happyAccidents;
    const spots = st.elements.find((e) => e.kind === 'bank').meta.spots;
    const [x, y] = spots[Math.floor(spots.length / 2)];
    st.addSplat({ x, y, R: 40, pigment: PIGMENTS.find((p) => p.id === 'van-dyke-brown'), hint: 'cabin', delay: 50 });
  });
  await page.waitForTimeout(200);
  await settle();
  if (mood === 'misty-morning') {
    await S(async () => {
      const { PIGMENTS } = await import('./src/schemes.js');
      const st = window.happyAccidents;
      const m = st.elements.find((e) => e.kind === 'cabin').meta;
      st.addSplat({ x: (m.x0 + m.x1) / 2, y: m.baseY - m.size * 0.2, R: 16, pigment: PIGMENTS.find((p) => p.id === 'cadmium-yellow'), delay: 50 });
    });
    await page.waitForTimeout(200);
    await settle();
  }
  const cabin = await S(() => {
    const c = window.happyAccidents.elements.find((e) => e.kind === 'cabin');
    if (!c) return null;
    const row = c.ctx.getImageData(0, 0, c.canvas.width, 1).data;
    let top = 0;
    for (let i = 3; i < row.length; i += 4) top = Math.max(top, row[i]);
    return { glow: c.meta.glow, top };
  });
  assert.ok(cabin, `a cabin was painted (${mood})`);
  assert.equal(cabin.glow, true, `the cabin's lights are on (${mood})`);
  assert.equal(cabin.top, 0, `the chimney smoke runs into the top edge of the cabin's layer (${mood})`);
}

// Fits a phone: nothing scrolls sideways. Nor on a tablet, in the same stacked layout.
assert.equal(await S(() => document.documentElement.scrollWidth <= innerWidth), true, 'the page scrolls sideways on a phone');
for (const width of [600, 768, 959]) {
  await page.setViewportSize({ width, height: 1000 });
  assert.equal(await S(() => document.documentElement.scrollWidth <= innerWidth), true, `the page scrolls sideways at ${width} px wide`);
}

// A phone held sideways gets the side-by-side layout, packed to fit one screen: the whole canvas on the left, the
// palette and all four buttons beside it. The page itself doesn't scroll, so nothing needs a swipe on the canvas, which
// would paint. (Checked with the longest brush line, which takes three lines there.)
for (const [width, height] of [[844, 390], [667, 375]]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(300);
  const sideways = await S(() => {
    const lineEl = document.getElementById('line');
    const toolEl = document.getElementById('tool');
    const was = [lineEl.textContent, toolEl.textContent];
    lineEl.textContent = 'Your turn. Tap, flick, or press and hold. Try hitting what’s already there, too.';
    toolEl.textContent = 'Round brush · Sap Green, Yellow Ochre, Van Dyke Brown · a touch of Alizarin Crimson';
    const at = (id) => document.getElementById(id).getBoundingClientRect();
    const inside = (r) => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    const canvas = at('canvas');
    const seen = {
      canvas: inside(canvas),
      offScreen: ['line', 'palette', 'oopsBtn', 'autoBtn', 'newBtn', 'signBtn'].filter((id) => !inside(at(id))),
      beside: at('palette').left >= canvas.right,
      scrolls: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
    };
    [lineEl.textContent, toolEl.textContent] = was;
    return seen;
  });
  assert.deepEqual(sideways, { canvas: true, offScreen: [], beside: true, scrolls: false }, `held sideways at ${width} × ${height}`);
}

// With a notch at each side, as on an iPhone held sideways, nothing is drawn under it: not the page, not the gallery wall.
await page.setViewportSize({ width: 844, height: 390 });
const notched = await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, right: 47, bottom: 21 } }).then(() => true, () => false);
if (notched) {
  await page.waitForTimeout(300);
  const clear = () => S(() => {
    const under = [];
    for (const sel of ['.top', '#canvas', '.tray', '.wall']) {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      if (el.closest('[hidden]')) continue;
      if (r.left < 47 || r.right > innerWidth - 47) under.push(`${sel} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    return under;
  });
  assert.deepEqual(await clear(), [], 'the page sits under the notch');
  await page.keyboard.press('g');
  assert.deepEqual(await clear(), [], 'the gallery wall sits under the notch');
  await page.keyboard.press('Escape');
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 0 } });
} else {
  console.log('(this Chromium can’t pretend to have a notch, so that check was skipped)');
}
await page.setViewportSize({ width: 390, height: 844 });

// On a phone the palette and buttons stay put while the painter talks: every line the painter says fits the two lines
// kept for it, and the brush line under it keeps room for two whether it says nothing, a little or a lot.
const oopsAt = await S(async () => {
  const { LINES } = await import('./src/words.js');
  const lineEl = document.getElementById('line');
  const toolEl = document.getElementById('tool');
  const was = [lineEl.textContent, toolEl.textContent];
  const ys = new Set();
  for (const text of Object.values(LINES).flat()) {
    for (const info of ['', '1-inch brush · Titanium White', 'Round brush · Sap Green, Yellow Ochre, Van Dyke Brown · a touch of Alizarin Crimson']) {
      lineEl.textContent = text;
      toolEl.textContent = info;
      ys.add(Math.round(document.getElementById('oopsBtn').getBoundingClientRect().y));
    }
  }
  [lineEl.textContent, toolEl.textContent] = was;
  return [...ys];
});
assert.equal(oopsAt.length, 1, `the buttons moved as the painter talked, to ${oopsAt.join(', ')} px`);

// The S key opens the sign form without typing an "s" into it.
const watchTyping = () => S(() => {
  window.typed = [];
  for (const id of ['artistName', 'artTitle']) document.getElementById(id).addEventListener('input', (e) => window.typed.push(`${id}: ${e.data}`));
});
await watchTyping();
await page.keyboard.press('s');
assert.equal(await page.isHidden('#signSheet'), false, 'S opens the sign form');
assert.equal(await page.getByRole('dialog', { name: 'Sign your painting' }).count(), 1, 'the sign form is a dialog named for its heading');
assert.equal(await page.getByRole('textbox', { name: 'Title', exact: true }).count(), 1, 'the title field is named just Title');
assert.equal(await S(() => document.activeElement.id), 'artistName', 'with no name saved yet, S starts in the name field');
assert.deepEqual(await S(() => window.typed), [], 'pressing S typed into the sign form');
await page.keyboard.press('Escape');

// Sign it: the label shows and the painting goes up in the gallery. Anything still being painted when you sign is
// finished before the painting is framed, even something slow (here a splat that stays wet for eight seconds, longer
// than the wait used to last), and until then New canvas, Sign it, Let it happen and the gallery wall wait, from the
// buttons or the keys. (Paint another on an older painting from the wall would start over under the signature.)
await S(async () => {
  const { PIGMENTS } = await import('./src/schemes.js');
  const st = window.happyAccidents;
  st.addSplat({ x: st.W * 0.7, y: st.hy * 0.3, R: 20, pigment: PIGMENTS[0], delay: 8000 });
  window.framedBusy = [];
  const snapshot = st.snapshot.bind(st);
  st.snapshot = (...args) => {
    window.framedBusy.push(st.busy);
    return snapshot(...args);
  };
});
await page.click('#signBtn');
await page.fill('#artistName', 'Robin');
await page.fill('#artTitle', 'Test Pattern at Otter Cove');
await page.click('#signForm button[type=submit]');
const canvasNo = await page.textContent('#canvasNo');
await page.click('#newBtn');
assert.equal(await page.textContent('#canvasNo'), canvasNo, 'New canvas waits while the painting is being signed');
await page.click('#signBtn');
assert.equal(await page.isHidden('#signSheet'), true, 'Sign it waits while the painting is being signed');
await page.click('#autoBtn');
assert.equal(await page.getAttribute('#autoBtn', 'aria-pressed'), 'false', 'Let it happen waits while the painting is being signed');
await page.click('#galleryBtn');
assert.equal(await page.isHidden('#gallery'), true, 'Gallery waits while the painting is being signed');
for (const key of ['n', 's', 'a', 'g']) await page.keyboard.press(key);
assert.equal(await page.textContent('#canvasNo'), canvasNo, 'N waits while the painting is being signed');
assert.equal(await page.isHidden('#signSheet'), true, 'S waits while the painting is being signed');
assert.equal(await page.getAttribute('#autoBtn', 'aria-pressed'), 'false', 'A waits while the painting is being signed');
assert.equal(await page.isHidden('#gallery'), true, 'G waits while the painting is being signed');
await page.waitForSelector('#placard:not([hidden])', { timeout: 30000 });
assert.deepEqual(await S(() => window.framedBusy), [false, false], 'the painting was framed while paint on it was still going on');
assert.equal(await page.textContent('#plTitle'), 'Test Pattern at Otter Cove');
assert.equal(await page.textContent('#plArtist'), 'Robin');
assert.match(await page.textContent('#plNote'), /happy accidents/);
assert.equal(await S(() => document.getElementById('app').inert), true, 'the page behind the label is out of reach');
await page.click('#keepBtn');
assert.equal(await page.textContent('#galleryCount'), '1');
assert.equal(await S(() => document.getElementById('app').inert), false);
assert.equal(await S(() => document.activeElement.id), 'signBtn', 'after the label, focus goes back to Sign it');

// Paint added after signing isn't on the wall, so New canvas asks first.
await page.click('#oopsBtn');
await page.waitForTimeout(200);
await settle();
await page.click('#newBtn');
assert.equal(await page.textContent('#newBtn'), 'Start over?', 'New canvas asks first when paint was added after signing');
assert.equal(await page.textContent('#canvasNo'), canvasNo, 'the first tap of New canvas kept the painting');

// So does Paint another on a painting opened from the wall: the first tap asks, and only a second one starts over.
await page.click('#galleryBtn');
await page.click('.wall-open');
await page.click('#anotherBtn');
assert.equal(await page.textContent('#anotherBtn'), 'Start over?', 'Paint another on a painting from the wall asks first when the easel has paint that isn’t hung');
assert.equal(await page.textContent('#canvasNo'), canvasNo, 'the first tap of Paint another kept the painting');
await page.click('#anotherBtn');
assert.notEqual(await page.textContent('#canvasNo'), canvasNo, 'a second tap of Paint another starts over');
assert.equal(await page.isHidden('#placard'), true);

// The gallery survives a reload.
await page.reload();
await page.evaluate(() => document.fonts.ready);
assert.equal(await page.textContent('#galleryCount'), '1', 'the signed painting is still in the gallery after a reload');
await page.keyboard.press('g');
assert.equal(await page.locator('.wall-item').count(), 1);
await page.keyboard.press('Escape');

// Shift (or Caps Lock) doesn't stop the letter keys: the key hints show them as capitals.
await page.keyboard.press('Shift+G');
assert.equal(await page.isHidden('#gallery'), false, 'Shift+G opens the gallery');
await page.keyboard.press('Escape');

// The phone's Back button closes the overlay on top instead of leaving the page: the gallery wall, a painting opened
// from it, and the sign form. Closing one with its own button takes its step off the history again.
const goBack = async (id) => {
  await S(() => history.back());
  await page.waitForFunction((id) => document.getElementById(id)?.hidden !== false, id);
  assert.equal(await S(() => window.stillHere), true, `Back from #${id} left the page`);
};
await S(() => (window.stillHere = true));
await page.keyboard.press('g');
await goBack('gallery');
await page.keyboard.press('g');
await page.click('.wall-open');
await goBack('placard');
await page.keyboard.press('s');
await goBack('signSheet');
await page.click('#galleryBtn');
await page.click('#closeGallery');
await page.waitForFunction(() => history.state === null, null, { timeout: 5000 });

// Inside another page's frame (the claude.ai viewer), overlays leave the history alone: going back from in there would
// move the whole page back.
const host = await browser.newPage({ viewport: { width: 420, height: 900 } });
await host.setContent(`<iframe src="${base}" style="width:390px;height:844px;border:0"></iframe>`);
const framed = host.frames()[1];
await framed.waitForFunction(() => window.happyAccidents?.skipIntro);
await framed.evaluate(() => window.happyAccidents.skipIntro());
const pagesBack = await host.evaluate(() => history.length);
await framed.click('#galleryBtn');
assert.equal(await framed.isHidden('#gallery'), false, 'the gallery opens in a frame');
assert.equal(await host.evaluate(() => history.length), pagesBack, 'opening the gallery in a frame added a step to the page’s history');
await host.close();

// With the name remembered, S starts in the title field, still without an "s" added to the title.
await watchTyping();
await page.keyboard.press('s');
assert.equal(await S(() => document.activeElement.id), 'artTitle', 'with a name saved, S starts in the title field');
assert.equal(await page.inputValue('#artistName'), 'Robin');
assert.deepEqual(await S(() => window.typed), [], 'pressing S typed into the title');
await page.keyboard.press('Escape');

// Keyboard focus stays with the overlays: Tab doesn't wander into the page behind the gallery, and closing a painting
// opened from the wall goes back to the Gallery button that opened the wall.
await page.focus('#galleryBtn');
await page.keyboard.press('Enter');
assert.equal(await page.isHidden('#gallery'), false);
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('Tab');
  assert.equal(await S(() => document.getElementById('app').contains(document.activeElement)), false, 'Tab went from the gallery to the page behind it');
}
await page.focus('.wall-open');
await page.keyboard.press('Enter');
assert.equal(await page.isHidden('#placard'), false);
assert.equal(await page.isHidden('#gallery'), true);
await page.keyboard.press('Escape');
assert.equal(await S(() => document.activeElement.id), 'galleryBtn', 'closing a painting opened from the wall goes back to Gallery');

// Junk in storage (a hand edit, a bad write) doesn't stop the wall opening or hang as a broken painting, and a stored
// name that isn't text stays out of the name field.
await S(() => {
  const hung = JSON.parse(localStorage.getItem('happy-accidents:gallery'));
  localStorage.setItem('happy-accidents:gallery', JSON.stringify([null, 1, 'x', {}, ...hung]));
  localStorage.setItem('happy-accidents:artist', '{"x":1}');
});
await page.reload();
await page.evaluate(() => document.fonts.ready);
assert.equal(await page.textContent('#galleryCount'), '1', 'junk in storage counted as paintings');
await page.keyboard.press('g');
assert.equal(await page.isHidden('#gallery'), false, 'the gallery opens with junk in storage');
assert.equal(await page.locator('.wall-item').count(), 1, 'only the real painting hangs');
await page.keyboard.press('Escape');
await page.keyboard.press('s');
assert.equal(await page.inputValue('#artistName'), '', 'a stored name that isn’t text stays out of the name field');

// Left blank, the name signs as Anonymous, as the field's placeholder says, instead of the form refusing to send.
await page.click('#signForm button[type=submit]');
await page.waitForSelector('#placard:not([hidden])', { timeout: 30000 });
assert.equal(await page.textContent('#plArtist'), 'Anonymous', 'a blank name didn’t sign as Anonymous');
await page.click('#keepBtn');

// With sound saved on, nothing tries to start audio before the first tap or key (the browser refuses and says so in
// the console); the first tap starts it.
const audioComplaints = [];
page.on('console', (m) => { if (/AudioContext/.test(m.text())) audioComplaints.push(m.text()); });
await ctx.addInitScript(() => {
  const Real = window.AudioContext;
  if (Real) window.AudioContext = class extends Real { constructor(...args) { super(...args); (window.audioContexts ||= []).push(this); } };
});
await S(() => localStorage.setItem('happy-accidents:sound', 'true'));
await page.reload();
await page.evaluate(() => document.fonts.ready);
assert.equal(await page.textContent('#soundBtn'), 'Sound on');
await S(() => window.happyAccidents.randomAccident());
await page.waitForTimeout(500);
assert.equal(await S(() => (window.audioContexts || []).length), 0, 'audio was started before a tap or a key');
assert.deepEqual(audioComplaints, [], 'the console complained about audio');
b = await box();
await page.touchscreen.tap(b.x + b.width * 0.5, b.y + b.height * 0.3);
await page.waitForFunction(() => window.audioContexts?.[0]?.state === 'running', null, { timeout: 10000 });

// Works offline once it has been opened.
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
await ctx.setOffline(true);
await page.reload();
await page.waitForFunction(() => window.happyAccidents && window.happyAccidents.elements.length > 0, null, { timeout: 15000 });
assert.equal(await page.title(), 'Happy Accidents');
await ctx.setOffline(false);

// With JavaScript off, the page says what it needs on the first screen, not below an easel that does nothing.
const noScript = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
const plain = await noScript.newPage();
await plain.goto(base);
const note = await plain.locator('.noscript').boundingBox();
assert.ok(note && note.y + note.height <= 844, `the note about JavaScript is below the first screen (${JSON.stringify(note)})`);
await noScript.close();

assert.deepEqual(problems.filter((p) => !p.startsWith('failed:')), [], 'problems while painting');
// Offline, checked the junkdrawer house kit's way, from a server that answers like GitHub Pages: a browser may keep
// each file for ten minutes, and asks again by its ETag. `net` is the connection: 'up', 'down' (the server drops every
// connection) or 'stalled' (a plane's or a train's wifi: it takes each request and holds on to it). With `release`
// set it serves the next release. The server's own switches are needed because the browser's offline switch can't
// make a stall, and in some Chromium builds it doesn't stop the service worker's own requests.
{
  const { createServer } = await import('node:http');
  const { readFile } = await import('node:fs/promises');
  const { join, extname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { createHash } = await import('node:crypto');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
  let net = 'up', release = false;
  const held = [];
  const server = createServer((req, res) => {
    if (net === 'down') { req.socket.destroy(); return; }
    if (net === 'stalled') { held.push([req, res]); return; }
    serve(req, res);
  }).listen(0);
  async function serve(req, res) {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    let body;
    try { body = await readFile(join(root, path)); } catch { res.writeHead(404); res.end(); return; }
    if (release && path === '/sw.js') body = Buffer.from(String(body).replace(/const FILES = '[0-9a-f]*'/, "const FILES = 'next'"));
    if (release && path === '/index.html') body = Buffer.concat([body, Buffer.from('<!-- the next release -->\n')]);
    const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;
    const head = { etag, 'cache-control': 'max-age=600', 'content-type': TYPES[extname(path)] || 'text/html' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); res.end(); return; }
    res.writeHead(200, head);
    res.end(body);
  }
  const base = `http://localhost:${server.address().port}/`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 });
  const title = await page.title();

  // Works offline once it has been opened.
  net = 'down';
  await ctx.setOffline(true);
  await page.reload();
  assert.equal(await page.title(), title, 'the page did not open offline');
  await ctx.setOffline(false);

  // On a connection that's up but not answering, it opens from the copy too, after the worker's few seconds' wait for
  // the network: the page and every file it loads (were any of them left waiting on the network, it wouldn't open).
  net = 'stalled';
  const t0 = Date.now();
  await page.reload({ timeout: 10000 }).catch(() => {});
  const took = Date.now() - t0;
  assert.ok(took < 8000, `the page took ${took} ms to open on a stalled connection`);
  assert.equal(await page.title(), title, 'the page did not open on a stalled connection');
  net = 'up';
  for (const [req, res] of held.splice(0)) serve(req, res);

  // A new release: every file in the new copy comes from the server, though the browser still has its own copies of
  // the old ones for ten minutes. (The next release changes index.html, and so FILES in sw.js, as a real one does.)
  release = true;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  for (const end = Date.now() + 10000; !(await page.evaluate(async () => !!(await (await caches.match('index.html'))?.text())?.includes('<!-- the next release -->')));) {
    assert.ok(Date.now() < end, "the new release's offline copy kept the old index.html");
    await new Promise(r => setTimeout(r, 100));
  }
  assert.deepEqual(problems, [], 'problems while offline or on a stalled connection');
  await ctx.close();
  server.close();

  // sw.js changes whenever a file it keeps does, so a release replaces the whole offline copy at once: FILES in sw.js
  // is a fingerprint of every file in SHELL (sha1 of each, in the list's order, an address like './' read as its
  // index.html; the first 8 hex of the sha1 of those).
  const sw = await readFile(join(root, 'sw.js'), 'utf8');
  const shell = [...sw.match(/SHELL = \[([^\]]*)\]/)[1].replace(/\/\/.*/g, '').matchAll(/'([^']*)'/g)].map(m => m[1]);
  const all = createHash('sha1');
  for (const f of shell) all.update(createHash('sha1').update(await readFile(join(root, f.endsWith('/') ? f + 'index.html' : f))).digest());
  const files = all.digest('hex').slice(0, 8);
  assert.equal(sw.match(/const FILES = '([0-9a-f]*)'/)?.[1], files, `a file sw.js keeps for offline has changed: set FILES in sw.js to '${files}'`);
}

await browser.close();
server.close();
console.log('all good');
