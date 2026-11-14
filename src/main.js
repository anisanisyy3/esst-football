// ============================================================================
// APP ENTRY POINT
// 1. Language + RTL
// 2. Header / footer
// 3. Router
// 4. Auth state wiring
// ============================================================================

import './styles/main.css';
import './styles/responsive.css';
import './styles/rtl.css';

import { initLanguage } from './i18n/language.js';
import { renderHeader, setHeaderAuth, bindDemoReset } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { renderRoute, currentPath } from './router.js';
import * as auth from './services/authService.js';

// --- 1. Language (French by default, remembered in localStorage) ---
initLanguage();

// --- 2. Static shell ---
renderHeader();
renderFooter();
bindDemoReset();

// --- 3. Router (renders the page for the current URL) ---
renderRoute();

// --- 4. Auth + UI reactions ---

/** Refresh the header (login button vs dashboard button). */
async function refreshHeaderAuth() {
  try {
    const session = await auth.getSession();
    setHeaderAuth(session);
  } catch {
    setHeaderAuth(null);
  }
}

// Keep the header in sync with logins, logouts and expired sessions.
auth.onAuthChange(async () => {
  await refreshHeaderAuth();
  const path = currentPath();
  if (path.startsWith('/admin') || path.startsWith('/admin/login')) {
    renderRoute(); // the guard decides what to show
  }
});

// Re-render the page + shell texts when the language changes.
document.addEventListener('app:languagechange', () => {
  renderHeader();
  renderFooter();
  renderRoute();
});

// Highlight the active nav link after each navigation.
document.addEventListener('app:routechange', () => {
  renderHeader();
});

// Initial header auth state (async, updates the header when ready).
refreshHeaderAuth();
