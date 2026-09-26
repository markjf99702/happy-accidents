// The studio owns the canvas: the scene, the painted elements, the splats waiting
// to be turned into something, the lake reflection, and the animation loop.
import { SCHEMES, PIGMENTS, pickScheme } from './schemes.js';
import { TAU, rand, clamp, chance, pick, weighted } from './util.js';
import { rgba, darken } from './color.js';
import { makeSplat, renderSplat } from './splat.js';
import { decide } from './decide.js';
import { sky, signature, SIGNATURE_FONT } from './paint/index.js';
import { bristle, linePts } from './brush.js';
import { line, toolInfo } from './words.js';

export const W = 1200;
export const H = 900;

// Things that change when paint lands on them.
const REACTIVE = new Set(['evergreen', 'deciduous', 'bush', 'mountain', 'sun', 'moon', 'cloud', 'cabin', 'rock']);

// Paints that suit each kind of accident, for when nobody has loaded the brush. Repeats weight the pick.
const PAINT_FOR = {
  cloud: ['titanium-white', 'titanium-white', 'titanium-white', 'alizarin-crimson', 'cadmium-yellow', 'van-dyke-brown', 'prussian-blue'],
  mountain: ['titanium-white', 'titanium-white', 'phthalo-blue', 'prussian-blue', 'van-dyke-brown', 'sap-green'],
  sun: ['cadmium-yellow', 'cadmium-yellow', 'indian-yellow', 'titanium-white'],
  birds: ['van-dyke-brown', 'prussian-blue'],
  treeline: ['sap-green', 'sap-green', 'phthalo-blue', 'titanium-white'],
  bank: ['sap-green', 'sap-green', 'van-dyke-brown', 'yellow-ochre'],
  tree: ['sap-green', 'sap-green', 'sap-green', 'phthalo-blue', 'titanium-white', 'bright-red', 'cadmium-yellow', 'indian-yellow', 'van-dyke-brown'],
  cabin: ['van-dyke-brown', 'van-dyke-brown', 'bright-red'],
  water: ['phthalo-blue', 'titanium-white', 'titanium-white', 'bright-red', 'cadmium-yellow'],
};

// And the other way round: what a loaded paint can sensibly be aimed at.
const FITS = {
  white: ['cloud', 'mountain', 'sun', 'treeline', 'tree', 'water'],
  yellow: ['sun', 'cloud', 'tree', 'water'],
  red: ['cloud', 'tree', 'cabin', 'water'],
  green: ['mountain', 'treeline', 'bank', 'tree'],
  blue: ['mountain', 'birds', 'treeline', 'tree', 'water', 'cloud'],
  brown: ['mountain', 'birds', 'bank', 'cabin', 'cloud', 'tree'],
};

// Things a splat can land on without touching them: the sky itself, light, weather and small marks.
const SEE_THROUGH = new Set(['sky', 'sunpath', 'signature', 'mist', 'aurora', 'stars', 'birds', 'ripples', 'rain', 'foothills', 'waterfall', 'flowers']);

const paintFor = (hint) => {
  const id = pick(PAINT_FOR[hint] || PAINT_FOR.cloud);
  return PIGMENTS.find((p) => p.id === id);
};

