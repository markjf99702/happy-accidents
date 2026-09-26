// Fan-brush evergreens, leafy trees, bushes and little patches of flowers.
import { TAU, rand, randi, chance, clamp } from '../util.js';
import { rgba, mix, jitter, darken, lum } from '../color.js';
import { bristle, linePts, grass } from '../brush.js';
import { place, clumps, sideProfile } from '../shape.js';

// One tap of the fan brush: a spray of fine, slightly drooping lines out from the trunk.
export function fanTap(ctx, cx, y, side, len, droop, color, lw, n, alpha, from = 0) {
  ctx.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const sx = cx + side * len * (from ? rand(from, from + 0.2) : rand(-0.06, 0.1));
    const sy = y + rand(-len * 0.06, len * 0.06);
    const reach = rand(Math.max(from + 0.3, 0.55), 1.05);
    const ex = cx + side * len * reach;
    const ey = y + droop * reach * rand(0.6, 1.3) + rand(-len * 0.05, len * 0.12);
    const mx = (sx + ex) / 2;
    const my = Math.min(sy, ey) - len * rand(0.02, 0.1);
    ctx.strokeStyle = rgba(jitter(color, 0.04), alpha * rand(0.5, 1));
    ctx.lineWidth = lw * rand(0.6, 1.4);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
  }
}

export function groundColors(S, hz) {
  const g = S.scheme.ground;
  return [mix(g.dark, S.haze, hz), mix(g.mid, S.haze, hz), mix(g.light, S.haze, hz)];
}

export function evergreen(S, p) {
  const { scheme } = S;
  const { x, baseY, h } = p;
  const hz = p.haze ?? 0;
  const ta = p.tintAmt ?? 0.08;
  const dark = mix(mix(scheme.tree.dark, p.tint, ta), S.haze, hz);
  const mid = mix(mix(scheme.tree.mid, p.tint, ta * 0.8), S.haze, hz);
  const light = mix(mix(scheme.tree.light, p.tint, ta * 0.6 + 0.02), S.haze, hz * 0.8);
  const L = S.lightDir;
  const top = baseY - h;
  const lw = clamp(h / 240, 0.7, 2.2);
  const nT = Math.round(clamp(h / 5, 8, 70));
  const lean = rand(-0.03, 0.03) * h;
  const girth = rand(0.17, 0.24);
  // Where the splat bulged out to one side, the branches do too.
  const reach = sideProfile(p.shape);

  const tiers = [];
  for (let i = 0; i < nT; i++) {
    const t = i / (nT - 1);
    const y = top + t * h * 0.9;
    const cx = x + lean * (1 - t);
    let w = h * girth * (0.06 + 0.94 * Math.pow(t, 0.9)) * rand(0.55, 1.25);
    if (t > 0.15 && chance(0.12)) w *= 0.45;
    tiers.push({ t, y, cx, w, wL: w * reach(t, -1), wR: w * reach(t, 1), droop: w * rand(0.18, 0.45) });
  }

  const ops = [];
  const trunk = darken(mix(scheme.tree.dark, [62, 42, 26], 0.45), 0.15);
  ops.push((ctx) =>
    bristle(ctx, linePts(x, baseY, x + lean, top + h * 0.05, 16), { width: Math.max(2, h * 0.03), color: trunk, alpha: 0.95, taper: 0.05, colorVar: 0.02 }),
  );
  for (let i = 0; i < tiers.length; i += 2) {
    const pair = tiers.slice(i, i + 2);
    ops.push((ctx) => {
      for (const tr of pair) {
        for (const side of [-1, 1]) {
          const w = side < 0 ? tr.wL : tr.wR;
          fanTap(ctx, tr.cx, tr.y, side, w * (side === L ? 1 : rand(0.85, 1.05)), tr.droop, dark, lw, clamp(Math.round(w / 1.6), 4, 24), 0.85);
        }
      }
    });
  }
  for (let i = 0; i < tiers.length; i += 2) {
    const pair = tiers.slice(i, i + 2);
    ops.push((ctx) => {
      for (const tr of pair) {
        const lit = L < 0 ? tr.wL : tr.wR;
        const shade = L < 0 ? tr.wR : tr.wL;
        const n = clamp(Math.round(lit / 3), 2, 12);
        fanTap(ctx, tr.cx, tr.y - 0.5, L, lit * 0.95, tr.droop * 0.7, mid, lw, n, 0.7, 0.3);
        if (tr.t > 0.04) fanTap(ctx, tr.cx, tr.y - 1, L, lit, tr.droop * 0.6, light, lw * 0.9, Math.max(1, Math.round(n * 0.6)), 0.75, 0.5);
        if (chance(0.5)) fanTap(ctx, tr.cx, tr.y, -L, shade * 0.8, tr.droop * 0.6, mid, lw * 0.9, Math.max(1, Math.round(n * 0.3)), 0.45, 0.45);
      }
    });
  }
  const gc = groundColors(S, hz);
  ops.push((ctx) => grass(ctx, x, baseY, h * 0.16, gc, Math.round(clamp(h / 3, 8, 70)), clamp(h / 90, 0.6, 2.6)));

  return {
    kind: 'evergreen',
    depth: baseY,
    reflect: false,
    bbox: { x: x - h * 0.36 - 14, y: top - 12, w: h * 0.72 + 28, h: h + 24 },
    ops,
    dur: clamp(800 + h * 3, 900, 2600),
    meta: { x, baseY, size: h, type: 'evergreen', tiers, lw },
  };
}

