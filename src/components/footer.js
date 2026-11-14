// ============================================================================
// SITE FOOTER
// ============================================================================

import { t } from '../i18n/language.js';

export function renderFooter() {
  const root = document.getElementById('site-footer');
  if (!root) return;
  root.innerHTML = `
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <strong>${t('app.name')}</strong>
        <p>${t('footer.note')}</p>
      </div>
      <nav class="footer-nav" aria-label="Footer">
        <a href="/" data-link>${t('nav.home')}</a>
        <a href="/matches" data-link>${t('nav.matches')}</a>
        <a href="/standings" data-link>${t('nav.standings')}</a>
        <a href="/teams" data-link>${t('nav.teams')}</a>
        <a href="/statistics" data-link>${t('nav.statistics')}</a>
      </nav>
      <div class="footer-langs">${t('footer.languages')}</div>
    </div>
  </footer>`;
}
