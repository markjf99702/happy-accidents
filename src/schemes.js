import { hex, lighten, ramp } from './color.js';
import { pick } from './util.js';

// The paints on the palette. A splat's pigment tints whatever it turns into.
export const PIGMENTS = [
  { id: 'titanium-white', name: 'Titanium White', code: 'PW6', hex: '#f4f2ea', family: 'white' },
  { id: 'cadmium-yellow', name: 'Cadmium Yellow', code: 'PY35', hex: '#f2c21a', family: 'yellow' },
  { id: 'yellow-ochre', name: 'Yellow Ochre', code: 'PY43', hex: '#c48a33', family: 'yellow' },
  { id: 'indian-yellow', name: 'Indian Yellow', hex: '#df8a17', family: 'yellow' },
  { id: 'bright-red', name: 'Bright Red', hex: '#c9321f', family: 'red' },
  { id: 'alizarin-crimson', name: 'Alizarin Crimson', code: 'PR83', hex: '#7e1b2e', family: 'red' },
  { id: 'sap-green', name: 'Sap Green', hex: '#3f5c23', family: 'green' },
  { id: 'phthalo-blue', name: 'Phthalo Blue', code: 'PB15', hex: '#15418a', family: 'blue' },
  { id: 'prussian-blue', name: 'Prussian Blue', code: 'PB27', hex: '#12294a', family: 'blue' },
  { id: 'van-dyke-brown', name: 'Van Dyke Brown', code: 'NBr8', hex: '#3e2b1d', family: 'brown' },
].map((p) => ({ ...p, rgb: hex(p.hex) }));

