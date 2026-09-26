// Bundles the app into a single self-contained HTML file: dist/happy-accidents.html.
// Also writes dist/artifact.html, the same page without the document wrapper,
// for hosts that supply their own <html>/<head>/<body>.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const result = await build({
  entryPoints: [new URL('src/main.js', root).pathname],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  write: false,
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// A single file can't point at other files, so the fonts and the icon go in as data: URIs,
// and the links that only make sense for the hosted site (manifest, home-screen icon, preloads) come out.
const dataUri = async (path, type) => `data:${type};base64,${(await readFile(new URL(path, root))).toString('base64')}`;
let css = await read('styles.css');
for (const [, file] of css.matchAll(/url\((fonts\/[^)]+\.woff2)\)/g)) css = css.replace(`url(${file})`, `url(${await dataUri(file, 'font/woff2')})`);
const icon = await dataUri('icon.svg', 'image/svg+xml');
const html = (await read('index.html'))
  .replace(/<link rel="(manifest|apple-touch-icon|preload)"[^>]*>\n/g, '')
  .replace('href="icon.svg"', () => `href="${icon}"`)
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}</style>`)
  .replace('<script type="module" src="src/main.js"></script>', () => `<script>\n${js}</script>`);

const fragment = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?html[^>]*>\s*/gi, '')
  .replace(/<\/?head>\s*/gi, '')
  .replace(/<\/?body[^>]*>\s*/gi, '')
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/happy-accidents.html', root), html);
await writeFile(new URL('dist/artifact.html', root), fragment);
console.log(`dist/happy-accidents.html  ${(html.length / 1024).toFixed(1)} KB`);