// Leaves: many small dabs inside a clump, filtered to the part of the clump a pass should cover.
export function leafPass(ctx, cl, color, count, lw, alpha, keep) {
  for (let i = 0; i < count; i++) {
    const a = rand(TAU);
    const d = Math.sqrt(Math.random()) * cl.r;
    const px = cl.x + Math.cos(a) * d;
    const py = cl.y + Math.sin(a) * d * 0.85;
    if (keep && !keep(px - cl.x, py - cl.y, cl.r)) continue;
    ctx.fillStyle = rgba(jitter(color, 0.05), alpha * rand(0.55, 1));
    ctx.beginPath();
    ctx.ellipse(px, py, lw * rand(1.3, 2.8), lw * rand(0.8, 1.4), rand(TAU), 0, TAU);
    ctx.fill();
  }
}

export function foliage(S, clusters, leaf, lw) {
  const L = S.lightDir;
  const ops = [];
  const lit = (dx, dy, r) => dx * L + -dy > r * 0.05;
  const edge = (dx, dy, r) => dx * L + -dy > r * 0.5;
  const density = (cl, k, lo, hi) => clamp(Math.round(((cl.r * cl.r) / (lw * lw)) * k), lo, hi);
  for (const cl of clusters) ops.push((ctx) => leafPass(ctx, cl, leaf[0], density(cl, 0.55, 20, 1000), lw, 0.92));
  for (const cl of clusters) ops.push((ctx) => leafPass(ctx, cl, leaf[1], density(cl, 0.4, 10, 700), lw, 0.88, lit));
  for (const cl of clusters) {
    ops.push((ctx) => {
      leafPass(ctx, cl, leaf[2], density(cl, 0.22, 6, 400), lw * 0.9, 0.88, edge);
      leafPass(ctx, cl, leaf[3], density(cl, 0.05, 2, 90), lw * 0.9, 0.85, edge);
    });
  }
  return ops;
}

