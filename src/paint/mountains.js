// Palette-knife mountains and the quiet row of distant trees along the horizon.
import { rand, randi, chance, clamp } from '../util.js';
import { rgba, mix, jitter, darken } from '../color.js';
import { bristle, linePts, knife, pathOf, mistAtop } from '../brush.js';

// Midpoint displacement between two points, vertical jitter only.
function ridgeLine(a, b, amp, levels) {
  let pts = [a, b];
  let A = amp;
  for (let l = 0; l < levels; l++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const mx = (p0[0] + p1[0]) / 2 + rand(-0.12, 0.12) * Math.abs(p1[0] - p0[0]);
      const my = (p0[1] + p1[1]) / 2 + rand(-1, 1) * A;
      next.push([mx, my], p1);
    }
    pts = next;
    A *= 0.52;
  }
  return pts;
}

export function mountain(S, p) {
  const { W, hy, scheme } = S;
  const idx = clamp(p.index ?? 0, 0, 2);
  const layer = [scheme.mtn.far, scheme.mtn.mid, scheme.mtn.near][idx];
  const base = hy + 10;
  const peakY = clamp(p.y, hy * 0.1, hy - 40);
  const hgt = base - peakY;
  const halfL = clamp(hgt * rand(1.3, 2.3) + p.R, 120, W * 0.6);
  const halfR = clamp(hgt * rand(1.3, 2.3) + p.R, 120, W * 0.6);
  const px = p.x;
  const left = ridgeLine([px - halfL, base], [px, peakY], hgt * 0.24, 6);
  const right = ridgeLine([px, peakY], [px + halfR, base], hgt * 0.24, 6);
  const peakIndex = left.length - 1;
  const ridge = left.concat(right.slice(1)).map(([x, y], i, arr) =>
    i === 0 || i === arr.length - 1 || i === peakIndex ? [x, y] : [x, clamp(y, peakY + 3, base)],
  );
  const outline = ridge.concat([[px + halfR, base + 14], [px - halfL, base + 14]]);
  const path = pathOf(outline);

  const hazeAmt = [0.3, 0.14, 0.04][idx];
  const c0 = mix(mix(layer, p.tint, 0.1), S.haze, hazeAmt);
  const hi = scheme.snow ? scheme.mtn.snow : scheme.mtn.light;
  const shadowC = mix(scheme.mtn.shadow, c0, 0.45);
  const L = S.lightDir;
  const box = { x: px - halfL - 10, y: peakY - 10, w: halfL + halfR + 20, h: base + 24 - peakY };

  const ridgeYAt = (x) => {
    for (let i = 1; i < ridge.length; i++) {
      if (ridge[i][0] >= x) {
        const [x0, y0] = ridge[i - 1];
        const [x1, y1] = ridge[i];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
      }
    }
    return base;
  };

  const ops = [];
  ops.push((ctx) => {
    ctx.fillStyle = rgba(c0);
    ctx.fill(path);
  });

  // Rough underpainting so the base color isn't flat.
  for (let pass = 0; pass < 4; pass++) {
    ops.push((ctx) => {
      ctx.save();
      ctx.clip(path);
      for (let j = 0; j < 14; j++) {
        const x = rand(px - halfL, px + halfR);
        const y = rand(ridgeYAt(x), base);
        const len = rand(20, 70);
        const dir = chance(0.5) ? 1 : -1;
        knife(ctx, x, y, x + dir * len * 0.5, y + len, rand(3, 10), chance(0.5) ? darken(c0, 0.12) : mix(c0, shadowC, 0.5), 0.25, 0.5);
      }
      ctx.restore();
    });
  }

  // Knife highlights pulled down the faces that look toward the light, shadows on the rest.
  const strokes = [];
  for (let i = 0; i < ridge.length - 2; i++) {
    const a = ridge[i];
    const b = ridge[i + 2];
    const rising = b[1] < a[1];
    const lit = L < 0 ? rising : !rising;
    const rel = (a[1] - peakY) / hgt;
    if (rel > 0.8) continue;
    strokes.push({ x: a[0], y: a[1], lit, rel });
  }
  const snowLine = rand(0.35, 0.55);
  for (let s = 0; s < strokes.length; s += 8) {
    const chunk = strokes.slice(s, s + 8);
    ops.push((ctx) => {
      ctx.save();
      ctx.clip(path);
      for (const st of chunk) {
        const span = base - st.y;
        if (st.lit) {
          const len = span * rand(0.12, 0.5) * (1 - st.rel * 0.6);
          const dx = L * rand(0.25, 0.75);
          const snowy = scheme.snow && st.rel < snowLine;
          const col = snowy ? jitter(hi, 0.02) : mix(scheme.mtn.light, c0, 0.25 + st.rel * 0.5);
          knife(ctx, st.x, st.y + 0.5, st.x + dx * len, st.y + len, rand(3, 9), col, snowy ? 0.92 : 0.7, 0.45);
        } else if (chance(0.6)) {
          const len = span * rand(0.1, 0.35);
          knife(ctx, st.x, st.y + 1, st.x - L * rand(0.2, 0.6) * len, st.y + len, rand(3, 8), shadowC, 0.45, 0.5);
        }
      }
      ctx.restore();
    });
  }

  // Spurs: smaller ridges running down from the peaks, each with its own lit face.
  const peaks = [];
  for (let i = 4; i < ridge.length - 4; i++) {
    const y = ridge[i][1];
    if (y < ridge[i - 4][1] && y < ridge[i + 4][1] && (y - peakY) / hgt < 0.6) peaks.push(ridge[i]);
  }
  peaks.push([px, peakY]);
  const spurCount = Math.min(peaks.length, randi(2, 5));
  for (let s = 0; s < spurCount; s++) {
    const [sx0, sy0] = peaks.splice(randi(0, peaks.length - 1), 1)[0];
    const drift = rand(-0.9, 0.9);
    const len = (base - sy0) * rand(0.35, 0.7);
    const pts = [];
    let x = sx0;
    for (let y = sy0; y < sy0 + len; y += 4) {
      x += drift * 4 * rand(0.5, 1.5) + rand(-1.5, 1.5);
      pts.push([x, y]);
    }
    for (let i = 0; i < pts.length; i += 6) {
      const chunk = pts.slice(i, i + 6);
      ops.push((ctx) => {
        ctx.save();
        ctx.clip(path);
        for (const [sx, sy] of chunk) {
          const rel = (sy - peakY) / hgt;
          const snowy = scheme.snow && rel < snowLine;
          const col = snowy ? jitter(hi, 0.03) : mix(scheme.mtn.light, c0, 0.35 + rel * 0.5);
          const l = rand(8, 30) * (1 - rel * 0.5);
          knife(ctx, sx, sy, sx + L * l * rand(0.6, 1.1), sy + l * rand(0.5, 0.9), rand(3, 7), col, snowy ? 0.85 : 0.6, 0.5);
          if (chance(0.5)) knife(ctx, sx + 1, sy, sx - L * l * 0.6, sy + l * 0.7, rand(2, 5), shadowC, 0.35, 0.55);
        }
        ctx.restore();
      });
    }
  }

  // Tap the base into mist so it floats.
  ops.push((ctx) => mistAtop(ctx, box, base - hgt * 0.62, base, S.haze, 0, 0.95));
  ops.push((ctx) => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 10; i++) {
      const xx = rand(px - halfL, px + halfR - 80);
      const yy = base - rand(0, hgt * 0.3);
      bristle(ctx, linePts(xx, yy, xx + rand(80, 220), yy + rand(-3, 3), 24), { width: rand(6, 14), color: S.haze, alpha: 0.25, taper: 0.45 });
    }
    ctx.restore();
  });

  return {
    kind: 'mountain',
    depth: -500 + idx * 10 + (S.seq % 10) * 0.1,
    reflect: true,
    bbox: box,
    ops,
    dur: 2300,
    meta: { path, peak: [px, peakY] },
  };
}

