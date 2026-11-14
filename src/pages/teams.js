// ============================================================================
// TEAMS PAGE - public directory of registered teams.
// ============================================================================

import { t } from '../i18n/language.js';
import { dataService } from '../services/dataService.js';
import { teamCard } from '../components/teamCard.js';
import { errorPanel, emptyPanel } from '../utils/dom.js';

export default {
  title: 'page.teams',

  async render(root) {
    let teams;
    try {
      teams = await dataService.listTeams();
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

    // Archived teams never appear on the public site.
    const visible = (teams ?? []).filter((team) => !team.archived);

    const grid = visible.length
      ? visible.map((team) => teamCard(team, { created: true })).join('')
      : emptyPanel({ icon: '👕', message: t('teams.empty') });

    root.innerHTML = `
    <header class="page-header">
      <h1>${t('page.teams')}</h1>
      <p class="page-subtitle">${
        visible.length ? `${t('app.tagline')} · ${visible.length}` : t('app.tagline')
      }</p>
    </header>
    <div class="card-grid teams-grid">${grid}</div>`;
  },

  destroy() {},
};
