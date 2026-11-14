// ============================================================================
// ADMIN - TEAM MANAGEMENT SECTION (super admin only, enforced by RLS too)
// Create, edit, archive/restore, and delete teams with confirmations.
// ============================================================================

import { t, getLocale } from '../i18n/language.js';
import { dataService } from '../services/dataService.js';
import { validateTeam } from '../utils/validation.js';
import { formatDateLong } from '../utils/dateFormat.js';
import { teamLogo } from './logo.js';
import { escapeHtml, showToast, confirmDialog, emptyPanel, errorPanel } from '../utils/dom.js';

export async function renderTeamSection(container, ctx) {
  let teams;
  let matches;
  try {
    [teams, matches] = await Promise.all([dataService.listTeams(), dataService.listMatches()]);
  } catch (err) {
    container.innerHTML = '';
    container.append(
      errorPanel({
        message: t(err?.key ?? 'errors.loadFailed'),
        retryLabel: t('common.retry'),
        onRetry: () => ctx.refresh(),
      })
    );
    return;
  }

  const matchCount = (teamId) =>
    matches.filter((m) => m.home_team_id === teamId || m.away_team_id === teamId).length;

  container.innerHTML = `
  <div class="section-toolbar">
    <h2 class="section-title">${t('admin.section.teams')}</h2>
    <button id="team-add" class="btn btn-primary" type="button">+ ${t('admin.teams.add')}</button>
  </div>
  <div id="team-form-slot"></div>
  <div id="team-list" class="admin-team-list"></div>`;

  const listEl = container.querySelector('#team-list');
  const formSlot = container.querySelector('#team-form-slot');
  container
    .querySelector('#team-add')
    .addEventListener('click', () => openForm(null));

  const paintList = () => {
    if (!teams.length) {
      listEl.innerHTML = '';
      listEl.append(emptyPanel({ icon: '👕', message: t('admin.teams.empty') }));
      return;
    }
    listEl.innerHTML = teams.map(teamRow).join('');
    listEl.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openForm(teams.find((tm) => tm.id === btn.dataset.edit)))
    );
    listEl.querySelectorAll('[data-archive]').forEach((btn) =>
      btn.addEventListener('click', () => toggleArchive(btn.dataset.archive))
    );
    listEl.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', () => removeTeam(btn.dataset.delete))
    );
  };

  function teamRow(team) {
    const count = matchCount(team.id);
    return `
    <div class="admin-row${team.archived ? ' admin-row-muted' : ''}">
      <div class="admin-row-main">
        <span class="admin-row-teams">
          ${teamLogo(team, 30, 'team-logo team-logo-xs')}
          <strong>${escapeHtml(team.name)}</strong>
          <span class="tag">${escapeHtml(team.short_name ?? '')}</span>
          ${team.archived ? `<span class="badge badge-archived">${t('admin.teams.archived')}</span>` : ''}
        </span>
        <span class="admin-row-meta">
          ${t('admin.teams.matchesCount', { count })} · ${t('teams.created')} ${formatDateLong(
            team.created_at,
            getLocale(),
            'UTC'
          )}
        </span>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${team.id}" type="button">${t('common.edit')}</button>
        <button class="btn btn-ghost btn-sm" data-archive="${team.id}" type="button">
          ${team.archived ? t('admin.teams.restore') : t('admin.teams.archive')}
        </button>
        <button class="btn btn-danger-ghost btn-sm" data-delete="${team.id}" type="button">${t('common.delete')}</button>
      </div>
    </div>`;
  }

  function openForm(team = null) {
    formSlot.innerHTML = `
    <form id="team-form" class="panel form-grid" novalidate>
      <h3 class="panel-title">${team ? t('admin.teams.editTitle') : t('admin.teams.newTitle')}</h3>
      <div class="field">
        <label for="tf-name">${t('admin.form.teamName')}</label>
        <input id="tf-name" type="text" maxlength="60" value="${escapeHtml(team?.name ?? '')}" />
        <span class="field-error" data-err="name"></span>
      </div>
      <div class="field">
        <label for="tf-short">${t('admin.form.shortName')}</label>
        <input id="tf-short" type="text" maxlength="6" value="${escapeHtml(team?.short_name ?? '')}" />
        <span class="field-error" data-err="short_name"></span>
      </div>
      <div class="field">
        <label for="tf-logo">${t('admin.form.logoUrl')}</label>
        <input id="tf-logo" type="url" placeholder="https://…" value="${escapeHtml(team?.logo_url ?? '')}" />
        <span class="field-error" data-err="logo_url"></span>
      </div>
      <div class="field field-wide">
        <label for="tf-desc">${t('admin.form.description')}</label>
        <textarea id="tf-desc" rows="2" maxlength="300">${escapeHtml(team?.description ?? '')}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" type="button" id="tf-cancel">${t('common.cancel')}</button>
        <button class="btn btn-primary" type="submit">${t('common.save')}</button>
      </div>
      <div id="tf-alert"></div>
    </form>`;
    formSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const form = formSlot.querySelector('#team-form');
    form.querySelector('#tf-cancel').addEventListener('click', () => (formSlot.innerHTML = ''));

    let saving = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving) return;
      saving = true;
      const submitBtn = form.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      submitBtn.textContent = t('common.saving');
      form.querySelectorAll('.field-error').forEach((n) => (n.textContent = ''));
      form.querySelector('#tf-alert').innerHTML = '';

      const input = {
        name: form.querySelector('#tf-name').value,
        short_name: form.querySelector('#tf-short').value,
        logo_url: form.querySelector('#tf-logo').value,
        description: form.querySelector('#tf-desc').value,
      };
      const { valid, errors } = validateTeam(input);
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

      const payload = {
        name: input.name.trim(),
        short_name: input.short_name.trim(),
        logo_url: input.logo_url.trim() || null,
        description: input.description.trim() || null,
      };
      try {
        if (team) {
          await dataService.updateTeam(team.id, payload);
          showToast(t('admin.teams.updated'));
        } else {
          await dataService.createTeam(payload);
          showToast(t('admin.teams.created'));
        }
        formSlot.innerHTML = '';
        await ctx.refresh();
      } catch (err) {
        const alertEl = form.querySelector('#tf-alert');
        alertEl.innerHTML = `<div class="alert alert-error">${t(err?.key ?? 'errors.saving')}</div>`;
        saving = false;
        submitBtn.disabled = false;
        submitBtn.textContent = t('common.save');
      }
    });
  }

  async function toggleArchive(id) {
    const team = teams.find((tm) => tm.id === id);
    try {
      await dataService.updateTeam(id, { archived: !team?.archived });
      showToast(team?.archived ? t('admin.teams.restore') : t('admin.teams.archive'));
      await ctx.refresh();
    } catch (err) {
      showToast(t(err?.key ?? 'errors.generic'), 'error');
    }
  }

  async function removeTeam(id) {
    const team = teams.find((tm) => tm.id === id);
    const count = matchCount(id);
    const ok = await confirmDialog({
      title: t('common.delete'),
      message: count > 0 ? t('admin.teams.deleteWarning', { count }) : t('admin.teams.deleteSimple'),
      extraHtml:
        count > 0
          ? `<label class="check-line"><input type="checkbox" id="tf-confirm-delete"> ${t(
              'admin.teams.confirmDelete'
            )}</label>`
          : '',
      requireCheckbox: count > 0 ? '#tf-confirm-delete' : null,
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    try {
      await dataService.deleteTeam(id);
      showToast(t('admin.teams.deleted'));
      await ctx.refresh();
    } catch (err) {
      showToast(t(err?.key ?? 'errors.generic'), 'error');
    }
  }

  paintList();
}
