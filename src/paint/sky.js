// Things that live above the horizon: the sky wash, sun and moon, clouds,
// birds, stars, the aurora and drifting mist.
import { TAU, rand, randi, chance, clamp, gauss } from '../util.js';
import { rgba, mix, jitter, darken, lighten, ramp, hex } from '../color.js';
import { bristle, linePts, soft, scrub } from '../brush.js';
import { place, placeDrops, clumps } from '../shape.js';

export function sky(S) {
  const { W, hy, scheme } = S;
  const bottom = Math.ceil(hy + 8);
  const stops = scheme.sky;
  const ops = [];
  const gradient = (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, hy);
    for (const [t, c] of stops) g.addColorStop(t, rgba(c));
    return g;
  };

  // Criss-cross the whole sky, top to bottom, the way you'd work a 2-inch brush.
  const rows = 12;
  const rowH = bottom / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = r * rowH;
    ops.push((ctx) => {
      ctx.fillStyle = gradient(ctx);
      ctx.fillRect(0, y0 - 1, W, rowH + 2);
    });
    for (let pass = 0; pass < 3; pass++) {
      ops.push((ctx) => {
        for (let j = 0; j < 8; j++) {
          const cy = rand(y0 - rowH * 0.4, y0 + rowH * 1.4);
          const cx = rand(-60, W + 60);
          const L = rand(80, 170);
          const a = (chance(0.5) ? -1 : 1) * rand(0.45, 0.85);
          const dx = (Math.cos(a) * L) / 2;
          const dy = (Math.sin(a) * L) / 2;
          const c = ramp(stops, clamp(cy / hy, 0, 1));
          bristle(ctx, linePts(cx - dx, cy - dy, cx + dx, cy + dy, 16), {
            width: rand(30, 50),
            color: c,
            alpha: 0.26,
            colorVar: 0.03,
            taper: 0.35,
          });
        }
      });
    }
  }

  ops.push((ctx) => {
    const gx = W * (S.lightDir < 0 ? 0.24 : 0.76);
    const g = ctx.createRadialGradient(gx, hy, 0, gx, hy, W * 0.75);
    g.addColorStop(0, rgba(scheme.glow, 0.45));
    g.addColorStop(0.45, rgba(scheme.glow, 0.14));
    g.addColorStop(1, rgba(scheme.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, bottom);
  });

  for (let pass = 0; pass < 3; pass++) {
    ops.push((ctx) => {
      for (let j = 0; j < 6; j++) {
        const y = hy - rand(2, hy * 0.18);
        const x = rand(-100, W);
        const c = mix(ramp(stops, y / hy), scheme.glow, 0.15);
        bristle(ctx, linePts(x, y, x + rand(200, 500), y + rand(-4, 4), 30), { width: rand(10, 24), color: c, alpha: 0.2, taper: 0.4 });
      }
    });
  }

  if (scheme.stars) {
    ops.push((ctx) => {
      const n = scheme.night ? 90 : 40;
      for (let i = 0; i < n; i++) {
        const y = rand(hy * 0.65);
        const fade = 1 - y / (hy * 0.65);
        ctx.fillStyle = rgba(scheme.sun, rand(0.15, 0.7) * fade);
        ctx.beginPath();
        ctx.arc(rand(W), y, rand(0.4, 1.2), 0, TAU);
        ctx.fill();
      }
    });
  }

  return { kind: 'sky', depth: -1000, reflect: true, bbox: { x: 0, y: 0, w: W, h: bottom }, ops, dur: 1800 };
}

