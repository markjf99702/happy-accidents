import { Studio } from './studio.js';
import { PIGMENTS } from './schemes.js';
import { makeTitle, featureLine, madeFrom, line } from './words.js';
import { pick, rand, gauss } from './util.js';
import * as sound from './sound.js';

const $ = (id) => document.getElementById(id);

// Browser storage can be missing or throw (private windows, sandboxed frames), so every access is guarded.
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};
const KEY = { brush: 'happy-accidents:brush', name: 'happy-accidents:artist', sound: 'happy-accidents:sound', gallery: 'happy-accidents:gallery' };

const canvas = $('canvas');
const stage = $('stage');
const easel = $('easel');
const lineEl = $('line');
const toolEl = $('tool');
const hintEl = $('hint');
const inFrame = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

// When the page runs inside the claude.ai artifact viewer, saving a file goes through the
// viewer's downloads capability; elsewhere a plain browser download does the job.
let downloads = null;
window.claude?.use?.('downloads').then(
  (d) => {
    downloads = d;
  },
  () => {},
);

function dataUrlBytes(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ——— narration ———

let lineTimer = 0;
function narrate({ line: text, info }) {
  if (!text) return;
  lineEl.classList.add('swap');
  clearTimeout(lineTimer);
  lineTimer = setTimeout(() => {
    lineEl.textContent = text;
    toolEl.textContent = info || '';
    lineEl.classList.remove('swap');
  }, 180);
}

// ——— the studio ———

const bigScreen = Math.min(window.innerWidth, window.innerHeight) >= 600;
const scale = (window.devicePixelRatio || 1) >= 1.5 && bigScreen ? 1.5 : 1;
const studio = new Studio(canvas, {
  scale,
  onNarrate: narrate,
  onCanvas(s) {
    $('canvasNo').textContent = `Canvas No. ${s.number}`;
    $('schemeName').textContent = s.scheme.name;
  },
  onSplat(sp) {
    sound.splat(sp.R);
  },
  onBrush(kind, ms) {
    sound.brush(kind, ms);
  },
});

// ——— fitting the canvas to the screen ———

const wide = window.matchMedia('(min-width: 960px)');
function fit() {
  if (!wide.matches) {
    easel.style.width = '';
    return;
  }
  const r = stage.getBoundingClientRect();
  const cs = getComputedStyle(stage);
  const availW = r.width - 12;
  const availH = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 14;
  const w = Math.max(260, Math.floor(Math.min(availW, (availH * 4) / 3)));
  easel.style.width = `${w}px`;
}
new ResizeObserver(fit).observe(stage);
wide.addEventListener?.('change', fit);
fit();

// ——— the palette ———

const OPTIONS = [{ id: 'surprise', name: 'Surprise me', hex: null }, ...PIGMENTS];
let loaded = store.get(KEY.brush, 'surprise');
if (!OPTIONS.some((o) => o.id === loaded)) loaded = 'surprise';

const paletteEl = $('palette');
const dabs = OPTIONS.map((o) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = o.id === 'surprise' ? 'dab surprise' : 'dab';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', o.name);
  b.title = o.code ? `${o.name} · ${o.code}` : o.name;
  if (o.hex) b.style.setProperty('--c', o.hex);
  b.dataset.id = o.id;
  b.addEventListener('click', () => load(o.id, true));
  b.addEventListener('keydown', (e) => {
    const i = OPTIONS.indexOf(o);
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = OPTIONS[(i + 1) % OPTIONS.length];
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = OPTIONS[(i - 1 + OPTIONS.length) % OPTIONS.length];
    if (next) {
      e.preventDefault();
      load(next.id, true);
    }
  });
  paletteEl.appendChild(b);
  return b;
});

function load(id, focus = false) {
  loaded = id;
  store.set(KEY.brush, id);
  const o = OPTIONS.find((p) => p.id === id);
  $('loadedName').textContent = id === 'surprise' ? 'Surprise me · new paint every splat' : o.code ? `${o.name} · ${o.code}` : o.name;
  for (const d of dabs) {
    const on = d.dataset.id === id;
    d.setAttribute('aria-checked', String(on));
    d.tabIndex = on ? 0 : -1;
    if (on && focus) d.focus();
  }
}
load(loaded);

