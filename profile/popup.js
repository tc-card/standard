let activePopup = null; // { backdrop, dialog, lastFocused }

export function setPopupTheme(vars) {
  const root = document.documentElement;
  const map = {
    '--popup-bg': vars.bg,
    '--popup-border': vars.border,
    '--popup-text': vars.text,
    '--popup-sub': vars.sub,
    '--popup-item': vars.item,
    '--popup-item-hover': vars.itemHover,
    '--popup-accent': vars.accent,
    '--popup-accent-text': vars.accentText,
    '--popup-blur': `${vars.blur ?? 20}px`,
  };
  for (const [key, val] of Object.entries(map)) {
    if (val == null) root.style.removeProperty(key);
    else root.style.setProperty(key, val);
  }
}

export function closePopup() {
  if (!activePopup) return;
  const { backdrop, dialog, lastFocused } = activePopup;
  activePopup = null;
  backdrop.classList.remove('is-open');
  dialog.classList.remove('is-open');
  document.body.classList.remove('popup-open');
  setTimeout(() => {
    backdrop.remove();
    dialog.remove();
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }, 260);
}

export function showPopup({ content, label = 'Dialog', onMount }) {
  if (activePopup) closePopup();

  const lastFocused = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'popup-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'popup';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', label);
  dialog.innerHTML = `
    <button type="button" class="popup-close" aria-label="Close">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
    <div class="popup-body">${content}</div>
  `;

  dialog.querySelector('.popup-close').addEventListener('click', closePopup);
  backdrop.addEventListener('click', closePopup);

  /* Focus trap: Tab cycles within the popup, Shift+Tab wraps to the end. */
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = dialog.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  document.body.appendChild(backdrop);
  document.body.appendChild(dialog);
  document.body.classList.add('popup-open');

  activePopup = { backdrop, dialog, lastFocused };

  if (onMount) onMount(dialog.querySelector('.popup-body'), dialog);

  /* Defer is-open by one frame so the CSS transitions actually run. */
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    dialog.classList.add('is-open');
    const focusEl =
      dialog.querySelector('.popup-body button, .popup-body a, .popup-body input') ||
      dialog.querySelector('.popup-close');
    if (focusEl) focusEl.focus();
  });

  return dialog;
}

export function showAlert({ icon = 'info', title, text, confirmText = 'OK', onConfirm }) {
  const iconMap = {
    error: 'fa-circle-exclamation is-error',
    success: 'fa-circle-check is-success',
    warning: 'fa-triangle-exclamation is-warning',
    info: 'fa-circle-info',
  };
  const iconClass = iconMap[icon] || iconMap.info;
  const content = `
    <div class="popup-alert">
      <i class="fas ${iconClass} popup-alert-icon" aria-hidden="true"></i>
      ${title ? `<h3 class="popup-alert-title">${escapeHtml(title)}</h3>` : ''}
      ${text ? `<p class="popup-alert-text">${escapeHtml(text)}</p>` : ''}
      <button type="button" class="popup-btn-primary" data-confirm>${escapeHtml(confirmText)}</button>
    </div>`;
  showPopup({
    content,
    label: title || 'Alert',
    onMount: (body) => {
      body.querySelector('[data-confirm]').addEventListener('click', () => {
        if (onConfirm) onConfirm();
        closePopup();
      });
    },
  });
}

const TOAST_ICONS = {
  success: 'fa-circle-check is-success',
  error: 'fa-circle-exclamation is-error',
  warning: 'fa-triangle-exclamation is-warning',
  info: 'fa-circle-info',
};

export function showToast({ icon = 'info', title, text, duration = 2200 }) {
  const toast = document.createElement('div');
  toast.className = 'popup-toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <i class="fas ${TOAST_ICONS[icon] || TOAST_ICONS.info} popup-toast-icon" aria-hidden="true"></i>
    <div class="popup-toast-body">
      ${title ? `<div class="popup-toast-title">${escapeHtml(title)}</div>` : ''}
      ${text ? `<div class="popup-toast-text">${escapeHtml(text)}</div>` : ''}
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-open'));

  const dismiss = () => {
    if (!toast.isConnected) return;
    toast.classList.remove('is-open');
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 200);
  };
  const timer = setTimeout(dismiss, duration);

  /* Swipe-up to dismiss on touch devices. Preserves the horizontal
     translate on phones (the toast is centered via translate(-50%, 0)). */
  let startY = 0;
  let deltaY = 0;
  toast.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    deltaY = 0;
  }, { passive: true });
  toast.addEventListener('touchmove', (e) => {
    deltaY = e.touches[0].clientY - startY;
    if (deltaY < 0) {
      const isMobile = window.matchMedia('(max-width: 640px)').matches;
      toast.style.transform = isMobile
        ? `translate(-50%, ${deltaY}px)`
        : `translateY(${deltaY}px)`;
      toast.style.opacity = String(Math.max(0, 1 + deltaY / 100));
    }
  }, { passive: true });
  toast.addEventListener('touchend', () => {
    if (deltaY < -40) {
      clearTimeout(timer);
      dismiss();
    } else {
      toast.style.transform = '';
      toast.style.opacity = '';
    }
  });

  return toast;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activePopup) {
    e.preventDefault();
    closePopup();
  }
});

function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  if (typeof unsafe !== 'string') return String(unsafe);
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}