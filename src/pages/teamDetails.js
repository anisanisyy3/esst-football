// ============================================================================
// TEAM DETAILS PAGE - team identity + league statistics + its matches.
// ============================================================================

import { t, getLocale } from '../i18n/language.js';
import { dataService } from '../services/dataService.js';
import { loadSettings, getCachedSettings } from '../lib/settingsCache.js';
import { calculateStandings } from '../utils/standings.js';
import { matchCard } from '../components/matchCard.js';
import { teamLogo } from '../components/logo.js';
import { escapeHtml, errorPanel, emptyPanel } from '../utils/dom.js';

export default {
  title: 'page.teamDetails',

  async render(root, params) {
    await loadSettings();

    let teams;
    let matches;
    let team;
    try {
      [teams, matches] = await Promise.all([
        dataService.listTeams(),
        dataService.listMatches(),
      ]);
      team = teams.find((tm) => tm.id === params.id) ?? null;
    } catch (err) {
      root.innerHTML = '';
      root.append(
        errorPanel({
          message: t(err?.key ?? 'errors.dbConnection'),
          retryLabel: t('common.retry'),
          onRetry: () => this.render(root, params),
        })
      );
      return;
    }

    if (!team) {
      root.innerHTML = '';
      root.append(emptyPanel({ icon: '🔍', message: t('teamDetails.empty') }));
      return;
    }

    // League row for this team (position, points, W/D/L, goals).
    const rows = calculateStandings(teams, matches, getCachedSettings());
    const row = rows.find((r) => r.team_id === team.id) ?? {
      position: '—',
      played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0, goal_diff: 0, points: 0,
    };
    const teamMatches = matches
      .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
      .sort((a, b) => b.kickoff_at.localeCompare(a.kickoff_at));

    const gd = row.goal_diff > 0 ? `+${row.goal_diff}` : String(row.goal_diff);

    root.innerHTML = `
    <nav class="breadcrumbs"><a href="/teams" data-link>← ${t('teamDetails.backToTeams')}</a></nav>
    <header class="team-hero">
      ${teamLogo(team, 84, 'team-logo team-logo-xl')}
      <div>
        <h1>${escapeHtml(team.name)}</h1>
        <span class="team-hero-short">${escapeHtml(team.short_name ?? '')}</span>
        ${team.description ? `<p class="team-hero-desc">${escapeHtml(team.description)}</p>` : ''}
      </div>
    </header>

    <section class="section" aria-labelledby="team-stats-title">
      <h2 class="section-title" id="team-stats-title">${t('teamDetails.recordTitle')}</h2>
      <div class="stat-grid">
        <div class="stat-card stat-accent">
          <span class="stat-value">${row.position}</span>
          <span class="stat-label">${t('teamDetails.position')} <small>${t('teamDetails.positionOf', { total: rows.length })}</small></span>
        </div>
        ${stat(row.points, t('standings.pointsFull'))}
        ${stat(row.played, t('standings.playedFull'))}
        ${stat(row.won, t('standings.winsFull'))}
        ${stat(row.drawn, t('standings.drawsFull'))}
        ${stat(row.lost, t('standings.lossesFull'))}
        ${stat(row.goals_for, t('standings.goalsForFull'))}
        ${stat(row.goals_against, t('standings.goalsAgainstFull'))}
        ${stat(gd, t('standings.goalDiffFull'))}
      </div>
    </section>

    <section class="section" aria-labelledby="team-fixtures-title">
      <h2 class="section-title" id="team-fixtures-title">${t('teamDetails.fixturesTitle')}</h2>
      <div class="card-grid">
        ${
          teamMatches.length
            ? teamMatches.map((m) => matchCard(m)).join('')
            : emptyPanel({ icon: '📅', message: t('teamDetails.noMatches') })
        }
      </div>
    </section>`;
  },

  destroy() {},
};

function stat(value, label) {
  return `
  <div class="stat-card">
    <span class="stat-value">${value}</span>
    <span class="stat-label">${label}</span>
  </div>`;
}