const currentPigment = () => (loaded === 'surprise' ? pick(PIGMENTS) : PIGMENTS.find((p) => p.id === loaded));
// For accidents you didn't make: a loaded paint is used as is; on Surprise me, the accident picks a paint that suits it.
const accidentPigment = () => (loaded === 'surprise' ? undefined : currentPigment());

// ——— intro demo and first-time hint ———

let demoTimers = [];
let acted = false;
function userActed() {
  if (acted) return;
  acted = true;
  demoTimers.forEach(clearTimeout);
  demoTimers = [];
  hintEl.classList.add('gone');
}

function runDemo() {
  const steps = [
    ['mountain', 2100],
    ['bank', 4000],
    ['tree', 5800],
  ];
  for (const [hint, at] of steps) demoTimers.push(setTimeout(() => studio.randomAccident({ hint, delay: 400 }), at));
  demoTimers.push(setTimeout(() => narrate({ line: line('invite'), info: '' }), 8600));
}

// ——— painting with the pointer ———

let gesture = null;

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * studio.W, y: ((e.clientY - r.top) / r.height) * studio.H, t: e.timeStamp };
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  canvas.setPointerCapture?.(e.pointerId);
  userActed();
  const p = toCanvas(e);
  const pigment = currentPigment();
  gesture = { id: e.pointerId, start: p, cx: e.clientX, cy: e.clientY, pts: [p], moved: 0, pigment, drops: [] };
  gesture.poolTimer = setTimeout(() => {
    if (gesture && gesture.moved < 10) studio.startPool(gesture.start, gesture.pigment);
  }, 220);
});

canvas.addEventListener('pointermove', (e) => {
  if (!gesture || e.pointerId !== gesture.id) return;
  const p = toCanvas(e);
  gesture.moved = Math.max(gesture.moved, Math.hypot(e.clientX - gesture.cx, e.clientY - gesture.cy));
  const last = gesture.pts[gesture.pts.length - 1];
  gesture.pts.push(p);
  if (gesture.pts.length > 24) gesture.pts.shift();
  if (gesture.moved >= 10 && studio.pool) studio.endPool();
  // Paint flying off a fast brush leaves a trail of droplets.
  const speed = Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, p.t - last.t);
  if (gesture.moved >= 10 && speed > 1 && gesture.drops.length < 40 && Math.random() < 0.45) {
    const d = { x: p.x + gauss() * 5, y: p.y + gauss() * 5, r: rand(1, 3.4) };
    gesture.drops.push(d);
    studio.addDrop(d, gesture.pigment);
  }
});

function finishGesture(e, cancelled = false) {
  if (!gesture || e.pointerId !== gesture.id) return;
  const g = gesture;
  gesture = null;
  clearTimeout(g.poolTimer);
  studio.takeDrops();
  if (cancelled) {
    studio.endPool();
    return;
  }
  const p = toCanvas(e);
  if (studio.pool) {
    studio.commitPool();
    return;
  }
  if (g.moved >= 10) {
    // Velocity over roughly the last 60ms of the drag.
    let q = g.pts[0];
    for (let i = g.pts.length - 1; i >= 0; i--) {
      q = g.pts[i];
      if (p.t - q.t > 60) break;
    }
    const dt = Math.max(8, p.t - q.t);
    const vx = (p.x - q.x) / dt;
    const vy = (p.y - q.y) / dt;
    const speed = Math.hypot(vx, vy);
    const R = Math.min(64, Math.max(14, 16 + speed * 9 + rand(-3, 3)));
    studio.addSplat({ x: p.x, y: p.y, vx, vy, R, pigment: g.pigment, trail: g.drops });
  } else {
    studio.addSplat({ x: p.x, y: p.y, R: rand(11, 22), pigment: g.pigment });
  }
}

canvas.addEventListener('pointerup', (e) => finishGesture(e));
canvas.addEventListener('pointercancel', (e) => finishGesture(e, true));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ——— actions ———

function oops() {
  userActed();
  studio.randomAccident({ pigment: accidentPigment() });
}

let autoTimer = null;
const autoBtn = $('autoBtn');
function setAuto(on) {
  clearTimeout(autoTimer);
  autoTimer = null;
  autoBtn.setAttribute('aria-pressed', String(on));
  autoBtn.textContent = on ? 'Stop' : 'Let it happen';
  if (on) {
    userActed();
    tickAuto(250);
  }
}
function tickAuto(delay) {
  autoTimer = setTimeout(() => {
    if (studio.accidents >= 24) {
      setAuto(false);
      narrate({ line: line('done'), info: '' });
      return;
    }
    if (studio.active.length < 2) studio.randomAccident({ pigment: accidentPigment() });
    tickAuto(rand(1300, 2400));
  }, delay);
}

