// ============================================================================
// STANDINGS TABLE - full league table or a compact preview (home page).
// ============================================================================

import { t } from '../i18n/language.js';
import { escapeHtml } from '../utils/dom.js';
import { teamLogo } from './logo.js';

/**
 * @param {Array} rows result of calculateStandings()
 * @param {{limit?: number, compact?: boolean}} options
 */
export function standingsTable(rows, { limit = 0, compact = false } = {}) {
  const list = limit > 0 ? rows.slice(0, limit) : rows;

  const head = `
    <thead>
      <tr>
        <th class="col-pos" scope="col" title="${t('standings.position')}">#</th>
        <th class="col-team" scope="col">${t('standings.team')}</th>
        <th scope="col" title="${t('standings.playedFull')}">${t('standings.played')}</th>
        <th scope="col" title="${t('standings.winsFull')}">${t('standings.wins')}</th>
        <th scope="col" title="${t('standings.drawsFull')}">${t('standings.draws')}</th>
        <th scope="col" title="${t('standings.lossesFull')}">${t('standings.losses')}</th>
        ${compact ? '' : `<th scope="col" title="${t('standings.goalsForFull')}">${t('standings.goalsFor')}</th>`}
        ${compact ? '' : `<th scope="col" title="${t('standings.goalsAgainstFull')}">${t('standings.goalsAgainst')}</th>`}
        <th scope="col" title="${t('standings.goalDiffFull')}">${t('standings.goalDiff')}</th>
        <th class="col-pts" scope="col" title="${t('standings.pointsFull')}">${t('standings.points')}</th>
      </tr>
    </thead>`;

  const body = list
    .map((row) => {
      const gd = row.goal_diff > 0 ? `+${row.goal_diff}` : String(row.goal_diff);
      return `
      <tr>
        <td class="col-pos"><span class="pos-chip pos-${row.position <= 2 ? 'top' : ''}">${row.position}</span></td>
        <td class="col-team">
          <span class="team-cell">
            ${teamLogo(row, 26, 'team-logo team-logo-xs')}
            <span class="team-cell-name">${escapeHtml(row.name)}</span>
            <span class="team-cell-short">${escapeHtml(row.short_name ?? '')}</span>
          </span>
        </td>
        <td>${row.played}</td>
        <td>${row.won}</td>
        <td>${row.drawn}</td>
        <td>${row.lost}</td>
        ${compact ? '' : `<td>${row.goals_for}</td>`}
        ${compact ? '' : `<td>${row.goals_against}</td>`}
        <td class="col-gd">${gd}</td>
        <td class="col-pts"><strong>${row.points}</strong></td>
      </tr>`;
    })
    .join('');

  return `
  <div class="table-scroll">
    <table class="standings-table ${compact ? 'standings-compact' : ''}">
      <caption class="visually-hidden">${t('page.standings')}</caption>
      ${head}
      <tbody>${body}</tbody>
    </table>
  </div>`;
}