export function sun(S, p) {
  const { scheme, hy } = S;
  const moon = scheme.sunType === 'moon';
  const r = clamp(p.R * rand(0.9, 1.3), 18, 54);
  const x = p.x;
  const y = Math.min(p.y, hy - r * 1.6);
  const g = r * 5.5;
  const ops = [];
  ops.push((ctx) => soft(ctx, x, y, g, scheme.sunGlow, 0.42));
  ops.push((ctx) => soft(ctx, x, y, r * 2.4, lighten(scheme.sunGlow, 0.3), 0.45));
  ops.push((ctx) => {
    ctx.fillStyle = rgba(scheme.sun, 0.96);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  });
  for (let i = 0; i < 6; i++) {
    ops.push((ctx) => {
      for (let j = 0; j < 5; j++) {
        const a = rand(TAU);
        const d = rand(r * 0.75);
        scrub(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, rand(r * 0.2, r * 0.4), lighten(scheme.sun, 0.3), 0.3);
      }
    });
  }
  ops.push((ctx) => {
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      scrub(ctx, x + Math.cos(a) * r * 0.96, y + Math.sin(a) * r * 0.96, r * 0.14, scheme.sun, 0.3);
    }
  });
  if (moon) {
    ops.push((ctx) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.clip();
      for (let i = 0; i < 7; i++) soft(ctx, x + rand(-r * 0.55, r * 0.55), y + rand(-r * 0.55, r * 0.55), rand(r * 0.12, r * 0.3), darken(scheme.sun, 0.3), 0.22);
      const sx = x - S.lightDir * r * 0.9;
      const gr = ctx.createRadialGradient(sx, y, r * 0.4, sx, y, r * 1.6);
      gr.addColorStop(0, rgba(darken(scheme.sun, 0.45), 0));
      gr.addColorStop(1, rgba(darken(scheme.sun, 0.45), 0.35));
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    });
  }
  return {
    kind: moon ? 'moon' : 'sun',
    depth: -900,
    reflect: true,
    bbox: { x: x - g, y: y - g, w: g * 2, h: g * 2 },
    ops,
    dur: 1300,
    meta: { x, y, r },
  };
}

