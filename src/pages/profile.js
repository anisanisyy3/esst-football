// ============================================================================
// PROFILE - member edits their own allowed profile fields.
// ============================================================================
import { t } from '../i18n/language.js';
import { isDemoMode } from '../lib/supabaseClient.js';
import * as auth from '../services/authService.js';
import { dataService } from '../services/dataService.js';
import { escapeHtml, showToast } from '../utils/dom.js';
import { POSITIONS } from '../utils/positions.js';

const POS_LABEL = { goalkeeper: 'positions.goalkeeper', defender: 'positions.defender', midfielder: 'positions.midfielder', forward: 'positions.forward' };
const FEET = ['right', 'left', 'both'];

export default {
  title: 'page.profile',
  async render(root) {
    const session = await auth.getSession();
    if (!session) { root.innerHTML = `<p>${escapeHtml(t('auth.signInRequired'))}</p><a href="/admin/login" data-link class="btn btn-primary">${t('nav.login')}</a>`; return; }
    const profile = await auth.getProfile();
    root.innerHTML = `
      <section class="page-header"><h1>${escapeHtml(t('profile.title'))}</h1></section>
      <div class="card form-card">
        <form id="pf" class="form-grid">
          <label>${t('profile.fullName')}<input type="text" name="full_name" value="${escapeHtml(profile.full_name || '')}" required /></label>
          <label>${t('profile.birthYear')}<input type="number" name="birth_year" value="${profile.birth_year || ''}" min="1950" max="2020" /></label>
          <label>${t('profile.mainPosition')}<select name="main_position">
            ${POSITIONS.map((p) => `<option value="${p}" ${profile.main_position === p ? 'selected' : ''}>${t(POS_LABEL[p])}</option>`).join('')}
          </select></label>
          <label>${t('profile.secondaryPosition')}<select name="secondary_position">
            <option value="">—</option>
            ${POSITIONS.map((p) => `<option value="${p}" ${profile.secondary_position === p ? 'selected' : ''}>${t(POS_LABEL[p])}</option>`).join('')}
          </select></label>
          <label>${t('profile.preferredFoot')}<select name="preferred_foot">
            ${FEET.map((f) => `<option value="${f}" ${profile.preferred_foot === f ? 'selected' : ''}>${t(`foot.${f}`)}</option>`).join('')}
          </select></label>
          <label>${t('profile.height')}<input type="number" name="height_cm" value="${profile.height_cm || ''}" min="120" max="230" /></label>
          <label>${t('profile.weight')}<input type="number" name="weight_kg" value="${profile.weight_kg || ''}" min="30" max="160" /></label>
          <label>${t('profile.nickname')}<input type="text" name="nickname" value="${escapeHtml(profile.nickname || '')}" /></label>
          <label>${t('profile.photoUrl')}<input type="url" name="photo_url" value="${escapeHtml(profile.photo_url || '')}" /></label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${t('common.save')}</button>
          </div>
        </form>
        <p class="muted">${t('profile.ovr')}: <strong>${profile.ovr ?? 60}</strong> · ${t('profile.role')}: ${escapeHtml(profile.role)}</p>
      </div>`;

    root.querySelector('#pf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await auth.updateProfile({
          full_name: fd.get('full_name'),
          birth_year: fd.get('birth_year') ? Number(fd.get('birth_year')) : null,
          main_position: fd.get('main_position'),
          secondary_position: fd.get('secondary_position') || null,
          preferred_foot: fd.get('preferred_foot'),
          height_cm: fd.get('height_cm') ? Number(fd.get('height_cm')) : null,
          weight_kg: fd.get('weight_kg') ? Number(fd.get('weight_kg')) : null,
          nickname: fd.get('nickname') || null,
          photo_url: fd.get('photo_url') || null,
          profile_complete: true,
        });
        showToast(t('profile.saved'), 'success');
      } catch (err) {
        showToast(t(err.key || 'errors.generic'), 'error');
      }
    });
  },
};
