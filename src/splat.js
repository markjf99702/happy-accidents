// The accident itself: a glossy blob of wet paint with spikes and flung droplets.
import { TAU, rand, randi, clamp, gauss } from './util.js';
import { rgba, darken, lighten, lum } from './color.js';

export function makeSplat({ x, y, vx = 0, vy = 0, R = 16, pigment, trail = [], hint = null }) {
  const speed = Math.hypot(vx, vy);
  const flick = speed > 0.3;
  const ang = speed > 0.05 ? Math.atan2(vy, vx) : rand(TAU);
  const stretch = 1 + clamp(speed * 0.45, 0, 1.4) + rand(0, 0.15);
  const harm = [];
  for (let k = 2; k <= 7; k++) harm.push([k, rand(0.03, 0.14) / Math.sqrt(k - 1), rand(TAU)]);
  const spikes = Array.from({ length: randi(2, 8) }, () => ({ th: rand(TAU), len: rand(0.25, 0.9), w: rand(0.06, 0.16) }));
  const drops = [];
  const nd = randi(5, 12) + Math.round(speed * 6);
  for (let i = 0; i < nd; i++) {
    drops.push({
      th: flick ? gauss() * 0.35 : rand(TAU),
      dist: flick ? rand(1.2, 3.8) * stretch : rand(1.15, 2.4),
      r: rand(0.04, 0.17),
      el: flick ? rand(1, 2.2) : rand(1, 1.4),
    });
  }
  return { x, y, R, ang, stretch, speed, harm, spikes, drops, pigment, trail, hint, born: performance.now(), alpha: 1 };
}

// The blob's outline in local coordinates (origin at the splat's center).
export function blobPoints(sp, N = 72) {
  const pts = [];
  const c = Math.cos(sp.ang);
  const s = Math.sin(sp.ang);
  for (let i = 0; i < N; i++) {
    const th = (i / N) * TAU;
    let r = 1;
    for (const [k, a, p] of sp.harm) r += a * Math.sin(k * th + p);
    for (const sk of sp.spikes) {
      let d = Math.abs(th - sk.th);
      if (d > Math.PI) d = TAU - d;
      if (d < sk.w) r += sk.len * Math.pow(1 - d / sk.w, 2);
    }
    const lx = Math.cos(th) * r * sp.R * sp.stretch;
    const ly = Math.sin(th) * r * sp.R;
    pts.push([lx * c - ly * s, lx * s + ly * c]);
  }
  return pts;
}

// Flung droplets in local coordinates.
export function dropPoints(sp) {
  return sp.drops.map((d) => {
    const a = sp.ang + d.th;
    return { x: Math.cos(a) * d.dist * sp.R, y: Math.sin(a) * d.dist * sp.R, r: d.r * sp.R + 0.8, el: d.el, a };
  });
}

function blobPath(sp) {
  const pts = blobPoints(sp);
  const N = pts.length;
  const path = new Path2D();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[N - 1], pts[0]);
  path.moveTo(m0[0], m0[1]);
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % N]);
    path.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  path.closePath();
  return path;
}

