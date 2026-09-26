// Things that sit on or in the lake: rocks, ripples and the sparkle path under the sun.
import { rand, randi, chance, clamp } from '../util.js';
import { rgba, mix, darken, lighten, jitter } from '../color.js';
import { knife, tap, pathOf, bristle, linePts } from '../brush.js';
import { topEdge, heights, at } from '../shape.js';

export function rock(S, p) {
  const { scheme, hy, H } = S;
  const L = S.lightDir;
  const dT = clamp((p.y - hy) / (H - hy), 0, 1);
  const { x, y } = p;
  const top = [];
  const n = 22;
  let w;
  let hh;
  if (p.shape) {
    // The rock is the top of the splat, sitting in the water.
    const { box } = p.shape;
    w = clamp(box.w * rand(0.9, 1.2) * (0.45 + dT * 1.3), 10, 170);
    hh = w * clamp(box.h / box.w, 0.35, 0.75) * 0.7;
    const hs = heights(topEdge(p.shape.pts, n + 1), p.shape.cy + box.h * 0.15);
    for (let i = 0; i <= n; i++) top.push([x - w / 2 + (i / n) * w, y - Math.pow(at(hs, i / n), 0.8) * hh]);
  } else {
    w = clamp(p.R * rand(1.5, 2.4) * (0.35 + dT), 10, 170);
    hh = w * rand(0.3, 0.55);
    for (let i = 0; i <= n; i++) {
      const ang = Math.PI * (1 - i / n);
      top.push([x + (Math.cos(ang) * w) / 2, y - Math.sin(ang) * hh * (1 + rand(-0.14, 0.14))]);
    }
  }
  top[0][1] = y;
  top[n][1] = y;
  const path = pathOf(top);
  const dark = mix(scheme.ground.dark, scheme.mtn.shadow, 0.4);
  const lightC = mix(scheme.mtn.light, dark, 0.35);

  const ops = [];
  ops.push((ctx) => {
    // reflection first so the rock sits on top of it
    ctx.save();
    ctx.translate(0, 2 * y + 2);
    ctx.scale(1, -0.9);
    ctx.fillStyle = rgba(darken(dark, 0.1), 0.45);
    ctx.fill(path);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (let yy = y + 3; yy < y + hh * 1.1; yy += rand(2, 5)) {
      ctx.fillStyle = `rgba(0,0,0,${rand(0.3, 0.8)})`;
      ctx.fillRect(x - w, yy, w * 2, rand(0.6, 1.6));
    }
    ctx.restore();
  });
  ops.push((ctx) => {
    ctx.fillStyle = rgba(dark);
    ctx.fill(path);
  });
  ops.push((ctx) => {
    ctx.save();
    ctx.clip(path);
    for (let i = 1; i < top.length - 1; i++) {
      const [px, py] = top[i];
      const onLit = (px - x) * L > -w * 0.15;
      if (!onLit || chance(0.3)) continue;
      const len = hh * rand(0.2, 0.6);
      knife(ctx, px, py + 0.5, px + L * len * 0.5 - (px - x) * 0.15, py + len, rand(2, 5) * clamp(w / 60, 0.6, 2), jitter(lightC, 0.03), 0.8, 0.45);
    }
    ctx.restore();
  });
  ops.push((ctx) => {
    const segs = randi(2, 4);
    for (let i = 0; i < segs; i++) {
      const sx = x - w * 0.65 + rand(0, w * 1.1);
      tap(ctx, sx, y + 0.5, rand(w * 0.15, w * 0.45), 0, scheme.waterLine, 0.75, rand(1, 1.8));
    }
  });
  return { kind: 'rock', depth: y, reflect: false, bbox: { x: x - w * 0.75, y: y - hh * 1.3, w: w * 1.5, h: hh * 2.6 }, ops, dur: 1000, meta: { top, x, y, w, hh, path } };
}

export function ripples(S, p) {
  const { scheme, hy, H } = S;
  const dT = clamp((p.y - hy) / (H - hy), 0, 1);
  const spread = clamp(p.R * (p.wide ? 5 : 3), 20, 200) * (0.4 + dT);
  // A ring of ripples where the splat landed, and a little one wherever a droplet hit the water.
  const spots = [{ x: p.x, y: p.y, n: p.wide ? randi(9, 14) : randi(3, 5), s: 1 }];
  for (const d of (p.shape?.drops || []).slice(0, 10)) if (d.y > hy + 3) spots.push({ x: d.x, y: d.y, n: 1, s: clamp(d.r / 3, 0.3, 0.8) });
  const ops = [];
  for (const sp of spots) {
    ops.push((ctx) => {
      for (let i = 0; i < sp.n; i++) {
        const y = sp.y + (sp.n > 1 ? rand(-spread * 0.2, spread * 0.2) : 0);
        const len = rand(6, 30) * (0.4 + dT * 1.2) * sp.s;
        const x = sp.x + (sp.n > 1 ? rand(-spread * 0.6, spread * 0.6) : 0);
        bristle(ctx, linePts(x - len / 2, y, x + len / 2, y, 8), { width: 1.6, count: 2, color: p.color ?? scheme.waterLine, alpha: 0.6, taper: 0.3 });
        bristle(ctx, linePts(x - len / 2, y + 2, x + len / 2, y + 2, 8), { width: 1.4, count: 2, color: darken(scheme.water, 0.3), alpha: 0.25, taper: 0.3 });
      }
    });
  }
  const xs = spots.map((q) => q.x);
  const ys = spots.map((q) => q.y);
  const bx = Math.min(...xs) - spread - 40;
  const by = Math.min(...ys) - spread * 0.3 - 6;
  return { kind: 'ripples', depth: p.y, reflect: false, bbox: { x: bx, y: by, w: Math.max(...xs) + spread + 40 - bx, h: Math.max(...ys) + spread * 0.3 + 10 - by }, ops, dur: 700 };
}

