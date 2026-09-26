// Land pulled in from the edges of the canvas, and the little cabin.
import { TAU, rand, chance, clamp, lerp, smoothstep } from '../util.js';
import { rgba, mix, jitter, darken, lighten, hex } from '../color.js';
import { bristle, linePts, knife, tap, soft, pathOf, boundsOf, poly, grass } from '../brush.js';

export function bank(S, p) {
  const { W, H, hy, scheme } = S;
  const side = p.side ?? (p.x < W / 2 ? -1 : 1);
  const edgeX = side < 0 ? -30 : W + 30;
  const dT = clamp((p.y - hy) / (H - hy), 0, 1);
  const far = dT < 0.45;
  const reach = p.R * rand(1.2, 2.2) + 30 + dT * 90;
  const tipX = clamp(p.x - side * reach, 30, W - 30);
  const rise = rand(10, 28) * (0.4 + dT * 1.4);
  const yEdge = p.y - rise;
  const yTip = p.y + rand(2, 8) * (0.5 + dT);

  // Top contour: from the canvas edge out to the tip, with a few soft hills.
  const n = 40;
  const hillF = rand(1.5, 3.5);
  const hillPh = rand(TAU);
  const hillA = rand(4, 14) * (0.4 + dT);
  const top = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = lerp(edgeX, tipX, t);
    const yb = lerp(yEdge, yTip, smoothstep(Math.pow(t, 1.4)));
    const bump = Math.sin(t * Math.PI * hillF + hillPh) * hillA - Math.abs(Math.sin(t * Math.PI * hillF * 2.1 + hillPh)) * hillA * 0.3;
    top.push([x, yb + bump * (1 - t)]);
  }

  // Shoreline: flat for a far strip, curving down toward the viewer for a near bank.
  const shore = [];
  if (far) {
    const th = rand(0, 4) + dT * 10;
    for (let i = n; i >= 0; i--) {
      const t = i / n;
      shore.push([lerp(edgeX, tipX, t), yTip + 1 + (1 - t) * th + rand(-0.8, 0.8)]);
    }
  } else {
    // The shore swings out toward the viewer, then eases back, with a few small coves.
    const out = rand(40, 180);
    const cove = rand(TAU);
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const swing = Math.sin(u * Math.PI * 0.85) * out * 0.7 + u * out * 0.3;
      const wob = Math.sin(u * 11 + cove) * 6 + Math.sin(u * 23 + cove * 2) * 3;
      shore.push([tipX - side * (swing + wob), lerp(yTip, H + 20, Math.pow(u, 0.9))]);
    }
    shore.push([edgeX, H + 20]);
  }
  const outline = top.concat(shore);
  const path = pathOf(outline);

  const hzAmt = (1 - dT) * 0.35;
  const snowy = scheme.id === 'winter-hush';
  const dark = mix(mix(snowy ? mix(scheme.ground.dark, scheme.ground.mid, 0.5) : scheme.ground.dark, p.tint, 0.08), S.haze, hzAmt);
  const mid = mix(scheme.ground.mid, S.haze, hzAmt * 0.9);
  const light = mix(scheme.ground.light, S.haze, hzAmt * 0.7);
  const scale = 0.5 + dT * 1.8;
  const L = S.lightDir;

  const ops = [];
  ops.push((ctx) => {
    ctx.fillStyle = rgba(dark);
    ctx.fill(path);
  });
  // Contour strokes across the whole body of the land so it isn't a flat shape.
  const depthSpan = far ? Math.max(10, yTip + 8 - yEdge) : H - yEdge;
  const passes = far ? 6 : 16;
  for (let k = 0; k < passes; k++) {
    ops.push((ctx) => {
      ctx.save();
      ctx.clip(path);
      for (let j = 0; j < (far ? 1 : 2); j++) {
        const off = Math.pow(Math.random(), 1.4) * depthSpan;
        const near = off / depthSpan;
        const pts = top.map(([x, y]) => [x, y + off + rand(-1.5, 1.5)]);
        const c = mix(dark, chance(0.3) ? light : mid, rand(0.15, 0.45) * (1 - near * 0.6));
        bristle(ctx, pts, { width: rand(6, 20) * scale, color: c, alpha: 0.32, dry: 0.35, taper: 0.2 });
      }
      ctx.restore();
    });
  }
  if (!far) {
    ops.push((ctx) => {
      ctx.save();
      ctx.clip(path);
      for (let i = 0; i < 90; i++) {
        const t = Math.random();
        const [tx, ty] = top[Math.floor(t * (top.length - 1))];
        const gy = ty + Math.pow(Math.random(), 1.3) * (H - ty);
        const s2 = scale * (0.7 + ((gy - ty) / (H - ty + 1)) * 0.9);
        grass(ctx, tx + rand(-12, 12), gy, 7 * s2, [mid, dark, light], 5, s2, 0.6);
      }
      ctx.restore();
    });
  }
  // Grass tapped along the top edge, then highlights where the hills face the light.
  for (let i = 0; i < top.length - 1; i += 4) {
    const chunk = top.slice(i, i + 5);
    ops.push((ctx) => {
      for (let j = 0; j < chunk.length - 1; j++) {
        const [xa, ya] = chunk[j];
        const [xb, yb] = chunk[j + 1];
        const facing = (yb - ya) * L > 0 ? 1 : 0.35;
        const count = Math.round(Math.abs(xb - xa) * 0.8 * (0.6 + dT));
        for (let k = 0; k < count; k++) {
          const t = Math.random();
          const gx = lerp(xa, xb, t);
          const gy = lerp(ya, yb, t) + rand(0, 4 + dT * 18);
          tap(ctx, gx, gy, rand(2, 7) * scale, -Math.PI / 2 + rand(-0.6, 0.6), jitter(mid, 0.05), 0.7 * rand(0.5, 1), rand(0.8, 1.5) * Math.min(1.5, scale));
          if (chance(0.45 * facing)) {
            tap(ctx, gx + rand(-2, 2), gy - rand(0, 3), rand(2, 6) * scale, -Math.PI / 2 + rand(-0.6, 0.6), jitter(light, 0.05), 0.75 * rand(0.5, 1), rand(0.7, 1.3) * Math.min(1.4, scale));
          }
        }
      }
    });
  }
  // Tufts scattered a little further into the land.
  ops.push((ctx) => {
    ctx.save();
    ctx.clip(path);
    for (let i = 0; i < 40 * (0.5 + dT); i++) {
      const pt = top[Math.floor(rand(top.length - 1))];
      grass(ctx, pt[0] + rand(-10, 10), pt[1] + rand(8, 20 + dT * 70), 6 * scale, [mid, light, mid], 5, scale * 0.8, 0.55);
    }
    ctx.restore();
  });
  if (!far) {
    ops.push((ctx) => {
      ctx.save();
      ctx.clip(path);
      const edge = shore.slice(0, -1);
      for (let i = 0; i < 3; i++) {
        bristle(ctx, edge.map(([x, y]) => [x + side * rand(4, 10) * scale, y]), { width: rand(10, 22) * scale, color: darken(dark, 0.25), alpha: 0.35, taper: 0.1, dry: 0.3 });
      }
      ctx.restore();
    });
  }
  // Water line: a thin light scrape where the land meets the water, and a dark reflection under it.
  ops.push((ctx) => {
    const wl = scheme.waterLine;
    const pts = far ? shore : shore.slice(0, -1);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      if (y > H) continue;
      if (far) {
        ctx.fillStyle = rgba(darken(dark, 0.1), 0.28);
        ctx.fillRect(x - 6, y + 1, 12, rand(2, 5 + dT * 20));
      }
      if (chance(0.7)) {
        const l = rand(4, 16) * scale;
        const dir = far ? rand(-1, 1) : -side;
        tap(ctx, x, y + (far ? 1.5 : 0), l, dir < 0 ? Math.PI : 0, wl, 0.7, rand(1, 1.8));
      }
    }
  });

  const spots = [];
  for (let i = 2; i < top.length - 3; i++) {
    const [x, y] = top[i];
    if (x < 10 || x > W - 10) continue;
    spots.push([x, y + rand(4, 10 + dT * 40)]);
  }

  const b = boundsOf(outline, 20);
  const shoreBottom = far ? Math.max(...shore.map((s) => s[1])) + 10 + dT * 20 : H;
  b.h = Math.max(b.h, shoreBottom - b.y + 10);
  return {
    kind: 'bank',
    depth: Math.min(...top.map((t) => t[1])),
    reflect: false,
    bbox: b,
    ops,
    dur: clamp(1100 + dT * 1200, 1100, 2200),
    meta: { outline, spots, side },
  };
}

