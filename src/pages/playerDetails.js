// ============================================================================
// PLAYER DETAILS - member-only profile, career stats and OVR history.
// ============================================================================
import { t } from '../i18n/language.js';
import { isDemoMode } from '../lib/supabaseClient.js';
import * as auth from '../services/authService.js';
import { dataService } from '../services/dataService.js';
import { computeCareerStats } from '../utils/career.js';
import { escapeHtml, showToast } from '../utils/dom.js';

export default {
  title: 'page.playerDetails',
  async render(root, params) {
    const session = await auth.getSession();
    const me = session ? await auth.getProfile().catch(() => null) : null;
    if (!auth.isMember(me)) {
      root.innerHTML = `<div class="empty-state"><p>${escapeHtml(t('players.membersOnly'))}</p></div>`;
      return;
    }
    const id = params.id;
    root.innerHTML = `<div class="loading">${escapeHtml(t('common.loading'))}</div>`;
    try {
      const profile = await dataService.getProfileById(id);
      if (!profile) { root.innerHTML = `<div class="empty-state"><p>${escapeHtml(t('errors.notFound'))}</p></div>`; return; }
      const records = await dataService.fetchPlayerRecords(id);
      const appearances = records.appearances || [];
      const matches = records.matches || [];
      const events = records.events || [];
      const entries = [];
      const byMatch = new Map();
      for (const ap of appearances) {
        const match = matches.find((m) => m.id === ap.match_id);
        if (!match || match.status !== 'finished') continue;
        if (byMatch.has(match.id)) continue;
        byMatch.set(match.id, { match, appearances: appearances.filter((a) => a.match_id === match.id), events: events.filter((e) => e.match_id === match.id) });
      }
      const career = computeCareerStats(id, [...byMatch.values()]);
      const ovrHist = isDemoMode ? await dataService.getOvrHistory(id) : { ledger: await dataService.getOvrLedger(id), history: { current: profile.ovr, perMatch: [] } };
      const ledger = ovrHist.ledger || [];
      const suspensions = await dataService.getSuspensions(id);

      root.innerHTML = `
        <section class="page-header"><h1>${escapeHtml(profile.display_name || profile.full_name || '')}</h1>
          <p class="page-sub">${escapeHtml(profile.nickname || '')}</p></section>
        <div class="card">
          <div class="player-card-head">
            ${profile.photo_url ? `<img class="avatar avatar-lg" src="${escapeHtml(profile.photo_url)}" alt="" />` : `<div class="avatar avatar-lg avatar-fallback">${escapeHtml((profile.display_name || '?').slice(0, 1).toUpperCase())}</div>`}
            <div>
              <p><strong>${escapeHtml(t('profile.mainPosition'))}:</strong> ${escapeHtml(t(`positions.${profile.main_position || 'midfielder'}`))}</p>
              ${profile.secondary_position ? `<p><strong>${escapeHtml(t('profile.secondaryPosition'))}:</strong> ${escapeHtml(t(`positions.${profile.secondary_position}`))}</p>` : ''}
              <p><strong>${escapeHtml(t('profile.preferredFoot'))}:</strong> ${escapeHtml(t(`foot.${profile.preferred_foot || 'right'}`))}</p>
              <p><strong>OVR:</strong> ${profile.ovr ?? 60}</p>
            </div>
          </div>
        </div>
        <section class="section"><h2 class="section-title">${escapeHtml(t('stats.career'))}</h2>
          <div class="stat-grid">
            <div class="stat-card"><span class="stat-value">${career.matches_played}</span><span class="stat-label">${t('stats.matches')}</span></div>
            <div class="stat-card"><span class="stat-value">${career.wins}</span><span class="stat-label">${t('stats.wins')}</span></div>
            <div class="stat-card"><span class="stat-value">${career.draws}</span><span class="stat-label">${t('stats.draws')}</span></div>
            <div class="stat-card"><span class="stat-value">${career.losses}</span><span class="stat-label">${t('stats.losses')}</span></div>
            <div class="stat-card"><span class="stat-value">${career.goals}</span><span class="stat-label">${t('stats.goals')}</span></div>
            <div class="stat-card"><span class="stat-value">${career.assists}</span><span class="stat-label">${t('stats.assists')}</span></div>
            <div class="stat-card"><span class="stat-value">${career.yellow_cards}</span><span class="stat-label">${t('stats.yellowCards')}</span></div>
            <div class="stat-card"><span class="stat-value">${career.red_cards}</span><span class="stat-label">${t('stats.redCards')}</span></div>
            <div class="stat-card"><span class="stat-value">${career.minutes_played}</span><span class="stat-label">${t('stats.minutes')}</span></div>
            <div class="stat-card"><span class="stat-value">${career.clean_sheets}</span><span class="stat-label">${t('stats.cleanSheets')}</span></div>
          </div>
        </section>
        <section class="section"><h2 class="section-title">${escapeHtml(t('ovr.history'))}</h2>
          <div class="table-wrap"><table class="standings-table"><thead><tr><th>${t('ovr.match')}</th><th>${t('ovr.before')}</th><th>${t('ovr.delta')}</th><th>${t('ovr.after')}</th><th>${t('ovr.reasons')}</th></tr></thead><tbody>
            ${ (ovrHist.history?.perMatch || []).map((pm) => `<tr><td>${escapeHtml(pm.match_id)}</td><td>${pm.before}</td><td>${pm.delta > 0 ? '+' : ''}${pm.delta}</td><td>${pm.after}</td><td>${escapeHtml(ledger.filter((l) => l.match_id === pm.match_id).map((l) => l.reason + ' ' + (l.delta > 0 ? '+' : '') + l.delta).join(', '))}</td></tr>`).join('') || `<tr><td colspan="5" class="muted">${escapeHtml(t('common.empty'))}</td></tr>` }
          </tbody></table></div>
        </section>
        ${ suspensions.length ? `<section class="section"><h2 class="section-title">${escapeHtml(t('suspensions.title'))}</h2>
          <ul>${suspensions.map((s) => `<li>${escapeHtml(s.status)} — ${escapeHtml(s.red_card_match_id)}</li>`).join('')}</ul></section>` : '' }`;
    } catch (err) {
      root.innerHTML = `<div class="error-state"><p>${escapeHtml(t('errors.generic'))}</p></div>`;
      showToast(t('errors.generic'), 'error');
    }
  },
};
