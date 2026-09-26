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
