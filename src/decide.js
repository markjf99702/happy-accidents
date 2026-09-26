// Looks at a splat (its color, where it landed, what it landed on, its shape, which way
// it was flung) and decides what it was trying to be. The paint picks what it becomes and
// where it lands picks which version: white is a cloud up high, a snowy peak low in the sky,
// a birch or a snowy pine on land, and a sail out on the lake.
// Returns a plan: a list of steps, each of which builds one painted element (or paints onto
// an existing one) when its turn comes.
import { chance, clamp, rand, weighted, pick } from './util.js';
import { hex, mix, lighten, darken, lum } from './color.js';
import { splatShape } from './splat.js';
import * as P from './paint/index.js';
import * as R from './paint/react.js';

const step = (kind, make, extra = {}) => ({ kind, make, ...extra });

const WHITE = [255, 255, 255];

// Leaf colors for each paint, darkest to lightest.
const LEAF = {
  green: ['#243a1c', '#46692a', '#8fae45', '#d8e07a'],
  yellow: ['#6b4a0e', '#b8860f', '#e8c040', '#fff0a0'],
  red: ['#5b1210', '#9e2418', '#d0452a', '#f08a5a'],
  brown: ['#3a2a1c', '#5a4028', '#8a6a44', '#b89468'],
  birch: ['#7a7a44', '#d4d09a', '#ece8c0', '#fffbe8'],
};

// The earth that land-making paints lay down: dark, mid, light.
const GROUND = {
  green: ['#1f2d14', '#3f5c23', '#8fae45'],
  brown: ['#24180e', '#5a4028', '#9a7a52'],
  yellow: ['#3a2a10', '#9a7a2a', '#e0c060'],
};

