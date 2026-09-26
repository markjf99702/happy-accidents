import { clamp } from './util.js';

export function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const darken = (c, t) => mix(c, [0, 0, 0], t);
export const lighten = (c, t) => mix(c, [255, 255, 255], t);
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

export function jitter(c, amt) {
  const j = amt * 255;
  return [
    clamp(c[0] + (Math.random() * 2 - 1) * j, 0, 255),
    clamp(c[1] + (Math.random() * 2 - 1) * j, 0, 255),
    clamp(c[2] + (Math.random() * 2 - 1) * j, 0, 255),
  ];
}

// stops: [[t, rgb], ...] sorted by t
export function ramp(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    if (t <= t1) {
      const [t0, c0] = stops[i - 1];
      return mix(c0, c1, (t - t0) / (t1 - t0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}

// Paint mixes by what it absorbs, not by averaging light: yellow and blue make green, red and
// green make brown. A weighted geometric mean of the channels is a fair stand-in for that, with a
// little plain averaging so white lightens a mix the way it does on a palette.
// parts: [[rgb, weight], ...]
export function mixPaint(parts) {
  const total = parts.reduce((s, [, w]) => s + w, 0) || 1;
  return [0, 1, 2].map((ch) => {
    const geo = 255 * Math.exp(parts.reduce((s, [c, w]) => s + (w / total) * Math.log(Math.max(c[ch], 5) / 255), 0));
    const avg = parts.reduce((s, [c, w]) => s + (w / total) * c[ch], 0);
    return geo * 0.7 + avg * 0.3;
  });
}

// Hue (0-360), saturation and lightness (0-1), and chroma (0-1).
export function hsl(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const c = max - min;
  const l = (max + min) / 2;
  const s = c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (c) h = max === r ? 60 * (((g - b) / c + 6) % 6) : max === g ? 60 * ((b - r) / c + 2) : 60 * ((r - g) / c + 4);
  return { h, s, l, c };
}

// Which of the palette's families a color belongs to: white, yellow, red, green, blue or brown.
// Every paint on the palette reads as its own family; mixes land wherever they look like they should.
export function familyOf(rgb) {
  const { h, s, l, c } = hsl(rgb);
  if (c < 0.1) return l > 0.72 ? 'white' : 'brown';
  if (h < 62 && (l < 0.34 || s < 0.35)) return 'brown';
  if (h >= 345 || h < 18) return 'red';
  if (h < 62) return 'yellow';
  if (h < 185) return 'green';
  if (h < 300) return 'blue';
  return 'red';
}

// A plain word for a color, for the painter to say.
export function colorName(rgb) {
  const { h, l, c } = hsl(rgb);
  const fam = familyOf(rgb);
  if (fam === 'white') return 'white';
  if (c < 0.1) return l < 0.25 ? 'nearly black' : 'grey';
  if (fam === 'brown') return l > 0.42 ? 'tan' : 'brown';
  if (h >= 260 && h < 345) return l > 0.62 ? 'lilac' : 'purple';
  if (fam === 'red') return l > 0.6 ? 'pink' : l < 0.3 ? 'deep red' : 'red';
  if (fam === 'yellow') return h < 40 ? 'orange' : l > 0.72 ? 'pale yellow' : 'yellow';
  if (fam === 'green') return l > 0.6 ? 'pale green' : l < 0.25 ? 'dark green' : 'green';
  return l > 0.6 ? 'pale blue' : l < 0.22 ? 'deep blue' : 'blue';
}
