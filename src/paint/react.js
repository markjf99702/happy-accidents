// Paint that lands on something already in the painting changes it instead of adding
// something new. Most of these paint straight into the existing element's layer with
// source-atop, so the new paint only sticks where there was paint before: snow settles
// on the needles, not the sky between them.
import { rand, chance, clamp, gauss } from '../util.js';
import { rgba, mix, jitter, darken, lighten, hex } from '../color.js';
import { bristle, linePts, knife, soft, mistAtop, pathOf } from '../brush.js';
import { fanTap, leafPass } from './trees.js';

const WHITE = [250, 251, 255];
const AUTUMN = ['#6b200e', '#b4471d', '#e28b22', '#f5c54f'].map(hex);

function atop(ctx, draw) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  draw();
  ctx.restore();
}

function density(cl, lw, k, lo, hi) {
  return clamp(Math.round(((cl.r * cl.r) / (lw * lw)) * k), lo, hi);
}

// ——— trees ———

export function treeSnow(S, t, p) {
  const m = t.meta;
  const L = S.lightDir;
  const snow = mix(WHITE, p.tint, 0.04);
  const shaded = mix(snow, S.scheme.mtn.shadow, 0.3);
  const ops = [];
  if (m.tiers) {
    for (let i = 0; i < m.tiers.length; i += 3) {
      const chunk = m.tiers.slice(i, i + 3);
      ops.push((ctx) => {
        for (const tr of chunk) {
          if (tr.t < 0.04) continue;
          for (const side of [-1, 1]) {
            const w = side < 0 ? tr.wL : tr.wR;
            fanTap(ctx, tr.cx, tr.y - 1.5, side, w * 0.95, tr.droop * 0.3, side === L ? snow : shaded, m.lw * 1.3, clamp(Math.round(w / 2.2), 2, 16), 0.9, 0.1);
          }
        }
      });
    }
  } else {
    const upper = (dx, dy, r) => -dy > r * rand(-0.15, 0.25);
    for (const cl of m.clusters) {
      ops.push((ctx) => atop(ctx, () => leafPass(ctx, cl, snow, density(cl, m.lw, 0.3, 8, 500), m.lw, 0.95, upper)));
    }
  }
  return { kind: 'treeSnow', onto: t, ops, dur: 1300 };
}

// Warm paint on an evergreen: late light catching the side of it.
export function treeGlow(S, t, p) {
  const m = t.meta;
  const L = S.lightDir;
  const warm = lighten(mix(p.tint, hex('#ffd27a'), 0.45), 0.25);
  const ops = [];
  if (m.tiers) {
    for (let i = 0; i < m.tiers.length; i += 3) {
      const chunk = m.tiers.slice(i, i + 3);
      ops.push((ctx) =>
        atop(ctx, () => {
          for (const tr of chunk) {
            const w = L < 0 ? tr.wL : tr.wR;
            fanTap(ctx, tr.cx, tr.y - 1, L, w, tr.droop * 0.6, warm, m.lw, clamp(Math.round(w / 4), 1, 9), 0.8, 0.4);
          }
        }),
      );
    }
  } else {
    const edge = (dx, dy, r) => dx * L - dy > r * 0.4;
    for (const cl of m.clusters) ops.push((ctx) => atop(ctx, () => leafPass(ctx, cl, warm, density(cl, m.lw, 0.18, 6, 300), m.lw, 0.85, edge)));
  }
  return { kind: 'treeGlow', onto: t, ops, dur: 1100 };
}

