// ============================================================================
// ADMIN DASHBOARD - protected area for organizers.
// Sections: Overview | Matches | Teams | Managers | Settings | Audit history.
// Roles: super_admin = everything; score_manager = matches only; pending =
// read-only screen. Real permissions are enforced by Supabase RLS anyway.
// ============================================================================

import { t, getLocale } from '../i18n/language.js';
import { isDemoMode } from '../lib/supabaseClient.js';
import * as auth from '../services/authService.js';
import { dataService } from '../services/dataService.js';
import { subscribeToMatches } from '../services/dataService.js';
import { loadSettings, invalidateSettings, getTz } from '../lib/settingsCache.js';
import { computeStats } from '../utils/stats.js';
import { renderMatchSection } from '../components/adminMatchManager.js';
import { renderTeamSection } from '../components/adminTeamManager.js';
import { escapeHtml, showToast, confirmDialog, errorPanel, emptyPanel } from '../utils/dom.js';
import { formatDateTime } from '../utils/dateFormat.js';
import { navigate } from '../router.js';

const SECTIONS = [
  { id: 'overview', key: 'admin.section.overview', icon: '📊', roles: ['score_manager', 'super_admin'] },
  { id: 'matches', key: 'admin.section.matches', icon: '⚽', roles: ['score_manager', 'super_admin'] },
  { id: 'reports', key: 'admin.section.reports', icon: '📝', roles: ['score_manager', 'super_admin'] },
  { id: 'teams', key: 'admin.section.teams', icon: '🛡️', roles: ['super_admin'] },
  { id: 'requests', key: 'admin.section.requests', icon: '📥', roles: ['super_admin'] },
  { id: 'managers', key: 'admin.section.managers', icon: '👤', roles: ['super_admin'] },
  { id: 'settings', key: 'admin.section.settings', icon: '⚙️', roles: ['super_admin'] },
  { id: 'audit', key: 'admin.section.audit', icon: '🕘', roles: ['super_admin'] },
];