// A strip of far-off evergreens sitting on the far shore (or up a mountainside).
export function treeline(S, p) {
  const { scheme } = S;
  const scale = p.scale ?? 1;
  const baseY = p.baseY ?? S.hy + rand(3, 7);
  const w = clamp(p.R * rand(6, 10) * scale, 120, 640);
  const x0 = p.x - w / 2;
  const x1 = p.x + w / 2;
  const hz = p.haze ?? 0.4;
  const c = mix(mix(scheme.tree.dark, p.tint, 0.06), S.haze, hz);
  const cl = mix(scheme.tree.light, S.haze, Math.min(0.9, hz + 0.1));
  const ground = mix(scheme.ground.dark, S.haze, hz);
  const maxH = clamp(p.R * 0.9, 14, 40) * scale;

  const trees = [];
  for (let x = x0; x < x1; x += rand(2.5, 6) * Math.max(0.6, scale)) {
    const t = (x - x0) / w;
    const env = Math.pow(Math.sin(Math.PI * t), 0.6);
    trees.push({ x, h: maxH * env * rand(0.35, 1) + 2 });
  }

  const ops = [];
  if (!p.noGround) {
    ops.push((ctx) => {
      for (let i = 0; i < 3; i++) {
        bristle(ctx, linePts(x0 - 10, baseY + rand(-1, 2), x1 + 10, baseY + rand(-1, 2), 40), {
          width: rand(3, 7) * Math.max(0.6, scale),
          color: ground,
          alpha: 0.85,
          taper: 0.25,
        });
      }
    });
  }
  for (let i = 0; i < trees.length; i += 10) {
    const chunk = trees.slice(i, i + 10);
    ops.push((ctx) => {
      ctx.lineCap = 'round';
      for (const tr of chunk) {
        const top = baseY - tr.h;
        ctx.strokeStyle = rgba(jitter(c, 0.03), 0.9);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let yy = top; yy < baseY; yy += 1.6) {
          const half = ((yy - top) / tr.h) * tr.h * 0.28 * rand(0.6, 1.3);
          ctx.moveTo(tr.x - half, yy + rand(-0.6, 0.6));
          ctx.lineTo(tr.x + half, yy + rand(-0.6, 0.6));
        }
        ctx.moveTo(tr.x, top - 1);
        ctx.lineTo(tr.x, baseY);
        ctx.stroke();
      }
    });
  }
  ops.push((ctx) => {
    ctx.lineCap = 'round';
    for (const tr of trees) {
      if (!chance(0.35)) continue;
      const top = baseY - tr.h;
      ctx.strokeStyle = rgba(cl, 0.45);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let yy = top + tr.h * 0.2; yy < baseY - 2; yy += 3) {
        const half = ((yy - top) / tr.h) * tr.h * 0.25;
        ctx.moveTo(tr.x + S.lightDir * half * 0.2, yy);
        ctx.lineTo(tr.x + S.lightDir * half, yy + 0.5);
      }
      ctx.stroke();
    }
  });
  const box = { x: x0 - 14, y: baseY - maxH - 6, w: w + 28, h: maxH + 16 };
  ops.push((ctx) => mistAtop(ctx, box, baseY - maxH * 0.7, baseY + 2, S.haze, 0, 0.7));

  return {
    kind: p.kind ?? 'treeline',
    depth: p.depth ?? 0.5,
    reflect: p.reflect ?? true,
    bbox: box,
    ops,
    dur: 1400,
  };
}
