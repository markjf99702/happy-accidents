// Helpers for turning a splat's outline into the silhouette of whatever it becomes.
import { clamp } from './util.js';

// The upper edge of a closed outline, as the highest point in each of `bins` columns.
export function topEdge(pts, bins = 48) {
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const [x] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  const w = x1 - x0 || 1;
  const ys = new Array(bins).fill(Infinity);
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const steps = Math.max(1, Math.ceil((Math.abs(bx - ax) / w) * bins * 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const b = clamp(Math.floor(((x - x0) / w) * bins), 0, bins - 1);
      if (y < ys[b]) ys[b] = y;
    }
  }
  fillGaps(ys);
  return { x0, x1, ys };
}

// Heights of that edge above a reference line, scaled to 0..1.
export function heights(edge, refY) {
  const hs = edge.ys.map((y) => Math.max(0, refY - y));
  const m = Math.max(...hs) || 1;
  return hs.map((h) => h / m);
}

// Linear lookup into an array at u in 0..1.
export function at(arr, u) {
  const f = clamp(u, 0, 1) * (arr.length - 1);
  const i = Math.floor(f);
  const t = f - i;
  return i >= arr.length - 1 ? arr[arr.length - 1] : arr[i] * (1 - t) + arr[i + 1] * t;
}

// Leftmost and rightmost crossings of a horizontal line through the outline.
export function span(pts, y) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    if ((ay <= y && by > y) || (by <= y && ay > y)) {
      const x = ax + ((y - ay) / (by - ay)) * (bx - ax);
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  return lo === Infinity ? null : [lo, hi];
}

// Move and scale an outline: shape.cx/cy lands on (x, y), stretched by sx, sy.
export function place(shape, x, y, sx, sy = sx) {
  return shape.pts.map(([px, py]) => [x + (px - shape.cx) * sx, y + (py - shape.cy) * sy]);
}

export function placeDrops(shape, x, y, sx, sy = sx) {
  return shape.drops.map((d) => ({ x: x + (d.x - shape.cx) * sx, y: y + (d.y - shape.cy) * sy, r: d.r * Math.min(sx, sy) }));
}

// Points spread around the inside of an outline, each with a radius that fits its spot:
// how clumps of leaves or puffs of cloud fill a silhouette.
export function clumps(pts, cx, cy, size, every = 5) {
  const out = [];
  for (let i = 0; i < pts.length; i += every) {
    const [px, py] = pts[i];
    const d = Math.hypot(px - cx, py - cy) || 1;
    const r = clamp(d * 0.42, size * 0.35, size);
    out.push({ x: px + ((cx - px) / d) * r * 0.75, y: py + ((cy - py) / d) * r * 0.75, r });
  }
  return out;
}

function fillGaps(ys) {
  const n = ys.length;
  for (let i = 0; i < n; i++) {
    if (ys[i] !== Infinity) continue;
    let a = i - 1;
    let b = i + 1;
    while (a >= 0 && ys[a] === Infinity) a--;
    while (b < n && ys[b] === Infinity) b++;
    if (a < 0 && b >= n) ys[i] = 0;
    else if (a < 0) ys[i] = ys[b];
    else if (b >= n) ys[i] = ys[a];
    else ys[i] = ys[a] + ((ys[b] - ys[a]) * (i - a)) / (b - a);
  }
}

// How far the outline reaches to each side at each height, relative to its average reach
// on that side. Lets a tree's branches bulge where the splat bulged.
export function sideProfile(shape) {
  if (!shape) return () => 1;
  const { pts, box, cx } = shape;
  const rows = [];
  for (let i = 0; i <= 16; i++) {
    const y = box.y + (0.08 + (0.84 * i) / 16) * box.h;
    const s = span(pts, y);
    rows.push(s ? [Math.max(1, cx - s[0]), Math.max(1, s[1] - cx)] : [1, 1]);
  }
  const meanL = rows.reduce((a, r) => a + r[0], 0) / rows.length;
  const meanR = rows.reduce((a, r) => a + r[1], 0) / rows.length;
  return (t, side) => {
    const f = clamp(t, 0, 1) * 16;
    const i = Math.min(15, Math.floor(f));
    const k = side < 0 ? 0 : 1;
    const ext = rows[i][k] * (1 - (f - i)) + rows[i + 1][k] * (f - i);
    return clamp(0.55 + (0.45 * ext) / (side < 0 ? meanL : meanR), 0.45, 1.5);
  };
}
