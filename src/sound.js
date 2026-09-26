// Soft, synthesized studio sounds: the damp pat of paint landing on canvas and the hush of a
// brush. Everything is built from pink noise (softer than white noise) with gentle onsets and
// the highs rolled off, so nothing clicks, cracks or hisses.
let ac = null;
let master = null;
let pink = null;
let enabled = false;

function ensure() {
  if (ac) return true;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  ac = new Ctx();
  master = ac.createGain();
  master.gain.value = 0.8;
  // A gentle limiter, so a pile of splats at once never gets harsh.
  const soften = ac.createDynamicsCompressor();
  soften.threshold.value = -20;
  soften.knee.value = 12;
  soften.ratio.value = 4;
  soften.attack.value = 0.006;
  soften.release.value = 0.25;
  master.connect(soften).connect(ac.destination);
  // Two seconds of pink noise (Paul Kellet's filter), scaled to a peak of 1.
  const len = ac.sampleRate * 2;
  pink = ac.createBuffer(1, len, ac.sampleRate);
  const d = pink.getChannelData(0);
  let [b0, b1, b2, b3, b4, b5, b6] = [0, 0, 0, 0, 0, 0, 0];
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    peak = Math.max(peak, Math.abs(d[i]));
  }
  for (let i = 0; i < len; i++) d[i] /= peak;
  return true;
}

export function setSound(on) {
  enabled = on;
  if (on && ensure() && ac.state === 'suspended') ac.resume();
}

export const soundOn = () => enabled;

// Browsers only start audio from a user gesture; call this from one.
export function wake() {
  if (enabled && ac && ac.state === 'suspended') ac.resume();
}

function noise(t, stop, loop = false) {
  const src = ac.createBufferSource();
  src.buffer = pink;
  src.loop = loop;
  src.start(t, Math.random() * 1.5);
  src.stop(stop);
  return src;
}

function filter(type, freq, q) {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

// Paint landing on stretched canvas: a soft, muffled pat, the canvas giving a little underneath,
// and a quiet wet spread. Bigger splats are lower and a touch longer.
export function splat(size = 20) {
  if (!enabled || !ensure()) return;
  const t = ac.currentTime + 0.005;
  const big = Math.min(1, size / 50);
  const vary = 0.9 + Math.random() * 0.2;

  // The pat: low-passed pink noise that swells in over about 15 ms instead of snapping on.
  const lp = filter('lowpass', (1300 - big * 500) * vary, 0.5);
  lp.frequency.setValueAtTime((1300 - big * 500) * vary, t);
  lp.frequency.setTargetAtTime(380, t + 0.02, 0.07);
  const lp2 = filter('lowpass', 2000, 0.5);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.42 + big * 0.15, t + 0.015 + big * 0.01);
  g.gain.setTargetAtTime(0.0001, t + 0.02 + big * 0.01, 0.05 + big * 0.04);
  noise(t, t + 0.7).connect(lp).connect(lp2).connect(g).connect(master);

  // The canvas giving: a round, low thump with no click at the front.
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime((115 - big * 35) * vary, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.16);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.linearRampToValueAtTime(0.09 + big * 0.06, t + 0.012);
  og.gain.setTargetAtTime(0.0001, t + 0.02, 0.05);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + 0.5);

  // The wet spread: a quiet, sinking squelch just after the pat.
  const s = t + 0.018;
  const bp = filter('bandpass', 1000 * vary, 1.2);
  bp.frequency.setValueAtTime(1000 * vary, s);
  bp.frequency.exponentialRampToValueAtTime(420, s + 0.16);
  const wg = ac.createGain();
  wg.gain.setValueAtTime(0.0001, s);
  wg.gain.linearRampToValueAtTime(0.22, s + 0.03);
  wg.gain.setTargetAtTime(0.0001, s + 0.04, 0.05);
  noise(s, s + 0.5).connect(bp).connect(wg).connect(master);
}

// Palette-knife work sounds a little grainier than a brush, but still soft.
const KNIFE = new Set(['mountain', 'rock', 'cabin', 'snowfall', 'rockSnow', 'roofSnow']);

// A brush on canvas: soft swishes that swell in and ease out, one per stroke, with the tone
// rising and falling a little as the bristles drag.
export function brush(kind, ms) {
  if (!enabled || !ensure() || kind === 'signature') return;
  const t = ac.currentTime + 0.01;
  const dur = Math.min(2.6, ms / 1000);
  const knife = KNIFE.has(kind);
  const f0 = knife ? 1150 : 700;
  const bp = filter('bandpass', f0, knife ? 0.9 : 0.6);
  const lp = filter('lowpass', knife ? 2600 : 1800, 0.5);
  bp.frequency.setValueAtTime(f0, t);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  const strokes = Math.max(2, Math.round(dur * 2.2));
  const len = dur / strokes;
  for (let i = 0; i < strokes; i++) {
    const s = t + i * len;
    const peak = (knife ? 0.075 : 0.055) * (0.75 + Math.random() * 0.5);
    g.gain.setTargetAtTime(peak, s, len * 0.16);
    g.gain.setTargetAtTime(0.0001, s + len * 0.55, len * 0.18);
    bp.frequency.setTargetAtTime(f0 * 1.25, s, len * 0.25);
    bp.frequency.setTargetAtTime(f0 * 0.85, s + len * 0.5, len * 0.25);
  }
  g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
  noise(t, t + dur + 0.5, true).connect(bp).connect(lp).connect(g).connect(master);
}