export default {
  title: 'page.adminDashboard',

  async render(root, params) {
    // ---------------------- AUTH GUARD ----------------------
    let session;
    let profile;
    try {
      session = await auth.getSession();
      if (!session) {
        sessionStorage.setItem('esst_auth_notice', 'expired');
        navigate('/admin/login', { replace: true });
        return;
      }
      profile = session.profile ?? (await auth.getProfile());
    } catch (err) {
      renderGuardError(root, err);
      return;
    }

    const role = profile?.role ?? 'pending';

    if (role === 'pending') {
      renderPendingScreen(root, profile);
      return;
    }

    const superAdmin = role === 'super_admin';
    let section = params.section ?? 'overview';
    if (!SECTIONS.some((s) => s.id === section && s.roles.includes(role))) {
      section = 'overview';
    }

    await loadSettings();

    const allowed = SECTIONS.filter((s) => s.roles.includes(role));
    // Members without any dashboard permission (plain players) get a friendly
    // screen instead of crashing on an empty section list.
    if (!allowed.length) {
      renderNoAccessScreen(root, profile);
      return;
    }
    const activeSection = allowed.find((s) => s.id === section) ?? allowed[0];

    root.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-side-head">
          <span class="admin-role tag tag-accent">${t(`admin.role.${role}`)}</span>
        </div>
        <nav class="admin-nav" aria-label="${t('page.adminDashboard')}">
          ${allowed
            .map(
              (s) => `
              <a href="/admin/${s.id}" data-link
                 class="admin-nav-link${s.id === activeSection.id ? ' active' : ''}"
                 ${s.id === activeSection.id ? 'aria-current="page"' : ''}>
                <span aria-hidden="true">${s.icon}</span> ${t(s.key)}
              </a>`
            )
            .join('')}
        </nav>
        <div class="admin-side-foot">
          <a href="/" data-link class="admin-nav-link">🏠 ${t('admin.backToSite')}</a>
          <button id="admin-logout" class="btn btn-outline btn-sm btn-block" type="button">
            ${t('auth.logout') ?? ''}
          </button>
        </div>
      </aside>
      <div class="admin-content">
        <header class="admin-topbar">
          <p class="admin-welcome">${t('admin.welcome', { name: escapeHtml(profile.display_name || profile.email) })}</p>
          ${isDemoMode ? `<span class="badge badge-demo">${t('demo.badge')}</span>` : ''}
        </header>
        <div id="admin-section" class="admin-section"></div>
      </div>
    </div>`;

    // Logout (confirmation for super admins to avoid accidents).
    root.querySelector('#admin-logout').addEventListener('click', async () => {
      await auth.logout();
      showToast(t('auth.loggedOut'));
      navigate('/');
    });

    const container = root.querySelector('#admin-section');
    await renderSection(container, activeSection.id, { profile, superAdmin });

    // Live refresh of matches data for overview/matches sections.
    let timer = null;
    this._unsub = subscribeToMatches(() => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const current = root.querySelector('#admin-section');
        if (!current || !current.isConnected) return;
        if (activeSection.id === 'overview' || activeSection.id === 'matches') {
          await renderSection(current, activeSection.id, { profile, superAdmin });
        }
      }, 400);
    });
  },

  destroy() {
    this._unsub?.();
  },
};

async function renderSection(container, sectionId, ctx) {
  container.innerHTML = `<div class="loading">${t('common.loading')}</div>`;
  try {
    switch (sectionId) {
      case 'overview':
        await renderOverview(container, ctx);
        break;
      case 'matches':
        await renderMatchSection(container, {
          ...ctx,
          refresh: () => renderSection(container, 'matches', ctx),
          reload: () => renderSection(container, 'matches', ctx),
        });
        break;
      case 'reports':
        await renderReports(container, ctx);
        break;
      case 'teams':
        await renderTeamSection(container, {
          ...ctx,
          refresh: () => renderSection(container, 'teams', ctx),
        });
        break;
      case 'requests':
        await renderRequests(container, ctx);
        break;
      case 'managers':
        await renderManagers(container, ctx);
        break;
      case 'settings':
        await renderSettings(container, ctx);
        break;
      case 'audit':
        await renderAudit(container, ctx);
        break;
    }
  } catch (err) {
    container.innerHTML = '';
    container.append(
      errorPanel({
        message: t(err?.key ?? 'errors.loadFailed'),
        retryLabel: t('common.retry'),
        onRetry: () => renderSection(container, sectionId, ctx),
      })
    );
  }
}

// ---------------------------------------------------------------------------
// OVERVIEW
// ---------------------------------------------------------------------------
async function renderOverview(container, ctx) {
  const [teams, matches] = await Promise.all([dataService.listTeams(), dataService.listMatches()]);
  const stats = computeStats(teams.filter((tm) => !tm.archived), matches);

  container.innerHTML = `
  <h2 class="section-title">${t('admin.overview.title')}</h2>
  <p class="page-subtitle">${t('admin.overview.subtitle')}</p>
  <div class="stat-grid">
    ${statCard(stats.teamCount, t('stats.teams'))}
    ${statCard(stats.totalMatches, t('stats.totalMatches'))}
    ${statCard(stats.finishedCount, t('stats.finished'))}
    ${statCard(stats.upcomingCount, t('stats.upcoming'))}
    ${statCard(stats.liveCount, t('stats.live'), 'stat-live')}
  </div>
  <div class="admin-quick">
    <a class="btn btn-primary" href="/admin/matches" data-link>⚽ ${t('admin.quick.addMatch')}</a>
    ${ctx.superAdmin ? `<a class="btn btn-outline" href="/admin/teams" data-link>🛡️ ${t('admin.quick.addTeam')}</a>` : ''}
  </div>`;
}

function statCard(value, label, extra = '') {
  return `
  <div class="stat-card ${extra}">
    <span class="stat-value">${value}</span>
    <span class="stat-label">${label}</span>
  </div>`;
}

// ---------------------------------------------------------------------------
// MANAGERS (super admin)
// ---------------------------------------------------------------------------
async function renderManagers(container, ctx) {
  const managers = await dataService.listManagers();
  if (!managers.length) {
    container.innerHTML = `<h2 class="section-title">${t('admin.managers.title')}</h2>`;
    container.append(emptyPanel({ icon: '👤', message: t('admin.managers.empty') }));
    return;
  }

  const rows = managers
    .map((manager) => {
      const isSelf = manager.id === ctx.profile.id;
      const actions = [];
      if (!isSelf) {
        if (manager.role === 'pending') {
          actions.push(`<button class="btn btn-primary btn-sm" data-role="score_manager" data-id="${manager.id}" type="button">${t('admin.managers.promote')}</button>`);
        }
        if (manager.role === 'score_manager') {
          actions.push(`<button class="btn btn-ghost btn-sm" data-role="pending" data-id="${manager.id}" type="button">${t('admin.managers.revoke')}</button>`);
          actions.push(`<button class="btn btn-outline btn-sm" data-role="super_admin" data-id="${manager.id}" type="button">${t('admin.managers.makeSuper')}</button>`);
        }
        if (manager.role === 'super_admin') {
          actions.push(`<button class="btn btn-danger-ghost btn-sm" data-role="score_manager" data-id="${manager.id}" type="button">${t('admin.managers.demote')}</button>`);
        }
      }
      return `
      <div class="admin-row">
        <div class="admin-row-main">
          <span class="admin-row-teams">
            <strong>${escapeHtml(manager.display_name || manager.email)}${isSelf ? ` <em class="muted">${t('common.you')}</em>` : ''}</strong>
            <span class="muted">${escapeHtml(manager.email)}</span>
          </span>
          <span class="admin-row-meta">${t('admin.managers.status')}: ${
            manager.role === 'pending' ? t('admin.role.pending') : t('admin.managers.active')
          }</span>
        </div>
        <div class="admin-row-actions">
          <span class="tag tag-${manager.role}">${t(`admin.role.${manager.role}`)}</span>
          ${actions.join('')}
        </div>
      </div>`;
    })
    .join('');

  container.innerHTML = `
  <h2 class="section-title">${t('admin.managers.title')}</h2>
  <p class="page-subtitle">${t('admin.managers.subtitle')}</p>
  <div class="alert alert-info">${t('admin.managers.inviteHint')}</div>
  <div class="admin-team-list">${rows}</div>

  <div class="panel">
    <h3 class="panel-title">${t('admin.managers.myProfile')}</h3>
    <div class="field">
      <label for="my-name">${t('admin.managers.displayName')}</label>
      <input id="my-name" type="text" maxlength="60" value="${escapeHtml(ctx.profile.display_name ?? '')}" />
    </div>
    <div class="form-actions">
      <button id="save-profile" class="btn btn-primary" type="button">${t('admin.managers.saveProfile')}</button>
    </div>
  </div>`;

  // Role changes go through the secure DB function (RLS-verified).
  container.querySelectorAll('[data-role]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.id;
      const newRole = btn.dataset.role;
      if (newRole === 'super_admin') {
        const target = managers.find((m) => m.id === targetId);
        const ok = await confirmDialog({
          title: t('common.confirm'),
          message: t('admin.managers.confirmSuper', { name: target?.display_name ?? target?.email ?? '' }),
          confirmLabel: t('common.confirm'),
          cancelLabel: t('common.cancel'),
        });
        if (!ok) return;
      }
      btn.disabled = true;
      try {
        await dataService.changeManagerRole(targetId, newRole);
        showToast(t('common.success'));
        await renderSection(container, 'managers', ctx);
      } catch (err) {
        showToast(t(err?.key ?? 'admin.errors.roleChange'), 'error');
        btn.disabled = false;
      }
    })
  );

  // Own display name (self-update only, enforced by RLS).
  container.querySelector('#save-profile').addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    try {
      const name = container.querySelector('#my-name').value.trim();
      await dataService.updateMyProfile({ display_name: name });
      showToast(t('admin.managers.profileSaved'));
    } catch (err) {
      showToast(t(err?.key ?? 'errors.saving'), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
// REPORTS (score manager): mark LIVE + post-match report editor
// ---------------------------------------------------------------------------
async function renderReports(container, ctx) {
  const matches = await dataService.listMatches();
  const sorted = [...matches].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));

  container.innerHTML = `
    <h2 class="section-title">${t('admin.reports.title')}</h2>
    <p class="page-subtitle">${t('admin.reports.subtitle')}</p>
    <div class="admin-match-list">
      ${sorted.map((m) => `
        <div class="admin-match-row" data-match="${m.id}">
          <div class="admin-row-main">
            <span class="admin-row-teams"><strong>${escapeHtml(m.home_team?.short_name || m.home_team_id)}</strong> vs <strong>${escapeHtml(m.away_team?.short_name || m.away_team_id)}</strong></span>
            <span class="admin-row-meta">${escapeHtml(m.round_name || '')} · ${escapeHtml(formatDateTime(m.kickoff_at))}</span>
          </div>
          <div class="admin-row-actions">
            <span class="tag tag-${m.status}">${t(`status.${m.status}`)}</span>
            ${m.status === 'scheduled' ? `<button class="btn btn-primary btn-sm" data-live="${m.id}" type="button">${t('admin.reports.markLive')}</button>` : ''}
            ${(m.status === 'live' || m.status === 'finished') ? `<button class="btn btn-outline btn-sm" data-report="${m.id}" type="button">${t('admin.reports.openReport')}</button>` : ''}
          </div>
        </div>`).join('')}
    </div>
    <div id="report-editor"></div>`;

  container.querySelectorAll('[data-live]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await dataService.markMatchLive(btn.dataset.live);
        showToast(t('admin.reports.markedLive'), 'success');
        await renderReports(container, ctx);
      } catch (err) { showToast(t(err?.key) || err?.message || 'errors.generic', 'error'); }
    });
  });
  container.querySelectorAll('[data-report]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const reportCtx = { ...ctx, refresh: () => renderReports(container, ctx) };
      await openReportEditor(container.querySelector('#report-editor'), btn.dataset.report, reportCtx);
    });
  });
}

async function openReportEditor(host, matchId, ctx) {
  const match = await dataService.getMatch(matchId);
  const events = (await dataService.getMatchEvents(matchId)) || [];
  const report = await dataService.getMatchReport(matchId);
  host.innerHTML = `
    <div class="panel report-editor">
      <h3 class="panel-title">${escapeHtml(match.home_team?.short_name)} vs ${escapeHtml(match.away_team?.short_name)}</h3>
      <p class="muted">${t('admin.reports.eventsHelp')}</p>
      <div id="events-list" class="events-list">
        ${events.map((e, i) => renderEventRow(e, i, match)).join('')}
      </div>
      <button id="add-event" class="btn btn-ghost btn-sm" type="button">+ ${t('admin.reports.addEvent')}</button>
      <div class="form-grid">
        <label>${t('admin.reports.summary')}<textarea id="rep-summary">${escapeHtml(report?.summary || '')}</textarea></label>
        <label>${t('admin.reports.refereeHome')}<input id="rep-rh" type="number" value="${report?.referee_score_home ?? ''}" /></label>
        <label>${t('admin.reports.refereeAway')}<input id="rep-ra" type="number" value="${report?.referee_score_away ?? ''}" /></label>
      </div>
      <div class="form-actions">
        <button id="submit-report" class="btn btn-primary" type="button">${t('admin.reports.submit')}</button>
      </div>
      <div id="calc-preview" class="calc-preview"></div>
    </div>`;

  host.querySelector('#add-event').addEventListener('click', () => {
    const list = host.querySelector('#events-list');
    const idx = list.children.length;
    list.insertAdjacentHTML('beforeend', renderEventRow({ event_type: 'goal', detail: 'normal', minute: 0, team_id: match.home_team_id, player_id: '', related_player_id: '' }, idx, match));
  });
  host.querySelector('#submit-report').addEventListener('click', async () => {
    const evs = collectEvents(host, match);
    const summary = host.querySelector('#rep-summary').value;
    const rh = host.querySelector('#rep-rh').value;
    const ra = host.querySelector('#rep-ra').value;
    try {
      const res = await dataService.submitMatchReport({
        matchId, events: evs, summary,
        refereeHome: rh === '' ? null : Number(rh),
        refereeAway: ra === '' ? null : Number(ra),
      });
      showToast(t('admin.reports.submitted', { score: `${res.homeScore}-${res.awayScore}` }), 'success');
      await ctx.refresh?.();
    } catch (err) {
      showToast(t(err?.key) || err?.message || 'errors.generic', 'error');
    }
  });
}

function renderEventRow(e, idx, match) {
  const teams = [match.home_team_id, match.away_team_id];
  return `<div class="event-row" data-idx="${idx}">
    <select class="ev-type">
      <option value="goal" ${e.event_type === 'goal' ? 'selected' : ''}>${t('event.goal')}</option>
      <option value="yellow" ${e.event_type === 'yellow' ? 'selected' : ''}>${t('event.yellow')}</option>
      <option value="red" ${e.event_type === 'red' ? 'selected' : ''}>${t('event.red')}</option>
      <option value="sub" ${e.event_type === 'sub' ? 'selected' : ''}>${t('event.sub')}</option>
    </select>
    <select class="ev-detail">
      <option value="normal" ${e.detail === 'normal' ? 'selected' : ''}>${t('event.normal')}</option>
      <option value="penalty" ${e.detail === 'penalty' ? 'selected' : ''}>${t('event.penalty')}</option>
      <option value="own_goal" ${e.detail === 'own_goal' ? 'selected' : ''}>${t('event.ownGoal')}</option>
    </select>
    <input class="ev-minute" type="number" min="0" max="130" value="${e.minute ?? 0}" placeholder="${t('event.minute')}" />
    <input class="ev-extra" type="number" min="0" max="15" value="${e.extra_minute ?? ''}" placeholder="+min" />
    <select class="ev-team">${teams.map((tm) => `<option value="${tm}" ${e.team_id === tm ? 'selected' : ''}>${tm === match.home_team_id ? (match.home_team?.short_name || 'H') : (match.away_team?.short_name || 'A')}</option>`).join('')}</select>
    <input class="ev-player" type="text" value="${escapeHtml(e.player_id || '')}" placeholder="${t('event.player')}" />
    <input class="ev-related" type="text" value="${escapeHtml(e.related_player_id || '')}" placeholder="${t('event.assistOrIn')}" />
    <button class="btn btn-ghost btn-xs" data-remove type="button">✕</button>
  </div>`;
}

function collectEvents(host, match) {
  const rows = host.querySelectorAll('.event-row');
  const out = [];
  rows.forEach((row) => {
    out.push({
      event_type: row.querySelector('.ev-type').value,
      detail: row.querySelector('.ev-detail').value,
      minute: Number(row.querySelector('.ev-minute').value || 0),
      extra_minute: row.querySelector('.ev-extra').value === '' ? null : Number(row.querySelector('.ev-extra').value),
      team_id: row.querySelector('.ev-team').value,
      player_id: row.querySelector('.ev-player').value.trim(),
      related_player_id: row.querySelector('.ev-related').value.trim() || null,
    });
  });
  host.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = () => btn.closest('.event-row').remove();
  });
  return out;
}

// ---------------------------------------------------------------------------
// REQUESTS (super admin): staff requests, team creation, transfers
// ---------------------------------------------------------------------------
async function renderRequests(container, ctx) {
  const [staff, creations, transfers] = await Promise.all([
    dataService.listStaffRequests(),
    dataService.listTeamCreationRequests(),
    dataService.listTransfers(),
  ]);
  container.innerHTML = `
    <h2 class="section-title">${t('admin.requests.title')}</h2>
    <section class="panel">
      <h3 class="panel-title">${t('admin.requests.staff')}</h3>
      ${renderStaffRequests(staff)}
    </section>
    <section class="panel">
      <h3 class="panel-title">${t('admin.requests.teamCreation')}</h3>
      ${renderTeamCreations(creations)}
    </section>
    <section class="panel">
      <h3 class="panel-title">${t('admin.requests.transfers')}</h3>
      ${renderTransfers(transfers)}
    </section>`;

  // wire actions
  container.querySelectorAll('[data-staff-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const role = btn.dataset.role || 'score_manager';
      try { await dataService.reviewStaffRequest(btn.dataset.staffApprove, true, role); showToast(t('common.success'), 'success'); await renderRequests(container, ctx); }
      catch (err) { showToast(err?.message || 'errors.generic', 'error'); }
    });
  });
  container.querySelectorAll('[data-staff-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try { await dataService.reviewStaffRequest(btn.dataset.staffReject, false, null); await renderRequests(container, ctx); }
      catch (err) { showToast(err?.message || 'errors.generic', 'error'); }
    });
  });
  container.querySelectorAll('[data-team-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try { await dataService.approveTeamCreation(btn.dataset.teamApprove, true); showToast(t('common.success'), 'success'); await renderRequests(container, ctx); }
      catch (err) { showToast(err?.message || 'errors.generic', 'error'); }
    });
  });
  container.querySelectorAll('[data-team-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try { await dataService.approveTeamCreation(btn.dataset.teamReject, false); await renderRequests(container, ctx); }
      catch (err) { showToast(err?.message || 'errors.generic', 'error'); }
    });
  });
  container.querySelectorAll('[data-transfer-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try { await dataService.finalizeTransfer(btn.dataset.transferApprove, true); showToast(t('common.success'), 'success'); await renderRequests(container, ctx); }
      catch (err) { showToast(err?.message || 'errors.generic', 'error'); }
    });
  });
  container.querySelectorAll('[data-transfer-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try { await dataService.finalizeTransfer(btn.dataset.transferReject, false); await renderRequests(container, ctx); }
      catch (err) { showToast(err?.message || 'errors.generic', 'error'); }
    });
  });
}

function renderStaffRequests(list) {
  const pending = (list || []).filter((r) => r.status === 'pending');
  if (!pending.length) return `<p class="muted">${t('admin.requests.none')}</p>`;
  return `<div class="admin-team-list">${pending.map((r) => `
    <div class="admin-row">
      <div class="admin-row-main">
        <span class="admin-row-teams"><strong>${escapeHtml(r.user?.display_name || r.user_id)}</strong></span>
        <span class="admin-row-meta">${escapeHtml(r.requested_task)} · ${escapeHtml(r.description || '')}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-primary btn-sm" data-staff-approve="${r.id}" data-role="score_manager" type="button">${t('common.approve')}</button>
        <button class="btn btn-ghost btn-sm" data-staff-reject="${r.id}" type="button">${t('common.reject')}</button>
      </div>
    </div>`).join('')}</div>`;
}

function renderTeamCreations(list) {
  const pending = (list || []).filter((r) => r.status === 'pending');
  if (!pending.length) return `<p class="muted">${t('admin.requests.none')}</p>`;
  return `<div class="admin-team-list">${pending.map((r) => `
    <div class="admin-row">
      <div class="admin-row-main">
        <span class="admin-row-teams"><strong>${escapeHtml(r.proposed_name)}</strong> (${escapeHtml(r.short_name)})</span>
        <span class="admin-row-meta">${escapeHtml(r.requester?.display_name || r.requester_id)}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-primary btn-sm" data-team-approve="${r.id}" type="button">${t('common.approve')}</button>
        <button class="btn btn-ghost btn-sm" data-team-reject="${r.id}" type="button">${t('common.reject')}</button>
      </div>
    </div>`).join('')}</div>`;
}

function renderTransfers(list) {
  const pending = (list || []).filter((r) => r.status === 'captain_approved' || r.status === 'pending');
  if (!pending.length) return `<p class="muted">${t('admin.requests.none')}</p>`;
  return `<div class="admin-team-list">${pending.map((r) => `
    <div class="admin-row">
      <div class="admin-row-main">
        <span class="admin-row-teams">${escapeHtml(r.player_id)} · ${escapeHtml(r.from_team_id)} → ${escapeHtml(r.to_team_id)}</span>
        <span class="admin-row-meta">${escapeHtml(r.status)}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-primary btn-sm" data-transfer-approve="${r.id}" type="button">${t('common.approve')}</button>
        <button class="btn btn-ghost btn-sm" data-transfer-reject="${r.id}" type="button">${t('common.reject')}</button>
      </div>
    </div>`).join('')}</div>`;
}
async function renderSettings(container, ctx) {
  if (!ctx.superAdmin) {
    container.innerHTML = `<div class="alert alert-error">${t('admin.settings.superOnly')}</div>`;
    return;
  }
  const settings = (await dataService.getSettings()) ?? {};
  container.innerHTML = `
  <h2 class="section-title">${t('admin.settings.title')}</h2>
  <p class="page-subtitle">${t('admin.settings.subtitle')}</p>
  <form id="settings-form" class="panel form-grid" novalidate>
    <div class="field field-wide">
      <label for="s-name">${t('admin.form.tournamentName')}</label>
      <input id="s-name" type="text" maxlength="80" value="${escapeHtml(settings.tournament_name ?? '')}" />
    </div>
    <div class="field">
      <label for="s-season">${t('admin.form.seasonLabel')}</label>
      <input id="s-season" type="text" maxlength="40" value="${escapeHtml(settings.season_label ?? '')}" />
    </div>
    <div class="field">
      <label for="s-tz">${t('admin.form.timezone')}</label>
      <input id="s-tz" type="text" maxlength="40" value="${escapeHtml(settings.timezone ?? 'Africa/Algiers')}" />
    </div>
    <div class="field">
      <label for="s-win">${t('admin.form.pointsWin')}</label>
      <input id="s-win" type="number" min="0" max="10" step="1" value="${settings.points_for_win ?? 3}" />
    </div>
    <div class="field">
      <label for="s-draw">${t('admin.form.pointsDraw')}</label>
      <input id="s-draw" type="number" min="0" max="10" step="1" value="${settings.points_for_draw ?? 1}" />
    </div>
    <div class="field">
      <label for="s-loss">${t('admin.form.pointsLoss')}</label>
      <input id="s-loss" type="number" min="0" max="10" step="1" value="${settings.points_for_loss ?? 0}" />
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">${t('common.save')}</button>
    </div>
    <div id="s-alert"></div>
  </form>`;

  const form = container.querySelector('#settings-form');
  let saving = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = t('common.saving');

    const win = Number(form.querySelector('#s-win').value);
    const draw = Number(form.querySelector('#s-draw').value);
    const loss = Number(form.querySelector('#s-loss').value);
    const name = form.querySelector('#s-name').value.trim();
    const season = form.querySelector('#s-season').value.trim();
    const tz = form.querySelector('#s-tz').value.trim() || 'Africa/Algiers';

    const alertEl = form.querySelector('#s-alert');
    if (!name || !Number.isInteger(win) || !Number.isInteger(draw) || !Number.isInteger(loss)) {
      alertEl.innerHTML = `<div class="alert alert-error">${t('errors.generic')}</div>`;
      saving = false;
      submitBtn.disabled = false;
      submitBtn.textContent = t('common.save');
      return;
    }

    try {
      await dataService.updateSettings({
        tournament_name: name,
        season_label: season,
        timezone: tz,
        points_for_win: win,
        points_for_draw: draw,
        points_for_loss: loss,
      });
      invalidateSettings();
      await loadSettings();
      showToast(t('admin.settings.saved'));
    } catch (err) {
      alertEl.innerHTML = `<div class="alert alert-error">${t(err?.key ?? 'errors.saving')}</div>`;
    } finally {
      saving = false;
      submitBtn.disabled = false;
      submitBtn.textContent = t('common.save');
    }
  });
}

// ---------------------------------------------------------------------------
// AUDIT HISTORY (super admin)
// ---------------------------------------------------------------------------
async function renderAudit(container) {
  const logs = await dataService.listAuditLogs();
  const rows = logs
    .map((log) => {
      const match = log.match;
      const matchLabel = match
        ? `${match.home_team?.short_name ?? '—'} – ${match.away_team?.short_name ?? '—'}`
        : log.match_id;
      let change = '';
      const scoreChanged =
        log.old_home_score !== log.new_home_score || log.old_away_score !== log.new_away_score;
      const statusChanged = log.old_status !== log.new_status;
      if (scoreChanged) {
        change += `<span class="audit-score" dir="ltr">${log.old_home_score ?? '–'}:${log.old_away_score ?? '–'} → ${log.new_home_score ?? '–'}:${log.new_away_score ?? '–'}</span> `;
      }
      if (statusChanged) {
        change += `<span class="tag">${t(`status.${log.old_status}`)} → ${t(`status.${log.new_status}`)}</span>`;
      }
      return `
      <div class="admin-row">
        <div class="admin-row-main">
          <span class="admin-row-teams"><strong>${escapeHtml(matchLabel)}</strong></span>
          <span class="admin-row-meta">
            ${log.match?.kickoff_at ? formatDateTime(log.match.kickoff_at, getLocale(), getTz()) + ' · ' : ''}
            ${t('admin.audit.changedBy')}: ${escapeHtml(log.changer?.display_name || log.changer?.email || '—')}
          </span>
        </div>
        <div class="admin-row-actions">
          <span class="muted">${formatDateTime(log.changed_at, getLocale(), getTz())}</span>
          <span class="audit-change">${change}</span>
        </div>
      </div>`;
    })
    .join('');

  container.innerHTML = `
  <h2 class="section-title">${t('admin.section.audit')}</h2>
  <p class="page-subtitle">${t('admin.audit.subtitle')}</p>
  ${
    logs.length
      ? `<div class="admin-team-list">${rows}</div>`
      : emptyPanel({ icon: '🕘', message: t('admin.audit.empty') })
  }`;
}

// ---------------------------------------------------------------------------
// Guard error + pending screens
// ---------------------------------------------------------------------------
function renderGuardError(root, err) {
  root.innerHTML = '';
  const wrap = errorPanel({
    message: t(err?.key ?? 'errors.dbConnection'),
    retryLabel: t('common.retry'),
    onRetry: () => navigate('/admin'),
  });
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-ghost';
  logoutBtn.type = 'button';
  logoutBtn.textContent = t('auth.logout');
  logoutBtn.addEventListener('click', async () => {
    await auth.logout();
    navigate('/admin/login');
  });
  wrap.append(logoutBtn);
  root.append(wrap);
}

function renderNoAccessScreen(root, profile) {
  root.innerHTML = `
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-logo">🔒</div>
      <h1>${t('admin.noAccessTitle')}</h1>
      <p>${t('admin.noAccessMessage')}</p>
      <p class="muted">${escapeHtml(profile?.email ?? '')}</p>
      <div class="form-actions">
        <a class="btn btn-primary" href="/" data-link>${t('admin.backToSite')}</a>
        <a class="btn btn-outline" href="/my-team" data-link>${t('nav.myTeam')}</a>
        <button id="no-access-logout" class="btn btn-ghost" type="button">${t('auth.logout')}</button>
      </div>
    </div>
  </div>`;
  root.querySelector('#no-access-logout').addEventListener('click', async () => {
    await auth.logout();
    navigate('/');
  });
}

function renderPendingScreen(root, profile) {
  root.innerHTML = `
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-logo">⏳</div>
      <h1>${t('auth.pendingTitle')}</h1>
      <p>${t('auth.pendingMessage')}</p>
      <p class="muted">${escapeHtml(profile?.email ?? '')}</p>
      <div class="form-actions">
        <a class="btn btn-outline" href="/" data-link>${t('admin.backToSite')}</a>
        <button id="pending-logout" class="btn btn-ghost" type="button">${t('auth.logout')}</button>
      </div>
    </div>
  </div>`;
  root.querySelector('#pending-logout').addEventListener('click', async () => {
    await auth.logout();
    navigate('/');
  });
}
