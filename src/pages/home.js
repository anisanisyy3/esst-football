// ============================================================================
// HOME PAGE - hero, live match, upcoming, results, standings & stats previews.
// Live-refreshes via Supabase Realtime (demo: cross-tab storage events).
// ============================================================================

import { t, getLocale } from '../i18n/language.js';
import { dataService, subscribeToMatches } from '../services/dataService.js';
import { loadSettings, getCachedSettings } from '../lib/settingsCache.js';
import { calculateStandings } from '../utils/standings.js';
import { computeStats } from '../utils/stats.js';
import { matchCard } from '../components/matchCard.js';
import { standingsTable } from '../components/standingsTable.js';
import { tournamentMark } from '../components/logo.js';
import { escapeHtml, errorPanel, emptyPanel } from '../utils/dom.js';
import { formatKickoff } from '../utils/dateFormat.js';

export default {
  title: 'page.home',

  async render(root) {
    await loadSettings();
    let data;
    try {
      data = await fetchData();
    } catch (err) {
      renderError(root, err);
      return;
    }

    paint(root, data);

    // Live updates without reloading the page.
    let timer = null;
    this._unsub = subscribeToMatches(() => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          paint(root, await fetchData());
        } catch {
          /* transient network issue: keep current content */
        }
      }, 250);
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
  return { teams, matches, settings: getCachedSettings() };
}

function renderError(root, err) {
  root.innerHTML = '';
  root.append(
    errorPanel({
      message: t(err?.key ?? 'errors.dbConnection'),
      retryLabel: t('common.retry'),
      onRetry: () => this.render(root),
    })
  );
}

function paint(root, { teams, matches, settings }) {
  const live = matches.filter((m) => m.status === 'live');
  const upcoming = matches
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
    .slice(0, 4);
  const results = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => b.kickoff_at.localeCompare(a.kickoff_at))
    .slice(0, 4);
  const rows = calculateStandings(teams, matches, settings);
  const stats = computeStats(teams, matches);

  root.innerHTML = `
  <section class="hero">
    <div class="hero-inner">
      <span class="hero-badge">${tournamentMark(20)} ${t('home.heroBadge')}${
        settings.season_label ? ` · ${escapeHtml(settings.season_label)}` : ''
      }</span>
      <h1 class="hero-title">${escapeHtml(settings.tournament_name || t('app.name'))}</h1>
      <p class="hero-subtitle">${t('home.heroSubtitle')}</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="/matches" data-link>${t('home.ctaMatches')}</a>
        <a class="btn btn-outline btn-lg" href="/standings" data-link>${t('home.ctaStandings')}</a>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="live-title">
    <h2 class="section-title" id="live-title"><span class="live-dot"></span> ${t('home.live.title')}</h2>
    <div id="live-slot">${sectionContent(live, 'live')}</div>
  </section>

  <section class="section" aria-labelledby="upcoming-title">
    <div class="section-head">
      <h2 class="section-title" id="upcoming-title">${t('home.upcoming.title')}</h2>
      <a class="section-link" href="/matches" data-link>${t('nav.matches')} →</a>
    </div>
    <div class="card-grid">${sectionContent(upcoming, 'upcoming')}</div>
  </section>

  <section class="section" aria-labelledby="results-title">
    <div class="section-head">
      <h2 class="section-title" id="results-title">${t('home.results.title')}</h2>
      <a class="section-link" href="/matches" data-link>${t('nav.matches')} →</a>
    </div>
    <div class="card-grid">${sectionContent(results, 'results')}</div>
  </section>

  <section class="section" aria-labelledby="standings-title">
    <div class="section-head">
      <h2 class="section-title" id="standings-title">${t('home.standings.title')}</h2>
      <a class="section-link" href="/standings" data-link>${t('home.standings.viewAll')} →</a>
    </div>
    <div id="standings-slot">${standingsContent(rows)}</div>
  </section>

  <section class="section" aria-labelledby="stats-title">
    <h2 class="section-title" id="stats-title">${t('home.stats.title')}</h2>
    <div class="stat-grid">
      ${statCard(stats.teamCount, t('home.stats.teams'))}
      ${statCard(stats.totalMatches, t('home.stats.matches'))}
      ${statCard(stats.finishedCount, t('home.stats.finished'))}
      ${statCard(stats.upcomingCount, t('home.stats.upcoming'))}
    </div>
  </section>`;
}

function sectionContent(list, kind) {
  if (!list.length) {
    const message =
      kind === 'live'
        ? t('home.live.empty')
        : kind === 'upcoming'
          ? t('home.upcoming.empty')
          : t('home.results.empty');
    return emptyPanel({ icon: kind === 'live' ? '📡' : kind === 'upcoming' ? '📅' : '🏁', message });
  }
  return list.map((m) => matchCard(m)).join('');
}

function standingsContent(rows) {
  const played = rows.some((r) => r.played > 0);
  if (!played) {
    return emptyPanel({ icon: '🏆', message: t('home.standings.empty') });
  }
  return standingsTable(rows, { limit: 4, compact: true });
}

function statCard(value, label) {
  return `
  <div class="stat-card">
    <span class="stat-value">${value}</span>
    <span class="stat-label">${label}</span>
  </div>`;
}