export function decide(S, sp) {
  const { H, hy } = S;
  const center = sp.center || { x: sp.x, y: sp.y };
  const pigment = sp.mixPigment || sp.pigment;
  const b = { x: center.x, y: center.y, R: sp.effR || sp.R, tint: pigment.rgb, elong: sp.stretch, shape: splatShape(sp) };
  const c = { fam: pigment.family, id: pigment.id, rgb: pigment.rgb };
  const hint = sp.hint;
  const vertical = Math.abs(Math.sin(sp.ang)) > 0.7 && sp.stretch > 1.35;

  // Paint that lands on something already there changes it.
  const hit = S.elementAt(b.x, b.y, b.R);
  if (hit) {
    const plan = react(S, hit, b, c.fam);
    if (plan) return plan;
  }

  const band = H * 0.035;
  if (b.y < hy - band) return sky(S, b, c, hint);
  if (b.y < hy + band) return [step('treeline', () => P.treeline(S, { ...b, ...treelineLook(c) }), { say: c.fam === 'white' ? 'snowyTreeline' : undefined })];
  return low(S, b, c, hint, vertical);
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
              tintAmt: fam === 'green' ? 0.3 : 0.06,
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
      return [step('cloudOverSun', () => P.cloud(S, { ...b, ...cloudLook(S, { fam, rgb: b.tint }), x: x + rand(-0.5, 0.5) * r, y: y + rand(-0.3, 0.3) * r, R: r * 1.2, elong: 2.6 }))];
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
      const bloom = bloomColor(b.tint);
      return [
        step('garden', () => P.flowers(S, { x: m.x0 - m.size * rand(0.05, 0.2), y: m.baseY + 2, R: m.size * 0.12, tint: bloom, onLand })),
        step('flowers', () => P.flowers(S, { x: m.x1 + m.size * rand(0.05, 0.2), y: m.baseY + 2, R: m.size * 0.12, tint: bloom, onLand }), { quiet: true }),
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

// ——— the sky ———

function sky(S, b, c, hint) {
  const skyT = b.y / S.hy; // 0 at the top of the canvas, 1 at the horizon
  const lowSky = skyT > 0.45;
  const { night } = S.scheme;
  const lit = S.has('sun') || S.has('moon');
  const room = S.count('mountain') < (hint === 'mountain' ? 4 : 3);
  // A mountain, if there's room for one and the splat is big and low enough (or was aimed at being one).
  const mountainy = (p) => room && (hint === 'mountain' || (!hint && lowSky && b.R > 20 && chance(p)));

  if (b.R < 17 && !hint) {
    const bright = c.fam === 'white' || c.fam === 'yellow';
    if (bright && (night || (S.scheme.stars && chance(0.5)))) return [step('stars', () => P.stars(S, b))];
    if (bright || c.fam === 'red') return [step('cloud', () => P.cloud(S, { ...b, elong: Math.max(b.elong, 2.6), ...cloudLook(S, c) }), { say: 'wisp' })];
    return [birdsStep(S, b, c)];
  }
  if (hint === 'birds') return [birdsStep(S, b, c)];

  switch (c.fam) {
    case 'yellow':
      if (!lit && hint !== 'cloud' && hint !== 'mountain' && skyT < 0.85) return sunSteps(S, b, c);
      if (c.id === 'yellow-ochre' && mountainy(0.35)) return [mountainStep(S, b, { tintAmt: 0.35 }, 'goldMountain')];
      return [step('cloud', () => P.cloud(S, { ...b, ...cloudLook(S, c) }), { say: 'goldenCloud' })];

    case 'white':
      if (!lit && (hint === 'sun' || (!hint && skyT < 0.6 && b.elong < 1.5 && chance(0.4)))) return sunSteps(S, b, c);
      if (mountainy(0.6)) return [mountainStep(S, b, { snowy: true, snowLine: 0.75, tintAmt: 0.05 }, 'snowyMountain')];
      return [step('cloud', () => P.cloud(S, { ...b, ...cloudLook(S, c) }))];

    case 'red':
      if (mountainy(0.3)) return [mountainStep(S, b, { tintAmt: 0.35 }, 'redMountain')];
      return [step('cloud', () => P.cloud(S, { ...b, ...cloudLook(S, c) }), { say: 'sunsetCloud' })];

    case 'green': {
      if (night && !S.has('aurora') && hint !== 'mountain' && skyT < 0.7 && b.R > 22 && chance(0.6)) {
        S.reserve('aurora');
        return [step('aurora', () => P.aurora(S, b))];
      }
      if (room && (hint === 'mountain' || lowSky)) return greenMountain(S, b);
      return tallTree(S, b) || (room ? greenMountain(S, b) : [step('treeline', () => P.treeline(S, { ...b, y: S.hy, tintAmt: 0.15 }))]);
    }

    case 'blue':
      if (c.id === 'prussian-blue' && hint !== 'mountain' && (hint === 'cloud' || !lowSky) && chance(0.5)) return stormSteps(S, b, c, 1);
      if (mountainy(0.7)) return [mountainStep(S, b, { tintAmt: 0.4 }, 'blueMountain')];
      if (!hint && b.R < 24 && chance(0.25)) return [birdsStep(S, b, c)];
      return [step('cloud', () => P.cloud(S, { ...b, ...cloudLook(S, c) }), { say: 'coolCloud' })];

    case 'brown':
    default:
      if (mountainy(0.75)) return [mountainStep(S, b, { tintAmt: 0.45 }, 'brownMountain')];
      if (!hint && b.R < 26 && chance(0.35)) return [birdsStep(S, b, c)];
      return stormSteps(S, b, c, 0.4);
  }
}

// The light and shadow of a cloud made from this paint.
function cloudLook(S, c) {
  const { cloud, night } = S.scheme;
  const rgb = c.rgb;
  switch (c.fam) {
    case 'white':
      return { light: mix(cloud.light, WHITE, night ? 0.3 : 0.5), shadow: mix(cloud.shadow, cloud.light, 0.25) };
    case 'yellow':
      return { light: dim(S, mix(cloud.light, lighten(rgb, 0.35), 0.55)), shadow: mix(cloud.shadow, rgb, 0.3) };
    case 'red':
      return { light: dim(S, mix(cloud.light, lighten(rgb, 0.5), 0.5)), shadow: mix(cloud.shadow, rgb, 0.45) };
    case 'blue':
      return { light: dim(S, mix(cloud.light, mix(lighten(rgb, 0.45), [160, 190, 235], 0.4), 0.75)), shadow: mix(cloud.shadow, rgb, 0.6) };
    case 'brown':
      return stormLook(S, c);
    default:
      return {};
  }
}

// Dark, heavy clouds for dark paint.
function stormLook(S, c) {
  const { cloud } = S.scheme;
  return { light: mix(darken(cloud.shadow, 0.05), lighten(c.rgb, 0.4), 0.45), shadow: darken(mix(cloud.shadow, c.rgb, 0.55), 0.3) };
}

function stormSteps(S, b, c, rainChance) {
  const steps = [step('cloud', () => P.cloud(S, { ...b, ...stormLook(S, c) }), { say: 'stormCloud' })];
  if (chance(rainChance)) steps.push(step('rain', (prev) => R.rain(S, prev), { quiet: true }));
  return steps;
}

function birdsStep(S, b, c) {
  return step('birds', () => P.birds(S, { ...b, color: mix(S.scheme.bird, c.rgb, 0.5) }));
}

function sunSteps(S, b, c) {
  const { sunType, sun, sunGlow } = S.scheme;
  const moon = sunType === 'moon';
  S.reserve(moon ? 'moon' : 'sun');
  const look = c.fam === 'white' ? { body: mix(sun, WHITE, 0.6), glow: mix(sunGlow, WHITE, 0.4) } : { body: mix(sun, lighten(c.rgb, 0.25), 0.6), glow: mix(sunGlow, c.rgb, 0.5) };
  return [step(moon ? 'moon' : 'sun', () => P.sun(S, { ...b, ...look })), step('sunpath', (prev) => P.sunpath(S, prev.meta), { quiet: true })];
}

function mountainStep(S, b, look, say) {
  const index = S.count('mountain');
  S.reserve('mountain');
  return step('mountain', () => P.mountain(S, { ...b, index, ...look }), { say });
}

// A green mountain, with trees climbing one flank.
function greenMountain(S, b) {
  const main = mountainStep(S, b, { tintAmt: 0.55 }, 'greenMountain');
  const side = chance(0.5) ? -1 : 1;
  return [
    main,
    step(
      'foothills',
      (prev) => {
        const m = prev.meta;
        const y = m.peak[1] + m.hgt * rand(0.45, 0.7);
        const x = m.peak[0] + side * m.hgt * rand(0.35, 0.7);
        return P.treeline(S, { ...b, x, y, baseY: y + 10, haze: 0.5, scale: 0.6, slope: side * 0.4, depth: prev.depth + 0.5, noGround: true, kind: 'foothills', tintAmt: 0.3 });
      },
      { quiet: true },
    ),
  ];
}

// Green high in the sky is the top of a tall tree growing up from the land below. If
// there's no land under it, the tree brings a bit of shore with it.
function tallTree(S, b) {
  const { W, H, hy } = S;
  const nearY = hy + (H - hy) * 0.35;
  const look = { kind: 'evergreen', p: { tintAmt: 0.15 } };
  const grow = (x, baseY) => P.evergreen(S, { ...b, x, baseY, h: clamp(baseY - b.y + b.R, 80, H * 1.05), tintAmt: look.p.tintAmt, haze: 0 });
  for (const dx of [0, -25, 25, -55, 55, -90, 90]) {
    const x = b.x + dx;
    if (x < 10 || x > W - 10) continue;
    for (let y = nearY; y < H - 6; y += 6) {
      if (S.isLand(x, y)) return [step('evergreen', () => grow(x, y + 4), { say: 'tallTree' })];
    }
  }
  const side = b.x < W / 2 ? -1 : 1;
  const bx = side < 0 ? clamp(b.x, W * 0.1, W * 0.36) : clamp(b.x, W * 0.64, W * 0.9);
  const land = step(
    'bank',
    () => {
      const spec = P.bank(S, { ...b, shape: null, x: bx, y: hy + (H - hy) * rand(0.68, 0.8), R: rand(36, 48), side, connect: true, ground: pal(S, GROUND.green) });
      S.addLand(spec.meta.outline);
      return spec;
    },
    { say: 'tallTree' },
  );
  return [
    land,
    step(
      'evergreen',
      (prev) => {
        const spots = prev.meta.spots;
        if (!spots.length) return null;
        const spot = spots.reduce((a, s) => (Math.abs(s[0] - b.x) < Math.abs(a[0] - b.x) ? s : a));
        return grow(spot[0], spot[1]);
      },
      { quiet: true },
    ),
  ];
}

// The far treeline along the horizon, in the paint's color.
function treelineLook(c) {
  switch (c.fam) {
    case 'white':
      return { snowy: true, tintAmt: 0.1 };
    case 'green':
      return { tintAmt: 0.15 };
    case 'blue':
      return { tintAmt: 0.4 };
    default:
      return { tintAmt: 0.45 };
  }
}

// ——— the lake and the land ———

function low(S, b, c, hint, vertical) {
  const { H, hy } = S;
  const dT = (b.y - hy) / (H - hy);
  const footY = Math.min(H - 4, b.y + b.R * 0.3);
  const onLand = S.isLand(b.x, footY) || S.isLand(b.x, b.y);
  if (onLand && hint !== 'bank' && hint !== 'water') return land(S, { ...b, y: footY }, c, hint, vertical, dT);
  return water(S, b, c, hint, vertical, dT);
}

// Greens, browns and ochre make ground; other paints stay on the water.
const makesLand = (c) => c.fam === 'green' || c.fam === 'brown' || c.id === 'yellow-ochre';

function water(S, b, c, hint, vertical, dT) {
  const { W } = S;
  const nearEdge = b.x < W * 0.3 || b.x > W * 0.7;
  const openWater = !nearEdge && dT <= 0.72;
  const landish = hint === 'bank' || hint === 'tree' || (hint !== 'water' && makesLand(c));

  if (c.fam === 'brown' && openWater && hint !== 'bank' && hint !== 'tree' && (hint === 'water' || (b.R < 22 && chance(0.6)))) {
    return [step('rock', () => P.rock(S, b))];
  }
  if (landish) {
    if (openWater && b.R < 14 && hint !== 'bank' && hint !== 'tree') {
      // Too small for an island: a rock, and if it's green, moss on it.
      const rock = step('rock', () => P.rock(S, b));
      return c.fam === 'green' ? [rock, step('moss', () => rock.spec?.el && R.moss(S, rock.spec.el, b), { quiet: true })] : [rock];
    }
    const connect = hint === 'bank' || !openWater;
    const kind = connect ? 'bank' : 'island';
    const ground = GROUND[c.fam === 'yellow' ? 'yellow' : c.fam];
    const base = step(kind, () => {
      const spec = P.bank(S, { ...b, connect, ground: ground && pal(S, ground) });
      S.addLand(spec.meta.outline);
      return spec;
    });
    const steps = [base];
    const wantsTree = hint === 'tree' || (hint !== 'bank' && b.R > 30 && chance(c.fam === 'green' ? 0.7 : 0.45));
    if (wantsTree) {
      base.say = connect ? 'bankTree' : 'islandTree';
      const look = treeLook(S, b, c, vertical, 'tree');
      const main = step(
        look.kind,
        () => {
          const spots = base.spec.meta.spots.filter((s) => Math.abs(s[0] - b.x) < b.R * 4 + 60);
          const spot = pick(spots.length ? spots : base.spec.meta.spots);
          return spot ? tree(S, { ...b, x: spot[0], y: spot[1] }, look) : null;
        },
        { quiet: true },
      );
      steps.push(main);
      if (look.snow) steps.push(snowOn(S, main, b));
    }
    return steps;
  }

  switch (c.fam) {
    case 'white':
      if (b.R >= 15 && S.count('sailboat') < 3) return [step('sailboat', () => P.sailboat(S, b))];
      return chance(0.5) ? [step('glints', () => P.glints(S, b))] : [step('ripples', () => P.ripples(S, { ...b, color: S.scheme.waterLine }))];
    case 'red':
      if (S.count('canoe') < 3) return [step('canoe', () => P.canoe(S, b))];
      return [step('glints', () => P.glints(S, b))];
    case 'yellow':
      return [step('glints', () => P.glints(S, b))];
    case 'blue':
      return [step('ripples', () => P.ripples(S, { ...b, color: mix(S.scheme.waterLine, c.rgb, 0.35), wide: b.R > 24 }), { say: 'blueRipples' })];
    default:
      return [step('ripples', () => P.ripples(S, b))];
  }
}

function land(S, b, c, hint, vertical, dT) {
  const onLand = (x, y) => S.isLand(x, y);
  if (b.R < 13 && !hint) {
    if (c.fam === 'green' || c.fam === 'brown') {
      const leaf = pal(S, LEAF[c.fam]);
      return [step('bush', () => tree(S, b, { kind: 'bush', p: { leaf } }))];
    }
    return [step('flowers', () => P.flowers(S, { ...b, tint: bloomColor(c.rgb), onLand }))];
  }

  const cabinFits = !S.has('cabin') && dT > 0.06 && dT < 0.62 && b.R >= 18 && b.elong < 1.6;
  const cabinOdds = { brown: 0.55, red: 0.3, white: 0.12 }[c.fam] || 0;
  if (cabinFits && hint !== 'tree' && (hint === 'cabin' || (!hint && chance(cabinOdds)))) return cabinSteps(S, b, c);

  const look = treeLook(S, b, c, vertical, hint);
  const main = step(look.kind, () => tree(S, b, look), { say: look.say });
  const steps = [main];
  if (look.snow) steps.push(snowOn(S, main, b));
  const buddy = (side, say) => {
    const f = step(look.kind, () => friend(S, main.spec, b.tint, side, look), say ? { say } : { quiet: true });
    steps.push(f);
    if (look.snow) steps.push(snowOn(S, f, b));
  };
  const big = b.R > 42 && dT > 0.5;
  if (big && chance(0.6)) {
    buddy(-1, 'family');
    buddy(1);
  } else if (chance(0.38)) {
    buddy(undefined, 'friend');
  }
  return steps;
}

function cabinSteps(S, b, c) {
  S.reserve('cabin');
  const size = clamp((b.y - S.hy) * 0.42 + b.R * 0.6, 26, 230);
  const bushSide = -S.lightDir;
  const wall = c.fam === 'red' ? dim(S, mix(hex('#8e2a1c'), c.rgb, 0.4)) : c.fam === 'white' ? dim(S, [226, 222, 212]) : undefined;
  const say = c.fam === 'red' ? 'redCabin' : c.fam === 'white' ? 'whiteCabin' : undefined;
  const leaf = c.fam === 'green' ? pal(S, LEAF.green) : undefined;
  return [
    step('cabin', () => P.cabin(S, { ...b, baseY: b.y, size, wall }), { say }),
    step('bush', () => P.bush(S, { ...b, shape: null, x: b.x + bushSide * size * rand(0.55, 0.8), baseY: b.y + 2, r: size * 0.2, leaf }), { quiet: true }),
  ];
}

// What kind of tree this paint grows, and how it's colored.
function treeLook(S, b, c, vertical, hint) {
  const leaf = (name) => pal(S, LEAF[name]);
  switch (c.fam) {
    case 'white':
      if (chance(0.65)) return { kind: 'evergreen', p: { tintAmt: 0.12 }, snow: true, say: 'snowyTree' };
      // White bark and white branches, with only a few pale leaves so the white shows.
      return { kind: 'deciduous', p: { birch: true, bare: true, sparse: 0.14, leaf: leaf('birch') }, say: 'birch' };
    case 'blue':
      return { kind: 'evergreen', p: { tintAmt: 0.5, tint: dim(S, mix(c.rgb, [170, 195, 215], 0.45)) }, say: 'blueSpruce' };
    case 'yellow':
      return chance(0.7) ? { kind: 'deciduous', p: { leaf: leaf('yellow') }, say: 'goldenTree' } : { kind: 'bush', p: { leaf: leaf('yellow') } };
    case 'red':
      return chance(0.7) ? { kind: 'deciduous', p: { leaf: leaf('red') }, say: 'redTree' } : { kind: 'bush', p: { leaf: leaf('red') } };
    case 'brown':
      return chance(0.75) ? { kind: 'deciduous', p: { bare: true, leaf: leaf('brown') }, say: 'bareTree' } : { kind: 'bush', p: { leaf: leaf('brown') } };
    case 'green':
    default: {
      const kind = weighted([
        ['evergreen', 0.8 + (vertical ? 0.4 : 0) + (hint === 'tree' ? 0.2 : 0)],
        ['deciduous', S.scheme.leafy ? 0.45 : 0.3],
        ['bush', 0.22 + (b.R < 22 ? 0.3 : 0)],
      ]);
      return { kind, p: kind === 'evergreen' ? { tintAmt: 0.15 } : { leaf: leaf('green') } };
    }
  }
}

function tree(S, b, look) {
  const dT = clamp((b.y - S.hy) / (S.H - S.hy), 0, 1);
  const depth = b.y - S.hy;
  const haze = clamp((0.25 - dT) * 1.6, 0, 0.4);
  const p = { ...b, ...look.p, baseY: b.y, haze };
  if (look.kind === 'evergreen') {
    const h = clamp(depth * rand(1.1, 1.8) + b.R * 1.4, 16, S.H * 1.05);
    return P.evergreen(S, { ...p, h });
  }
  if (look.kind === 'deciduous') {
    const h = clamp(depth * rand(0.9, 1.4) + b.R * 1.2, 16, S.H * 0.95);
    return P.deciduous(S, { ...p, h });
  }
  const r = clamp(depth * rand(0.08, 0.14) + b.R * 0.5, 5, 140);
  return P.bush(S, { ...p, r });
}

// Snow settling on a tree that was just painted.
function snowOn(S, treeStep, b) {
  return step(
    'treeSnow',
    () => {
      const el = treeStep.spec?.el;
      return el && first(el, 'snow') ? R.treeSnow(S, el, b) : null;
    },
    { quiet: true },
  );
}

// A smaller neighbor next to a tree (preferably on the given side), if there's ground for
// it. It matches the tree's look when there is one.
function friend(S, prev, tint, preferSide, look) {
  if (!prev?.meta?.type) return null;
  const { x, baseY, size, type } = prev.meta;
  const sides = preferSide ? [preferSide, -preferSide] : chance(0.5) ? [-1, 1] : [1, -1];
  const extra = look?.p || {};
  for (const side of sides) {
    const fx = x + side * size * rand(0.22, 0.42);
    const fy = baseY + rand(-size * 0.03, size * 0.06);
    if (fx < 0 || fx > S.W || fy > S.H - 2 || !S.isLand(fx, fy)) continue;
    const b = { x: fx, y: fy, R: 10, tint, elong: 1, ...extra };
    const scale = rand(0.5, 0.8);
    const dT = clamp((fy - S.hy) / (S.H - S.hy), 0, 1);
    const haze = clamp((0.25 - dT) * 1.6, 0, 0.4);
    if (type === 'deciduous') return P.deciduous(S, { ...b, baseY: fy, h: size * scale, haze });
    if (type === 'bush') return P.bush(S, { ...b, baseY: fy, r: (size / 2.2) * scale, haze });
    return P.evergreen(S, { ...b, baseY: fy, h: size * scale, haze });
  }
  return null;
}

// ——— colors ———

// Bright paint is toned down to suit the light: at night everything sits in shadow.
function dim(S, col) {
  const k = S.scheme.night ? 0.55 : S.scheme.id === 'violet-dusk' ? 0.3 : 0;
  return k ? mix(col, S.scheme.tree.dark, k) : col;
}

const pal = (S, list) => list.map((h) => dim(S, hex(h)));

// Flowers in the paint's own color, lifted a little when the paint is too dark to show.
const bloomColor = (rgb) => (lum(rgb) < 0.2 ? lighten(rgb, 0.4) : rgb);
