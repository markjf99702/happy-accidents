// The parts that don't need a browser:  node --test test/unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { featureLine, madeFrom, durationText, makeTitle, toolInfo, LINES } from '../src/words.js';
import { topEdge, heights, at, span, sideProfile } from '../src/shape.js';
import { ramp, mix, hex, mixPaint, familyOf, colorName } from '../src/color.js';
import { weighted, pickFresh, clamp } from '../src/util.js';
import { SCHEMES, PIGMENTS } from '../src/schemes.js';
import { decide } from '../src/decide.js';
import { makeSplat } from '../src/splat.js';
import { flowers, canoe, glints } from '../src/paint/index.js';
import { autumn, treeGlow, sunlitCloud } from '../src/paint/react.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Just enough of a studio to ask decide() what a splat becomes: ground everywhere below the horizon, nothing painted yet.
function bareStudio(schemeId = 'golden-hour') {
  const reserved = new Set();
  const scheme = SCHEMES.find((s) => s.id === schemeId);
  return {
    W: 1200,
    H: 900,
    hy: 480,
    lightDir: 1,
    scheme,
    haze: scheme.haze,
    elementAt: () => null,
    isLand: (x, y) => y > 480,
    has: (kind) => reserved.has(kind),
    count: () => 0,
    reserve: (kind) => reserved.add(kind),
  };
}

test('the placard lists what is in the painting in plain English', () => {
  assert.equal(featureLine({}), 'Mostly sky and water, which is plenty.');
  assert.equal(featureLine({ cabin: 1 }), 'Features a cabin.');
  assert.equal(featureLine({ mountain: 2, evergreen: 1 }), 'Features two mountains and a happy little tree.');
  assert.equal(featureLine({ mountain: 1, evergreen: 3, sun: 1 }), 'Features a mountain, three happy little trees and the sun.');
  const long = featureLine({ mountain: 2, evergreen: 3, deciduous: 2, bush: 1, cabin: 1, cloud: 2, rock: 1 });
  assert.match(long, /, and more\.$/);
  assert.doesNotMatch(long, /and more and/);
});

test('painting time and accident counts read naturally', () => {
  assert.equal(durationText(42), '42 seconds');
  assert.equal(durationText(192), '3 min 12 s');
  assert.equal(madeFrom(1, 20), 'Painted wet-on-wet from one happy accident in 20 seconds.');
  assert.equal(madeFrom(14, 192), 'Painted wet-on-wet from 14 happy accidents in 3 min 12 s.');
  assert.equal(madeFrom(0, 2), 'Painted wet-on-wet without a single accident, in 2 seconds.', 'a blank canvas isn’t made from 0 happy accidents');
});

test('titles are always real words', () => {
  for (const s of SCHEMES) {
    for (let i = 0; i < 40; i++) {
      const t = makeTitle({ mountain: 1, evergreen: 2, cabin: i % 2, island: i % 3 === 0 ? 1 : 0 }, s.id);
      assert.ok(t.length > 3, t);
      assert.doesNotMatch(t, /undefined|null|NaN|\{|\}/, t);
    }
  }
});

test('night titles don’t say night twice, like Midnight Night', () => {
  for (const id of ['northern-night', 'violet-dusk']) {
    for (let i = 0; i < 600; i++) assert.doesNotMatch(makeTitle({ mountain: 1 }, id), /\b(Midnight|Evening) Night\b/);
  }
});

test('the painter names the brush and a touch of the paint you used', () => {
  const blue = PIGMENTS.find((p) => p.id === 'phthalo-blue');
  assert.equal(toolInfo('mountain', blue), 'Palette knife · Van Dyke Brown, Prussian Blue, Titanium White · a touch of Phthalo Blue');
  assert.equal(toolInfo('no-such-thing', blue), '');
  for (const [key, lines] of Object.entries(LINES)) assert.ok(lines.length > 0, `no lines for ${key}`);
});

