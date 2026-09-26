// Soft, synthesized studio sounds: the wet slap of a splat and the whisper of a brush.
let ac = null;
let master = null;
let noise = null;
let enabled = false;

function ensure() {
  if (ac) return true;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  ac = new Ctx();
  master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);
  const len = ac.sampleRate;
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
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

export function splat(size = 20) {
  if (!enabled || !ensure()) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500 - Math.min(900, size * 12);
  bp.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(bp).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, 0.3);

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140 - Math.min(60, size), t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.14);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.28, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + 0.2);
}

const SCRAPE = new Set(['mountain', 'rock', 'cabin']);

export function brush(kind, ms) {
  if (!enabled || !ensure() || kind === 'signature') return;
  const t = ac.currentTime;
  const dur = Math.min(2.6, ms / 1000);
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = SCRAPE.has(kind) ? 'highpass' : 'lowpass';
  f.frequency.value = SCRAPE.has(kind) ? 2400 : 1400;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  const strokes = Math.max(2, Math.round(dur * 3.5));
  for (let i = 0; i < strokes; i++) {
    const s = t + (i / strokes) * dur;
    g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.04, s + 0.05);
    g.gain.linearRampToValueAtTime(0.008, s + (dur / strokes) * 0.9);
  }
  g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.1);
}