let newArmed = null;
const newBtn = $('newBtn');
function newCanvas() {
  const unsaved = studio.accidents > 0 && !studio.signed;
  if (unsaved && !newArmed) {
    newBtn.textContent = 'Start over?';
    newArmed = setTimeout(() => {
      newArmed = null;
      newBtn.textContent = 'New canvas';
    }, 3000);
    return;
  }
  clearTimeout(newArmed);
  newArmed = null;
  newBtn.textContent = 'New canvas';
  setAuto(false);
  userActed();
  studio.newCanvas();
}

const soundBtn = $('soundBtn');
function setSound(on) {
  sound.setSound(on);
  store.set(KEY.sound, on);
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.textContent = on ? 'Sound on' : 'Sound off';
}

$('oopsBtn').addEventListener('click', oops);
autoBtn.addEventListener('click', () => setAuto(!autoTimer));
newBtn.addEventListener('click', newCanvas);
$('signBtn').addEventListener('click', openSign);
$('galleryBtn').addEventListener('click', openGallery);
soundBtn.addEventListener('click', () => setSound(!sound.soundOn()));

// ——— overlays ———

let returnFocus = null;
function openOverlay(el, focusEl) {
  returnFocus = document.activeElement;
  el.hidden = false;
  (focusEl || el.querySelector('button, input'))?.focus();
}
function closeOverlay(el) {
  el.hidden = true;
  returnFocus?.focus?.();
}
const overlays = [$('signSheet'), $('placard'), $('gallery')];
for (const o of overlays) {
  o.addEventListener('click', (e) => {
    if (e.target === o) closeOverlay(o);
  });
}
const openOverlayEl = () => overlays.find((o) => !o.hidden);

// ——— signing ———

const artistName = $('artistName');
const artTitle = $('artTitle');

function openSign() {
  setAuto(false);
  userActed();
  artistName.value = store.get(KEY.name, '');
  artTitle.value = makeTitle(studio.counts, studio.scheme.id);
  openOverlay($('signSheet'), artistName.value ? artTitle : artistName);
}

$('rerollBtn').addEventListener('click', () => {
  artTitle.value = makeTitle(studio.counts, studio.scheme.id);
});
$('cancelSign').addEventListener('click', () => closeOverlay($('signSheet')));

$('signForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = artistName.value.trim() || 'Anonymous';
  const title = artTitle.value.trim() || makeTitle(studio.counts, studio.scheme.id);
  store.set(KEY.name, name);
  $('signSheet').hidden = true;
  narrate({ line: line('signature'), info: 'Liner brush · Bright Red' });
  await studio.sign(name);
  // Let anything still being painted finish before we frame it.
  for (let i = 0; i < 40 && studio.busy; i++) await new Promise((r) => setTimeout(r, 100));
  const s = studio.summary();
  const full = studio.snapshot(studio.W * studio.k, 'image/jpeg', 0.92);
  const record = {
    id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    title,
    artist: name,
    year: new Date().getFullYear(),
    date: new Date().toISOString(),
    img: studio.snapshot(720, 'image/jpeg', 0.85),
    accidents: s.accidents,
    seconds: s.seconds,
    scheme: s.scheme.name,
    number: s.number,
    features: featureLine(s.counts),
  };
  hang(record);
  showPlacard(record, full);
});

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'happy-accident';
}

function showPlacard(record, src) {
  const img = $('placardImg');
  img.src = src || record.img;
  img.alt = `${record.title}, a landscape painting by ${record.artist}`;
  $('plArtist').textContent = record.artist;
  $('plTitle').textContent = record.title;
  $('plYear').textContent = record.year;
  $('plNote').textContent = madeFrom(record.accidents, record.seconds);
  $('plFeatures').textContent = record.features;
  $('plCredit').textContent = `Collection of the artist · Canvas No. ${record.number} · ${record.scheme}`;
  const canSave = !inFrame || !!downloads;
  const saveBtn = $('downloadBtn');
  saveBtn.hidden = !canSave;
  saveBtn.textContent = 'Download image';
  saveBtn.onclick = () => saveImage(src || record.img, `${slug(record.title)}.jpg`);
  $('saveHint').hidden = canSave;
  $('gallery').hidden = true;
  openOverlay($('placard'), $('anotherBtn'));
}

