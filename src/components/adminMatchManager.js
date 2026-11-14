// ============================================================================
// ADMIN - MATCH MANAGEMENT SECTION
// List, create, edit, delete matches with validation and confirmations.
// Used by the admin dashboard (score managers + super admins).
// ============================================================================

import { t, getLocale } from '../i18n/language.js';
import { dataService } from '../services/dataService.js';
import { getTz } from '../lib/settingsCache.js';
import { validateMatch } from '../utils/validation.js';
import { wallTimeToIso, isoToWallInput, formatDateTime, formatKickoff } from '../utils/dateFormat.js';
import { statusBadge } from './matchCard.js';
import { teamLogo } from './logo.js';
import { escapeHtml, showToast, confirmDialog, emptyPanel } from '../utils/dom.js';

export async function renderMatchSection(container, ctx) {
  let matches;
  let teams;
  try {
    [matches, teams] = await Promise.all([dataService.listMatches(), dataService.listTeams()]);
  } catch (err) {
    container.append(
      errorBox(t(err?.key ?? 'errors.loadFailed'), () => ctx.reload())
    );
    return;
  }

  container.innerHTML = `
  <div class="section-toolbar">
    <h2 class="section-title">${t('admin.section.matches')}</h2>
    <button id="match-add" class="btn btn-primary" type="button">+ ${t('admin.matches.add')}</button>
  </div>
  <div id="match-form-slot"></div>
  <div id="match-list"></div>`;

  const listEl = container.querySelector('#match-list');
  const formSlot = container.querySelector('#match-form-slot');
  container
    .querySelector('#match-add')
    .addEventListener('click', () => openForm(null));

  const paintList = () => {
    if (!matches.length) {
      listEl.innerHTML = '';
      listEl.append(emptyPanel({ icon: '📋', message: t('admin.matches.empty') }));
      return;
    }
    const sorted = [...matches].sort((a, b) => b.kickoff_at.localeCompare(a.kickoff_at));
    listEl.innerHTML = sorted.map(matchRow).join('');
    listEl.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openForm(matches.find((m) => m.id === btn.dataset.edit)))
    );
    listEl.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', () => removeMatch(btn.dataset.delete))
    );
  };

  function matchRow(match) {
    const home = match.home_team;
    const away = match.away_team;
    const hasScore = match.home_score !== null && match.away_score !== null;
    return `
    <div class="admin-row">
      <div class="admin-row-main">
        <span class="admin-row-teams">
          ${teamLogo(home, 28, 'team-logo team-logo-xs')}
          <strong>${escapeHtml(home?.name ?? '—')}</strong>
          <span class="admin-score" dir="ltr">${
            hasScore ? `${match.home_score} – ${match.away_score}` : '·'
          }</span>
          <strong>${escapeHtml(away?.name ?? '—')}</strong>
          ${teamLogo(away, 28, 'team-logo team-logo-xs')}
        </span>
        <span class="admin-row-meta">
          ${formatKickoff(match.kickoff_at, getLocale(), getTz())}
          ${match.round_name ? ` · ${escapeHtml(match.round_name)}` : ''}
          ${match.venue ? ` · ${escapeHtml(match.venue)}` : ''}
          · ${t('common.updatedAt')} ${formatDateTime(match.updated_at, getLocale(), getTz())}
        </span>
      </div>
      <div class="admin-row-actions">
        ${statusBadge(match.status)}
        <button class="btn btn-ghost btn-sm" data-edit="${match.id}" type="button">${t('common.edit')}</button>
        ${
          ctx.superAdmin
            ? `<button class="btn btn-danger-ghost btn-sm" data-delete="${match.id}" type="button">${t('common.delete')}</button>`
            : ''
        }
      </div>
    </div>`;
  }

  function teamOptions(selectedId) {
    const options = teams
      .map(
        (team) =>
          `<option value="${team.id}" ${team.id === selectedId ? 'selected' : ''}>${escapeHtml(
            team.name
          )}${team.archived ? ` (${t('admin.teams.archived')})` : ''}</option>`
      )
      .join('');
    return `<option value="">${t('admin.form.selectTeam')}</option>${options}`;
  }

  /** Open the create/edit form (edit when `match` is provided). */
  function openForm(match = null) {
    const isEdit = Boolean(match);
    const status = match?.status ?? 'scheduled';
    const needsScore = status === 'live' || status === 'finished';
    const kickoffWall = match ? isoToWallInput(match.kickoff_at, getTz()) : '';

    formSlot.innerHTML = `
    <form id="match-form" class="panel form-grid" novalidate>
      <h3 class="panel-title">${isEdit ? t('admin.matches.editTitle') : t('admin.matches.newTitle')}</h3>
      <div class="field">
        <label for="f-home">${t('admin.form.homeTeam')}</label>
        <select id="f-home">${teamOptions(match?.home_team_id)}</select>
        <span class="field-error" data-err="teams"></span>
      </div>
      <div class="field">
        <label for="f-away">${t('admin.form.awayTeam')}</label>
        <select id="f-away">${teamOptions(match?.away_team_id)}</select>
      </div>
      <div class="field">
        <label for="f-kickoff">${t('admin.form.kickoff')}</label>
        <input id="f-kickoff" type="datetime-local" value="${kickoffWall}" />
        <span class="field-error" data-err="kickoff_at"></span>
      </div>
      <div class="field">
        <label for="f-status">${t('admin.form.status')}</label>
        <select id="f-status">
          ${['scheduled', 'live', 'finished', 'postponed', 'cancelled']
            .map((s) => `<option value="${s}" ${s === status ? 'selected' : ''}>${t(`status.${s}`)}</option>`)
            .join('')}
        </select>
      </div>
      <div class="field">
        <label for="f-round">${t('admin.form.round')}</label>
        <input id="f-round" type="text" maxlength="40" value="${escapeHtml(match?.round_name ?? '')}" />
      </div>
      <div class="field">
        <label for="f-venue">${t('admin.form.venue')}</label>
        <input id="f-venue" type="text" maxlength="80" value="${escapeHtml(match?.venue ?? '')}" />
      </div>
      <div class="field">
        <label for="f-hscore">${t('admin.form.homeScore')}</label>
        <input id="f-hscore" type="number" min="0" step="1" value="${match?.home_score ?? ''}" ${
          needsScore ? '' : 'disabled'
        } />
      </div>
      <div class="field">
        <label for="f-ascore">${t('admin.form.awayScore')}</label>
        <input id="f-ascore" type="number" min="0" step="1" value="${match?.away_score ?? ''}" ${
          needsScore ? '' : 'disabled'
        } />
        <span class="field-error" data-err="scores"></span>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" type="button" id="f-cancel">${t('common.cancel')}</button>
        <button class="btn btn-primary" type="submit">${t('common.save')}</button>
      </div>
      <div id="form-alert"></div>
    </form>`;

    formSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const form = formSlot.querySelector('#match-form');
    const statusSel = form.querySelector('#f-status');
    const hScore = form.querySelector('#f-hscore');
    const aScore = form.querySelector('#f-ascore');

    // Scores are only editable for live/finished matches.
    const syncScores = () => {
      const needs = statusSel.value === 'live' || statusSel.value === 'finished';
      hScore.disabled = !needs;
      aScore.disabled = !needs;
      if (!needs) {
        hScore.value = '';
        aScore.value = '';
      } else {
        if (hScore.value === '') hScore.value = '0';
        if (aScore.value === '') aScore.value = '0';
      }
    };
    statusSel.addEventListener('change', syncScores);

    form.querySelector('#f-cancel').addEventListener('click', () => {
      formSlot.innerHTML = '';
    });

    let saving = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving) return; // no double submission
      saving = true;
      const submitBtn = form.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      submitBtn.textContent = t('common.saving');
      form.querySelectorAll('.field-error').forEach((n) => (n.textContent = ''));
      form.querySelector('#form-alert').innerHTML = '';

      const wall = form.querySelector('#f-kickoff').value;
      const input = {
        home_team_id: form.querySelector('#f-home').value,
        away_team_id: form.querySelector('#f-away').value,
        kickoff_at: wallTimeToIso(wall, getTz()),
        venue: form.querySelector('#f-venue').value,
        round_name: form.querySelector('#f-round').value,
        status: statusSel.value,
        home_score: hScore.disabled ? null : hScore.value,
        away_score: aScore.disabled ? null : aScore.value,
      };

      const { valid, errors } = validateMatch(input);
      if (!valid) {
        for (const [field, key] of Object.entries(errors)) {
          const errEl = form.querySelector(`[data-err="${field}"]`);
          if (errEl) errEl.textContent = t(key);
          else showToast(t(key), 'error');
        }
        saving = false;
        submitBtn.disabled = false;
        submitBtn.textContent = t('common.save');
        return;
      }

      // Scores only sent when entered (null otherwise).
      const payload = {
        home_team_id: input.home_team_id,
        away_team_id: input.away_team_id,
        kickoff_at: input.kickoff_at,
        venue: input.venue.trim() || null,
        round_name: input.round_name.trim() || null,
        status: input.status,
        home_score: input.home_score === null ? null : Number(input.home_score),
        away_score: input.away_score === null ? null : Number(input.away_score),
      };

      try {
        if (isEdit) {
          await dataService.updateMatch(match.id, payload);
          showToast(t('admin.matches.updated'));
        } else {
          await dataService.createMatch(payload);
          showToast(t('admin.matches.created'));
        }
        formSlot.innerHTML = '';
        await ctx.refresh();
      } catch (err) {
        const alertEl = form.querySelector('#form-alert');
        alertEl.innerHTML = `<div class="alert alert-error">${t(
          err?.key ?? 'errors.saving'
        )}${err?.detail && err.key === 'errors.generic' ? ` <code>${escapeHtml(err.detail)}</code>` : ''}</div>`;
        saving = false;
        submitBtn.disabled = false;
        submitBtn.textContent = t('common.save');
      }
    });
  }

  async function removeMatch(id) {
    const match = matches.find((m) => m.id === id);
    const ok = await confirmDialog({
      title: t('confirm.deleteMatchTitle'),
      message: `${t('confirm.deleteMatchBody')}\n${
        match ? `${match.home_team?.name ?? ''} – ${match.away_team?.name ?? ''}` : ''
      }`,
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    try {
      await dataService.deleteMatch(id);
      showToast(t('admin.matches.deleted'));
      await ctx.refresh();
    } catch (err) {
      showToast(t(err?.key ?? 'errors.generic'), 'error');
    }
  }

  paintList();
}

function errorBox(message, onRetry) {
  const box = document.createElement('div');
  box.className = 'alert alert-error';
  box.textContent = message;
  if (onRetry) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm';
    btn.type = 'button';
    btn.textContent = t('common.retry');
    btn.addEventListener('click', onRetry);
    box.append(btn);
  }
  return box;
}