export function cloud(S, p) {
  const { hy, scheme } = S;
  const light = mix(scheme.cloud.light, p.tint, 0.1);
  const shadow = mix(scheme.cloud.shadow, p.tint, 0.18);
  const w = clamp(p.R * rand(4.5, 7.5), 110, 560);
  const x = p.x;
  const y = clamp(p.y, 30, hy - 30);
  const ops = [];
  const depth = -800 + (1 - y / hy) * 50;

  if (p.elong > 2.3 || (!p.shape && chance(0.18))) {
    // A long flick leaves a long, thin streak of cloud.
    const h = w * rand(0.05, 0.1);
    ops.push((ctx) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.22);
      for (let i = 0; i < 6; i++) soft(ctx, rand(-w * 0.35, w * 0.35), rand(-h, h), w * rand(0.18, 0.3), light, 0.18);
      ctx.restore();
    });
    for (let pass = 0; pass < 12; pass++) {
      ops.push((ctx) => {
        for (let j = 0; j < 3; j++) {
          const len = w * rand(0.3, 0.8);
          const xx = x - w / 2 + rand(0, w - len);
          const yy = y + rand(-h, h) + (pass < 4 ? h * 0.4 : 0);
          bristle(ctx, linePts(xx, yy, xx + len, yy + rand(-3, 3), 30, rand(-0.01, 0.01)), {
            width: rand(4, 12),
            color: pass < 4 ? shadow : light,
            alpha: pass < 4 ? 0.28 : 0.45,
            taper: 0.45,
            dry: 0.25,
          });
        }
      });
    }
    const puffs = [-0.3, 0, 0.3].map((f) => ({ x: x + f * w, y, r: Math.max(h * 2, 12) }));
    return {
      kind: 'cloud',
      depth,
      reflect: true,
      bbox: { x: x - w / 2 - 30, y: y - h * 3, w: w + 60, h: h * 6 },
      ops,
      dur: 1300,
      meta: { puffs, baseY: y + h, h: h * 2, w, x, y, light, shadow },
    };
  }

  // A cumulus built from puffs.
  let h;
  let baseY;
  let puffs;
  if (p.shape) {
    // The cloud is the splat's own silhouette, blown up and flattened a little underneath.
    const f = w / p.shape.box.w;
    const fy = Math.min(f * 0.62, (w * 0.5) / p.shape.box.h);
    const poly = place(p.shape, x, y, f, fy);
    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    let right = -Infinity;
    for (const [px, py] of poly) {
      top = Math.min(top, py);
      bottom = Math.max(bottom, py);
      left = Math.min(left, px);
      right = Math.max(right, px);
    }
    baseY = y + (bottom - y) * 0.45;
    h = Math.max(24, baseY - top);
    const flat = poly.map(([px, py]) => [px, Math.min(py, baseY)]);
    puffs = clumps(flat, x, (top + baseY) / 2, h * 0.5, 4).map((pf) => ({ ...pf, y: Math.min(pf.y, baseY - pf.r * 0.4) }));
    for (let k = 0; k < 4; k++) puffs.push({ x: left + ((right - left) * (k + 0.5)) / 4, y: (top + baseY) / 2 + h * 0.1, r: h * 0.38 });
    // Droplets that flew off become little cloudlets drifting alongside.
    const bits = placeDrops(p.shape, x, y, f * 0.55, fy * 0.55)
      .filter((d) => d.y < hy - 20)
      .sort((a, b) => b.r - a.r)
      .slice(0, 4);
    for (const d of bits) {
      const r = clamp(d.r * 2.2, 10, h * 0.35);
      puffs.push({ x: d.x, y: d.y, r }, { x: d.x + r * 0.9, y: d.y + r * 0.2, r: r * 0.7 });
    }
  } else {
    h = w * rand(0.26, 0.4);
    baseY = y + h * 0.3;
    const n = randi(4, 7);
    puffs = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const pr = h * (0.3 + 0.5 * Math.sin(Math.PI * (0.15 + 0.7 * t))) * rand(0.75, 1.15);
      puffs.push({ x: x - w / 2 + w * (0.1 + 0.8 * t) + rand(-w * 0.04, w * 0.04), y: baseY - pr * rand(0.55, 0.85), r: pr });
    }
    const extra = randi(1, 3);
    for (let i = 0; i < extra; i++) {
      const q = puffs[randi(1, n - 2)];
      puffs.push({ x: q.x + rand(-q.r * 0.5, q.r * 0.5), y: q.y - q.r * rand(0.35, 0.65), r: q.r * rand(0.5, 0.8) });
    }
  }
  const la = -Math.PI / 2 + S.lightDir * (Math.PI / 4);

  // Body: soft, overlapping mass, darker toward the flat bottom.
  for (const pf of puffs) {
    ops.push((ctx) => {
      for (let i = 0; i < 16; i++) {
        const a = rand(TAU);
        const d = rand(pf.r * 0.75);
        const px = pf.x + Math.cos(a) * d;
        const py = pf.y + Math.sin(a) * d * 0.8;
        const lift = clamp((baseY - py) / (h * 1.1), 0, 1);
        soft(ctx, px, py, pf.r * rand(0.4, 0.65), mix(shadow, light, 0.15 + lift * 0.55), 0.3);
      }
    });
  }
  // Scumble light into the side facing the sun with short, loose strokes.
  for (const pf of puffs) {
    ops.push((ctx) => {
      for (let i = 0; i < 44; i++) {
        const a = la + gauss() * 0.85;
        const d = pf.r * Math.sqrt(Math.random()) * 0.8;
        const px = pf.x + Math.cos(a) * d;
        const py = pf.y + Math.sin(a) * d * 0.85;
        const dir = rand(TAU);
        const len = pf.r * rand(0.12, 0.3);
        bristle(ctx, linePts(px, py, px + Math.cos(dir) * len, py + Math.sin(dir) * len, 5, rand(-0.25, 0.25)), {
          width: pf.r * rand(0.12, 0.22),
          color: jitter(light, 0.02),
          alpha: 0.16 + (d / pf.r) * 0.16,
          count: 5,
          taper: 0.35,
        });
      }
    });
  }
  // Soft, broken edge along the tops of the puffs.
  ops.push((ctx) => {
    for (const pf of puffs) {
      for (let i = 0; i < 7; i++) {
        const a = la + rand(-1.2, 1.2);
        const sweep = rand(0.2, 0.45);
        const pts = [];
        for (let k = 0; k <= 6; k++) {
          const aa = a - sweep / 2 + (sweep * k) / 6;
          pts.push([pf.x + Math.cos(aa) * pf.r * 0.9, pf.y + Math.sin(aa) * pf.r * 0.78]);
        }
        bristle(ctx, pts, { width: pf.r * 0.14, color: light, alpha: 0.28, count: 5, taper: 0.5 });
      }
    }
  });
  ops.push((ctx) => {
    for (let i = 0; i < 4; i++) {
      const xx = x - w * 0.42 + rand(0, w * 0.3);
      bristle(ctx, linePts(xx, baseY - rand(0, h * 0.1), xx + w * rand(0.4, 0.6), baseY + rand(-3, 3), 24), {
        width: h * 0.18,
        color: shadow,
        alpha: 0.16,
        taper: 0.45,
      });
    }
  });
  ops.push((ctx) => {
    for (const pf of puffs) soft(ctx, pf.x + Math.cos(la) * pf.r * 0.3, pf.y + Math.sin(la) * pf.r * 0.3, pf.r * 0.6, light, 0.14);
  });

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const pf of puffs) {
    x0 = Math.min(x0, pf.x - pf.r * 1.3);
    x1 = Math.max(x1, pf.x + pf.r * 1.3);
    y0 = Math.min(y0, pf.y - pf.r * 1.2);
    y1 = Math.max(y1, pf.y + pf.r * 1.2);
  }
  x0 = Math.min(x0, x - w * 0.45);
  x1 = Math.max(x1, x + w * 0.45);
  y1 = Math.max(y1, baseY + h * 0.2);
  return {
    kind: 'cloud',
    depth,
    reflect: true,
    bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    ops,
    dur: 1700,
    meta: { puffs, baseY, h, w, x, y, light, shadow },
  };
}

