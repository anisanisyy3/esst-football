// ============================================================================
// REGISTER - public member sign-up + mandatory profile completion.
// ============================================================================
import { t } from '../i18n/language.js';
import { isDemoMode } from '../lib/supabaseClient.js';
import * as auth from '../services/authService.js';
import { dataService } from '../services/dataService.js';
import { navigate } from '../router.js';
import { el, showToast, escapeHtml } from '../utils/dom.js';
import { POSITIONS } from '../utils/positions.js';

const POS_LABEL = { goalkeeper: 'positions.goalkeeper', defender: 'positions.defender', midfielder: 'positions.midfielder', forward: 'positions.forward' };
const FEET = ['right', 'left', 'both'];

export default {
  title: 'page.register',
  async render(root) {
    root.innerHTML = `
      <section class="page-header"><h1>${escapeHtml(t('auth.registerTitle'))}</h1><p class="page-sub">${escapeHtml(t('auth.registerSubtitle'))}</p></section>
      <div class="card form-card">
        <form id="reg-form" class="form-grid">
          <label>${t('auth.email')}<input type="email" name="email" required /></label>
          <label>${t('auth.password')}<input type="password" name="password" required minlength="6" /></label>
          <label>${t('profile.fullName')}<input type="text" name="full_name" required /></label>
          <label>${t('profile.birthYear')}<input type="number" name="birth_year" min="1950" max="2020" required /></label>
          <label>${t('profile.mainPosition')}<select name="main_position" required>
            ${POSITIONS.map((p) => `<option value="${p}">${t(POS_LABEL[p])}</option>`).join('')}
          </select></label>
          <label>${t('profile.preferredFoot')}<select name="preferred_foot" required>
            ${FEET.map((f) => `<option value="${f}">${t(`foot.${f}`)}</option>`).join('')}
          </select></label>
          <label>${t('profile.nickname')}<input type="text" name="nickname" /></label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${t('auth.register')}</button>
          </div>
        </form>
        <p class="form-hint">${escapeHtml(t('auth.haveAccount'))} <a href="/admin/login" data-link>${t('nav.login')}</a></p>
      </div>`;

    root.querySelector('#reg-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const data = await auth.signUp({
          email: fd.get('email'),
          password: fd.get('password'),
          displayName: fd.get('full_name'),
        });
        await auth.updateProfile({
          full_name: fd.get('full_name'),
          birth_year: Number(fd.get('birth_year')),
          main_position: fd.get('main_position'),
          preferred_foot: fd.get('preferred_foot'),
          nickname: fd.get('nickname') || null,
          profile_complete: true,
        });
        showToast(t('auth.registerSuccess'), 'success');
        navigate('/profile');
      } catch (err) {
        showToast(t(err.key || 'errors.generic'), 'error');
      }
    });
  },
};
