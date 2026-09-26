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

function blobPath(sp) {
  const path = new Path2D();
  const N = 72;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * TAU;
    let r = 1;
    for (const [k, a, p] of sp.harm) r += a * Math.sin(k * th + p);
    for (const s of sp.spikes) {
      let d = Math.abs(th - s.th);
      if (d > Math.PI) d = TAU - d;
      if (d < s.w) r += s.len * Math.pow(1 - d / s.w, 2);
    }
    const lx = Math.cos(th) * r * sp.R * sp.stretch;
    const ly = Math.sin(th) * r * sp.R;
    const c = Math.cos(sp.ang);
    const s = Math.sin(sp.ang);
    pts.push([lx * c - ly * s, lx * s + ly * c]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m0 = mid(pts[N - 1], pts[0]);
  path.moveTo(m0[0], m0[1]);
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % N]);
    path.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  path.closePath();
  return path;
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
  const drops = sp.drops.map((d) => {
    const a = sp.ang + d.th;
    return { x: Math.cos(a) * d.dist * sp.R, y: Math.sin(a) * d.dist * sp.R, r: d.r * sp.R + 0.8, el: d.el, a };
  });
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
