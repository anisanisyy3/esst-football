// Thorough i18n usage scan: t('...') literals PLUS title:/key: string refs.
import { translations } from '../src/i18n/translations.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['fr', 'en', 'ar'];

const used = new Set();
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full);
    } else if (/\.(js|mjs)$/.test(entry)) {
      const content = readFileSync(full, 'utf8')
        .split('\n')
        .filter((l) => {
          const t = l.trim();
          return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
        })
        .join('\n');
      for (const m of content.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) used.add(m[1]);
      // title: 'page.x'  |  key: 'nav.x'  (router titles, nav links)
      for (const m of content.matchAll(/\b(?:title|key):\s*['"]([a-z][\w.]+)['"]/g)) used.add(m[1]);
      // err.key = 'errors.x'  |  appError.key = '...'
      for (const m of content.matchAll(/\.key\s*=\s*['"]([a-z][\w.]+)['"]/g)) used.add(m[1]);
      // template literals t(`fixed.${...}`) -> record the prefix
      for (const m of content.matchAll(/\bt\(\s*`([a-z][\w.]+)\.\$\{/g)) used.add(m[1] + '.*');
    }
  }
}
walk(join(root, 'src'));

let missing = 0;
const dynPrefixes = [];
for (const key of [...used].sort()) {
  if (key.endsWith('.*')) {
    dynPrefixes.push(key);
    continue;
  }
  const miss = LANGS.filter((lang) => !(key in translations[lang]));
  if (miss.length) {
    console.error(`MISSING [${miss.join(',')}] ${key}`);
    missing += miss.length;
  }
}
console.log(`Checked ${used.size} referenced keys (${dynPrefixes.length} dynamic prefixes skipped).`);
if (missing > 0) {
  console.error(`\n=== SCAN FAILED: ${missing} missing key(s) ===`);
  process.exit(1);
}
console.log('=== SCAN OK ===');