// Sparkles on the water under the sun (or moon).
export function sunpath(S, m) {
  const { hy, H, scheme } = S;
  const x = m.x;
  const rows = [];
  for (let y = hy + 2; y < H; y += rand(2, 6)) rows.push(y);
  const ops = [];
  for (let i = 0; i < rows.length; i += 12) {
    const chunk = rows.slice(i, i + 12);
    ops.push((ctx) => {
      for (const y of chunk) {
        const d = (y - hy) / (H - hy);
        const spread = m.r * 0.6 + (y - hy) * 0.3;
        const count = chance(0.5) ? 1 : 2;
        for (let k = 0; k < count; k++) {
          const cx = x + rand(-spread, spread) * rand(0.2, 1);
          const len = rand(3, 14) * (0.5 + d);
          ctx.fillStyle = rgba(m.color ?? scheme.sun, rand(0.25, 0.75) * (1 - d * 0.7));
          ctx.fillRect(cx - len / 2, y, len, rand(0.8, 1.8));
        }
      }
    });
  }
  const w = m.r * 0.6 + (H - hy) * 0.3;
  return { kind: 'sunpath', depth: 0.05, reflect: false, bbox: { x: x - w - 20, y: hy, w: w * 2 + 40, h: H - hy }, ops, dur: 900 };
}


// Draws a shape, then its reflection below the waterline, broken up by little ripples.
function withReflection(ctx, y, depth, draw) {
  draw(ctx);
  ctx.save();
  ctx.translate(0, 2 * y + 1);
  ctx.scale(1, -0.85);
  ctx.globalAlpha = 0.35;
  draw(ctx);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let yy = y + 2; yy < y + depth; yy += rand(2, 4)) {
    ctx.fillStyle = `rgba(0,0,0,${rand(0.35, 0.8)})`;
    ctx.fillRect(-1e4, yy, 2e4, rand(0.6, 1.4));
  }
  ctx.restore();
}

// White paint on open water: a little sailboat.
export function sailboat(S, p) {
  const { scheme, hy, H } = S;
  const dT = clamp((p.y - hy) / (H - hy), 0, 1);
  const s = clamp((p.y - hy) * 0.28 + p.R * 0.6, 14, 130);
  const L = S.lightDir;
  const { x, y } = p;
  const dir = chance(0.5) ? 1 : -1;
  const sail = mix(mix([250, 249, 244], scheme.mtn.light, scheme.night ? 0.5 : 0), p.tint, 0.08);
  const sailShade = mix(sail, scheme.water, 0.35);
  const hull = mix([52, 38, 30], scheme.ground.dark, 0.3);
  const mastX = x + dir * s * 0.05;
  const top = y - s * 1.15;
  const draw = (ctx) => {
    // hull
    ctx.fillStyle = rgba(hull);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.45, y - s * 0.12);
    ctx.lineTo(x + s * 0.45, y - s * 0.12);
    ctx.lineTo(x + s * 0.34 * dir, y);
    ctx.lineTo(x - s * 0.36 * dir, y);
    ctx.closePath();
    ctx.fill();
    // mainsail and jib
    const main = [[mastX, top], [mastX, y - s * 0.16], [mastX - dir * s * 0.42, y - s * 0.16]];
    const jib = [[mastX + dir * s * 0.03, top + s * 0.12], [mastX + dir * s * 0.03, y - s * 0.18], [mastX + dir * s * 0.34, y - s * 0.18]];
    for (const [pts, lit] of [[main, dir !== L], [jib, dir === L]]) {
      ctx.fillStyle = rgba(lit ? sail : sailShade);
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = rgba(darken(hull, 0.2));
    ctx.lineWidth = Math.max(0.8, s * 0.018);
    ctx.beginPath();
    ctx.moveTo(mastX, top - s * 0.04);
    ctx.lineTo(mastX, y - s * 0.12);
    ctx.stroke();
  };
  const ops = [
    (ctx) => withReflection(ctx, y, s * 1.1, draw),
    (ctx) => {
      for (let i = 0; i < 3; i++) tap(ctx, x - s * 0.7 + rand(0, s * 1.2), y + 1, rand(s * 0.2, s * 0.5), 0, scheme.waterLine, 0.7, rand(1, 1.6));
      // a short wake behind it
      for (let i = 0; i < 4; i++) tap(ctx, x - dir * s * (0.5 + i * 0.25), y + rand(-1, 2), s * rand(0.15, 0.3), dir > 0 ? Math.PI : 0, scheme.waterLine, 0.45 - i * 0.08, 1);
    },
  ];
  const box = { x: x - s * 1.6, y: top - 6, w: s * 3.2, h: s * 2.4 + 10 };
  return { kind: 'sailboat', depth: y, reflect: false, bbox: box, ops, dur: 900 + dT * 400, meta: { x, y, size: s } };
}