test('the painter’s lines use curly apostrophes, like the rest of the page', () => {
  for (const [key, lines] of Object.entries(LINES)) {
    for (const text of lines) assert.doesNotMatch(text, /'/, `${key}: ${text}`);
  }
});

test('an ordinary brown tap on land can be a cabin', () => {
  // Taps are R 11 to 22. From R 15 up, brown on land in the middle distance is a cabin about half the time (until there's
  // one), which makes about a third of those taps a cabin; smaller ones are a bare tree or a bush.
  const brown = PIGMENTS.find((p) => p.id === 'van-dyke-brown');
  const becomes = (R) => {
    const S = bareStudio();
    return decide(S, makeSplat({ x: 600, y: S.hy + (S.H - S.hy) * 0.3, R, pigment: brown }))[0].kind;
  };
  const cabins = Array.from({ length: 60 }, (_, i) => becomes(15 + (i % 3))).filter((k) => k === 'cabin').length;
  assert.ok(cabins >= 15, `only ${cabins} of 60 brown taps of R 15 to 17 made a cabin`);
  for (let i = 0; i < 30; i++) assert.notEqual(becomes(14.5), 'cabin', 'a brown tap smaller than R 15 made a cabin');
});

// Plays a painter's steps on a context that draws nothing and keeps every color it's handed, as [r, g, b].
function colorsOf(spec) {
  const colors = [];
  const keep = (c) => {
    const m = typeof c === 'string' && c.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (m) colors.push(m.slice(1, 4).map(Number));
  };
  const gradient = { addColorStop: (at, c) => keep(c) };
  const ctx = new Proxy(
    {},
    {
      get: (t, k) => (k in t ? t[k] : typeof k === 'string' && k.startsWith('create') ? () => gradient : () => {}),
      set: (t, k, v) => {
        if (k === 'fillStyle' || k === 'strokeStyle') keep(v);
        t[k] = v;
        return true;
      },
    },
  );
  for (const op of spec.ops) op(ctx);
  return colors;
}

// Runs fn with Math.random started from the same seed every time, so two runs make the same choices.
function sameDice(fn) {
  const real = Math.random;
  let a = 7;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}

test('at night and dusk, what paint adds sits in the shade like everything else', () => {
  // Each touch is painted twice from the same random numbers: in the mood itself, and in a copy of the mood that isn't
  // dimmed. The colors that differ are the ones that came from the paint, and each went toward the shade: the darkest
  // tree color, or for light on a cloud's edges, the cloud's own light (into the dark, it looked like grime).
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const paint = (id) => PIGMENTS.find((p) => p.id === id).rgb;
  const make = (S, x, y, R, id, hint) => decide(S, makeSplat({ x, y, R, pigment: PIGMENTS.find((p) => p.id === id), hint }))[0].make();
  for (const mood of ['northern-night', 'violet-dusk']) {
    const S = bareStudio(mood);
    const plain = { ...S, scheme: { ...S.scheme, id: 'not-dimmed', night: false } };
    const ground = S.hy + 150;
    const pine = make(S, 300, ground, 30, 'phthalo-blue', 'tree');
    const leafy = make(S, 500, ground, 30, 'cadmium-yellow', 'tree');
    const cloud = make(S, 600, S.hy * 0.3, 30, 'titanium-white', 'cloud');
    const hit = (id) => ({ x: 600, y: ground, R: 18, tint: paint(id) });
    const dark = S.scheme.tree.dark;
    const touches = {
      'autumn leaves': [(s) => autumn(s, leafy, hit('bright-red')), dark],
      'late light on a pine': [(s) => treeGlow(s, pine, hit('cadmium-yellow')), dark],
      'a cloud’s lit edges': [(s) => sunlitCloud(s, cloud, hit('cadmium-yellow')), cloud.meta.light],
      flowers: [(s) => flowers(s, { x: 700, y: ground, R: 10, tint: paint('cadmium-yellow') }), dark],
      'a canoe': [(s) => canoe(s, { x: 600, y: S.hy + 100, R: 20, tint: paint('bright-red') }), dark],
      glints: [(s) => glints(s, { x: 600, y: S.hy + 80, R: 20, tint: paint('cadmium-yellow') }), dark],
    };
    for (const [what, [paintIt, toward]] of Object.entries(touches)) {
      const shaded = sameDice(() => colorsOf(paintIt(S)));
      const bright = sameDice(() => colorsOf(paintIt(plain)));
      assert.equal(shaded.length, bright.length, `${what} at ${mood} painted differently`);
      const changed = shaded.map((c, i) => [c, bright[i]]).filter(([a, b]) => dist(a, b) > 1);
      assert.ok(changed.length > 0, `at ${mood}, ${what} kept the colors of daylight`);
      for (const [a, b] of changed) assert.ok(dist(a, toward) < dist(b, toward), `at ${mood}, ${what} went from ${b} to ${a}, out of the shade`);
    }
    // A warm cloud's shadow too, not just its light.
    for (const id of ['cadmium-yellow', 'bright-red']) {
      const shadow = (s) => make(s, 600, s.hy * 0.3, 30, id, 'cloud').meta.shadow;
      assert.ok(dist(shadow(S), dark) < dist(shadow(plain), dark), `at ${mood}, a ${id} cloud’s shadow kept the colors of daylight`);
    }
  }
});

test('a splat outline turns into a silhouette', () => {
  // A circle of radius 10 centered at (50, 50).
  const circle = Array.from({ length: 72 }, (_, i) => [50 + Math.cos((i / 72) * Math.PI * 2) * 10, 50 + Math.sin((i / 72) * Math.PI * 2) * 10]);
  const edge = topEdge(circle, 21);
  assert.ok(Math.abs(edge.x0 - 40) < 0.01 && Math.abs(edge.x1 - 60) < 0.01);
  assert.ok(Math.abs(Math.min(...edge.ys) - 40) < 0.5, 'the top of the circle is its highest point');
  const hs = heights(edge, 50);
  assert.equal(Math.max(...hs), 1);
  assert.ok(at(hs, 0.5) > 0.95 && at(hs, 0) < 0.5, 'tallest in the middle, low at the sides');
  assert.deepEqual(span(circle, 50).map((v) => Math.round(v)), [40, 60]);
  assert.equal(span(circle, 90), null);
  const reach = sideProfile({ pts: circle, box: { x: 40, y: 40, w: 20, h: 20 }, cx: 50 });
  assert.ok(reach(0.5, -1) > reach(0.02, -1), 'a circle reaches furthest at its middle');
  assert.equal(sideProfile(null)(0.5, 1), 1);
});

test('colors mix and ramp', () => {
  assert.deepEqual(hex('#ff8000'), [255, 128, 0]);
  assert.deepEqual(mix([0, 0, 0], [200, 100, 50], 0.5), [100, 50, 25]);
  const stops = [[0, [0, 0, 0]], [1, [255, 255, 255]]];
  assert.deepEqual(ramp(stops, 0.5), [127.5, 127.5, 127.5]);
  assert.deepEqual(ramp(stops, -1), [0, 0, 0]);
});

test('paint mixes like paint, and the mix decides its family', () => {
  for (const p of PIGMENTS) assert.equal(familyOf(p.rgb), p.family, `${p.name} reads as ${p.family}`);
  const P = Object.fromEntries(PIGMENTS.map((p) => [p.id, p.rgb]));
  const fam = (a, b, wa = 1, wb = 1) => familyOf(mixPaint([[P[a], wa], [P[b], wb]]));
  assert.equal(fam('cadmium-yellow', 'phthalo-blue'), 'green', 'yellow and blue make green');
  assert.equal(fam('cadmium-yellow', 'prussian-blue'), 'green');
  assert.equal(fam('bright-red', 'cadmium-yellow'), 'yellow', 'red and yellow make orange, which acts like yellow');
  assert.equal(colorName(mixPaint([[P['bright-red'], 1], [P['cadmium-yellow'], 1]])), 'orange');
  assert.equal(fam('bright-red', 'titanium-white'), 'red', 'red and white make pink');
  assert.equal(colorName(mixPaint([[P['bright-red'], 1], [P['titanium-white'], 1]])), 'pink');
  assert.equal(fam('bright-red', 'sap-green'), 'brown', 'red and green make brown');
  assert.equal(fam('titanium-white', 'phthalo-blue'), 'blue');
  assert.equal(colorName(mixPaint([[P['titanium-white'], 3], [P['phthalo-blue'], 1]])), 'pale blue', 'mostly white with some blue is pale blue');
  const same = mixPaint([[P['sap-green'], 2], [P['sap-green'], 5]]);
  same.forEach((v, i) => assert.ok(Math.abs(v - P['sap-green'][i]) < 1, 'a paint mixed with itself stays itself'));
});

test('small helpers behave', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(weighted([['a', 0], ['b', 1]]), 'b');
  const seen = new Set();
  let last = null;
  for (let i = 0; i < 30; i++) {
    const v = pickFresh('test', ['x', 'y', 'z']);
    assert.notEqual(v, last, 'never the same line twice in a row');
    last = v;
    seen.add(v);
  }
  assert.equal(seen.size, 3);
});