export class Studio {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.W = W;
    this.H = H;
    this.k = hooks.scale ?? 1;
    canvas.width = Math.round(W * this.k);
    canvas.height = Math.round(H * this.k);
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.mask = document.createElement('canvas');
    this.mask.width = W / 4;
    this.mask.height = H / 4;
    this.mctx = this.mask.getContext('2d', { willReadFrequently: true });
    const pix = document.createElement('canvas');
    pix.width = 1;
    pix.height = 1;
    this.pix = pix.getContext('2d', { willReadFrequently: true });
    this.paper = this.makePaper();
    this.weave = this.ctx.createPattern(this.makeWeave(), 'repeat');
    this.number = 0;
    this.gen = 0;
    this.elements = [];
    this.active = [];
    this.splats = [];
    this.pool = null;
    this.drops = [];
    this.running = false;
    this.frame = this.frame.bind(this);
  }

  layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * this.k));
    c.height = Math.max(1, Math.ceil(h * this.k));
    return c;
  }

  // ——— setup ———

  newCanvas(schemeId) {
    this.gen += 1;
    this.scheme = (schemeId && SCHEMES.find((s) => s.id === schemeId)) || pickScheme(this.scheme?.id);
    this.hy = Math.round(H * rand(0.5, 0.6));
    this.lightDir = chance(0.5) ? -1 : 1;
    this.haze = this.scheme.haze;
    this.elements = [];
    this.active = [];
    this.splats = [];
    this.pool = null;
    this.drops = [];
    this.counts = {};
    this.reserved = new Set();
    this.accidents = 0;
    this.signed = null;
    this.startedAt = Date.now();
    this.seq = 0;
    this.mctx.clearRect(0, 0, this.mask.width, this.mask.height);
    this.refl = this.layer(W, this.hy + 2);
    this.rctx = this.refl.getContext('2d');
    this.reflDirty = true;
    this.waterTex = this.makeWaterTexture();
    this.number += 1;
    this.addElement(sky(this));
    this.say('wash', 'wash');
    this.hooks.onCanvas?.(this);
    this.kick();
  }

  makePaper() {
    const c = this.layer(W, H);
    const x = c.getContext('2d');
    x.scale(this.k, this.k);
    x.fillStyle = '#f2efe6';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2500; i++) {
      x.fillStyle = `rgba(${chance(0.5) ? '255,255,255' : '120,110,90'},${rand(0.02, 0.06)})`;
      x.fillRect(rand(W), rand(H), rand(1, 3), rand(1, 3));
    }
    return c;
  }

  makeWeave() {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 96, 96);
    for (let i = 0; i < 96; i += 2) {
      x.fillStyle = `rgba(90,80,70,${rand(0.05, 0.35)})`;
      x.fillRect(0, i, 96, 1);
      x.fillStyle = `rgba(90,80,70,${rand(0.05, 0.35)})`;
      x.fillRect(i, 0, 1, 96);
    }
    return c;
  }

  makeWaterTexture() {
    const h = H - this.hy;
    const c = this.layer(W, h);
    const x = c.getContext('2d');
    x.scale(this.k, this.k);
    const { waterLine, water } = this.scheme;
    for (let i = 0; i < 220; i++) {
      const y = rand(0, h);
      const len = rand(20, 220) * (0.4 + y / h);
      const sx = rand(-50, W);
      const lightLine = chance(0.45);
      bristle(x, linePts(sx, y, sx + len, y + rand(-1, 1), 12), {
        width: rand(1.5, 4),
        count: 2,
        color: lightLine ? waterLine : darken(water, 0.35),
        alpha: lightLine ? rand(0.04, 0.12) : rand(0.06, 0.16),
        taper: 0.4,
      });
    }
    // the faint shine where far water meets the horizon
    for (let sx = -20; sx < W; sx += rand(60, 200)) {
      const len = rand(40, 180);
      bristle(x, linePts(sx, 1.2, sx + len, 1.2, 20), { width: 1.6, count: 2, color: waterLine, alpha: 0.35, taper: 0.4 });
    }
    return c;
  }

  // ——— queries used by the decision logic ———

  count(kind) {
    return this.counts[kind] || 0;
  }

  has(kind) {
    return this.reserved.has(kind) || this.count(kind) > 0;
  }

  reserve(kind) {
    this.reserved.add(kind);
  }

  isLand(x, y) {
    const mx = clamp(Math.floor(x / 4), 0, W / 4 - 1);
    const my = clamp(Math.floor(y / 4), 0, H / 4 - 1);
    return this.mctx.getImageData(mx, my, 1, 1).data[3] > 100;
  }

  addLand(pts) {
    const m = this.mctx;
    m.save();
    m.scale(0.25, 0.25);
    m.fillStyle = '#000';
    m.beginPath();
    pts.forEach(([x, y], i) => (i ? m.lineTo(x, y) : m.moveTo(x, y)));
    m.closePath();
    m.fill();
    m.restore();
  }

  // What's painted at a point: the frontmost element whose paint is actually there.
  // Samples a small ring as well as the center, so a splat on a thin-needled tree still counts.
  elementAt(x, y, r = 0) {
    const pts = [[x, y]];
    for (let i = 0; i < 6; i++) pts.push([x + Math.cos((i / 6) * TAU) * r * 0.5, y + Math.sin((i / 6) * TAU) * r * 0.5]);
    const tally = new Map();
    pts.forEach(([px, py], i) => {
      const el = this.topAt(px, py);
      if (el) tally.set(el, (tally.get(el) || 0) + (i ? 1 : 2.5));
    });
    let best = null;
    let most = 0;
    for (const [el, n] of tally) {
      if (n > most) {
        best = el;
        most = n;
      }
    }
    return best;
  }

  topAt(x, y) {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (SEE_THROUGH.has(el.kind)) continue;
      if (el.depth < 0 && y > this.hy) continue;
      const b = el.bbox;
      if (x < b.x || y < b.y || x >= b.x + b.w || y >= b.y + b.h) continue;
      if (el.kind === 'sun' || el.kind === 'moon') {
        if (Math.hypot(x - el.meta.x, y - el.meta.y) <= el.meta.r * 1.3) return el;
        continue;
      }
      if (this.alphaAt(el, x, y) > 90) return el;
    }
    return null;
  }

  alphaAt(el, x, y) {
    const p = this.pix;
    p.clearRect(0, 0, 1, 1);
    p.drawImage(el.canvas, Math.floor((x - el.bbox.x) * this.k), Math.floor((y - el.bbox.y) * this.k), 1, 1, 0, 0, 1, 1);
    return p.getImageData(0, 0, 1, 1).data[3];
  }

  findLand() {
    for (let i = 0; i < 80; i++) {
      const x = rand(W * 0.03, W * 0.97);
      const y = rand(this.hy + (H - this.hy) * 0.08, H * 0.97);
      if (this.isLand(x, y)) return { x, y };
    }
    return null;
  }

  findWater() {
    for (let i = 0; i < 60; i++) {
      const x = rand(W * 0.3, W * 0.7);
      const y = rand(this.hy + (H - this.hy) * 0.1, this.hy + (H - this.hy) * 0.8);
      if (!this.isLand(x, y)) return { x, y };
    }
    return null;
  }

  // ——— narration ———

  say(key, kind, pigment) {
    this.hooks.onNarrate?.({ line: line(key) || line(kind), info: toolInfo(kind, pigment), kind });
  }

  // ——— elements ———

  addElement(spec) {
    const b = this.clampBox(spec.bbox);
    const canvas = this.layer(b.w, b.h);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(this.k, 0, 0, this.k, -b.x * this.k, -b.y * this.k);
    const el = { ...spec, bbox: b, canvas, ctx, i: 0, t0: performance.now(), dur: spec.dur ?? 1400, done: false, seq: this.seq++ };
    this.elements.push(el);
    this.elements.sort((a, c) => a.depth - c.depth || a.seq - c.seq);
    this.active.push(el);
    this.counts[spec.kind] = (this.counts[spec.kind] || 0) + 1;
    if (spec.reflect) this.reflDirty = true;
    this.hooks.onBrush?.(spec.kind, el.dur);
    this.kick();
    return el;
  }

  // Paint more into an element that's already on the canvas (snow on a tree, a sunset in the sky).
  paintOnto(target, spec) {
    const el = {
      kind: spec.kind,
      ops: spec.ops,
      ctx: target.ctx,
      canvas: target.canvas,
      bbox: target.bbox,
      depth: target.depth,
      reflect: target.reflect,
      i: 0,
      t0: performance.now(),
      dur: spec.dur ?? 1200,
      done: false,
    };
    this.active.push(el);
    this.counts[spec.kind] = (this.counts[spec.kind] || 0) + 1;
    if (target.reflect) this.reflDirty = true;
    this.hooks.onBrush?.(spec.kind, el.dur);
    this.kick();
    return el;
  }

  clampBox({ x, y, w, h }) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(W, Math.ceil(x + w));
    const y1 = Math.min(H, Math.ceil(y + h));
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  // ——— splats ———

  addSplat(spec) {
    const x = clamp(spec.x, 0, W);
    const y = clamp(spec.y, 0, H);
    const sp = makeSplat({ ...spec, x, y });
    renderSplat(sp, this.k);
    this.land(sp, spec.delay ?? rand(450, 850));
    return sp;
  }

  // A splat hits the canvas. If it lands in paint that's still wet, the two run together.
  land(sp, delay) {
    sp.gen = this.gen;
    const wet = this.splats.find(
      (s) => s.state === 'wet' && s.gen === this.gen && Math.hypot(s.x - sp.x, s.y - sp.y) < (s.R * s.stretch + sp.R * sp.stretch) * 0.7,
    );
    this.splats.push(sp);
    this.accidents += 1;
    this.hooks.onSplat?.(sp);
    if (wet) this.merge(wet, sp);
    else {
      sp.state = 'wet';
      sp.timer = setTimeout(() => this.resolve(sp), delay);
    }
    this.kick();
  }

  merge(a, b) {
    b.state = 'merged';
    b.parent = a;
    a.merged = [...(a.merged || []), b];
    const parts = [a, ...a.merged];
    const areas = parts.map((p) => p.R * p.R * p.stretch);
    const total = areas.reduce((s, v) => s + v, 0);
    a.center = {
      x: parts.reduce((s, p, i) => s + p.x * areas[i], 0) / total,
      y: parts.reduce((s, p, i) => s + p.y * areas[i], 0) / total,
    };
    a.effR = Math.sqrt(parts.reduce((s, p) => s + p.R * p.R, 0));
    // The colors run together too.
    const rgb = [0, 1, 2].map((c) => parts.reduce((s, p, i) => s + p.pigment.rgb[c] * areas[i], 0) / total);
    const main = parts[areas.indexOf(Math.max(...areas))].pigment;
    const names = [...new Set(parts.map((p) => p.pigment.name))];
    a.mixPigment = { ...main, name: names.join(' and '), rgb };
    clearTimeout(a.timer);
    a.timer = setTimeout(() => this.resolve(a), rand(500, 800));
    this.say('merge', 'merge');
  }

  resolve(sp) {
    if (sp.gen !== this.gen || sp.state !== 'wet') return;
    let plan = [];
    try {
      plan = decide(this, sp);
    } catch (err) {
      console.error(err);
    }
    sp.state = 'absorbing';
    this.runPlan(sp, plan, 0);
  }

  runPlan(sp, plan, i) {
    if (sp.gen !== this.gen) return;
    if (i >= plan.length) {
      sp.state = 'fading';
      this.kick();
      return;
    }
    const st = plan[i];
    let spec = null;
    try {
      spec = st.make(plan[i - 1]?.spec);
    } catch (err) {
      console.error(err);
    }
    if (!spec) {
      this.runPlan(sp, plan, i + 1);
      return;
    }
    st.spec = spec;
    if (!st.quiet) this.say(st.say ?? st.kind, spec.kind, sp.mixPigment || sp.pigment);
    const el = spec.onto ? this.paintOnto(spec.onto, spec) : this.addElement(spec);
    spec.el = el;
    el.onProgress = (t) => {
      sp.alpha = Math.min(sp.alpha, 1 - clamp(((i + t) / plan.length) * 1.4, 0, 1));
    };
    el.onDone = () => this.runPlan(sp, plan, i + 1);
  }

  startPool(pt, pigment) {
    this.pool = makeSplat({ x: pt.x, y: pt.y, R: 14, pigment });
    this.pool.t0 = performance.now();
    renderSplat(this.pool, this.k);
    this.kick();
  }

  endPool() {
    const p = this.pool;
    this.pool = null;
    this.kick();
    return p;
  }

  // The held-down puddle becomes a real splat, shape and all.
  commitPool() {
    const sp = this.pool;
    if (!sp) return null;
    this.pool = null;
    this.land(sp, rand(350, 650));
    return sp;
  }

  // Droplets flung off the brush mid-drag, shown until the splat lands and takes them over.
  addDrop(d, pigment) {
    this.drops.push({ ...d, color: pigment.rgb });
    this.kick();
  }

  takeDrops() {
    const d = this.drops;
    this.drops = [];
    return d;
  }

  // An accident nobody asked for. hint nudges it toward something the painting could use.
  // With a paint given, it only aims where that color makes sense; without one, it picks a
  // paint that suits what it's aiming at.
  randomAccident(opts = {}) {
    const ang = rand(TAU);
    const speed = chance(0.5) ? rand(0.2, 1.6) : 0;
    const motion = { vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, delay: opts.delay };

    // Now and then, land right on something that's already painted and see what it does to it.
    const targets = this.elements.filter((e) => REACTIVE.has(e.kind));
    if (!opts.hint && targets.length > 2 && chance(0.28)) {
      const t = pick(targets);
      const spot = this.spotOn(t);
      if (spot) return this.addSplat({ ...motion, pigment: opts.pigment ?? pick(PIGMENTS), ...spot });
    }

    const fits = opts.pigment ? FITS[opts.pigment.family] : null;
    let hint = opts.hint ?? this.pickHint(fits);
    let spot = null;
    // Otherwise look for open space, so the painting keeps growing.
    for (let i = 0; i < 8 && !spot; i++) {
      const s = this.spotFor(hint);
      if (s && (i === 7 || !this.elementAt(s.x, s.y, s.R))) spot = s;
    }
    if (!spot) {
      hint = fits && !fits.includes('cloud') ? 'mountain' : 'cloud';
      spot = this.spotFor(hint);
    }
    const pigment = opts.pigment ?? paintFor(hint);
    return this.addSplat({ ...motion, pigment, ...spot, hint });
  }

  // A point that's actually on an element.
  spotOn(t) {
    const m = t.meta;
    if (!m) return null;
    switch (t.kind) {
      case 'mountain':
        return { x: m.peak[0] + rand(-40, 40), y: m.peak[1] + m.hgt * rand(0.15, 0.4), R: rand(16, 30) };
      case 'sun':
      case 'moon':
        return { x: m.x, y: m.y, R: rand(14, 22) };
      case 'cloud':
        return { x: m.x + rand(-0.2, 0.2) * m.w, y: m.baseY - m.h * 0.4, R: rand(16, 26) };
      case 'cabin':
        return { x: (m.x0 + m.x1) / 2, y: m.baseY - m.size * 0.2, R: rand(14, 22) };
      case 'rock':
        return { x: m.x, y: m.y - m.hh * 0.5, R: rand(12, 18) };
      default:
        return m.baseY ? { x: m.x, y: m.baseY - m.size * rand(0.35, 0.6), R: rand(14, 24) } : null;
    }
  }

  pickHint(fits) {
    const c = (k) => this.count(k);
    const land = this.findLand() !== null;
    const ok = ([hint]) => !fits || fits.includes(hint);
    return weighted([
      ['cloud', c('cloud') < 3 ? 2.2 : 0.7],
      ['mountain', c('mountain') === 0 ? 3.5 : c('mountain') < 3 ? 1.1 : 0],
      ['sun', this.has('sun') || this.has('moon') ? 0 : 0.7],
      ['birds', 0.45],
      ['treeline', c('treeline') < 2 ? 1.3 : 0.25],
      ['bank', c('bank') < 2 ? 2.8 : c('bank') < 4 ? 1 : 0.25],
      ['tree', land ? 3.2 + c('bank') * 0.3 : 0],
      ['cabin', land && !this.has('cabin') ? 0.5 : 0],
      ['water', 0.6],
    ].map((e) => (ok(e) ? e : [e[0], 0])));
  }

  spotFor(hint) {
    const hy = this.hy;
    switch (hint) {
      case 'cloud':
        return { x: rand(W * 0.05, W * 0.95), y: rand(0.08, 0.6) * hy, R: rand(24, 44) };
      case 'mountain':
        return { x: rand(W * 0.12, W * 0.88), y: hy - rand(0.16, 0.42) * H, R: rand(30, 55) };
      case 'sun':
        return { x: W * (this.lightDir < 0 ? rand(0.12, 0.38) : rand(0.62, 0.88)), y: rand(0.2, 0.5) * hy, R: rand(20, 30) };
      case 'birds':
        return { x: rand(W * 0.15, W * 0.85), y: rand(0.15, 0.55) * hy, R: rand(10, 15) };
      case 'treeline':
        return { x: rand(W * 0.1, W * 0.9), y: hy + rand(-0.015, 0.015) * H, R: rand(24, 44) };
      case 'bank': {
        const left = chance(0.5);
        return { x: left ? rand(W * 0.03, W * 0.26) : rand(W * 0.74, W * 0.97), y: hy + rand(0.12, 0.85) * (H - hy), R: rand(26, 48) };
      }
      case 'tree':
      case 'cabin': {
        const p = this.findLand();
        return p && { ...p, R: rand(20, 46) };
      }
      case 'water': {
        const p = this.findWater();
        return p && { ...p, R: rand(12, 30) };
      }
      default:
        return null;
    }
  }

  // ——— signing ———

  async sign(name) {
    try {
      await Promise.race([document.fonts.load(`44px ${SIGNATURE_FONT}`), new Promise((r) => setTimeout(r, 1500))]);
    } catch {
      /* fall back to whatever script face is available */
    }
    this.elements = this.elements.filter((e) => e.kind !== 'signature');
    this.counts.signature = 0;
    const el = this.addElement(signature(this, name));
    this.signed = { name, at: Date.now() };
    return new Promise((resolve) => {
      el.onDone = () => resolve();
    });
  }

  get busy() {
    return this.active.length > 0 || this.splats.some((s) => s.state === 'wet' || s.state === 'absorbing');
  }

  summary() {
    return {
      counts: { ...this.counts },
      accidents: this.accidents,
      seconds: Math.max(1, Math.round((Date.now() - this.startedAt) / 1000)),
      scheme: this.scheme,
      number: this.number,
    };
  }

  snapshot(width = W * this.k, type = 'image/jpeg', quality = 0.9) {
    this.render(performance.now(), { splats: false });
    const c = document.createElement('canvas');
    c.width = Math.round(width);
    c.height = Math.round((width * H) / W);
    c.getContext('2d').drawImage(this.canvas, 0, 0, c.width, c.height);
    this.render(performance.now());
    return c.toDataURL(type, quality);
  }

  // ——— loop ———

  kick() {
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(this.frame);
    }
  }

  frame(now) {
    for (const el of this.active) {
      const t = Math.min(1, (now - el.t0) / el.dur);
      const target = Math.min(el.ops.length, Math.ceil(t * el.ops.length));
      while (el.i < target) el.ops[el.i++](el.ctx);
      if (el.reflect) this.reflDirty = true;
      el.onProgress?.(t);
      if (el.i >= el.ops.length) el.done = true;
    }
    const finished = this.active.filter((e) => e.done);
    this.active = this.active.filter((e) => !e.done);
    for (const el of finished) {
      el.ops = null;
      el.onDone?.(el);
    }

    const dt = Math.min(64, now - (this.lastFrame ?? now));
    this.lastFrame = now;
    for (const s of this.splats) {
      if (s.state === 'fading') s.alpha -= dt / 350;
      else if (s.parent) s.alpha = s.parent.alpha;
    }
    this.splats = this.splats.filter((s) => s.alpha > 0.01);

    if (this.pool) {
      const R = 14 + 58 * (1 - Math.exp(-(now - this.pool.t0) / 1600));
      if (R - this.pool.renderedR > 0.8) {
        this.pool.R = R;
        renderSplat(this.pool, this.k);
      }
    }

    this.render(now);

    const animating = this.active.length || this.pool || this.splats.some((s) => now - s.born < 240 || s.state === 'fading' || s.state === 'absorbing');
    if (animating) requestAnimationFrame(this.frame);
    else {
      this.running = false;
      this.lastFrame = null;
    }
  }

  buildReflection() {
    const r = this.rctx;
    r.setTransform(this.k, 0, 0, this.k, 0, 0);
    r.drawImage(this.paper, 0, 0, W, H);
    for (const el of this.elements) {
      if (!el.reflect || el.depth > 0.5) continue;
      r.drawImage(el.canvas, el.bbox.x, el.bbox.y, el.canvas.width / this.k, el.canvas.height / this.k);
    }
    this.reflDirty = false;
  }

  drawWater(ctx) {
    const { hy, k } = this;
    if (this.reflDirty) this.buildReflection();
    const src = this.refl;
    const maxSy = src.height / k - 2;
    for (let y = hy; y < H; y += 2) {
      const d = y - hy;
      const sy = clamp(hy - d - 2, 0, maxSy);
      const amp = 0.4 + d * 0.012;
      const off = Math.sin(d * 0.23) * amp + Math.sin(d * 0.071 + 1.3) * amp * 0.7;
      ctx.drawImage(src, 0, sy * k, W * k, 2 * k, off - 8, y, W + 16, 2.3);
    }
    const g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, rgba(this.scheme.water, 0.12));
    g.addColorStop(1, rgba(this.scheme.water, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(0, hy, W, H - hy);
    ctx.drawImage(this.waterTex, 0, hy, W, H - hy);
  }

  render(now, opts = {}) {
    const { ctx, k } = this;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.paper, 0, 0, W, H);
    let water = false;
    for (const el of this.elements) {
      if (!water && el.depth >= 0) {
        this.drawWater(ctx);
        water = true;
      }
      ctx.drawImage(el.canvas, el.bbox.x, el.bbox.y, el.canvas.width / k, el.canvas.height / k);
    }
    if (!water) this.drawWater(ctx);

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = this.weave;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    if (opts.splats === false) return;
    for (const s of this.splats) this.drawSplat(ctx, s, now);
    if (this.pool) this.drawSplat(ctx, this.pool, now);
    for (const d of this.drops) {
      ctx.fillStyle = rgba(d.color);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
    }
  }

  drawSplat(ctx, s, now) {
    const age = now - s.born;
    let pop = 1;
    if (age < 200) {
      const t = age / 200;
      pop = 0.35 + 0.65 * (1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));
    }
    ctx.save();
    ctx.globalAlpha = clamp(s.alpha, 0, 1);
    ctx.translate(s.x, s.y);
    ctx.scale(pop, pop);
    ctx.drawImage(s.canvas, -s.ext, -s.ext, s.ext * 2, s.ext * 2);
    ctx.restore();
    if (s.trail?.length) {
      ctx.save();
      ctx.globalAlpha = clamp(s.alpha, 0, 1);
      ctx.fillStyle = rgba(s.pigment.rgb);
      for (const d of s.trail) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