export function deciduous(S, p) {
  const { scheme } = S;
  const { x, baseY, h } = p;
  const hz = p.haze ?? 0;
  const L = S.lightDir;
  const trunkC = mix(p.birch ? [226, 222, 212] : mix([62, 44, 30], scheme.ground.dark, 0.4), S.haze, hz);
  const leaf = (p.leaf || scheme.leaf).map((c) => mix(c, S.haze, hz));
  if (!p.leaf) {
    leaf[3] = mix(leaf[3], p.tint, 0.35);
    if (lum(p.tint) > 0.3) leaf[2] = mix(leaf[2], p.tint, 0.2);
  }

  const segs = [];
  const trunkTop = [x + rand(-0.05, 0.05) * h, baseY - h * rand(0.28, 0.38)];
  segs.push({ a: [x, baseY], b: trunkTop, w: Math.max(2.5, h * 0.055), w1: Math.max(1.6, h * 0.035) });
  let clusters;
  if (p.shape) {
    // The crown is the splat, blown up; limbs reach out from the trunk into it.
    const { box } = p.shape;
    const f = (h * rand(0.6, 0.8)) / box.w;
    const fy = Math.min(f * 0.85, (h * 0.7) / box.h);
    const ccx = trunkTop[0];
    const ccy = trunkTop[1] - box.h * fy * 0.42;
    const crown = place(p.shape, ccx, ccy, f, fy);
    clusters = clumps(crown, ccx, ccy, h * 0.17, 6);
    for (const cl of clusters) {
      if (!chance(0.6)) continue;
      const b = [trunkTop[0] + (cl.x - trunkTop[0]) * 0.75, trunkTop[1] + (cl.y - trunkTop[1]) * 0.75];
      segs.push({ a: trunkTop, b, w: Math.max(1.4, h * 0.03), w1: Math.max(0.8, h * 0.01) });
    }
    clusters.push({ x: ccx, y: ccy, r: h * 0.2 }, { x: ccx, y: (ccy + trunkTop[1]) / 2, r: h * 0.12 });
  } else {
    const ends = [];
    const grow = (pt, ang, len, w, depth) => {
      const b = [pt[0] + Math.cos(ang) * len, pt[1] + Math.sin(ang) * len];
      segs.push({ a: pt, b, w, w1: w * 0.6 });
      if (depth >= 3 || len < 6) {
        ends.push(b);
        return;
      }
      const kids = randi(2, 3);
      for (let i = 0; i < kids; i++) grow(b, ang + rand(-0.6, 0.6), len * rand(0.6, 0.78), w * 0.6, depth + 1);
      if (depth >= 2) ends.push(b);
    };
    const nb = randi(2, 4);
    for (let i = 0; i < nb; i++) {
      const spread = nb === 1 ? 0 : (i / (nb - 1) - 0.5) * 1.3;
      grow(trunkTop, -Math.PI / 2 + spread + rand(-0.2, 0.2), h * rand(0.2, 0.3), Math.max(1.4, h * 0.03), 1);
    }
    clusters = ends.map((e) => ({ x: e[0], y: e[1], r: h * rand(0.09, 0.15) }));
    clusters.push({ x: trunkTop[0], y: trunkTop[1] - h * 0.3, r: h * 0.22 });
  }
  const lw = clamp(h / 150, 0.9, 3);

  const ops = [];
  // Trunk and limbs as tapered shapes, then a little bark texture.
  for (let i = 0; i < segs.length; i += 4) {
    const chunk = segs.slice(i, i + 4);
    ops.push((ctx) => {
      for (const s of chunk) {
        const dx = s.b[0] - s.a[0];
        const dy = s.b[1] - s.a[1];
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l;
        const ny = dx / l;
        ctx.fillStyle = rgba(trunkC);
        ctx.beginPath();
        ctx.moveTo(s.a[0] + (nx * s.w) / 2, s.a[1] + (ny * s.w) / 2);
        ctx.lineTo(s.b[0] + (nx * s.w1) / 2, s.b[1] + (ny * s.w1) / 2);
        ctx.lineTo(s.b[0] - (nx * s.w1) / 2, s.b[1] - (ny * s.w1) / 2);
        ctx.lineTo(s.a[0] - (nx * s.w) / 2, s.a[1] - (ny * s.w) / 2);
        ctx.closePath();
        ctx.fill();
      }
    });
  }
  if (p.bare) {
    // No leaves: twigs off the ends of the limbs, and only a few dry leaves hanging on.
    ops.push(...twigs(segs, trunkC, h));
    for (const cl of clusters) ops.push((ctx) => leafPass(ctx, cl, leaf[1], Math.round(((cl.r * cl.r) / (lw * lw)) * (p.sparse ?? 0.04)), lw, 0.85));
  } else {
    ops.push(...foliage(S, clusters, leaf, lw));
  }
  if (p.birch) ops.push(...birchMarks(segs[0], h));
  ops.push((ctx) => {
    const s = segs[0];
    bristle(ctx, linePts(s.a[0] + L * s.w * 0.3, s.a[1] - 2, s.b[0] + L * s.w * 0.25, s.b[1] + h * 0.05, 10), {
      width: s.w * 0.3,
      color: mix(trunkC, scheme.mtn.light, 0.45),
      alpha: 0.6,
      dry: 0.4,
      count: 3,
    });
  });
  const gc = groundColors(S, hz);
  ops.push((ctx) => grass(ctx, x, baseY, h * 0.14, gc, Math.round(clamp(h / 3, 8, 60)), clamp(h / 90, 0.6, 2.4)));

  let x0 = x - h * 0.1;
  let x1 = x + h * 0.1;
  let y0 = baseY - h;
  for (const cl of clusters) {
    x0 = Math.min(x0, cl.x - cl.r * 1.3);
    x1 = Math.max(x1, cl.x + cl.r * 1.3);
    y0 = Math.min(y0, cl.y - cl.r * 1.3);
  }
  return {
    kind: 'deciduous',
    depth: baseY,
    reflect: false,
    bbox: { x: x0 - 8, y: y0 - 8, w: x1 - x0 + 16, h: baseY - y0 + 20 },
    ops,
    dur: clamp(900 + h * 3, 1000, 2600),
    meta: { x, baseY, size: h, type: 'deciduous', clusters, lw },
  };
}

