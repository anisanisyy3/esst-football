// ============================================================================
// SITE HEADER - logo, navigation, language selector, mobile menu, demo badge.
// Re-renders on route change (active link), language change and auth change.
// ============================================================================

import { t, getLanguage, setLanguage, LANGUAGES } from '../i18n/language.js';
import { isDemoMode } from '../lib/supabaseClient.js';
import { getSession } from '../services/authService.js';
import { currentPath } from '../router.js';
import { tournamentMark } from './logo.js';
import { escapeHtml } from '../utils/dom.js';

const NAV_LINKS = [
  { href: '/', key: 'nav.home' },
  { href: '/matches', key: 'nav.matches' },
  { href: '/standings', key: 'nav.standings' },
  { href: '/teams', key: 'nav.teams' },
  { href: '/players', key: 'nav.players' },
  { href: '/statistics', key: 'nav.statistics' },
];

let authState = { session: null, checked: false };

/** Update header auth state (called by main.js when auth changes). */
export function setHeaderAuth(session) {
  authState = { session, checked: true };
  renderHeader();
}

export function renderHeader() {
  const root = document.getElementById('site-header');
  if (!root) return;
  const path = currentPath();
  const session = authState.checked ? authState.session : null;
  const isAdmin = Boolean(session) && session.profile?.role !== 'pending';

  const links = NAV_LINKS.map(
    (link) => `
    <a href="${link.href}" data-link class="nav-link${path === link.href ? ' active' : ''}"
       ${path === link.href ? 'aria-current="page"' : ''}>${t(link.key)}</a>`
  ).join('');

  const adminLink = isAdmin
    ? `<a href="/admin" data-link class="btn btn-outline btn-sm">${t('nav.adminPanel')}</a>`
    : `<a href="/admin/login" data-link class="btn btn-outline btn-sm">${t('nav.admin')}</a>`;

  const langOptions = LANGUAGES.map(
    (lang) =>
      `<option value="${lang.code}" ${getLanguage() === lang.code ? 'selected' : ''}>${lang.label}</option>`
  ).join('');

  root.innerHTML = `
  ${isDemoMode ? demoBanner() : ''}
  <header class="site-header">
    <div class="header-inner">
      <a href="/" data-link class="brand" aria-label="${t('app.name')}">
        ${tournamentMark(38)}
        <span class="brand-text">
          <strong>${t('app.short')}</strong>
          <span class="brand-name">${escapeHtml(t('app.name'))}</span>
        </span>
      </a>
      <nav class="main-nav" aria-label="Main">${links}</nav>
      <div class="header-actions">
        <label class="lang-select-wrap">
          <span class="visually-hidden">${t('nav.language')}</span>
          <select id="lang-select" class="lang-select">${langOptions}</select>
        </label>
        ${adminLink}
        <button id="nav-toggle" class="nav-toggle" aria-expanded="false" aria-controls="mobile-menu">
          <span class="visually-hidden">${t('nav.menu')}</span>
          <span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>
        </button>
      </div>
    </div>
    <div id="mobile-menu" class="mobile-menu" hidden>
      ${links}
      ${adminLink.replace('btn-outline btn-sm', 'btn-outline')}
    </div>
  </header>`;

  // Language change
  root.querySelector('#lang-select')?.addEventListener('change', (e) => {
    setLanguage(e.target.value);
  });

  // Mobile menu toggle
  const toggle = root.querySelector('#nav-toggle');
  const menu = root.querySelector('#mobile-menu');
  toggle?.addEventListener('click', () => {
    const open = !menu.hidden;
    menu.hidden = open;
    toggle.setAttribute('aria-expanded', String(!open));
    toggle.classList.toggle('open', !open);
  });
  // Close the menu when a link is used
  menu?.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      menu.hidden = true;
      toggle?.setAttribute('aria-expanded', 'false');
      toggle?.classList.remove('open');
    })
  );
}

function demoBanner() {
  return `
  <div class="demo-banner" role="note">
    <span class="demo-badge">${t('demo.badge')}</span>
    <p>${t('demo.banner')}</p>
    <button id="demo-reset" class="demo-reset" type="button">${t('demo.reset')}</button>
  </div>`;
}

/** Bind demo reset (delegated once). */
export function bindDemoReset() {
  document.getElementById('site-header').addEventListener('click', (e) => {
    if (e.target.id === 'demo-reset') {
      localStorage.removeItem('esst_demo_db_v1');
      sessionStorage.removeItem('esst_demo_session_v1');
      if (location.protocol === 'file:') {
        // Portable build: stay on the same file and restart clean.
        location.hash = '#/';
        location.reload();
      } else {
        location.href = '/';
      }
    }
  });
}
