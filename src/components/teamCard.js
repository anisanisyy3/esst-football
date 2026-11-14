// ============================================================================
// TEAM CARD - directory card with logo (or initials), name and description.
// ============================================================================

import { t, getLocale } from '../i18n/language.js';
import { escapeHtml } from '../utils/dom.js';
import { formatDateLong } from '../utils/dateFormat.js';
import { teamLogo } from './logo.js';

export function teamCard(team, { created = false } = {}) {
  return `
  <a class="team-card" href="/teams/${team.id}" data-link>
    <div class="team-card-head">
      ${teamLogo(team, 56, 'team-logo team-logo-lg')}
      <div>
        <h3 class="team-card-name">${escapeHtml(team.name)}</h3>
        <span class="team-card-short">${escapeHtml(team.short_name ?? '')}</span>
      </div>
    </div>
    ${team.description ? `<p class="team-card-desc">${escapeHtml(team.description)}</p>` : ''}
    ${
      created && team.created_at
        ? `<span class="team-card-created">${t('teams.created')} ${formatDateLong(team.created_at, getLocale(), 'UTC')}</span>`
        : ''
    }
  </a>`;
}