export function birds(S, p) {
  const col = S.scheme.bird;
  const scale = clamp(p.R / 12, 0.7, 1.4) * (0.6 + 0.6 * (1 - p.y / S.hy));
  // Every droplet that flew off the brush becomes a bird, if there were enough of them.
  const drops = [];
  for (const d of p.shape?.drops || []) {
    if (d.y < S.hy - 12 && drops.every((o) => Math.hypot(o.x - d.x, o.y - d.y) > 9)) drops.push(d);
  }
  let list;
  if (drops.length >= 2) {
    list = drops.slice(0, 7).map((d) => ({ x: d.x, y: d.y, s: clamp(d.r * 2.4, 4, 12) * scale, tilt: rand(-0.25, 0.25) }));
    list.push({ x: p.x, y: p.y, s: clamp(p.R * 0.6, 6, 13) * scale, tilt: rand(-0.2, 0.2) });
  } else {
    list = Array.from({ length: randi(2, 5) }, () => ({
      x: p.x + rand(-60, 60) * scale,
      y: p.y + rand(-25, 25) * scale,
      s: rand(5, 11) * scale,
      tilt: rand(-0.25, 0.25),
    }));
  }
  const ops = list.map((b) => (ctx) => {
    ctx.strokeStyle = rgba(col, 0.9);
    ctx.lineCap = 'round';
    for (const lw of [Math.max(1, b.s * 0.22), Math.max(0.6, b.s * 0.1)]) {
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(b.x - b.s, b.y - b.s * 0.35 + b.tilt * b.s);
      ctx.quadraticCurveTo(b.x - b.s * 0.45, b.y - b.s * 0.65, b.x, b.y);
      ctx.quadraticCurveTo(b.x + b.s * 0.45, b.y - b.s * 0.65, b.x + b.s, b.y - b.s * 0.35 - b.tilt * b.s);
      ctx.stroke();
    }
  });
  const xs = list.map((b) => b.x);
  const ys = list.map((b) => b.y);
  const pad = 16 * scale;
  const bx = Math.min(...xs) - pad;
  const by = Math.min(...ys) - pad;
  return { kind: 'birds', depth: -700, reflect: true, bbox: { x: bx, y: by, w: Math.max(...xs) + pad - bx, h: Math.max(...ys) + pad - by }, ops, dur: 700 };
}

