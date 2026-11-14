// ============================================================================
// SMALL DOM HELPERS shared by every page/component.
// ============================================================================

/** querySelector shortcut. */
export function qs(selector, root = document) {
  return root.querySelector(selector);
}

/** Escape user-entered text before inserting it into HTML. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Friendly DOM node builder: el('div', { class: 'x' }, child1, child2). */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function')
      node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Show a toast notification (auto-dismissed). */
export function showToast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const toast = el('div', { class: `toast toast-${type}` }, message);
  root.append(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3600);
}

/**
 * Confirmation modal for destructive actions.
 * Resolves true only when the confirm button is pressed.
 * Pass translated labels: { title, message, confirmLabel, cancelLabel }.
 */
export function confirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  extraHtml = '',
  requireCheckbox = null,
}) {
  return new Promise((resolve) => {
    const backdrop = el('div', { class: 'modal-backdrop' });
    const dialog = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
    dialog.append(el('h3', { class: 'modal-title' }, title));
    if (message) dialog.append(el('p', { class: 'modal-message' }, message));
    if (extraHtml) {
      const extra = el('div', { class: 'modal-extra' });
      extra.innerHTML = extraHtml;
      dialog.append(extra);
    }
    const buttons = el('div', { class: 'modal-buttons' });
    const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, cancelLabel ?? 'Cancel');
    const okBtn = el('button', { class: 'btn btn-danger', type: 'button' }, confirmLabel ?? 'Confirm');
    buttons.append(cancelBtn, okBtn);
    dialog.append(buttons);
    backdrop.append(dialog);
    document.body.append(backdrop);

    const close = (result) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
    };
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
    });
    okBtn.addEventListener('click', () => {
      if (requireCheckbox) {
        const box = dialog.querySelector(requireCheckbox);
        if (box && !box.checked) {
          okBtn.classList.add('shake');
          setTimeout(() => okBtn.classList.remove('shake'), 400);
          return; // confirmation not given yet
        }
      }
      close(true);
    });
    cancelBtn.addEventListener('click', () => close(false));
    okBtn.focus();
  });
}

/** Render a standard error panel with a retry button. */
export function errorPanel({ message, retryLabel, onRetry }) {
  const wrap = el('div', { class: 'empty-state error-state' });
  wrap.innerHTML = `
    <div class="empty-icon">⚠️</div>
    <p class="empty-title"></p>
  `;
  wrap.querySelector('.empty-title').textContent = message;
  if (onRetry) {
    const btn = el('button', { class: 'btn btn-primary', type: 'button' }, retryLabel ?? 'Retry');
    btn.addEventListener('click', onRetry);
    wrap.append(btn);
  }
  return wrap;
}

/** Render a standard empty-state panel. */
export function emptyPanel({ icon = '📭', message }) {
  const wrap = el('div', { class: 'empty-state' });
  const iconEl = el('div', { class: 'empty-icon' }, icon);
  const textEl = el('p', { class: 'empty-title' }, message);
  wrap.append(iconEl, textEl);
  return wrap;
}
