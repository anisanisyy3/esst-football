// ============================================================================
// STANDINGS PAGE - the full automatically-calculated league table.
// ============================================================================

import { t } from '../i18n/language.js';
import { dataService, subscribeToMatches } from '../services/dataService.js';
import { loadSettings, getCachedSettings } from '../lib/settingsCache.js';
import { calculateStandings } from '../utils/standings.js';
import { standingsTable } from '../components/standingsTable.js';
import { errorPanel, emptyPanel, escapeHtml } from '../utils/dom.js';

export default {
  title: 'page.standings',

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
      const rows = calculateStandings(teams, matches, getCachedSettings());
      const anyPlayed = rows.some((r) => r.played > 0);
      const settings = getCachedSettings();
      const rules = t('standings.rules', {
        win: settings.points_for_win,
        draw: settings.points_for_draw,
        loss: settings.points_for_loss,
      });

      root.innerHTML = `
      <header class="page-header">
        <h1>${t('page.standings')}</h1>
        <p class="page-subtitle">${escapeHtml(t('standings.note'))}</p>
      </header>
      ${
        anyPlayed
          ? `
          <div class="standings-wrap">${standingsTable(rows)}</div>
          <p class="standings-rules">${rules}</p>`
          : emptyPanel({ icon: '🏆', message: t('standings.empty') })
      }`;
    };

    paint(data);

    this._unsub = subscribeToMatches(async () => {
      try {
        paint(await fetchData());
      } catch {
        /* keep current table */
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
