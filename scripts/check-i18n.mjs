// ============================================================================
// I18N COVERAGE CHECK - run with:  npm test  (second part)
// Verifies every t('key') used in the source exists in FR, EN and AR,
// plus the dynamic key families (statuses, roles, filters).
// ============================================================================

import { translations } from '../src/i18n/translations.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['fr', 'en', 'ar'];

let missing = 0;

function ensureKey(key) {
  for (const lang of LANGS) {
    if (!(key in translations[lang])) {
      console.error(`  ✘ missing [${lang}] ${key}`);
      missing += 1;
    }
  }
}

// 1. Collect t('...') / t("...") literals from all source files.
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
        // Ignore pure comment lines (docs may contain example calls).
        .filter((line) => {
          const trimmed = line.trim();
          return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
        })
        .join('\n');
      for (const m of content.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
        used.add(m[1]);
      }
    }
  }
}
walk(join(root, 'src'));

console.log(`Scanning ${used.size} translation keys used in src/...`);
for (const key of used) ensureKey(key);

// 2. Dynamic key families built at runtime.
const STATUSES = ['scheduled', 'live', 'finished', 'postponed', 'cancelled'];
const ROLES = ['pending', 'member', 'score_manager', 'super_admin'];
const FILTERS = ['all', 'upcoming', 'live', 'finished', 'postponed'];
const POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward'];
const FEET = ['right', 'left', 'both'];
for (const s of STATUSES) ensureKey(`status.${s}`);
for (const r of ROLES) ensureKey(`admin.role.${r}`);
for (const f of FILTERS) ensureKey(`matches.filter.${f}`);
for (const p of POSITIONS) ensureKey(`positions.${p}`);
for (const f of FEET) ensureKey(`foot.${f}`);

// 3. Sanity: all three languages define exactly the same key set.
const frKeys = Object.keys(translations.fr).sort();
for (const lang of LANGS) {
  const keys = Object.keys(translations[lang]).sort();
  if (keys.length !== frKeys.length) {
    console.error(`  ✘ ${lang} has ${keys.length} keys, fr has ${frKeys.length}`);
    missing += 1;
  }
}

if (missing > 0) {
  console.error(`\n=== I18N CHECK FAILED: ${missing} problem(s) ===`);
  process.exit(1);
}
console.log(`\n=== I18N CHECK OK: ${frKeys.length} keys × ${LANGS.length} languages ===`);