export function stars(S, p) {
  const col = S.scheme.sun;
  // The splat is the bright one; every droplet around it is another star.
  const list = [{ x: p.x, y: p.y, r: 2.3 }];
  for (const d of p.shape?.drops || []) if (d.y < S.hy - 8) list.push({ x: d.x, y: d.y, r: clamp(d.r * 0.45, 0.5, 1.7) });
  const spread = clamp(p.R * 5, 60, 200);
  for (let i = 0; i < 6; i++) list.push({ x: p.x + gauss() * spread * 0.5, y: Math.min(S.hy - 10, p.y + gauss() * spread * 0.35), r: rand(0.4, 0.9) });
  const ops = [];
  for (let i = 0; i < list.length; i += 3) {
    const chunk = list.slice(i, i + 3);
    ops.push((ctx) => {
      for (const s of chunk) {
        soft(ctx, s.x, s.y, s.r * 5, col, 0.22);
        ctx.fillStyle = rgba(col, rand(0.6, 1));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
        if (s.r > 1.5) {
          ctx.strokeStyle = rgba(col, 0.55);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 5, s.y);
          ctx.lineTo(s.x + s.r * 5, s.y);
          ctx.moveTo(s.x, s.y - s.r * 5);
          ctx.lineTo(s.x, s.y + s.r * 5);
          ctx.stroke();
        }
      }
    });
  }
  const xs = list.map((st) => st.x);
  const ys = list.map((st) => st.y);
  const bx = Math.min(...xs) - 16;
  const by = Math.min(...ys) - 16;
  return { kind: 'stars', depth: -950, reflect: true, bbox: { x: bx, y: by, w: Math.max(...xs) + 16 - bx, h: Math.max(...ys) + 16 - by }, ops, dur: 900 };
}

export function aurora(S, p) {
  const w = clamp(p.R * 12, 400, S.W * 1.1);
  const x0 = p.x - w / 2;
  const amp = rand(18, 50);
  const f = rand(0.004, 0.009);
  const ph = rand(TAU);
  const green = hex('#5ff0a8');
  const teal = hex('#43c6c9');
  const violet = hex('#9a6bd8');
  const ops = [];
  const step = 3;
  const cols = Math.ceil(w / step);
  for (let c = 0; c < cols; c += 16) {
    ops.push((ctx) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = c; k < Math.min(cols, c + 16); k++) {
        const x = x0 + k * step;
        const t = k / cols;
        const env = Math.pow(Math.sin(Math.PI * t), 0.7);
        const yc = p.y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3) * amp * 0.3;
        const len = rand(40, 130) * env;
        const g = ctx.createLinearGradient(0, yc - len, 0, yc + 8);
        g.addColorStop(0, rgba(violet, 0));
        g.addColorStop(0.45, rgba(teal, 0.12 * env));
        g.addColorStop(0.9, rgba(green, 0.26 * env));
        g.addColorStop(1, rgba(green, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = rand(1.5, 4);
        ctx.beginPath();
        ctx.moveTo(x, yc - len);
        ctx.lineTo(x + rand(-2, 2), yc + 8);
        ctx.stroke();
      }
      ctx.restore();
    });
  }
  return { kind: 'aurora', depth: -950, reflect: true, bbox: { x: x0 - 10, y: p.y - amp * 1.4 - 140, w: w + 20, h: amp * 2.8 + 170 }, ops, dur: 2000 };
}

// A band of haze drifting across a mountain.
export function mist(S, p) {
  const w = clamp(p.R * 10, 220, 700);
  const hz = S.haze;
  const ops = [];
  for (let i = 0; i < 6; i++) {
    ops.push((ctx) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.2);
      for (let j = 0; j < 4; j++) soft(ctx, rand(-w * 0.4, w * 0.4), rand(-40, 40), w * rand(0.12, 0.25), hz, 0.2);
      ctx.restore();
      const xx = p.x - w / 2 + rand(0, w * 0.5);
      bristle(ctx, linePts(xx, p.y + rand(-12, 12), xx + w * rand(0.3, 0.5), p.y + rand(-12, 12), 30), {
        width: rand(8, 18),
        color: hz,
        alpha: 0.22,
        taper: 0.45,
      });
    });
  }
  return { kind: 'mist', depth: p.depth, reflect: true, bbox: { x: p.x - w / 2 - 20, y: p.y - 50, w: w + 40, h: 100 }, ops, dur: 1200 };
}