// Thin twigs forking off the ends of a bare tree's limbs.
function twigs(segs, color, h) {
  const ops = [];
  const ends = segs.slice(1);
  for (let i = 0; i < ends.length; i += 4) {
    const chunk = ends.slice(i, i + 4);
    ops.push((ctx) => {
      ctx.strokeStyle = rgba(color, 0.9);
      ctx.lineCap = 'round';
      for (const s of chunk) {
        const ang = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]);
        for (let k = 0; k < 4; k++) {
          const a = ang + rand(-0.8, 0.8);
          const len = h * rand(0.05, 0.12);
          const mx = s.b[0] + Math.cos(a) * len * 0.5;
          const my = s.b[1] + Math.sin(a) * len * 0.5;
          ctx.lineWidth = Math.max(0.6, s.w1 * 0.5);
          ctx.beginPath();
          ctx.moveTo(s.b[0], s.b[1]);
          ctx.quadraticCurveTo(mx + rand(-3, 3), my + rand(-3, 3), s.b[0] + Math.cos(a) * len, s.b[1] + Math.sin(a) * len);
          ctx.stroke();
        }
      }
    });
  }
  return ops;
}

// The dark bands across birch bark.
function birchMarks(trunk, h) {
  return [
    (ctx) => {
      const [x0, y0] = trunk.a;
      const [x1, y1] = trunk.b;
      for (let i = 0; i < Math.round(h / 14); i++) {
        const t = Math.random();
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        const w = trunk.w * (1 - t * 0.4);
        ctx.fillStyle = rgba([40, 34, 30], rand(0.6, 0.9));
        ctx.fillRect(x - w / 2 + rand(0, w * 0.3), y, w * rand(0.3, 0.7), rand(1, 2.5));
      }
    },
  ];
}