// Warm paint on a leafy tree or bush: the leaves turn.
export function autumn(S, t, p) {
  const m = t.meta;
  const L = S.lightDir;
  const leaf = AUTUMN.map((c) => mix(c, p.tint, 0.3));
  const lit = (dx, dy, r) => dx * L - dy > r * 0.05;
  const edge = (dx, dy, r) => dx * L - dy > r * 0.5;
  const ops = [];
  for (const cl of m.clusters) ops.push((ctx) => atop(ctx, () => leafPass(ctx, cl, leaf[0], density(cl, m.lw, 0.5, 20, 900), m.lw, 0.9)));
  for (const cl of m.clusters) ops.push((ctx) => atop(ctx, () => leafPass(ctx, cl, leaf[1], density(cl, m.lw, 0.4, 10, 700), m.lw, 0.88, lit)));
  for (const cl of m.clusters) {
    ops.push((ctx) =>
      atop(ctx, () => {
        leafPass(ctx, cl, leaf[2], density(cl, m.lw, 0.22, 6, 400), m.lw * 0.9, 0.88, edge);
        leafPass(ctx, cl, leaf[3], density(cl, m.lw, 0.08, 3, 150), m.lw * 0.9, 0.85, edge);
      }),
    );
  }
  return { kind: 'autumn', onto: t, ops, dur: 1500 };
}

// ——— mountains ———

function litRidge(S, m, reach) {
  const L = S.lightDir;
  const peakY = m.peak[1];
  const out = [];
  for (let i = 0; i < m.ridge.length - 2; i += 2) {
    const a = m.ridge[i];
    const b = m.ridge[i + 2];
    const rising = b[1] < a[1];
    const rel = (a[1] - peakY) / m.hgt;
    if (rel > reach) continue;
    out.push({ x: a[0], y: a[1], rel, lit: L < 0 ? rising : !rising });
  }
  return out;
}

export function snowfall(S, t, p) {
  const m = t.meta;
  const L = S.lightDir;
  const snow = mix(WHITE, p.tint, 0.04);
  const shaded = mix(snow, S.scheme.mtn.shadow, 0.35);
  const pts = litRidge(S, m, Math.min(0.8, m.snowLine + 0.3));
  const ops = [];
  for (let i = 0; i < pts.length; i += 8) {
    const chunk = pts.slice(i, i + 8);
    ops.push((ctx) =>
      atop(ctx, () => {
        for (const st of chunk) {
          const len = (m.base - st.y) * rand(0.15, 0.5) * (1 - st.rel * 0.5);
          if (st.lit) knife(ctx, st.x, st.y + 0.5, st.x + L * rand(0.25, 0.7) * len, st.y + len, rand(4, 10), jitter(snow, 0.02), 0.95, 0.4);
          else knife(ctx, st.x, st.y + 1, st.x - L * rand(0.2, 0.6) * len, st.y + len * 0.8, rand(3, 8), shaded, 0.7, 0.45);
        }
      }),
    );
  }
  ops.push((ctx) =>
    atop(ctx, () => {
      for (let i = 0; i < 14; i++) {
        const x = p.x + gauss() * p.R * 1.5;
        const y = p.y + gauss() * p.R;
        const len = rand(10, 34);
        knife(ctx, x, y, x + L * len * 0.5, y + len, rand(3, 8), snow, 0.85, 0.5);
      }
    }),
  );
  ops.push((ctx) => mistAtop(ctx, m.box, m.base - m.hgt * 0.62, m.base, S.haze, 0, 0.6));
  return { kind: 'snowfall', onto: t, ops, dur: 1700 };
}

// Warm paint on a mountain: the last light turns the peaks pink and gold.
export function alpenglow(S, t, p) {
  const m = t.meta;
  const L = S.lightDir;
  const warm = lighten(mix(p.tint, S.scheme.glow, 0.6), 0.25);
  const peakY = m.peak[1];
  const ops = [];
  ops.push((ctx) =>
    atop(ctx, () => {
      const g = ctx.createLinearGradient(0, peakY, 0, peakY + m.hgt * 0.65);
      g.addColorStop(0, rgba(warm, 0.3));
      g.addColorStop(1, rgba(warm, 0));
      ctx.fillStyle = g;
      ctx.fillRect(m.box.x, peakY - 5, m.box.w, m.hgt * 0.7);
    }),
  );
  const pts = litRidge(S, m, 0.55).filter((st) => st.lit);
  for (let i = 0; i < pts.length; i += 8) {
    const chunk = pts.slice(i, i + 8);
    ops.push((ctx) =>
      atop(ctx, () => {
        for (const st of chunk) {
          const len = (m.base - st.y) * rand(0.1, 0.35);
          knife(ctx, st.x, st.y + 0.5, st.x + L * rand(0.25, 0.7) * len, st.y + len, rand(3, 8), warm, 0.55, 0.5);
        }
      }),
    );
  }
  return { kind: 'alpenglow', onto: t, ops, dur: 1500 };
}

