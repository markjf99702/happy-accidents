import { clamp } from '../util.js';

export const SIGNATURE_FONT = '"Mrs Saint Delafield", "Segoe Script", "Brush Script MT", cursive';
const RED = '#c9321f';

// The signature is lettered offscreen once, then revealed left to right.
export function signature(S, name) {
  const text = (name || '').trim().slice(0, 28) || 'Anonymous';
  const size = 44;
  const font = `${size}px ${SIGNATURE_FONT}`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const tw = Math.ceil(probe.measureText(text).width) + 24;
  const th = Math.ceil(size * 1.5);
  const k = S.k;
  const off = document.createElement('canvas');
  off.width = Math.ceil(tw * k);
  off.height = Math.ceil(th * k);
  const o = off.getContext('2d');
  o.scale(k, k);
  o.font = font;
  o.textBaseline = 'alphabetic';
  o.fillStyle = 'rgba(40,10,5,0.35)';
  o.fillText(text, 12.8, size * 1.02 + 0.8);
  o.fillStyle = RED;
  o.fillText(text, 12, size * 1.02);

  const x = clamp(S.W - 28 - tw, 8, S.W - tw);
  const y = S.H - 22 - th;
  const steps = 26;
  const ops = [];
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    ops.push((ctx) => {
      ctx.clearRect(x, y, tw, th);
      ctx.drawImage(off, 0, 0, off.width * f, off.height, x, y, tw * f, th);
    });
  }
  return { kind: 'signature', depth: 1e6, reflect: false, bbox: { x, y, w: tw, h: th }, ops, dur: 1300 };
}
