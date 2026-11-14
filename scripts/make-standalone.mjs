// ============================================================================
// MAKE STANDALONE - builds the portable version of the site.
//
//   npm.cmd run build:standalone
//
// Result: the `esst-website/` folder. Double-click its index.html and the
// site opens straight from the disk (in demo mode), no server required.
//
// How it works: a normal Vite build loads pages as separate ES module files,
// but browsers block those on file:// (CORS). So this script builds with
// everything merged into a single bundle, then inlines the CSS and that
// bundle directly into index.html. Navigation switches to #hash routes
// automatically when the site detects file:// (see src/router.js).
// ============================================================================

import { build } from 'vite';
import { readFile, writeFile, readdir, unlink, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(projectRoot, 'esst-website');

// --- 1. Build with relative URLs and a single bundle ------------------------
await build({
  configFile: resolve(projectRoot, 'vite.standalone.config.js'),
  root: projectRoot,
  logLevel: 'info',
});

// --- 2. Inline the CSS and the JS bundle into index.html --------------------
const indexPath = resolve(outDir, 'index.html');
let html = await readFile(indexPath, 'utf8');

// <link rel="stylesheet" ...>  ->  <style>
const cssLinks = [...html.matchAll(/<link[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)];
const cssDone = new Set();
for (const match of cssLinks) {
  const href = match[1];
  if (cssDone.has(href)) {
    html = html.replace(match[0], ''); // duplicate link -> drop it
    continue;
  }
  cssDone.add(href);
  const file = resolve(outDir, href.replace(/^\.\//, ''));
  const css = await readFile(file, 'utf8');
  // Function replacement: the CSS must never be parsed for "$" patterns.
  html = html.replace(match[0], () => `<style>\n${css}\n</style>`);
  await unlink(file);
}

// <script type="module" src="...">  ->  inline <script type="module">
// (Vite can emit the same entry tag twice in a single-chunk build: inline
// the first one and remove any duplicate.)
const scripts = [...html.matchAll(/<script[^>]*\bsrc="(\.\/assets\/[^"]+\.js)"[^>]*><\/script>/g)];
const inlined = new Set();
for (const match of scripts) {
  const src = match[1];
  if (inlined.has(src)) {
    html = html.replace(match[0], ''); // duplicate entry tag -> drop it
    continue;
  }
  inlined.add(src);
  const file = resolve(outDir, src.replace(/^\.\//, ''));
  let js = await readFile(file, 'utf8');
  // Never let a "</script>" inside the code close the inline tag early.
  js = js.replace(/<\/script/gi, '<\\/script');
  // Function replacement: the JS must never be parsed for "$" patterns
  // (minified code contains "$&", "$'"... which String.replace would expand).
  html = html.replace(match[0], () => `<script type="module">\n${js}\n</script>`);
  await unlink(file);
}

// Module preload hints point at files that no longer exist.
html = html.replace(/<link[^>]*\brel="modulepreload"[^>]*>/g, '');

await writeFile(indexPath, html);

// --- 3. Remove the now-empty leftovers (the favicon stays) ------------------
const assetsDir = resolve(outDir, 'assets');
if (existsSync(assetsDir)) {
  const leftovers = (await readdir(assetsDir)).filter((name) => /\.(js|css)$/i.test(name));
  for (const name of leftovers) await unlink(resolve(assetsDir, name));
  if ((await readdir(assetsDir)).length === 0) {
    await rm(assetsDir, { recursive: true });
  }
}

// --- 4. Safety check: nothing external may be left to load ------------------
const external = html.match(/(?:src|href)="\.\/[^"]+\.(?:js|css)"/g);
if (external) {
  throw new Error(`[make-standalone] Some assets were not inlined: ${external.join(', ')}`);
}

const sizeKb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
console.log('');
console.log('✔ Portable site ready!');
console.log(`  Folder : ${outDir}`);
console.log(`  Open   : esst-website${sep}index.html  (double-click it)`);
console.log(`  Size   : ~${sizeKb} KB in one self-contained file (demo mode, offline)`);
