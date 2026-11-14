// ============================================================================
// ROUTER - clean browser routes with history API.
// Refreshing /matches or /admin works because the dev server, `vite preview`
// and the Netlify redirect all fall back to index.html (SPA mode).
//
// Portable build: a page opened straight from disk (file://) cannot use the
// History API and browsers refuse to fetch separate module files from disk
// (CORS), so the router switches to #hash routes there automatically
// (index.html#/matches). The standalone build inlines everything into one
// file (see scripts/make-standalone.mjs).
// ============================================================================

import { t } from './i18n/language.js';
import { escapeHtml } from './utils/dom.js';

/**
 * True when the site runs as a plain file (double-clicked index.html),
 * or when forced with ?portable=1 (useful for testing the #hash routes
 * or hosting the single file somewhere without SPA fallbacks).
 */
export const IS_PORTABLE =
  location.protocol === 'file:' || new URLSearchParams(location.search).has('portable');

const ROUTES = [
  { pattern: '/', load: () => import('./pages/home.js') },
  { pattern: '/matches', load: () => import('./pages/matches.js') },
  { pattern: '/matches/:id', load: () => import('./pages/matchDetails.js') },
  { pattern: '/lineup/:id', load: () => import('./pages/lineup.js') },
  { pattern: '/standings', load: () => import('./pages/standings.js') },
  { pattern: '/teams', load: () => import('./pages/teams.js') },
  { pattern: '/teams/:id', load: () => import('./pages/teamDetails.js') },
  { pattern: '/statistics', load: () => import('./pages/statistics.js') },
  { pattern: '/register', load: () => import('./pages/register.js') },
  { pattern: '/profile', load: () => import('./pages/profile.js') },
  { pattern: '/players', load: () => import('./pages/players.js') },
  { pattern: '/players/:id', load: () => import('./pages/playerDetails.js') },
  { pattern: '/my-team', load: () => import('./pages/myTeam.js') },
  { pattern: '/admin/login', load: () => import('./pages/adminLogin.js') },
  { pattern: '/admin/:section', load: () => import('./pages/adminDashboard.js') },
  { pattern: '/admin', load: () => import('./pages/adminDashboard.js') },
];

let currentPage = null;
let navToken = 0;
let skipNextHashChange = false;

function normalizePath(pathname) {
  let path = pathname;
  const base = import.meta.env.BASE_URL;
  if (base && base !== '/' && path.startsWith(base)) {
    path = path.slice(base.length - 1);
  }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

/** Current route path - from the URL (hosted) or the #hash (portable build). */
export function currentPath() {
  if (IS_PORTABLE) {
    const raw = location.hash.startsWith('#') ? location.hash.slice(1) : '';
    let path = raw || '/';
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep the raw value */
    }
    return normalizePath(path);
  }
  return normalizePath(location.pathname);
}

function matchRoute(path) {
  const segments = path.split('/').filter(Boolean);
  for (const route of ROUTES) {
    const patternSegments = route.pattern.split('/').filter(Boolean);
    if (segments.length !== patternSegments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < patternSegments.length; i++) {
      if (patternSegments[i].startsWith(':')) {
        params[patternSegments[i].slice(1)] = decodeURIComponent(segments[i]);
      } else if (patternSegments[i] !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

/** Programmatic navigation used by the pages (keeps the URL clean). */
export function navigate(path, { replace = false } = {}) {
  if (IS_PORTABLE) {
    const target = `#${path}`;
    if (location.hash === target) {
      renderRoute(); // same hash: no event fires, render on purpose
    } else if (replace) {
      // No history API on file:// - a fragment-only replace keeps the page.
      skipNextHashChange = true;
      try {
        location.replace(`${location.pathname}${location.search}${target}`);
      } catch {
        location.hash = target;
      }
      renderRoute();
    } else {
      location.hash = target; // fires hashchange -> renderRoute
    }
    return;
  }
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  renderRoute();
}

/** Render the page matching the current URL. */
export async function renderRoute() {
  const token = ++navToken;
  const app = document.getElementById('app');
  if (!app) return;

  // Tear down the previous page (stops its realtime subscription).
  if (currentPage?.destroy) {
    try {
      currentPage.destroy();
    } catch {
      /* ignore teardown errors */
    }
  }
  currentPage = null;

  const path = currentPath();
  const matched = matchRoute(path);

  if (!matched) {
    document.title = `${t('page.notFound')} · ESST`;
    app.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🧭</div>
      <p class="empty-title">${t('page.notFound')}</p>
      <a class="btn btn-primary" href="/" data-link>${t('nav.home')}</a>
    </div>`;
    return;
  }

  app.innerHTML = `<div class="loading" role="status">${escapeHtml(t('common.loading'))}</div>`;

  let page;
  try {
    const mod = await matched.route.load();
    page = mod.default;
    if (token !== navToken) return; // user navigated away meanwhile
    document.title = `${t(page.title)} · ESST`;
    await page.render(app, matched.params);
    if (token !== navToken) {
      page.destroy?.();
      return;
    }
    currentPage = page;
  } catch (err) {
    console.error('[ESST] Page error:', err);
    app.innerHTML = `
    <div class="empty-state error-state">
      <div class="empty-icon">⚠️</div>
      <p class="empty-title">${t('errors.generic')}</p>
      <a class="btn btn-primary" href="/" data-link>${t('nav.home')}</a>
    </div>`;
  }
}

// Browser back / forward buttons (hosted) and #hash changes (portable build).
window.addEventListener('popstate', () => {
  if (!IS_PORTABLE) renderRoute();
});
window.addEventListener('hashchange', () => {
  if (skipNextHashChange) {
    skipNextHashChange = false;
    return;
  }
  renderRoute();
});

// Internal navigation for every <a data-link> on the page.
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[data-link]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('http')) return;
  event.preventDefault();
  navigate(IS_PORTABLE && href.startsWith('#') ? href.slice(1) : href);
});

// Pages may request a re-render after replacing the URL themselves.
document.addEventListener('app:navigate', renderRoute);
