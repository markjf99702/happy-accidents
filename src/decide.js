// Looks at a splat (where it landed, what it landed on, its shape, which way it was
// flung, what color) and decides what it was trying to be. Returns a plan: a list of
// steps, each of which builds one painted element (or paints onto an existing one)
// when its turn comes.
import { chance, clamp, rand, weighted, pick } from './util.js';
import { lum } from './color.js';
import { splatShape } from './splat.js';
import * as P from './paint/index.js';
import * as R from './paint/react.js';

const step = (kind, make, extra = {}) => ({ kind, make, ...extra });

export function decide(S, sp) {
  const { H, hy } = S;
  const center = sp.center || { x: sp.x, y: sp.y };
  const pigment = sp.mixPigment || sp.pigment;
  const b = { x: center.x, y: center.y, R: sp.effR || sp.R, tint: pigment.rgb, elong: sp.stretch, shape: splatShape(sp) };
  const fam = pigment.family;
  const hint = sp.hint;
  const vertical = Math.abs(Math.sin(sp.ang)) > 0.7 && sp.stretch > 1.35;

  // Paint that lands on something already there changes it.
  const hit = S.elementAt(b.x, b.y, b.R);
  if (hit) {
    const plan = react(S, hit, b, fam);
    if (plan) return plan;
  }

  const band = H * 0.035;
  if (b.y < hy - band) return sky(S, b, fam, hint);
  if (b.y < hy + band) return [step('treeline', () => P.treeline(S, { ...b }))];
  return low(S, b, fam, hint, vertical);
}

// True the first time this kind of change happens to this element, so the same thing
// doesn't pile up on itself (a second sunset on the same sun, say).
function first(t, kind) {
  t.touched = t.touched || new Set();
  if (t.touched.has(kind)) return false;
  t.touched.add(kind);
  return true;
}

function react(S, t, b, fam) {
  const white = fam === 'white';
  const warm = fam === 'yellow' || fam === 'red';
  switch (t.kind) {
    case 'evergreen':
    case 'deciduous':
    case 'bush':
      if (white && first(t, 'snow')) return [step('treeSnow', () => R.treeSnow(S, t, b))];
      if (warm && t.kind === 'evergreen' && first(t, 'glow')) return [step('treeGlow', () => R.treeGlow(S, t, b))];
      if (warm && t.kind !== 'evergreen' && first(t, 'autumn')) return [step('autumn', () => R.autumn(S, t, b))];
      return [step(t.kind, () => friend(S, t, b.tint, Math.sign(b.x - t.meta.x) || 1) || R.treeGlow(S, t, b), { say: 'company' })];

    case 'mountain':
      if (white && first(t, 'snow')) return [step('snowfall', () => R.snowfall(S, t, b))];
      if (fam === 'blue' && first(t, 'falls')) return [step('waterfall', () => R.waterfall(S, t, b) || P.mist(S, { ...b, depth: t.depth + 0.3 }))];
      if (warm && first(t, 'glow')) return [step('alpenglow', () => R.alpenglow(S, t, b))];
      if (fam === 'green' || chance(0.5)) {
        return [
          step('foothills', () =>
            P.treeline(S, {
              ...b,
              baseY: b.y + 10,
              haze: 0.5,
              scale: 0.6,
              slope: b.x < t.meta.peak[0] ? -0.4 : 0.4,
              depth: t.depth + 0.5,
              noGround: true,
              kind: 'foothills',
            }),
          ),
        ];
      }
      return [step('mist', () => P.mist(S, { ...b, depth: t.depth + 0.3 }))];

    case 'sun':
    case 'moon': {
      const skyEl = S.elements.find((e) => e.kind === 'sky');
      if ((warm || white) && skyEl && first(t, 'sunset')) return [step('sunset', () => R.sunset(S, skyEl, t, b))];
      const { x, y, r } = t.meta;
      return [step('cloudOverSun', () => P.cloud(S, { ...b, x: x + rand(-0.5, 0.5) * r, y: y + rand(-0.3, 0.3) * r, R: r * 1.2, elong: 2.6 }))];
    }

    case 'cloud':
      if (lum(b.tint) < 0.3 && first(t, 'storm')) return [step('storm', () => R.storm(S, t, b)), step('rain', () => R.rain(S, t, b), { quiet: true })];
      if (warm && first(t, 'lit')) return [step('sunlitCloud', () => R.sunlitCloud(S, t, b))];
      return null;

    case 'cabin': {
      if (white && first(t, 'snow')) return [step('roofSnow', () => R.roofSnow(S, t, b))];
      if (!t.meta.glow && (warm || chance(0.4))) return [step('lights', () => R.cabinLights(S, t, b))];
      if (!first(t, 'garden')) return null;
      const m = t.meta;
      const onLand = (x, y) => S.isLand(x, y);
      return [
        step('garden', () => P.flowers(S, { x: m.x0 - m.size * rand(0.05, 0.2), y: m.baseY + 2, R: m.size * 0.12, tint: b.tint, onLand })),
        step('flowers', () => P.flowers(S, { x: m.x1 + m.size * rand(0.05, 0.2), y: m.baseY + 2, R: m.size * 0.12, tint: b.tint, onLand }), { quiet: true }),
      ];
    }

    case 'rock':
      if (fam === 'green' && first(t, 'moss')) return [step('moss', () => R.moss(S, t, b))];
      if (white && first(t, 'snow')) return [step('rockSnow', () => R.rockSnow(S, t, b))];
      return null;

    default:
      return null;
  }
}

