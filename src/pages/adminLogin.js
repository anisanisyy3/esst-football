// ============================================================================
// ADMIN LOGIN - Supabase email/password (no public sign-up).
// In demo mode the page offers clearly-labeled demo role buttons instead.
// ============================================================================

import { t } from '../i18n/language.js';
import { isDemoMode } from '../lib/supabaseClient.js';
import * as auth from '../services/authService.js';
import { demoService } from '../services/demoService.js';
import { navigate } from '../router.js';
import { el, showToast } from '../utils/dom.js';
import { tournamentMark } from '../components/logo.js';

export default {
  title: 'page.adminLogin',

  async render(root) {
    // Already signed in? Go straight to the dashboard.
    const existing = await auth.getSession();
    if (existing) {
      navigate('/admin', { replace: true });
      return;
    }

    root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-logo">${tournamentMark(56)}</div>
        <h1>${t('page.adminLogin')}</h1>
        <p class="auth-note">${t('auth.inviteNote')}</p>
        <div id="auth-alert"></div>
        <div id="auth-body"></div>
      </div>
    </div>`;

    const alertEl = root.querySelector('#auth-alert');
    const body = root.querySelector('#auth-body');

    const showAlert = (message, type = 'error') => {
      alertEl.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
    };

    if (isDemoMode) {
      // ------------------------- DEMO MODE -------------------------
      const note = el('div', { class: 'alert alert-info' }, t('demo.authNotice'));
      const btnSuper = el(
        'button',
        {
          class: 'btn btn-primary btn-block',
          type: 'button',
        },
        t('demo.enterAsSuper')
      );
      const btnManager = el(
        'button',
        {
          class: 'btn btn-outline btn-block',
          type: 'button',
        },
        t('demo.enterAsManager')
      );
      const btnCaptain = el(
        'button',
        {
          class: 'btn btn-outline btn-block',
          type: 'button',
        },
        t('demo.enterAsCaptain')
      );
      const btnMember = el(
        'button',
        {
          class: 'btn btn-ghost btn-block',
          type: 'button',
        },
        t('demo.enterAsMember')
      );
      btnSuper.addEventListener('click', () => enterDemo('super_admin'));
      btnManager.addEventListener('click', () => enterDemo('score_manager'));
      btnCaptain.addEventListener('click', () => enterDemo('captain'));
      btnMember.addEventListener('click', () => enterDemo('member'));
      body.append(note, btnSuper, btnManager, btnCaptain, btnMember);
      return;
    }

    // ------------------------ REAL SUPABASE ------------------------
    // Notice banners (session expired / permission denied redirects).
    const notice = sessionStorage.getItem('esst_auth_notice');
    if (notice === 'expired') showAlert(t('auth.sessionExpired'), 'info');
    if (notice === 'denied') showAlert(t('auth.permissionDenied'), 'error');
    sessionStorage.removeItem('esst_auth_notice');

    const form = el('form', { class: 'auth-form', novalidate: true });
    form.innerHTML = `
      <div class="field">
        <label for="login-email">${t('auth.email')}</label>
        <input id="login-email" name="email" type="email" autocomplete="username" required />
      </div>
      <div class="field">
        <label for="login-password">${t('auth.password')}</label>
        <input id="login-password" name="password" type="password" autocomplete="current-password" required />
      </div>
      <button class="btn btn-primary btn-block" type="submit">${t('auth.signIn')}</button>`;
    const submitBtn = form.querySelector('button[type=submit]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = form.querySelector('#login-email').value;
      const password = form.querySelector('#login-password').value;
      submitBtn.disabled = true; // no double submission
      submitBtn.textContent = t('auth.signingIn');
      alertEl.innerHTML = '';
      try {
        const { profile } = await auth.login(email, password);
        // Pending accounts land on the dashboard, which explains the status.
        void profile?.role;
        navigate('/admin', { replace: true });
      } catch (err) {
        showAlert(t(err?.key ?? 'auth.error'));
        submitBtn.disabled = false;
        submitBtn.textContent = t('auth.signIn');
      }
    });
    body.append(form);
  },

  destroy() {},
};

async function enterDemo(role) {
  try {
    demoService.loginDemo(role);
    navigate('/admin', { replace: true });
  } catch (err) {
    showToast(t('errors.generic'), 'error');
  }
}
