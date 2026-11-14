// ============================================================================
// MY TEAM - private team space.
// ============================================================================
import { t } from '../i18n/language.js';
import * as auth from '../services/authService.js';
import { dataService } from '../services/dataService.js';
import { escapeHtml, showToast } from '../utils/dom.js';

export default {
  title: 'page.myTeam',
  async render(root) {
    const session = await auth.getSession();
    const me = session ? await auth.getProfile().catch(() => null) : null;
    if (!auth.isMember(me)) {
      root.innerHTML = `<div class="empty-state"><p>${escapeHtml(t('players.membersOnly'))}</p><a href="/admin/login" data-link class="btn btn-primary">${t('nav.login')}</a></div>`;
      return;
    }
    const membership = await dataService.myMembership();
    if (!membership) {
      root.innerHTML = `
        <section class="page-header"><h1>${escapeHtml(t('myTeam.title'))}</h1></section>
        <div class="empty-state"><p>${escapeHtml(t('myTeam.noTeam'))}</p>
        <a href="/teams" data-link class="btn btn-primary">${t('teams.browse')}</a></div>`;
      return;
    }
    const team = await dataService.getTeam(membership.team_id);
    const roster = await dataService.listTeamMemberships(membership.team_id);
    const posts = await dataService.listTeamPosts(membership.team_id);
    const isCaptain = membership.role_in_team === 'captain' || auth.isSuperAdmin(me);
    let joinRequests = [];
    if (isCaptain) joinRequests = await dataService.listJoinRequests(membership.team_id);

    root.innerHTML = `
      <section class="page-header"><h1>${escapeHtml(team.name)}</h1><p class="page-sub">${escapeHtml(t('myTeam.privateSpace'))}</p></section>
      <div class="grid-2">
        <div class="card">
          <h3>${escapeHtml(t('myTeam.roster'))}</h3>
          <ul class="roster-list">
            ${roster.map((m) => `<li>
              <span class="jersey">${m.jersey_number ?? '—'}</span>
              <span>${escapeHtml(m.player?.display_name || m.player_id)}</span>
              ${m.role_in_team === 'captain' ? `<span class="badge badge-captain">${t('team.captain')}</span>` : ''}
            </li>`).join('')}
          </ul>
        </div>
        <div class="card">
          <h3>${escapeHtml(t('myTeam.posts'))}</h3>
          <form id="post-form" class="form-grid">
            <input type="text" name="title" placeholder="${escapeHtml(t('myTeam.postTitle'))}" />
            <textarea name="body" placeholder="${escapeHtml(t('myTeam.postBody'))}" required></textarea>
            <button type="submit" class="btn btn-primary btn-sm">${t('myTeam.publish')}</button>
          </form>
          <div class="post-list">
            ${posts.map((p) => `<article class="post">
              <header><strong>${escapeHtml(p.author?.display_name || '')}</strong> <span class="muted">${escapeHtml(p.created_at)}</span>
              ${(p.author_id === session.user.id || isCaptain) ? `<button class="btn btn-ghost btn-xs" data-del="${p.id}">${t('common.delete')}</button>` : ''}</header>
              ${p.title ? `<h4>${escapeHtml(p.title)}</h4>` : ''}
              <p>${escapeHtml(p.body)}</p>
            </article>`).join('') || `<p class="muted">${escapeHtml(t('myTeam.noPosts'))}</p>`}
          </div>
        </div>
      </div>
      ${isCaptain ? `
      <section class="section"><h2 class="section-title">${escapeHtml(t('myTeam.joinRequests'))}</h2>
        <div class="table-wrap"><table class="standings-table"><thead><tr><th>${t('players.title')}</th><th>${t('myTeam.message')}</th><th>${t('common.actions')}</th></tr></thead><tbody>
          ${joinRequests.filter((r) => r.status === 'pending').map((r) => `<tr>
            <td>${escapeHtml(r.player?.display_name || r.player_id)}</td>
            <td>${escapeHtml(r.message || '')}</td>
            <td>
              <button class="btn btn-primary btn-xs" data-accept="${r.id}">${t('common.accept')}</button>
              <button class="btn btn-ghost btn-xs" data-reject="${r.id}">${t('common.reject')}</button>
            </td>
          </tr>`).join('') || `<tr><td colspan="3" class="muted">${escapeHtml(t('myTeam.noRequests'))}</td></tr>`}
        </tbody></table></div>
      </section>` : ''}`;

    root.querySelector('#post-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await dataService.addTeamPost(membership.team_id, fd.get('title'), fd.get('body'), 'post');
        showToast(t('myTeam.posted'), 'success');
        navigate('/my-team', { replace: true });
      } catch (err) { showToast(t('errors.generic'), 'error'); }
    });
    root.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try { await dataService.deleteTeamPost(btn.dataset.del); navigate('/my-team', { replace: true }); }
        catch (err) { showToast(t('errors.generic'), 'error'); }
      });
    });
    root.querySelectorAll('[data-accept]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try { await dataService.decideJoinRequest(btn.dataset.accept, true, null); showToast(t('myTeam.accepted'), 'success'); navigate('/my-team', { replace: true }); }
        catch (err) { showToast(t(err?.message || 'errors.generic'), 'error'); }
      });
    });
    root.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try { await dataService.decideJoinRequest(btn.dataset.reject, false, null); navigate('/my-team', { replace: true }); }
        catch (err) { showToast(t('errors.generic'), 'error'); }
      });
    });
  },
};
