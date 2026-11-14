// ============================================================================
// MATCHES PAGE - all fixtures with public filters (all/upcoming/live/
// finished/postponed), grouped by date. Live-refreshes in real time.
// ============================================================================

import { t, getLocale } from '../i18n/language.js';
import { dataService, subscribeToMatches } from '../services/dataService.js';
import { loadSettings } from '../lib/settingsCache.js';
import { matchCard } from '../components/matchCard.js';
import { escapeHtml, errorPanel, emptyPanel, el } from '../utils/dom.js';
import { formatDateLong } from '../utils/dateFormat.js';

const FILTERS = [
  { id: 'all', key: 'matches.filter.all' },
  { id: 'upcoming', key: 'matches.filter.upcoming' },
  { id: 'live', key: 'matches.filter.live' },
  { id: 'finished', key: 'matches.filter.finished' },
  { id: 'postponed', key: 'matches.filter.postponed' },
];

export default {
  title: 'page.matches',

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

    // Page shell + filter chips + list container
    root.innerHTML = `
      <header class="page-header">
        <h1>${t('page.matches')}</h1>
        <p class="page-subtitle">${t('app.name')}</p>
      </header>
      <div class="filter-chips" role="tablist" aria-label="${t('nav.matches')}">
        ${FILTERS.map(
          (f) => `<button class="chip" data-filter="${f.id}" type="button">${t(f.key)}</button>`
        ).join('')}
      </div>
      <div id="matches-list" class="matches-groups"></div>
    `;

    let filter = 'all';
    const listEl = root.querySelector('#matches-list');
    const chipEls = [...root.querySelectorAll('.chip')];

    const paint = () => {
      chipEls.forEach((chip) => chip.classList.toggle('chip-active', chip.dataset.filter === filter));
      listEl.innerHTML = buildList(data.matches, filter);
    };

    chipEls.forEach((chip) =>
      chip.addEventListener('click', () => {
        filter = chip.dataset.filter;
        paint();
      })
    );

    paint();

    // Realtime refresh (keeps the current filter)
    let timer = null;
    this._unsub = subscribeToMatches(() => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          data = await fetchData();
          paint();
        } catch {
          /* keep current content on transient errors */
        }
      }, 250);
    });
  },

  destroy() {
    this._unsub?.();
  },
};

async function fetchData() {
  return { matches: await dataService.listMatches() };
}

function inFilter(match, filter) {
  switch (filter) {
    case 'upcoming':
      return match.status === 'scheduled';
    case 'live':
      return match.status === 'live';
    case 'finished':
      return match.status === 'finished';
    case 'postponed':
      return match.status === 'postponed';
    default:
      return true;
  }
}

function buildList(matches, filter) {
  const filtered = matches.filter((m) => inFilter(m, filter));
  if (!filtered.length) {
    return emptyPanel({
      icon: '📅',
      message: matches.length ? t('matches.empty') : t('matches.emptyAll'),
    });
  }

  // Group by calendar day, then sort each day by kick-off time.
  const groups = new Map();
  for (const match of filtered.sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))) {
    const day = (match.kickoff_at ?? '').slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(match);
  }

  return [...groups.entries()]
    .map(
      ([day, list]) => `
      <section class="match-group">
        <h2 class="match-group-title">${escapeHtml(formatDateLong(`${day}T12:00:00Z`, getLocale(), 'UTC'))}</h2>
        <div class="card-grid">${list.map((m) => matchCard(m)).join('')}</div>
      </section>`
    )
    .join('');
}