// Red paint on open water: a canoe.
export function canoe(S, p) {
  const { scheme, hy } = S;
  const s = clamp((p.y - hy) * 0.32 + p.R * 0.6, 12, 150);
  const { x, y } = p;
  const body = mix(p.tint, [200, 40, 30], 0.3);
  const lit = lighten(body, 0.3);
  const inside = darken(body, 0.55);
  const tilt = rand(-0.06, 0.06);
  const draw = (ctx) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    // the hull: a long, shallow crescent
    ctx.fillStyle = rgba(body);
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.09);
    ctx.quadraticCurveTo(0, s * 0.07, s * 0.5, -s * 0.09);
    ctx.quadraticCurveTo(s * 0.46, 0, s * 0.3, 0);
    ctx.lineTo(-s * 0.3, 0);
    ctx.quadraticCurveTo(-s * 0.46, 0, -s * 0.5, -s * 0.09);
    ctx.fill();
    // the inside, seen over the near gunwale
    ctx.fillStyle = rgba(inside);
    ctx.beginPath();
    ctx.moveTo(-s * 0.44, -s * 0.075);
    ctx.quadraticCurveTo(0, -s * 0.02, s * 0.44, -s * 0.075);
    ctx.quadraticCurveTo(0, -s * 0.05, -s * 0.44, -s * 0.075);
    ctx.fill();
    ctx.strokeStyle = rgba(lit, 0.85);
    ctx.lineWidth = Math.max(0.8, s * 0.015);
    ctx.beginPath();
    ctx.moveTo(-s * 0.46, -s * 0.07);
    ctx.quadraticCurveTo(0, s * 0.03, s * 0.46, -s * 0.07);
    ctx.stroke();
    ctx.restore();
  };
  const ops = [
    (ctx) => withReflection(ctx, y, s * 0.3, draw),
    (ctx) => {
      for (let i = 0; i < 4; i++) tap(ctx, x - s * 0.8 + rand(0, s * 1.4), y + rand(1, 3), rand(s * 0.15, s * 0.4), 0, scheme.waterLine, 0.6, rand(1, 1.5));
    },
  ];
  return { kind: 'canoe', depth: y, reflect: false, bbox: { x: x - s * 0.9, y: y - s * 0.3, w: s * 1.8, h: s * 0.7 }, ops, dur: 800, meta: { x, y, size: s } };
}

// Yellow paint on the water: light glinting off it.
export function glints(S, p) {
  const { hy, H } = S;
  const dT = clamp((p.y - hy) / (H - hy), 0, 1);
  const w = clamp(p.R * 5, 40, 260) * (0.5 + dT);
  const h = w * 0.25;
  const col = lighten(p.tint, 0.45);
  const ops = [];
  ops.push((ctx) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1, 0.25);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.55);
    g.addColorStop(0, rgba(col, 0.28));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  const drops = (p.shape?.drops || []).filter((d) => d.y > hy + 3);
  for (let k = 0; k < 6; k++) {
    ops.push((ctx) => {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        const gx = p.x + Math.cos(a) * r * w * 0.5;
        const gy = p.y + Math.sin(a) * r * h * 0.5;
        const len = rand(3, 14) * (0.5 + dT) * (1 - r * 0.5);
        ctx.fillStyle = rgba(col, rand(0.45, 0.95) * (1 - r * 0.5));
        ctx.fillRect(gx - len / 2, gy, len, rand(0.8, 1.8));
      }
      for (const d of drops.slice(k * 2, k * 2 + 2)) {
        ctx.fillStyle = rgba(col, 0.9);
        ctx.fillRect(d.x - 4, d.y, 8, 1.4);
      }
    });
  }
  return { kind: 'glints', depth: p.y, reflect: false, bbox: { x: p.x - w * 0.6 - 60, y: p.y - h * 0.6 - 60, w: w * 1.2 + 120, h: h * 1.2 + 120 }, ops, dur: 900 };
}