export function bush(S, p) {
  const { scheme } = S;
  const r = p.r;
  const hz = p.haze ?? 0;
  const leafy = scheme.leafy && chance(0.6);
  const base = p.leaf || (leafy ? scheme.leaf : [scheme.tree.dark, scheme.tree.mid, scheme.tree.light, scheme.leaf[3]]);
  const leaf = base.map((c) => mix(c, S.haze, hz));
  if (!p.leaf) leaf[3] = mix(leaf[3], p.tint, 0.5);
  let clusters;
  if (p.shape) {
    const { box } = p.shape;
    const f = (r * 2.4) / box.w;
    const fy = Math.min(f * 0.75, (r * 1.6) / box.h);
    const cy = p.baseY - r * 0.75;
    clusters = clumps(place(p.shape, p.x, cy, f, fy), p.x, cy, r * 0.6, 6).map((cl) => ({ ...cl, y: Math.min(cl.y, p.baseY - cl.r * 0.35) }));
    clusters.push({ x: p.x, y: cy, r: r * 0.6 });
  } else {
    clusters = Array.from({ length: randi(3, 6) }, () => ({
      x: p.x + rand(-r, r) * 0.9,
      y: p.baseY - r * 0.35 - rand(0, r * 0.55),
      r: r * rand(0.45, 0.8),
    }));
  }
  const lw = clamp(r / 26, 0.8, 3);
  const ops = foliage(S, clusters, leaf, lw);
  const gc = groundColors(S, hz);
  ops.push((ctx) => grass(ctx, p.x, p.baseY, r * 1.1, gc, Math.round(clamp(r, 8, 50)), clamp(r / 30, 0.6, 2.2)));
  let x0 = p.x - r * 1.2;
  let x1 = p.x + r * 1.2;
  let y0 = p.baseY - r * 1.2;
  for (const cl of clusters) {
    x0 = Math.min(x0, cl.x - cl.r * 1.3);
    x1 = Math.max(x1, cl.x + cl.r * 1.3);
    y0 = Math.min(y0, cl.y - cl.r * 1.3);
  }
  return {
    kind: 'bush',
    depth: p.baseY,
    reflect: false,
    bbox: { x: x0 - 8, y: y0 - 8, w: x1 - x0 + 16, h: p.baseY - y0 + 20 },
    ops,
    dur: clamp(600 + r * 12, 700, 1800),
    meta: { x: p.x, baseY: p.baseY, size: r * 2.2, type: 'bush', clusters, lw },
  };
}

export function flowers(S, p) {
  const { scheme, hy, H } = S;
  const dT = clamp((p.y - hy) / (H - hy), 0, 1);
  const r = clamp(p.R * 1.8, 8, 44) * (0.4 + dT);
  const bloom = lum(p.tint) > 0.2 ? p.tint : scheme.leaf[3];
  const gc = groundColors(S, 0);
  // One clump where the splat landed, and a little one wherever a droplet did.
  const spots = [{ x: p.x, y: p.y, r }];
  const drops = (p.shape?.drops || []).filter((d) => d.y > hy + 4 && (!p.onLand || p.onLand(d.x, d.y)));
  for (const d of drops.slice(0, 10)) spots.push({ x: d.x, y: d.y, r: clamp(d.r * 3, 3, r * 0.45) });
  const ops = [];
  ops.push((ctx) => {
    for (const s of spots) grass(ctx, s.x, s.y, s.r, [gc[1], gc[2], scheme.tree.mid], Math.round(s.r * 2 + 2), clamp(s.r / 14, 0.6, 2.4));
  });
  for (let pass = 0; pass < 3; pass++) {
    ops.push((ctx) => {
      for (const sp of spots) {
        for (let i = 0; i < Math.max(1, Math.round(sp.r * 0.6)); i++) {
          const fx = sp.x + rand(-sp.r, sp.r);
          const fy = sp.y - rand(0, sp.r * 0.35);
          const s = rand(0.8, 2.2) * clamp(r / 20, 0.6, 2);
          ctx.fillStyle = rgba(jitter(bloom, 0.05), rand(0.7, 1));
          ctx.beginPath();
          ctx.arc(fx, fy, s, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(fx - s * 0.3, fy - s * 0.3, s * 0.4, 0, TAU);
          ctx.fill();
        }
      }
    });
  }
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of spots) {
    x0 = Math.min(x0, s.x - s.r);
    x1 = Math.max(x1, s.x + s.r);
    y0 = Math.min(y0, s.y - s.r);
    y1 = Math.max(y1, s.y);
  }
  return { kind: 'flowers', depth: p.y, reflect: false, bbox: { x: x0 - 12, y: y0 - 12, w: x1 - x0 + 24, h: y1 - y0 + 26 }, ops, dur: 800 };
}
