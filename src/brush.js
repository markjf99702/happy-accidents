// Brush primitives. Everything on the canvas is built from these: bristle strokes,
// taps, scrubs and knife pulls, each drawn as many thin, slightly different lines
// so the result reads as paint instead of vector shapes.
import { TAU, rand, clamp } from './util.js';
import { rgba, jitter } from './color.js';

function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i) * (1 - u) + hash1(i + 1) * u;
}

// Points along a straight (optionally bowed) line. bend is a fraction of the length.
export function linePts(x0, y0, x1, y1, n = 8, bend = 0) {
  const pts = [];
  const nx = -(y1 - y0);
  const ny = x1 - x0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const b = Math.sin(t * Math.PI) * bend;
    pts.push([x0 + (x1 - x0) * t + nx * b, y0 + (y1 - y0) * t + ny * b]);
  }
  return pts;
}

// Catmull-Rom resample through control points.
export function curvePts(pts, per = 6) {
  if (pts.length < 3) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// A loaded brush dragged along a path. Each bristle is its own line with its own
// color wobble, opacity and start/end, and `dry` breaks bristles up as paint runs out.
export function bristle(ctx, pts, o) {
  const n = pts.length;
  if (n < 2) return;
  const width = o.width ?? 10;
  const count = o.count ?? clamp(Math.round(width / 1.8), 3, 26);
  const alpha = o.alpha ?? 0.85;
  const cv = o.colorVar ?? 0.04;
  const dry = o.dry ?? 0;
  const taper = o.taper ?? 0.2;
  const freq = o.dryFreq ?? 0.08;
  const lw = o.lineWidth ?? Math.max(0.8, (width / count) * 1.35);

  const nm = new Array(n);
  const len = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    nm[i] = [-dy / l, dx / l];
    if (i) len[i] = len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const total = len[n - 1] || 1;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = 0; k < count; k++) {
    const u = (k + 0.5 + (Math.random() - 0.5) * 0.9) / count - 0.5;
    const off = u * width;
    ctx.strokeStyle = rgba(jitter(o.color, cv), alpha * (0.45 + Math.random() * 0.55));
    ctx.lineWidth = lw * (0.6 + Math.random() * 0.8);
    const s0 = Math.random() * taper * (0.5 + Math.abs(u));
    const s1 = 1 - Math.random() * taper * (0.3 + Math.abs(u));
    const seed = Math.random() * 1000;
    let on = false;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = len[i] / total;
      let vis = t >= s0 && t <= s1;
      if (vis && dry > 0) vis = noise1(seed + len[i] * freq) > dry * (0.35 + 0.65 * t);
      if (!vis) {
        on = false;
        continue;
      }
      const x = pts[i][0] + nm[i][0] * off;
      const y = pts[i][1] + nm[i][1] * off;
      if (!on) {
        ctx.moveTo(x, y);
        on = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Palette knife: a flat, broken stroke that skips over the canvas texture.
export function knife(ctx, x0, y0, x1, y1, w, color, alpha = 0.9, broken = 0.45) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  bristle(ctx, linePts(x0, y0, x1, y1, Math.max(4, Math.round(L / 3))), {
    width: w,
    color,
    alpha,
    count: Math.max(3, Math.round(w * 1.1)),
    lineWidth: 1.1,
    dry: broken,
    dryFreq: 0.12,
    taper: 0.12,
    colorVar: 0.03,
  });
}

// One short straight touch of the brush.
export function tap(ctx, x, y, len, ang, color, alpha = 0.8, lw = 1.2) {
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
  ctx.stroke();
}

// A soft round glow. Used sparingly for haze, clouds and light.
export function soft(ctx, x, y, r, color, alpha) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.6, rgba(color, alpha * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// Little circular scrubbing motion, the way you'd work in a cloud.
export function scrub(ctx, x, y, r, color, alpha) {
  const pts = [];
  const turns = rand(0.9, 1.4);
  const a0 = rand(TAU);
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (i / steps) * turns * TAU;
    const rr = r * (0.55 + 0.45 * Math.sin((i / steps) * Math.PI));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]);
  }
  bristle(ctx, pts, { width: r * 0.9, color, alpha, count: 5, taper: 0.3, colorVar: 0.02 });
}

// A cluster of tiny taps, like pushing a brush into the canvas.
export function dabs(ctx, x, y, r, color, n, alpha = 0.85, lw = 1.2, len = r * 0.4) {
  for (let i = 0; i < n; i++) {
    const a = rand(TAU);
    const d = Math.sqrt(Math.random()) * r;
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d * 0.8;
    tap(ctx, px, py, rand(len * 0.4, len), rand(TAU), jitter(color, 0.04), alpha * rand(0.5, 1), lw * rand(0.7, 1.5));
  }
}

// Upward flicks of grass (or snow, or dirt) at the foot of something.
export function grass(ctx, x, y, spread, colors, n, scale = 1, alpha = 0.8) {
  for (let i = 0; i < n; i++) {
    const px = x + rand(-spread, spread);
    const py = y + rand(-2, 4) * scale;
    const len = rand(2, 7) * scale;
    const ang = -Math.PI / 2 + rand(-0.7, 0.7);
    tap(ctx, px, py, len, ang, jitter(colors[i % colors.length], 0.04), alpha * rand(0.5, 1), rand(0.8, 1.6) * Math.min(1.6, scale));
  }
}

// Fill a polygon given as [[x, y], ...].
export function poly(ctx, pts, color, alpha = 1) {
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

export function pathOf(pts) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

export function boundsOf(pts, pad = 0) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

// Tint an area that's already painted (source-atop) with a vertical gradient: mist at the foot of things.
export function mistAtop(ctx, box, y0, y1, color, a0, a1) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(color, a0));
  g.addColorStop(1, rgba(color, a1));
  ctx.fillStyle = g;
  ctx.fillRect(box.x, Math.min(y0, y1), box.w, Math.abs(y1 - y0) + 30);
  ctx.restore();
}
