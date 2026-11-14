// ============================================================================
// MATCH CARD - the visual scoreboard used on home, matches, team pages.
// ============================================================================

import { t, getLocale } from '../i18n/language.js';
import { formatKickoff, formatTime, relativeDay } from '../utils/dateFormat.js';
import { escapeHtml } from '../utils/dom.js';
import { teamLogo } from './logo.js';
import { getTz } from '../lib/settingsCache.js';

export function statusBadge(status, extraClass = '') {
  return `<span class="badge badge-${status} ${extraClass}">
    ${status === 'live' ? '<span class="live-dot" aria-hidden="true"></span>' : ''}
    ${t(`status.${status}`)}
  </span>`;
}

export function scoreOrTime(match, { compact = false } = {}) {
  if (match.status === 'live' || match.status === 'finished') {
    const hasScore = match.home_score !== null && match.away_score !== null;
    return `<span class="score${compact ? ' score-sm' : ''}" dir="ltr">${
      hasScore ? `${match.home_score} – ${match.away_score}` : '– : –'
    }</span>`;
  }
  if (match.status === 'scheduled' || match.status === 'postponed') {
    const { labelKey, time } = relativeDay(match.kickoff_at, getLocale(), getTz());
    if (labelKey) {
      return `<span class="match-when">${t(labelKey)} · ${time}</span>`;
    }
    return `<span class="match-when">${formatTime(match.kickoff_at, getLocale(), getTz())}</span>`;
  }
  return `<span class="match-when">—</span>`;
}

/** One match card (whole card links to the match details page). */
export function matchCard(match, { showVenue = true, showRound = true } = {}) {
  const home = match.home_team;
  const away = match.away_team;
  const homeName = home?.name ?? '—';
  const awayName = away?.name ?? '—';
  return `
  <article class="match-card${match.status === 'live' ? ' match-live' : ''}">
    <div class="match-card-top">
      ${
        showRound && match.round_name
          ? `<span class="match-round">${escapeHtml(match.round_name)}</span>`
          : '<span></span>'
      }
      ${statusBadge(match.status)}
    </div>
    <a class="match-card-body" href="/matches/${match.id}" data-link
       aria-label="${escapeHtml(homeName)} ${t('match.vs')} ${escapeHtml(awayName)}">
      <div class="match-side">
        ${teamLogo(home, 36, 'team-logo team-logo-sm')}
        <span class="match-team-name">${escapeHtml(homeName)}</span>
      </div>
      <div class="match-middle">
        ${scoreOrTime(match)}
      </div>
      <div class="match-side match-side-right">
        <span class="match-team-name">${escapeHtml(awayName)}</span>
        ${teamLogo(away, 36, 'team-logo team-logo-sm')}
      </div>
    </a>
    <div class="match-card-foot">
      <span>${formatKickoff(match.kickoff_at, getLocale(), getTz())}</span>
      ${showVenue && match.venue ? `<span>📍 ${escapeHtml(match.venue)}</span>` : ''}
    </div>
  </article>`;
}