test('the README says what each file is for', async () => {
  const readme = await readFile(join(root, 'README.md'), 'utf8');
  const list = readme.slice(readme.indexOf('### Files'));
  const code = (await readdir(join(root, 'src'), { withFileTypes: true })).filter((e) => e.isFile()).map((e) => `src/${e.name}`);
  for (const f of [...code, 'src/paint/', 'fonts/', 'sw.js', 'carry.js']) assert.ok(list.includes(`- \`${f}\`:`), `the README's Files list leaves out ${f}`);
});

test('the gallery wall says how many paintings it keeps', async () => {
  // Signing one more than that takes the oldest painting down, so the wall says so.
  const main = await readFile(join(root, 'src/main.js'), 'utf8');
  const html = await readFile(join(root, 'index.html'), 'utf8');
  const cap = main.match(/\[record, \.\.\.readGallery\(\)\]\.slice\(0, (\d+)\)/)?.[1];
  assert.ok(cap, 'main.js keeps the wall to some other number of paintings now');
  assert.match(html, new RegExp(`keeps your ${cap} newest paintings`), `the wall doesn't say it keeps ${cap} paintings`);
});

test('the screenshot tool starts its random numbers again before each painting', async () => {
  // The page paints its own first canvas as it loads, and how far it gets depends on timing; without this, the same
  // seed gave different paintings from run to run.
  const tool = await readFile(join(root, 'tools/screenshots.mjs'), 'utf8');
  const paintings = tool.split('page.evaluate(').filter((call) => call.includes('newCanvas('));
  assert.ok(paintings.length >= 2, 'the screenshot tool paints its canvases somewhere else now');
  for (const call of paintings) assert.match(call.slice(0, call.indexOf('newCanvas(')), /reseed\(/, `a painting in tools/screenshots.mjs isn't reseeded first: ${call.slice(0, 120)}`);
});

test('the offline copy lists every file the page needs', async () => {
  const sw = await readFile(join(root, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'([^']+\.(?:js|css|woff2|svg|html|webmanifest))'/g)].map((m) => m[1]));
  const walk = async (dir) => {
    const out = [];
    for (const e of await readdir(join(root, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) out.push(...(await walk(p)));
      else out.push(p);
    }
    return out;
  };
  const needed = [...(await walk('src')), ...(await walk('fonts')), 'styles.css', 'index.html', 'carry.js', 'icon.svg', 'manifest.webmanifest'];
  for (const f of needed) assert.ok(listed.has(f), `sw.js doesn't list ${f}`);
  for (const f of listed) assert.ok(needed.includes(f), `sw.js lists ${f}, which doesn't exist`);
});
