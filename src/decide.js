// Looks at a splat (where it landed, how big, which way it was flung, what color)
// and decides what it was trying to be. Returns a plan: a list of steps, each of
// which builds one painted element when its turn comes.
import { chance, clamp, rand, weighted, pick } from './util.js';
import * as P from './paint/index.js';

const step = (kind, make, extra = {}) => ({ kind, make, ...extra });

export function decide(S, sp) {
  const { H, hy } = S;
  const b = { x: sp.x, y: sp.y, R: sp.R, tint: sp.pigment.rgb, elong: sp.stretch };
  const fam = sp.pigment.family;
  const hint = sp.hint;
  const vertical = Math.abs(Math.sin(sp.ang)) > 0.7 && sp.stretch > 1.35;
  const band = H * 0.035;

  if (b.y < hy - band) return sky(S, b, fam, hint);
  if (b.y < hy + band) return [step('treeline', () => P.treeline(S, { ...b }))];
  return low(S, b, fam, hint, vertical);
}

function sky(S, b, fam, hint) {
  const mtn = S.mountainAt(b.x, b.y);
  if (mtn && hint !== 'cloud' && hint !== 'sun') {
    if (chance(0.55)) {
      return [
        step('foothills', () =>
          P.treeline(S, { ...b, baseY: b.y + 10, haze: 0.5, scale: 0.6, depth: mtn.depth + 0.5, noGround: true, kind: 'foothills' }),
        ),
      ];
    }
    return [step('mist', () => P.mist(S, { ...b, depth: mtn.depth + 0.3 }))];
  }

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

  const nearEdge = b.x < W * 0.3 || b.x > W * 0.7;
  const banks = S.count('bank');
  const wantBank = hint === 'bank' || hint === 'tree' || (hint !== 'water' && (nearEdge || dT > 0.72 || (banks < 2 && chance(0.45))));
  if (wantBank) {
    const steps = [
      step('bank', () => {
        const spec = P.bank(S, b);
        S.addLand(spec.meta.outline);
        return spec;
      }),
    ];
    if (hint === 'tree' || (b.R > 30 && chance(0.7))) {
      steps[0].say = 'bankTree';
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
  if (b.R < 13 && !hint) return [step('flowers', () => P.flowers(S, b))];

  const brownish = fam === 'brown' || fam === 'red';
  if (!S.has('cabin') && dT > 0.06 && dT < 0.62 && b.R >= 18 && b.elong < 1.6 && (hint === 'cabin' || chance(brownish ? 0.45 : 0.14))) {
    S.reserve('cabin');
    const size = clamp((b.y - S.hy) * 0.42 + b.R * 0.6, 26, 230);
    const bushSide = -S.lightDir;
    return [
      step('cabin', () => P.cabin(S, { ...b, baseY: b.y, size })),
      step('bush', () => P.bush(S, { ...b, x: b.x + bushSide * size * rand(0.55, 0.8), baseY: b.y + 2, r: size * 0.2 }), { quiet: true }),
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

// A smaller neighbor next to whatever was just painted, if there's ground for it.
function friend(S, prev, tint) {
  if (!prev?.meta) return null;
  const { x, baseY, size, type } = prev.meta;
  for (const side of chance(0.5) ? [-1, 1] : [1, -1]) {
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
