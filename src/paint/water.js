// Things that sit on or in the lake: rocks, ripples and the sparkle path under the sun.
import { rand, randi, chance, clamp } from '../util.js';
import { rgba, mix, darken, jitter } from '../color.js';
import { knife, tap, pathOf, bristle, linePts } from '../brush.js';

export function rock(S, p) {
  const { scheme, hy, H } = S;
  const L = S.lightDir;
  const dT = clamp((p.y - hy) / (H - hy), 0, 1);
  const w = clamp(p.R * rand(1.5, 2.4) * (0.35 + dT), 10, 170);
  const hh = w * rand(0.3, 0.55);
  const { x, y } = p;
  const top = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const ang = Math.PI * (1 - i / n);
    top.push([x + (Math.cos(ang) * w) / 2, y - Math.sin(ang) * hh * (1 + rand(-0.14, 0.14))]);
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
  return { kind: 'rock', depth: y, reflect: false, bbox: { x: x - w * 0.75, y: y - hh * 1.3, w: w * 1.5, h: hh * 2.6 }, ops, dur: 1000 };
}

export function ripples(S, p) {
  const { scheme, hy, H } = S;
  const dT = clamp((p.y - hy) / (H - hy), 0, 1);
  const spread = clamp(p.R * 3, 20, 120) * (0.4 + dT);
  const n = randi(4, 9);
  const ops = [];
  for (let i = 0; i < n; i++) {
    ops.push((ctx) => {
      const y = p.y + rand(-spread * 0.3, spread * 0.3);
      const len = rand(6, 30) * (0.4 + dT * 1.2);
      const x = p.x + rand(-spread, spread);
      bristle(ctx, linePts(x - len / 2, y, x + len / 2, y, 8), { width: 1.6, count: 2, color: scheme.waterLine, alpha: 0.6, taper: 0.3 });
      bristle(ctx, linePts(x - len / 2, y + 2, x + len / 2, y + 2, 8), { width: 1.4, count: 2, color: darken(scheme.water, 0.3), alpha: 0.25, taper: 0.3 });
    });
  }
  return { kind: 'ripples', depth: p.y, reflect: false, bbox: { x: p.x - spread - 40, y: p.y - spread * 0.4 - 4, w: spread * 2 + 80, h: spread * 0.8 + 8 }, ops, dur: 700 };
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
          ctx.fillStyle = rgba(scheme.sun, rand(0.25, 0.75) * (1 - d * 0.7));
          ctx.fillRect(cx - len / 2, y, len, rand(0.8, 1.8));
        }
      }
    });
  }
  const w = m.r * 0.6 + (H - hy) * 0.3;
  return { kind: 'sunpath', depth: 0.05, reflect: false, bbox: { x: x - w - 20, y: hy, w: w * 2 + 40, h: H - hy }, ops, dur: 900 };
}