// Blue paint on a mountain: water finds its way down from where it hit.
export function waterfall(S, t, p) {
  const m = t.meta;
  const bottom = m.base - 4;
  if (bottom - p.y < 30) return null;
  const w = clamp(p.R * 0.45, 5, 22);
  const path = [];
  const wob = rand(100);
  for (let y = p.y; y <= bottom; y += 5) {
    const u = (y - p.y) / (bottom - p.y);
    path.push([p.x + Math.sin(wob + u * 5) * w * 0.35 + Math.sin(wob * 2 + u * 13) * w * 0.12, y, w * (0.5 + 0.7 * u)]);
  }
  const water = mix(WHITE, S.scheme.water, 0.18);
  const rock = darken(m.c0, 0.3);
  const ops = [];
  ops.push((ctx) => {
    ctx.save();
    ctx.clip(m.path);
    bristle(ctx, path.map(([x, y]) => [x, y]), { width: w * 1.7, color: rock, alpha: 0.55, taper: 0.15, dry: 0.2 });
    ctx.restore();
  });
  for (let k = 0; k < 8; k++) {
    ops.push((ctx) => {
      ctx.save();
      ctx.clip(m.path);
      for (let j = 0; j < 4; j++) {
        const off = rand(-0.5, 0.5);
        bristle(ctx, path.map(([x, y, pw]) => [x + off * pw, y]), {
          width: w * rand(0.15, 0.35),
          color: mix(water, S.scheme.water, rand(0, 0.35)),
          alpha: rand(0.5, 0.85),
          count: 3,
          taper: 0.1,
          dry: 0.25,
          dryFreq: 0.05,
        });
      }
      ctx.restore();
    });
  }
  const [lx, ly] = path[path.length - 1];
  ops.push((ctx) => {
    for (let i = 0; i < 8; i++) soft(ctx, lx + rand(-w * 1.5, w * 1.5), ly - rand(0, w * 1.5), w * rand(1.2, 2.4), WHITE, 0.22);
  });
  return {
    kind: 'waterfall',
    depth: t.depth + 0.4,
    reflect: true,
    bbox: { x: Math.min(p.x, lx) - w * 4, y: p.y - 10, w: Math.abs(lx - p.x) + w * 8, h: bottom - p.y + w * 3 + 20 },
    ops,
    dur: 1600,
  };
}

// ——— sky ———

// Warm paint on the sun: the whole sky warms up around it.
export function sunset(S, skyEl, sunEl, p) {
  const { W, hy } = S;
  const warm = mix(S.scheme.sunGlow, p.tint, 0.4);
  const { x, y } = sunEl.meta;
  const ops = [];
  ops.push((ctx) => soft(ctx, x, y, W * 0.65, warm, 0.28));
  ops.push((ctx) => {
    const g = ctx.createLinearGradient(0, hy * 0.5, 0, hy);
    g.addColorStop(0, rgba(warm, 0));
    g.addColorStop(1, rgba(warm, 0.34));
    ctx.fillStyle = g;
    ctx.fillRect(0, hy * 0.5, W, hy * 0.5 + 8);
  });
  for (let pass = 0; pass < 4; pass++) {
    ops.push((ctx) => {
      for (let j = 0; j < 4; j++) {
        const yy = hy - rand(4, hy * 0.22);
        const xx = rand(-100, W);
        bristle(ctx, linePts(xx, yy, xx + rand(200, 500), yy + rand(-3, 3), 30), { width: rand(6, 16), color: lighten(warm, 0.2), alpha: 0.16, taper: 0.45 });
      }
    });
  }
  return { kind: 'sunset', onto: skyEl, ops, dur: 1700 };
}

