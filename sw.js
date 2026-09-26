// Offline support: keep a copy of Happy Accidents so it paints with no signal.
// Signed paintings live in localStorage, not here.
// Network first, so a new version shows up as soon as you're online.
// When you add, rename or remove a file the page loads, update SHELL (npm test checks it) and bump CACHE.

const CACHE = 'happy-accidents-v1';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg',
  'fonts/caprasimo.woff2', 'fonts/figtree.woff2', 'fonts/figtree-italic.woff2', 'fonts/mrs-saint-delafield.woff2',
  'src/main.js', 'src/studio.js', 'src/splat.js', 'src/shape.js', 'src/decide.js', 'src/words.js',
  'src/schemes.js', 'src/color.js', 'src/util.js', 'src/brush.js', 'src/sound.js',
  'src/paint/index.js', 'src/paint/sky.js', 'src/paint/mountains.js', 'src/paint/trees.js',
  'src/paint/land.js', 'src/paint/water.js', 'src/paint/react.js', 'src/paint/signature.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))),
  );
});
