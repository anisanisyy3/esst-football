// ============================================================================
// PLAYERS - member-only list of member profiles.
// ============================================================================
import { t } from '../i18n/language.js';
import { isDemoMode } from '../lib/supabaseClient.js';
import * as auth from '../services/authService.js';
import { dataService } from '../services/dataService.js';
import { navigate } from '../router.js';
import { escapeHtml, showToast } from '../utils/dom.js';

export default {
  title: 'page.players',
  async render(root) {
    const session = await auth.getSession();
    const profile = session ? await auth.getProfile().catch(() => null) : null;
    if (!auth.isMember(profile)) {
      root.innerHTML = `<section class="page-header"><h1>${escapeHtml(t('players.title'))}</h1></section>
        <div class="empty-state"><p>${escapeHtml(t('players.membersOnly'))}</p>
        <a href="/admin/login" data-link class="btn btn-primary">${t('nav.login')}</a></div>`;
      return;
    }
    root.innerHTML = `<section class="page-header"><h1>${escapeHtml(t('players.title'))}</h1><p class="page-sub">${escapeHtml(t('players.subtitle'))}</p></section>
      <div id="players-list" class="loading">${escapeHtml(t('common.loading'))}</div>`;
    try {
      const members = await dataService.listMembers();
      const list = (members || []).filter((p) => auth.isMember(p));
      const container = root.querySelector('#players-list');
      if (!list.length) { container.innerHTML = `<div class="empty-state"><p>${escapeHtml(t('players.empty'))}</p></div>`; return; }
      container.innerHTML = `<div class="card-grid">${list.map((p) => `
        <a class="card player-card" href="/players/${p.id}" data-link>
          <div class="player-card-head">
            ${p.photo_url ? `<img class="avatar" src="${escapeHtml(p.photo_url)}" alt="" />` : `<div class="avatar avatar-fallback">${escapeHtml((p.display_name || '?').slice(0, 1).toUpperCase())}</div>`}
            <div>
              <strong>${escapeHtml(p.display_name || p.full_name || '')}</strong>
              <div class="muted">${escapeHtml(p.nickname || '')}</div>
            </div>
          </div>
          <div class="player-card-meta">
            <span class="badge">${t(`positions.${p.main_position || 'midfielder'}`)}</span>
            <span class="badge badge-ovr">OVR ${p.ovr ?? 60}</span>
          </div>
        </a>`).join('')}</div>`;
    } catch (err) {
      root.querySelector('#players-list').innerHTML = `<div class="error-state"><p>${escapeHtml(t('errors.generic'))}</p></div>`;
      showToast(t('errors.generic'), 'error');
    }
  },
};