function sky(S, b, fam, hint) {
  const skyT = b.y / S.hy;
  if (b.R < 17 && !hint) {
    const starry = S.scheme.night || (S.scheme.stars && chance(0.5));
    return [step(starry ? 'stars' : 'birds', () => (starry ? P.stars(S, b) : P.birds(S, b)))];
  }
  if (hint === 'birds') return [step('birds', () => P.birds(S, b))];

  const bright = fam === 'white' || fam === 'yellow';
  if (!S.has('sun') && !S.has('moon') && (hint === 'sun' || (!hint && skyT < 0.7 && b.elong < 1.5 && chance(bright ? 0.5 : 0.1)))) {
    const moon = S.scheme.sunType === 'moon';
    S.reserve(moon ? 'moon' : 'sun');
    return [step(moon ? 'moon' : 'sun', () => P.sun(S, b)), step('sunpath', (prev) => P.sunpath(S, prev.meta), { quiet: true })];
  }

  if (S.scheme.night && !S.has('aurora') && skyT < 0.65 && b.R > 28 && chance(0.35)) {
    S.reserve('aurora');
    return [step('aurora', () => P.aurora(S, b))];
  }

  const count = S.count('mountain');
  let pM = count >= 3 ? 0 : clamp((skyT - 0.25) * 1.5, 0, 0.9) * (b.R > 22 ? 1 : 0.4);
  if (hint === 'mountain') pM = count >= 4 ? 0 : 0.95;
  if (hint === 'cloud') pM = 0.03;
  if (chance(pM)) {
    S.reserve('mountain');
    return [step('mountain', () => P.mountain(S, { ...b, index: count }))];
  }
  return [step('cloud', () => P.cloud(S, b))];
}

function low(S, b, fam, hint, vertical) {
  const { W, H, hy } = S;
  const dT = (b.y - hy) / (H - hy);
  const footY = Math.min(H - 4, b.y + b.R * 0.3);
  const onLand = S.isLand(b.x, footY) || S.isLand(b.x, b.y);

  if (onLand && hint !== 'bank' && hint !== 'water') return land(S, { ...b, y: footY }, fam, hint, vertical, dT);

  // On the water: near an edge the splat becomes land joined to the shore; out in the
  // middle it may become an island in its own shape.
  const nearEdge = b.x < W * 0.3 || b.x > W * 0.7;
  const connect = hint === 'bank' || (hint !== 'water' && (nearEdge || dT > 0.72));
  const island = !connect && hint !== 'water' && b.R >= 16 && (hint === 'tree' || chance(0.55));
  if (connect || island) {
    const kind = connect ? 'bank' : 'island';
    const steps = [
      step(kind, () => {
        const spec = P.bank(S, { ...b, connect });
        S.addLand(spec.meta.outline);
        return spec;
      }),
    ];
    if (hint === 'tree' || (b.R > 30 && chance(0.7))) {
      steps[0].say = connect ? 'bankTree' : 'islandTree';
      steps.push(
        step(
          'tree',
          (prev) => {
            const spots = prev.meta.spots.filter((s) => Math.abs(s[0] - b.x) < b.R * 4 + 60);
            const spot = pick(spots.length ? spots : prev.meta.spots);
            return spot ? tree(S, { ...b, x: spot[0], y: spot[1] }, treeKind(S, b, fam, vertical, 'tree')) : null;
          },
          { quiet: true },
        ),
      );
    }
    return steps;
  }
  if (b.R < 16 || (hint === 'water' && chance(0.5))) return [step('ripples', () => P.ripples(S, b))];
  return [step('rock', () => P.rock(S, b))];
}