// Dark paint on a cloud: it gets heavy.
export function storm(S, t, p) {
  const m = t.meta;
  const heavy = darken(mix(S.scheme.cloud.shadow, p.tint, 0.3), 0.35);
  const ops = [];
  ops.push((ctx) =>
    atop(ctx, () => {
      const g = ctx.createLinearGradient(0, m.baseY, 0, m.baseY - m.h * 1.4);
      g.addColorStop(0, rgba(heavy, 0.62));
      g.addColorStop(1, rgba(heavy, 0.12));
      ctx.fillStyle = g;
      ctx.fillRect(t.bbox.x, t.bbox.y, t.bbox.w, t.bbox.h);
    }),
  );
  for (const pf of m.puffs) {
    ops.push((ctx) => atop(ctx, () => soft(ctx, pf.x, pf.y + pf.r * 0.4, pf.r * 0.8, heavy, 0.3)));
  }
  return { kind: 'storm', onto: t, ops, dur: 1100 };
}

export function rain(S, t) {
  const m = t.meta;
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const pf of m.puffs) {
    x0 = Math.min(x0, pf.x - pf.r * 0.6);
    x1 = Math.max(x1, pf.x + pf.r * 0.6);
  }
  const top = m.baseY - m.h * 0.15;
  const bottom = S.hy - 2;
  if (bottom - top < 20) return null;
  const slant = rand(-0.28, 0.28);
  const col = mix(darken(S.scheme.cloud.shadow, 0.25), S.haze, 0.2);
  const ops = [];
  // A soft veil first: wide, ragged strokes, so the rain has no hard edge.
  for (let k = 0; k < 3; k++) {
    ops.push((ctx) => {
      for (let j = 0; j < 7; j++) {
        const x = rand(x0, x1);
        const y = top + rand(0, 20);
        const len = (bottom - y) * rand(0.6, 1);
        bristle(ctx, linePts(x, y, x + slant * len, y + len, 20), { width: rand(18, 40), color: col, alpha: 0.07, count: 7, taper: 0.4 });
      }
    });
  }
  for (let k = 0; k < 14; k++) {
    ops.push((ctx) => {
      ctx.lineCap = 'round';
      for (let j = 0; j < 22; j++) {
        const y = rand(top, bottom - 20);
        const x = rand(x0, x1) + slant * (y - top);
        const len = rand(15, 60);
        ctx.strokeStyle = rgba(col, rand(0.12, 0.32) * (1 - (y - top) / (bottom - top)) + 0.06);
        ctx.lineWidth = rand(0.8, 1.4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + slant * len, y + len);
        ctx.stroke();
      }
    });
  }
  const spread = Math.abs(slant) * (bottom - top);
  return { kind: 'rain', depth: t.depth + 0.1, reflect: true, bbox: { x: x0 - spread - 10, y: top - 4, w: x1 - x0 + spread * 2 + 20, h: bottom - top + 8 }, ops, dur: 1500 };
}

// Warm paint on a cloud: its edges catch the light.
export function sunlitCloud(S, t, p) {
  const m = t.meta;
  const warm = lighten(mix(p.tint, S.scheme.glow, 0.5), 0.3);
  const la = -Math.PI / 2 + S.lightDir * (Math.PI / 4);
  const ops = m.puffs.map((pf) => (ctx) =>
    atop(ctx, () => {
      for (let i = 0; i < 18; i++) {
        const a = la + gauss() * 0.7;
        const d = pf.r * rand(0.55, 0.95);
        const px = pf.x + Math.cos(a) * d;
        const py = pf.y + Math.sin(a) * d * 0.85;
        const dir = rand(Math.PI * 2);
        const len = pf.r * rand(0.1, 0.25);
        bristle(ctx, linePts(px, py, px + Math.cos(dir) * len, py + Math.sin(dir) * len, 5), { width: pf.r * 0.16, color: warm, alpha: 0.35, count: 5, taper: 0.35 });
      }
    }),
  );
  return { kind: 'sunlitCloud', onto: t, ops, dur: 1100 };
}