// Everything the painters need to know about where the paint actually went, in canvas
// coordinates: the outline (a union, if other wet splats ran into this one), the
// droplets, and the center the decision is made from.
export function splatShape(sp) {
  const parts = [sp, ...(sp.merged || [])];
  const center = sp.center || { x: sp.x, y: sp.y };
  const outlines = parts.map((p) => blobPoints(p).map(([x, y]) => [x + p.x, y + p.y]));
  let pts = outlines[0];
  if (parts.length > 1) {
    // Union by casting rays from the shared center and keeping the farthest paint on each.
    const N = 96;
    const best = new Array(N).fill(0);
    for (const o of outlines) {
      for (let i = 0; i < o.length; i++) {
        const [ax, ay] = o[i];
        const [bx, by] = o[(i + 1) % o.length];
        for (let t = 0; t < 1; t += 0.25) {
          const x = ax + (bx - ax) * t;
          const y = ay + (by - ay) * t;
          const bin = ((Math.round((Math.atan2(y - center.y, x - center.x) / TAU) * N) % N) + N) % N;
          best[bin] = Math.max(best[bin], Math.hypot(x - center.x, y - center.y));
        }
      }
    }
    for (let i = 0; i < N; i++) {
      if (best[i]) continue;
      let a = 1;
      let b = 1;
      while (!best[(i - a + N) % N] && a < N) a++;
      while (!best[(i + b) % N] && b < N) b++;
      best[i] = (best[(i - a + N) % N] * b + best[(i + b) % N] * a) / (a + b);
    }
    pts = best.map((r, i) => [center.x + Math.cos((i / N) * TAU) * r, center.y + Math.sin((i / N) * TAU) * r]);
  }
  const R = sp.effR || sp.R;
  const drops = [];
  for (const p of parts) for (const d of dropPoints(p)) drops.push({ x: d.x + p.x, y: d.y + p.y, r: d.r });
  for (const p of parts) {
    for (const d of p.trail || []) if (Math.hypot(d.x - center.x, d.y - center.y) < R * 6) drops.push({ x: d.x, y: d.y, r: d.r });
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { pts, drops, cx: center.x, cy: center.y, box: { x: x0, y: y0, w: x1 - x0 || 1, h: y1 - y0 || 1 } };
}

// Renders the splat into its own small canvas, centered on its origin.
export function renderSplat(sp, k) {
  const ext = Math.ceil(sp.R * (sp.stretch * 4.2 + 1.2));
  const c = sp.canvas && sp.ext === ext ? sp.canvas : document.createElement('canvas');
  c.width = Math.ceil(ext * 2 * k);
  c.height = Math.ceil(ext * 2 * k);
  const ctx = c.getContext('2d');
  ctx.setTransform(k, 0, 0, k, ext * k, ext * k);
  ctx.clearRect(-ext, -ext, ext * 2, ext * 2);
  const col = sp.pigment.rgb;
  const body = blobPath(sp);
  const drops = dropPoints(sp);
  const dropPath = new Path2D();
  for (const d of drops) {
    dropPath.moveTo(d.x + Math.cos(d.a) * d.r * d.el, d.y + Math.sin(d.a) * d.r * d.el);
    dropPath.ellipse(d.x, d.y, d.r * d.el, d.r, d.a, 0, TAU);
  }

  ctx.save();
  ctx.translate(1.3, 2.2);
  ctx.fillStyle = 'rgba(20,12,6,0.22)';
  ctx.fill(body);
  ctx.fill(dropPath);
  ctx.restore();

  ctx.fillStyle = rgba(col);
  ctx.fill(body);
  ctx.fill(dropPath);

  ctx.save();
  ctx.clip(body);
  const g = ctx.createRadialGradient(-sp.R * 0.3, -sp.R * 0.35, 0, 0, 0, sp.R * 1.4 * sp.stretch);
  g.addColorStop(0, rgba(lighten(col, 0.28), 0.55));
  g.addColorStop(0.7, rgba(col, 0));
  g.addColorStop(1, rgba(darken(col, 0.3), 0.4));
  ctx.fillStyle = g;
  ctx.fillRect(-ext, -ext, ext * 2, ext * 2);
  ctx.restore();

  ctx.strokeStyle = rgba(lum(col) > 0.8 ? darken(col, 0.25) : darken(col, 0.35), 0.5);
  ctx.lineWidth = 1.1;
  ctx.stroke(body);

  // wet highlights
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-sp.R * 0.3, -sp.R * 0.36, sp.R * 0.28, sp.R * 0.11, -0.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-sp.R * 0.02, -sp.R * 0.5, Math.max(0.8, sp.R * 0.06), 0, TAU);
  ctx.fill();
  for (const d of drops) {
    if (d.r < 1.4) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.35, d.r * 0.3, 0, TAU);
    ctx.fill();
  }
  sp.canvas = c;
  sp.ext = ext;
  sp.renderedR = sp.R;
}
