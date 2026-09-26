export const TAU = Math.PI * 2;

export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const chance = (p) => Math.random() < p;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);

export function gauss() {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

// entries: [[value, weight], ...]
export function weighted(entries) {
  let total = 0;
  for (const [, w] of entries) total += Math.max(0, w);
  if (total <= 0) return entries[0][0];
  let r = Math.random() * total;
  for (const [value, w] of entries) {
    r -= Math.max(0, w);
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// Like pick(), but avoids repeating the last few choices made under the same key.
const recent = new Map();
export function pickFresh(key, list) {
  if (!list || !list.length) return '';
  const seen = recent.get(key) || [];
  const pool = list.filter((item) => !seen.includes(item));
  const choice = pick(pool.length ? pool : list);
  seen.push(choice);
  while (seen.length > Math.min(4, list.length - 1)) seen.shift();
  recent.set(key, seen);
  return choice;
}