export function cabin(S, p) {
  const { scheme } = S;
  const L = S.lightDir;
  const s = p.size;
  const cx = p.x;
  const by = p.baseY;
  const m = (x) => (L < 0 ? x : 2 * cx - x);
  const mp = (pts) => pts.map(([x, y]) => [m(x), y]);

  const fx0 = cx - s * 0.5;
  const fx1 = cx - s * 0.05;
  const wallH = s * 0.36;
  const apex = [(fx0 + fx1) / 2, by - wallH - s * 0.26];
  const back = s * 0.55;
  const rise = s * 0.05;
  const front = mp([[fx0, by], [fx0, by - wallH], apex, [fx1, by - wallH], [fx1, by]]);
  const sideWall = mp([[fx1, by], [fx1 + back, by - rise], [fx1 + back, by - rise - wallH * 0.94], [fx1, by - wallH]]);
  const roof = mp([
    [apex[0], apex[1]],
    [apex[0] + back, apex[1] - rise],
    [fx1 + back + s * 0.05, by - rise - wallH * 0.94 + s * 0.02],
    [fx1 + s * 0.05, by - wallH + s * 0.03],
  ]);

  const wood = mix(hex('#4a3322'), scheme.ground.dark, 0.25);
  const lit = mix(wood, scheme.mtn.light, 0.38);
  const shade = darken(wood, 0.35);
  const roofC = scheme.snow ? mix(scheme.ground.mid, [255, 255, 255], 0.3) : mix(hex('#3a2a22'), p.tint, 0.15);
  const roofLit = scheme.snow ? [255, 255, 255] : mix(roofC, scheme.mtn.light, 0.45);
  const glow = scheme.night || scheme.id === 'violet-dusk' || scheme.id === 'golden-hour';
  const lw = clamp(s / 60, 0.8, 2.6);

  const ops = [];
  ops.push((ctx) => {
    poly(ctx, sideWall, shade);
    poly(ctx, front, wood);
  });
  // Side planks run along the wall; front boards run up and down.
  ops.push((ctx) => {
    const rows = Math.max(3, Math.round(wallH / (4 * lw)));
    for (let i = 1; i < rows; i++) {
      const t = i / rows;
      knife(ctx, m(fx1), by - wallH * t, m(fx1 + back), by - rise - wallH * 0.94 * t, lw * 1.2, mix(shade, lit, 0.25), 0.55, 0.5);
    }
  });
  ops.push((ctx) => {
    ctx.save();
    ctx.clip(pathOf(front));
    const cols = Math.max(4, Math.round((fx1 - fx0) / (5 * lw)));
    for (let i = 0; i <= cols; i++) {
      const x = m(fx0 + ((fx1 - fx0) * i) / cols);
      knife(ctx, x, by, x, apex[1], lw * 2, jitter(lit, 0.03), 0.65, 0.4);
    }
    ctx.restore();
  });
  ops.push((ctx) => poly(ctx, roof, roofC));
  ops.push((ctx) => {
    ctx.save();
    ctx.clip(pathOf(roof));
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x0 = lerp(roof[0][0], roof[1][0], t);
      const y0 = lerp(roof[0][1], roof[1][1], t);
      const x1 = lerp(roof[3][0], roof[2][0], t);
      const y1 = lerp(roof[3][1], roof[2][1], t);
      knife(ctx, x0, y0, x1, y1, lw * 3, jitter(roofLit, 0.03), 0.7, 0.45);
    }
    ctx.restore();
  });
  ops.push((ctx) => {
    const trim = mix(lit, [255, 255, 255], 0.2);
    const e0 = [m(fx0 - s * 0.05), by - wallH + s * 0.04];
    const e1 = [m(fx1 + s * 0.05), by - wallH + s * 0.04];
    knife(ctx, e0[0], e0[1], m(apex[0]), apex[1] - 1, lw * 2, trim, 0.9, 0.2);
    knife(ctx, m(apex[0]), apex[1] - 1, e1[0], e1[1], lw * 2, trim, 0.9, 0.2);
    // chimney
    const t = 0.72;
    const chx = lerp(roof[0][0], roof[1][0], t);
    const chy = lerp(roof[0][1], roof[1][1], t);
    poly(ctx, [[chx - s * 0.035, chy + s * 0.04], [chx - s * 0.035, chy - s * 0.12], [chx + s * 0.035, chy - s * 0.12], [chx + s * 0.035, chy + s * 0.04]], darken(wood, 0.2));
    knife(ctx, chx + L * s * 0.02, chy - s * 0.12, chx + L * s * 0.02, chy + s * 0.02, lw * 1.2, lit, 0.7, 0.4);
    if (glow) {
      for (let i = 0; i < 6; i++) {
        soft(ctx, chx + rand(-3, 3) + i * s * 0.02 * -L, chy - s * 0.16 - i * s * 0.07, s * (0.04 + i * 0.012), mix(S.haze, [200, 200, 200], 0.3), 0.12);
      }
    }
  });
  ops.push((ctx) => {
    // door
    const dx = m((fx0 + fx1) / 2);
    const dw = s * 0.1;
    const dh = wallH * 0.62;
    poly(ctx, [[dx - dw / 2, by], [dx - dw / 2, by - dh], [dx + dw / 2, by - dh], [dx + dw / 2, by]], darken(wood, 0.55));
    // window on the side wall
    const wx0 = fx1 + back * 0.35;
    const wx1 = fx1 + back * 0.6;
    const yA = by - wallH * 0.62;
    const yB = by - wallH * 0.3;
    const win = mp([[wx0, yB], [wx0, yA], [wx1, yA - rise * 0.5], [wx1, yB - rise * 0.5]]);
    if (glow) soft(ctx, m((wx0 + wx1) / 2), (yA + yB) / 2, s * 0.25, scheme.window, 0.35);
    poly(ctx, win, glow ? scheme.window : darken(wood, 0.6));
    ctx.strokeStyle = rgba(lit, 0.8);
    ctx.lineWidth = lw;
    ctx.beginPath();
    win.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
  });
  ops.push((ctx) => {
    const g = scheme.ground;
    const x0 = Math.min(m(fx0), m(fx1 + back)) - s * 0.2;
    const x1 = Math.max(m(fx0), m(fx1 + back)) + s * 0.2;
    grass(ctx, (x0 + x1) / 2, by + 1, (x1 - x0) / 2, [g.dark, g.mid, g.light], Math.round(s * 1.2), clamp(s / 45, 0.7, 2.6));
    // a worn little path from the door
    const dx = m((fx0 + fx1) / 2);
    for (let i = 0; i < 5; i++) {
      bristle(ctx, linePts(dx + rand(-s * 0.04, s * 0.04), by + 2, dx - L * s * rand(0.05, 0.25), by + s * rand(0.25, 0.4), 10), {
        width: s * 0.06,
        color: lighten(g.mid, 0.15),
        alpha: 0.35,
        dry: 0.4,
        taper: 0.3,
      });
    }
  });

  const all = front.concat(sideWall, roof);
  const b = boundsOf(all, s * 0.3);
  b.h += s * 0.2;
  return { kind: 'cabin', depth: by, reflect: false, bbox: b, ops, dur: 2000, meta: { x: cx, baseY: by, size: s } };
}
