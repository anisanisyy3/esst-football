// ============================================================================
// LINEUP EDITOR - captain-only (also readable by team members / public when locked).
// ============================================================================
import { t } from '../i18n/language.js';
import * as auth from '../services/authService.js';
import { dataService } from '../services/dataService.js';
import { validateLineupInput, formationSlots, slotDefaultPosition } from '../utils/lineup.js';
import { FORMATIONS } from '../utils/positions.js';
import { escapeHtml, showToast } from '../utils/dom.js';
import { navigate } from '../router.js';

export default {
  title: 'page.lineup',
  async render(root, params) {
    const session = await auth.getSession();
    const me = session ? await auth.getProfile().catch(() => null) : null;
    if (!auth.isMember(me)) {
      root.innerHTML = `<div class="empty-state"><p>${escapeHtml(t('players.membersOnly'))}</p></div>`;
      return;
    }
    const matchId = params.id || params.matchId;
    root.innerHTML = `<div class="loading">${escapeHtml(t('common.loading'))}</div>`;
    let match, membership, team, roster, existing, suspended;
    try {
      match = await dataService.getMatch(matchId);
      membership = await dataService.myMembership();
      if (!membership) { root.innerHTML = `<div class="empty-state"><p>${escapeHtml(t('myTeam.noTeam'))}</p></div>`; return; }
      team = await dataService.getTeam(membership.team_id);
      roster = await dataService.listTeamMemberships(membership.team_id);
      existing = await dataService.getLineup(matchId, membership.team_id);
      suspended = await dataService.suspendedIdsForMatch(matchId);
    } catch (err) {
      root.innerHTML = `<div class="error-state"><p>${escapeHtml(t('errors.generic'))}</p></div>`;
      return;
    }
    const isCaptain = membership.role_in_team === 'captain' || auth.isSuperAdmin(me);
    const locked = !!existing?.is_locked;

    // Build player state from existing or fresh.
    const slotCount = 11;
    let formation = existing?.formation || '4-3-3';
    const players = (existing?.players || []).map((p) => ({
      player_id: p.player_id,
      jersey_number: p.jersey_number,
      match_position: p.match_position,
      is_starter: p.is_starter,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
    }));

    const eligibleIds = roster.map((m) => m.player_id);

    root.innerHTML = `
      <section class="page-header">
        <h1>${escapeHtml(t('lineup.title'))}</h1>
        <p class="page-sub">${escapeHtml(team.name)} · ${escapeHtml(match.home_team?.short_name || match.home_team_id)} vs ${escapeHtml(match.away_team?.short_name || match.away_team_id)} · ${escapeHtml(match.round_name || '')}</p>
      </section>
      ${locked ? `<div class="alert alert-info">${escapeHtml(t('lineup.locked'))}</div>` : ''}
      <div class="card">
        <div class="form-grid">
          <label>${t('lineup.formation')}<select id="formation" ${locked ? 'disabled' : ''}>
            ${Object.keys(FORMATIONS).map((f) => `<option value="${f}" ${f === formation ? 'selected' : ''}>${f}</option>`).join('')}
          </select></label>
        </div>
        <div id="pitch" class="pitch"></div>
      </div>
      <div class="card">
        <h3>${escapeHtml(t('lineup.squad'))}</h3>
        <p class="muted">${escapeHtml(t('lineup.squadHelp'))}</p>
        <div id="squad-list" class="squad-list"></div>
      </div>
      <div class="card">
        <h3>${escapeHtml(t('lineup.selected'))}</h3>
        <div id="selected-list"></div>
        <div class="form-grid">
          <label>${t('lineup.tactics')}<textarea id="tactics" rows="3" ${locked ? 'disabled' : ''} placeholder="${escapeHtml(t('lineup.tacticsHelp'))}">${escapeHtml(existing?.tactics || '')}</textarea></label>
        </div>
        <div class="form-actions">
          ${isCaptain && !locked ? `<button id="save-lineup" class="btn btn-primary" type="button">${t('common.save')}</button>` : ''}
          <a href="/matches/${matchId}" data-link class="btn btn-outline">${t('common.back')}</a>
        </div>
        <div id="validation" class="validation-box"></div>
      </div>`;

    const squadList = root.querySelector('#squad-list');
    const selectedList = root.querySelector('#selected-list');
    const validationBox = root.querySelector('#validation');
    const pitch = root.querySelector('#pitch');

    function renderSquad() {
      squadList.innerHTML = roster.map((m) => {
        const prof = m.player || {};
        const selected = players.find((p) => p.player_id === m.player_id);
        const isSusp = suspended.has(m.player_id);
        return `<div class="squad-row ${selected ? 'selected' : ''} ${isSusp ? 'suspended' : ''}">
          <span class="jersey">${m.jersey_number ?? '—'}</span>
          <span class="squad-name">${escapeHtml(prof.display_name || m.player_id)}</span>
          <span class="badge">${t(`positions.${prof.main_position || 'midfielder'}`)}</span>
          ${isSusp ? `<span class="badge badge-danger">${t('lineup.suspended')}</span>` : ''}
          ${isCaptain && !locked ? (selected
            ? `<button class="btn btn-ghost btn-xs" data-remove="${m.player_id}">${t('common.remove')}</button>`
            : `<button class="btn btn-primary btn-xs" data-add="${m.player_id}" data-pos="${prof.main_position || 'midfielder'}">${t('lineup.add')}</button>`) : ''}
        </div>`;
      }).join('');
      squadList.querySelectorAll('[data-add]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = btn.dataset.add;
          const pos = btn.dataset.pos;
          const isStarter = players.filter((p) => p.is_starter).length < 11;
          // Prefill the jersey with the roster number (captain can still change it).
          const rosterJersey = roster.find((m) => m.player_id === pid)?.jersey_number ?? null;
          players.push({ player_id: pid, jersey_number: rosterJersey, match_position: pos, is_starter: isStarter, is_captain: false, is_vice_captain: false });
          refresh();
        });
      });
      squadList.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = players.findIndex((p) => p.player_id === btn.dataset.remove);
          if (idx >= 0) players.splice(idx, 1);
          refresh();
        });
      });
    }

    function renderSelected() {
      selectedList.innerHTML = players.map((p, i) => {
        const prof = roster.find((r) => r.player_id === p.player_id)?.player || {};
        return `<div class="selected-row">
          <span>${escapeHtml(prof.display_name || p.player_id)}</span>
          <select class="sel-pos" data-i="${i}">
            ${['goalkeeper', 'defender', 'midfielder', 'forward'].map((pos) => `<option value="${pos}" ${p.match_position === pos ? 'selected' : ''}>${t(`positions.${pos}`)}</option>`).join('')}
          </select>
          <label class="chk"><input type="checkbox" class="sel-starter" data-i="${i}" ${p.is_starter ? 'checked' : ''} /> ${t('lineup.starter')}</label>
          <input class="sel-jersey" type="number" min="1" max="99" value="${p.jersey_number ?? ''}" data-i="${i}" placeholder="#" />
          <label class="chk"><input type="checkbox" class="sel-captain" data-i="${i}" ${p.is_captain ? 'checked' : ''} /> C</label>
          <label class="chk"><input type="checkbox" class="sel-vice" data-i="${i}" ${p.is_vice_captain ? 'checked' : ''} /> VC</label>
        </div>`;
      }).join('');
      selectedList.querySelectorAll('.sel-pos').forEach((el) => el.addEventListener('change', (e) => { players[e.target.dataset.i].match_position = e.target.value; validate(); }));
      selectedList.querySelectorAll('.sel-starter').forEach((el) => el.addEventListener('change', (e) => { players[e.target.dataset.i].is_starter = e.target.checked; validate(); }));
      selectedList.querySelectorAll('.sel-jersey').forEach((el) => el.addEventListener('change', (e) => { players[e.target.dataset.i].jersey_number = e.target.value === '' ? null : Number(e.target.value); validate(); }));
      selectedList.querySelectorAll('.sel-captain').forEach((el) => el.addEventListener('change', (e) => {
        const i = e.target.dataset.i;
        players.forEach((p, idx) => { if (idx != i) p.is_captain = false; });
        players[i].is_captain = e.target.checked;
        validate();
        renderSelected();
      }));
      selectedList.querySelectorAll('.sel-vice').forEach((el) => el.addEventListener('change', (e) => { players[e.target.dataset.i].is_vice_captain = e.target.checked; validate(); }));
    }

    function renderPitch() {
      const slots = formationSlots(formation) || [];
      pitch.innerHTML = `<div class="pitch-grid">${slots.map((slot, i) => {
        const starter = players.filter((p) => p.is_starter)[i];
        const prof = starter ? roster.find((r) => r.player_id === starter.player_id)?.player : null;
        return `<div class="pitch-slot" data-slot="${i}">
          <span class="slot-label">${slot}</span>
          ${starter ? `<span class="slot-player">${escapeHtml(prof?.display_name || starter.player_id)}</span>` : `<span class="slot-empty">+</span>`}
        </div>`;
      }).join('')}</div>`;
    }

    function validate() {
      const res = validateLineupInput({
        formation,
        players,
        eligiblePlayerIds: eligibleIds,
        suspendedPlayerIds: [...suspended],
      });
      validationBox.innerHTML = res.valid
        ? `<div class="alert alert-success">${t('lineup.valid')} (${res.checked.starters}+${res.checked.subs})</div>`
        : `<div class="alert alert-error">${res.errors.map((e) => t(e.split(':')[0]) + (e.includes(':') ? ' ' + e.split(':').slice(1).join(':') : '')).join('<br>')}</div>`;
      return res.valid;
    }

    function refresh() {
      renderSquad();
      renderSelected();
      renderPitch();
      validate();
    }

    root.querySelector('#formation')?.addEventListener('change', (e) => { formation = e.target.value; refresh(); });

    root.querySelector('#save-lineup')?.addEventListener('click', async () => {
      if (!validate()) { showToast(t('lineup.invalid'), 'error'); return; }
      const btn = root.querySelector('#save-lineup');
      btn.disabled = true;
      try {
        const captainPlayer = players.find((p) => p.is_captain);
        const vicePlayer = players.find((p) => p.is_vice_captain);
        const tactics = root.querySelector('#tactics')?.value?.trim() || null;
        await dataService.saveLineup({
          matchId, teamId: membership.team_id, formation,
          captainId: captainPlayer?.player_id || null,
          viceCaptainId: vicePlayer?.player_id || null,
          tactics,
          players: players.map((p) => ({
            player_id: p.player_id,
            jersey_number: p.jersey_number,
            match_position: p.match_position,
            is_starter: p.is_starter,
            is_captain: p.is_captain,
            is_vice_captain: p.is_vice_captain,
          })),
        });
        showToast(t('lineup.saved'), 'success');
      } catch (err) {
        showToast(err?.message || t('errors.generic'), 'error');
      } finally {
        btn.disabled = false;
      }
    });

    refresh();
  },
};
