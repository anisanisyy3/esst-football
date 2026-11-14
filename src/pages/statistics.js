// ============================================================================
// STATISTICS PAGE - tournament dashboard derived from real records only.
// Player scoring stats are intentionally left as a future extension.
// ============================================================================

import { t, getLocale } from '../i18n/language.js';
import { dataService, subscribeToMatches } from '../services/dataService.js';
import { loadSettings, getCachedSettings } from '../lib/settingsCache.js';
import { calculateStandings } from '../utils/standings.js';
import { computeStats } from '../utils/stats.js';
import { escapeHtml, errorPanel, emptyPanel } from '../utils/dom.js';

export default {
  title: 'page.statistics',

  async render(root) {
    await loadSettings();
    let data;
    try {
      data = await fetchData();
    } catch (err) {
      root.innerHTML = '';
      root.append(
        errorPanel({
          message: t(err?.key ?? 'errors.dbConnection'),
          retryLabel: t('common.retry'),
          onRetry: () => this.render(root),
        })
      );
      return;
    }

    const paint = ({ teams, matches }) => {
      const stats = computeStats(teams, matches);
      const rows = calculateStandings(teams, matches, getCachedSettings());
      const leader = rows[0] ?? null;
      const hasFinished = stats.finishedCount > 0;

      root.innerHTML = `
      <header class="page-header">
        <h1>${t('page.statistics')}</h1>
        <p class="page-subtitle">${t('app.name')}</p>
      </header>

      <div class="stat-grid">
        ${stat(stats.teamCount, t('stats.teams'))}
        ${stat(stats.totalMatches, t('stats.totalMatches'))}
        ${stat(stats.finishedCount, t('stats.finished'))}
        ${stat(stats.upcomingCount, t('stats.upcoming'))}
        ${stat(stats.liveCount, t('stats.live'))}
        ${stat(stats.postponedCount, t('stats.postponed'))}
      </div>

      ${
        hasFinished
          ? `
          <section class="section">
            <h2 class="section-title">${t('stats.totalGoals')}</h2>
            <div class="stat-grid">
              ${stat(stats.totalGoals, t('stats.totalGoals'))}
              ${stat(stats.avgGoals ?? '—', t('stats.avgGoals'))}
            </div>
          </section>

          <section class="section">
            <h2 class="section-title">${t('stats.bestAttack')} / ${t('stats.bestDefense')}</h2>
            <div class="stat-grid">
              <div class="stat-card stat-accent">
                <span class="stat-value">${escapeHtml(stats.bestAttack?.team?.short_name ?? '—')}</span>
                <span class="stat-label">${t('stats.bestAttack')} · ${stats.bestAttack?.goals ?? 0}</span>
              </div>
              <div class="stat-card stat-accent">
                <span class="stat-value">${escapeHtml(stats.bestDefense?.team?.short_name ?? '—')}</span>
                <span class="stat-label">${t('stats.bestDefense')} · ${stats.bestDefense?.goalsAgainst ?? 0}</span>
              </div>
              <div class="stat-card stat-accent">
                <span class="stat-value">${escapeHtml(stats.bestDiff?.team?.short_name ?? '—')}</span>
                <span class="stat-label">${t('stats.bestDiff')} · ${
                  stats.bestDiff && stats.bestDiff.diff > 0 ? '+' : ''
                }${stats.bestDiff?.diff ?? 0}</span>
              </div>
              ${
                leader
                  ? `<div class="stat-card stat-accent">
                      <span class="stat-value">${leader.position}</span>
                      <span class="stat-label">${escapeHtml(leader.name)} · ${leader.points}</span>
                    </div>`
                  : ''
              }
            </div>
          </section>

          ${goalsChart(stats.goalsByTeam)}`
          : emptyPanel({ icon: '📊', message: t('stats.emptyResults') })
      }

      <p class="coming-soon">🚧 ${t('stats.playersSoon')}</p>`;
    };

    paint(data);

    this._unsub = subscribeToMatches(async () => {
      try {
        paint(await fetchData());
      } catch {
        /* keep current view */
      }
    });
  },

  destroy() {
    this._unsub?.();
  },
};

async function fetchData() {
  const [teams, matches] = await Promise.all([
    dataService.listTeams(),
    dataService.listMatches(),
  ]);
  return { teams, matches };
}

function stat(value, label) {
  return `
  <div class="stat-card">
    <span class="stat-value">${value}</span>
    <span class="stat-label">${label}</span>
  </div>`;
}

/** Simple horizontal bar chart (pure CSS, no library). */
function goalsChart(goalsByTeam) {
  if (!goalsByTeam.length) return '';
  const max = Math.max(...goalsByTeam.map((e) => e.goals), 1);
  const rows = goalsByTeam
    .map(
      (entry) => `
      <div class="chart-row">
        <span class="chart-label">${escapeHtml(entry.short_name || entry.name)}</span>
        <div class="chart-track">
          <div class="chart-bar" style="width:${Math.round((entry.goals / max) * 100)}%"></div>
        </div>
        <span class="chart-value">${entry.goals}</span>
      </div>`
    )
    .join('');
  return `
  <section class="section">
    <h2 class="section-title">${t('stats.chartGoals')}</h2>
    <div class="chart-card">${rows}</div>
  </section>`;
}