async function saveImage(src, filename) {
  const btn = $('downloadBtn');
  if (downloads) {
    try {
      await downloads.save({ filename, data: dataUrlBytes(src) });
      btn.textContent = 'Saved';
    } catch (err) {
      if (err?.code === 'declined' || err?.code === 'rate_limited') return;
      btn.hidden = true;
      $('saveHint').hidden = false;
    }
    return;
  }
  const a = document.createElement('a');
  a.href = src;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

$('anotherBtn').addEventListener('click', () => {
  $('placard').hidden = true;
  setAuto(false);
  studio.newCanvas();
  canvas.focus();
});
$('keepBtn').addEventListener('click', () => closeOverlay($('placard')));

// ——— the gallery wall ———

function readGallery() {
  const list = store.get(KEY.gallery, []);
  return Array.isArray(list) ? list : [];
}

function hang(record) {
  const list = [record, ...readGallery()].slice(0, 12);
  while (list.length && !store.set(KEY.gallery, list)) list.pop();
  updateCount();
}

function updateCount() {
  const n = readGallery().length;
  $('galleryCount').textContent = n ? String(n) : '';
}

function openGallery() {
  setAuto(false);
  renderWall();
  openOverlay($('gallery'), $('closeGallery'));
}

function renderWall() {
  const list = readGallery();
  const grid = $('wallGrid');
  grid.replaceChildren();
  $('wallEmpty').hidden = list.length > 0;
  for (const rec of list) {
    const li = document.createElement('li');
    li.className = 'wall-item';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'wall-open';
    open.setAttribute('aria-label', `Open ${rec.title}`);
    const img = document.createElement('img');
    img.src = rec.img;
    img.alt = '';
    img.loading = 'lazy';
    open.appendChild(img);
    open.addEventListener('click', () => showPlacard(rec));
    const meta = document.createElement('div');
    meta.className = 'wall-meta';
    const p = document.createElement('p');
    const cite = document.createElement('cite');
    cite.textContent = rec.title;
    p.append(cite, `${rec.artist}, ${new Date(rec.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'quiet';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      if (remove.dataset.armed) {
        store.set(
          KEY.gallery,
          readGallery().filter((r) => r.id !== rec.id),
        );
        updateCount();
        renderWall();
        $('closeGallery').focus();
        return;
      }
      remove.dataset.armed = '1';
      remove.textContent = 'Remove it?';
      setTimeout(() => {
        delete remove.dataset.armed;
        remove.textContent = 'Remove';
      }, 3000);
    });
    meta.append(p, remove);
    li.append(open, meta);
    grid.appendChild(li);
  }
}

$('closeGallery').addEventListener('click', () => closeOverlay($('gallery')));

// ——— keyboard ———

window.addEventListener('keydown', (e) => {
  const open = openOverlayEl();
  if (open) {
    if (e.key === 'Escape') closeOverlay(open);
    return;
  }
  if (e.target.closest?.('input, textarea')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    narrate({ line: line('undo'), info: '' });
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const onButton = e.target.closest?.('button');
  if (e.key === ' ' && !onButton) {
    e.preventDefault();
    oops();
  } else if (e.key === 'Enter' && e.target === canvas) {
    oops();
  } else if (e.key === 'a') setAuto(!autoTimer);
  else if (e.key === 's') openSign();
  else if (e.key === 'n') newCanvas();
  else if (e.key === 'g') openGallery();
  else if (e.key === 'm') setSound(!sound.soundOn());
});

// ——— start ———

// Keep a copy for painting offline. Not inside the claude.ai viewer or a file opened from disk, where it isn't allowed.
if ('serviceWorker' in navigator && !inFrame && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

window.addEventListener('pointerdown', sound.wake, true);
window.addEventListener('keydown', sound.wake, true);

setSound(store.get(KEY.sound, false) === true);
updateCount();
studio.newCanvas();
runDemo();

// Exposed for tinkering from the console, and for test/e2e.mjs and tools/screenshots.mjs.
window.happyAccidents = studio;
studio.skipIntro = userActed;