// ——— the cabin ———

export function cabinLights(S, t, p) {
  const m = t.meta;
  const warm = mix(S.scheme.window, p.tint, 0.2);
  m.glow = true;
  let wx = 0;
  let wy = 0;
  for (const [x, y] of m.win) {
    wx += x / m.win.length;
    wy += y / m.win.length;
  }
  const ops = [];
  ops.push((ctx) => soft(ctx, wx, wy, m.size * 0.28, warm, 0.4));
  ops.push((ctx) => {
    ctx.fillStyle = rgba(warm);
    ctx.fill(pathOf(m.win));
    ctx.strokeStyle = rgba(m.lit, 0.8);
    ctx.lineWidth = clamp(m.size / 60, 0.8, 2.6);
    ctx.stroke(pathOf(m.win));
  });
  for (let i = 0; i < 7; i++) {
    ops.push((ctx) =>
      soft(ctx, m.chim[0] + rand(-2, 2) - S.lightDir * i * m.size * 0.025, m.chim[1] - m.size * 0.16 - i * m.size * 0.07, m.size * (0.04 + i * 0.013), mix(S.haze, [200, 200, 200], 0.3), 0.14),
    );
  }
  return { kind: 'lights', onto: t, ops, dur: 1200 };
}

export function roofSnow(S, t, p) {
  const m = t.meta;
  const snow = mix(WHITE, p.tint, 0.04);
  const r = m.roof;
  const lw = clamp(m.size / 60, 0.8, 2.6);
  const ops = [];
  for (let k = 0; k < 3; k++) {
    ops.push((ctx) => {
      ctx.save();
      ctx.clip(pathOf(r));
      for (let i = 0; i <= 8; i++) {
        const u = (k * 9 + i) / 26;
        const x0 = r[0][0] + (r[1][0] - r[0][0]) * u;
        const y0 = r[0][1] + (r[1][1] - r[0][1]) * u;
        const x1 = r[3][0] + (r[2][0] - r[3][0]) * u;
        const y1 = r[3][1] + (r[2][1] - r[3][1]) * u;
        knife(ctx, x0, y0, x1, y1, lw * 4, jitter(snow, 0.02), 0.92, 0.25);
      }
      ctx.restore();
    });
  }
  ops.push((ctx) => knife(ctx, r[3][0], r[3][1], r[2][0], r[2][1], lw * 2.5, snow, 0.95, 0.3));
  return { kind: 'roofSnow', onto: t, ops, dur: 1100 };
}

// ——— rocks ———

function rockCap(S, t, color, alpha, dabbed) {
  const m = t.meta;
  const ops = [];
  ops.push((ctx) =>
    atop(ctx, () => {
      for (const [x, y] of m.top) {
        if (chance(0.25)) continue;
        const len = m.hh * rand(0.15, 0.45);
        if (dabbed) {
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = rgba(jitter(color, 0.05), alpha * rand(0.6, 1));
            ctx.beginPath();
            ctx.ellipse(x + rand(-3, 3), y + rand(0, len), rand(1.2, 3), rand(0.8, 1.8), rand(Math.PI), 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          knife(ctx, x, y, x + S.lightDir * len * 0.3, y + len, rand(2, 5) * clamp(m.w / 60, 0.6, 2), color, alpha, 0.35);
        }
      }
    }),
  );
  return ops;
}

export function moss(S, t) {
  const c = mix(S.scheme.tree.mid, S.scheme.tree.light, 0.35);
  return { kind: 'moss', onto: t, ops: rockCap(S, t, c, 0.85, true), dur: 800 };
}

export function rockSnow(S, t, p) {
  return { kind: 'rockSnow', onto: t, ops: rockCap(S, t, mix(WHITE, p.tint, 0.04), 0.95, false), dur: 800 };
}
