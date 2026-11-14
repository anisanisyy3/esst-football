// ============================================================================
// MATCH DETAILS PAGE - full information about a single match.
// ============================================================================

import { t, getLocale } from '../i18n/language.js';
import { dataService, subscribeToMatches } from '../services/dataService.js';
import { loadSettings, getTz } from '../lib/settingsCache.js';
import { statusBadge } from '../components/matchCard.js';
import { teamLogo } from '../components/logo.js';
import { escapeHtml, errorPanel, emptyPanel } from '../utils/dom.js';
import { formatKickoff, formatDateTime } from '../utils/dateFormat.js';

export default {
  title: 'page.matchDetails',

  async render(root, params) {
    await loadSettings();

    const paint = (match) => {
      if (!match) {
        root.innerHTML = '';
        root.append(emptyPanel({ icon: '🔍', message: t('matchDetails.empty') }));
        return;
      }
      const home = match.home_team;
      const away = match.away_team;
      const hasScore = match.home_score !== null && match.away_score !== null;
      const winner =
        hasScore && match.status === 'finished'
          ? match.home_score > match.away_score
            ? home?.name
            : match.away_score > match.home_score
              ? away?.name
              : null
          : null;

      root.innerHTML = `
      <nav class="breadcrumbs"><a href="/matches" data-link>← ${t('matchDetails.backToMatches')}</a></nav>
      <article class="match-detail">
        <div class="match-detail-top">
          ${match.round_name ? `<span class="match-round">${escapeHtml(match.round_name)}</span>` : ''}
          ${statusBadge(match.status)}
        </div>
        <div class="scoreboard" dir="ltr">
          <div class="scoreboard-team">
            ${teamLogo(home, 64, 'team-logo team-logo-xl')}
            <span class="scoreboard-name">${escapeHtml(home?.name ?? '—')}</span>
            <span class="scoreboard-short">${escapeHtml(home?.short_name ?? '')}</span>
          </div>
          <div class="scoreboard-center">
            ${
              hasScore
                ? `<span class="scoreboard-score">${match.home_score} – ${match.away_score}</span>`
                : `<span class="scoreboard-time">${formatKickoff(match.kickoff_at, getLocale(), getTz())}</span>`
            }
            ${winner ? `<span class="scoreboard-winner">🏆 ${escapeHtml(winner)}</span>` : ''}
          </div>
          <div class="scoreboard-team">
            ${teamLogo(away, 64, 'team-logo team-logo-xl')}
            <span class="scoreboard-name">${escapeHtml(away?.name ?? '—')}</span>
            <span class="scoreboard-short">${escapeHtml(away?.short_name ?? '')}</span>
          </div>
        </div>
        <dl class="match-info-grid">
          <div><dt>${t('match.kickoff')}</dt><dd>${formatKickoff(match.kickoff_at, getLocale(), window.__tz)}</dd></div>
          <div><dt>${t('match.venue')}</dt><dd>${match.venue ? escapeHtml(match.venue) : '—'}</dd></div>
          <div><dt>${t('match.round')}</dt><dd>${match.round_name ? escapeHtml(match.round_name) : '—'}</dd></div>
          <div><dt>${t('common.updatedAt')}</dt><dd>${formatDateTime(match.updated_at, getLocale(), getTz())}</dd></div>
        </dl>
      </article>`;
    };

    let match;
    try {
      match = await dataService.getMatch(params.id);
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

    paint(match);

    this._unsub = subscribeToMatches(async () => {
      try {
        const fresh = await dataService.getMatch(params.id);
        if (fresh) {
          match = fresh;
          paint(match);
        }
      } catch {
        /* keep current view */
      }
    });
  },

  destroy() {
    this._unsub?.();
  },
};