// Each canvas gets one of these moods. Colors are hex here and converted to rgb arrays below.
const RAW = [
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    sunType: 'sun',
    sky: [[0, '#33507f'], [0.42, '#7c7a9c'], [0.78, '#e2a468'], [1, '#f8dc9a']],
    glow: '#ffd88a',
    sun: '#fff3c6',
    sunGlow: '#ffcc76',
    cloud: { light: '#ffe4ba', shadow: '#8c6d86' },
    mtn: { far: '#8b7fa1', mid: '#5f5679', near: '#403a5a', light: '#f5cd96', shadow: '#2d2946', snow: '#fff1dc' },
    snow: false,
    tree: { dark: '#1a2318', mid: '#34462a', light: '#b8a752' },
    leaf: ['#2a381c', '#56702e', '#a7b049', '#e3c35c'],
    ground: { dark: '#231e13', mid: '#4f5629', light: '#c8b35b' },
    water: '#1f3659',
    waterLine: '#fbe6bd',
    bird: '#2a2330',
    window: '#ffcf6e',
  },
  {
    id: 'winter-hush',
    name: 'Winter Hush',
    sunType: 'sun',
    sky: [[0, '#4d6b98'], [0.5, '#9bb2ce'], [1, '#e9eef2']],
    glow: '#ffffff',
    sun: '#fbfbf3',
    sunGlow: '#eef1f4',
    cloud: { light: '#ffffff', shadow: '#7b8eab' },
    mtn: { far: '#9ba9bf', mid: '#6b7c98', near: '#46556f', light: '#dfe7ef', shadow: '#384660', snow: '#ffffff' },
    snow: true,
    tree: { dark: '#0f2420', mid: '#22403a', light: '#eef4f7' },
    leaf: ['#3b3934', '#6b675d', '#cfd6dc', '#ffffff'],
    ground: { dark: '#6e809a', mid: '#b6c4d4', light: '#ffffff' },
    water: '#39567a',
    waterLine: '#ffffff',
    bird: '#26303c',
    window: '#ffd98a',
  },
  {
    id: 'northern-night',
    name: 'Northern Night',
    sunType: 'moon',
    night: true,
    stars: true,
    sky: [[0, '#040816'], [0.5, '#0b1f3e'], [0.82, '#17445a'], [1, '#3a7a6a']],
    glow: '#62d6a8',
    sun: '#f3efd6',
    sunGlow: '#a7c3d8',
    cloud: { light: '#8fa5bf', shadow: '#1b2942' },
    mtn: { far: '#1f3049', mid: '#15223a', near: '#0c1527', light: '#9fbdd2', shadow: '#070c19', snow: '#c9dceb' },
    snow: true,
    tree: { dark: '#03080a', mid: '#0a191b', light: '#4c7c82' },
    leaf: ['#050c0c', '#0e2221', '#3d6b67', '#9fd0bf'],
    ground: { dark: '#050b0b', mid: '#0e201d', light: '#3a675e' },
    water: '#071630',
    waterLine: '#bfe5de',
    bird: '#060b12',
    window: '#ffc861',
  },
  {
    id: 'autumn-blaze',
    name: 'Autumn Blaze',
    sunType: 'sun',
    leafy: true,
    sky: [[0, '#3d6ca6'], [0.55, '#8fb9d7'], [1, '#f1e1bf']],
    glow: '#ffe7b3',
    sun: '#fff6d6',
    sunGlow: '#ffe2a8',
    cloud: { light: '#ffffff', shadow: '#8b91a9' },
    mtn: { far: '#9386a7', mid: '#6b5b73', near: '#4a3c4f', light: '#f5d9ba', shadow: '#34283b', snow: '#fffaf2' },
    snow: true,
    tree: { dark: '#15231a', mid: '#2e4428', light: '#8b9a45' },
    leaf: ['#5b1d0f', '#b3471d', '#e28b22', '#f5c54f'],
    ground: { dark: '#291a0d', mid: '#6d491d', light: '#d8a043' },
    water: '#284a6e',
    waterLine: '#fdf3dd',
    bird: '#2a2020',
    window: '#ffcf6e',
  },
  {
    id: 'misty-morning',
    name: 'Misty Morning',
    sunType: 'sun',
    sky: [[0, '#8ea4a6'], [0.6, '#c8d1c5'], [1, '#eeede0']],
    glow: '#fffbe6',
    sun: '#fffdf1',
    sunGlow: '#fbf6e2',
    cloud: { light: '#fbfaf1', shadow: '#99a6a2' },
    mtn: { far: '#afb9b9', mid: '#879796', near: '#607373', light: '#f4f2e6', shadow: '#4d5f60', snow: '#ffffff' },
    snow: false,
    tree: { dark: '#21352f', mid: '#3b564a', light: '#a5b79b' },
    leaf: ['#293c2f', '#4e6c4f', '#97af89', '#e9d9a1'],
    ground: { dark: '#29362a', mid: '#57704e', light: '#bbc99f' },
    water: '#6e898b',
    waterLine: '#fbfaf1',
    bird: '#3a4442',
    window: '#ffe2a0',
  },
  {
    id: 'violet-dusk',
    name: 'Violet Dusk',
    sunType: 'sun',
    stars: true,
    sky: [[0, '#1c1944'], [0.45, '#553c79'], [0.8, '#c56a77'], [1, '#f3a46e']],
    glow: '#ffae7e',
    sun: '#ffd89e',
    sunGlow: '#ff9868',
    cloud: { light: '#ffc29f', shadow: '#4a3465' },
    mtn: { far: '#5b4a7d', mid: '#3e3261', near: '#271f43', light: '#f6ad89', shadow: '#1a1530', snow: '#ffe2cf' },
    snow: false,
    tree: { dark: '#120e1c', mid: '#231b33', light: '#8b5b6f' },
    leaf: ['#1c1426', '#3a2a45', '#8e5a70', '#f19f79'],
    ground: { dark: '#140f20', mid: '#2c2238', light: '#a0667a' },
    water: '#211b44',
    waterLine: '#ffd1ae',
    bird: '#140f1e',
    window: '#ffc070',
  },
];

function prep(value) {
  if (typeof value === 'string' && value[0] === '#') return hex(value);
  if (Array.isArray(value)) return value.map(prep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = prep(v);
    return out;
  }
  return value;
}

export const SCHEMES = RAW.map((raw) => {
  const s = prep(raw);
  s.haze = lighten(ramp(s.sky, 0.93), 0.06);
  return s;
});

export function pickScheme(avoidId) {
  const pool = SCHEMES.filter((s) => s.id !== avoidId);
  return pick(pool.length ? pool : SCHEMES);
}