function land(S, b, fam, hint, vertical, dT) {
  if (b.R < 13 && !hint) return [step('flowers', () => P.flowers(S, { ...b, onLand: (x, y) => S.isLand(x, y) }))];

  const brownish = fam === 'brown' || fam === 'red';
  if (!S.has('cabin') && dT > 0.06 && dT < 0.62 && b.R >= 18 && b.elong < 1.6 && (hint === 'cabin' || chance(brownish ? 0.45 : 0.14))) {
    S.reserve('cabin');
    const size = clamp((b.y - S.hy) * 0.42 + b.R * 0.6, 26, 230);
    const bushSide = -S.lightDir;
    return [
      step('cabin', () => P.cabin(S, { ...b, baseY: b.y, size })),
      step('bush', () => P.bush(S, { ...b, shape: null, x: b.x + bushSide * size * rand(0.55, 0.8), baseY: b.y + 2, r: size * 0.2 }), { quiet: true }),
    ];
  }

  const kind = treeKind(S, b, fam, vertical, hint);
  const steps = [step(kind, () => tree(S, b, kind))];
  const big = b.R > 42 && dT > 0.5;
  if (big && chance(0.6)) {
    steps.push(step(kind, (prev) => friend(S, prev, b.tint), { say: 'family' }));
    steps.push(step(kind, (prev) => friend(S, prev, b.tint), { quiet: true }));
  } else if (chance(0.38)) {
    steps.push(step(kind, (prev) => friend(S, prev, b.tint), { say: 'friend' }));
  }
  return steps;
}

function treeKind(S, b, fam, vertical, hint) {
  const leafy = S.scheme.leafy;
  return weighted([
    ['evergreen', 0.55 + (fam === 'green' || fam === 'blue' ? 0.25 : 0) + (vertical ? 0.4 : 0) + (hint === 'tree' ? 0.2 : 0)],
    ['deciduous', (leafy ? 0.45 : 0.18) + (fam === 'yellow' || fam === 'red' ? 0.25 : 0)],
    ['bush', 0.22 + (b.R < 22 ? 0.3 : 0)],
  ]);
}

function tree(S, b, kind) {
  const dT = clamp((b.y - S.hy) / (S.H - S.hy), 0, 1);
  const depth = b.y - S.hy;
  const haze = clamp((0.25 - dT) * 1.6, 0, 0.4);
  if (kind === 'evergreen') {
    const h = clamp(depth * rand(1.1, 1.8) + b.R * 1.4, 16, S.H * 1.05);
    return P.evergreen(S, { ...b, baseY: b.y, h, haze });
  }
  if (kind === 'deciduous') {
    const h = clamp(depth * rand(0.9, 1.4) + b.R * 1.2, 16, S.H * 0.95);
    return P.deciduous(S, { ...b, baseY: b.y, h, haze });
  }
  const r = clamp(depth * rand(0.08, 0.14) + b.R * 0.5, 5, 140);
  return P.bush(S, { ...b, baseY: b.y, r, haze });
}

// A smaller neighbor next to a tree (preferably on the given side), if there's ground for it.
function friend(S, prev, tint, preferSide) {
  if (!prev?.meta?.type) return null;
  const { x, baseY, size, type } = prev.meta;
  const sides = preferSide ? [preferSide, -preferSide] : chance(0.5) ? [-1, 1] : [1, -1];
  for (const side of sides) {
    const fx = x + side * size * rand(0.22, 0.42);
    const fy = baseY + rand(-size * 0.03, size * 0.06);
    if (fx < 0 || fx > S.W || fy > S.H - 2 || !S.isLand(fx, fy)) continue;
    const b = { x: fx, y: fy, R: 10, tint, elong: 1 };
    const scale = rand(0.5, 0.8);
    const dT = clamp((fy - S.hy) / (S.H - S.hy), 0, 1);
    const haze = clamp((0.25 - dT) * 1.6, 0, 0.4);
    if (type === 'deciduous') return P.deciduous(S, { ...b, baseY: fy, h: size * scale, haze });
    if (type === 'bush') return P.bush(S, { ...b, baseY: fy, r: (size / 2.2) * scale, haze });
    return P.evergreen(S, { ...b, baseY: fy, h: size * scale, haze });
  }
  return null;
}
