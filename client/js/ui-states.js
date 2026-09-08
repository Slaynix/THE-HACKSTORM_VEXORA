/**
 * ui-states.js — Shared UI state renderers.
 *
 * Every data-driven screen uses these for consistent:
 *   Loading (skeleton)  |  Empty (CTA)  |  Error (retry)
 *   Offline banner  |  Syncing indicator  |  Toast
 */

import { t } from './i18n.js';

// ── Skeleton Loading ──────────────────────────────────────────────────────────

/**
 * Renders skeleton loading cards into a container.
 * @param {HTMLElement} container
 * @param {number} count  Number of skeleton cards
 */
export function showLoading(container, count = 3) {
  if (!container) return;
  container.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="flex items-center gap-3 mb-3">
        <div class="skeleton skeleton-circle w-10 h-10"></div>
        <div class="flex-1">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text-sm"></div>
        </div>
      </div>
      <div class="skeleton h-2 rounded-full w-full mb-2"></div>
      <div class="flex justify-between">
        <div class="skeleton skeleton-text-sm w-1/3"></div>
        <div class="skeleton skeleton-text-sm w-1/4"></div>
      </div>
    </div>
  `).join('');
}

// ── Empty State ───────────────────────────────────────────────────────────────

/**
 * Renders a friendly empty state with optional CTA.
 * @param {HTMLElement} container
 * @param {{ icon?: string, title?: string, message?: string, ctaText?: string, ctaHref?: string }} opts
 */
export function showEmpty(container, { icon = '📭', title, message, ctaText, ctaHref } = {}) {
  if (!container) return;
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <div class="text-5xl mb-4">${icon}</div>
      <h3 class="text-lg font-semibold text-gray-700 mb-1">${title ?? t('common.noData')}</h3>
      ${message ? `<p class="text-sm text-gray-500 mb-6 max-w-[260px]">${message}</p>` : ''}
      ${ctaText && ctaHref ? `<a href="${ctaHref}" class="btn-primary">${ctaText}</a>` : ''}
    </div>
  `;
}

// ── Error State ───────────────────────────────────────────────────────────────

/**
 * Renders an error state with retry button.
 * @param {HTMLElement} container
 * @param {{ message?: string, retryFn?: Function }} opts
 */
export function showError(container, { message, retryFn } = {}) {
  if (!container) return;
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <div class="text-5xl mb-4">⚠️</div>
      <h3 class="text-lg font-semibold text-gray-700 mb-1">${t('common.error')}</h3>
      <p class="text-sm text-gray-500 mb-6">${message ?? ''}</p>
      <button id="retry-btn" class="btn-primary">${t('common.retry')}</button>
    </div>
  `;
  if (retryFn) {
    container.querySelector('#retry-btn')?.addEventListener('click', retryFn);
  }
}

// ── Offline Banner ────────────────────────────────────────────────────────────

let _offlineBanner = null;

function _ensureOfflineBanner() {
  if (_offlineBanner) return _offlineBanner;
  _offlineBanner = document.createElement('div');
  _offlineBanner.className = 'offline-banner';
  _offlineBanner.setAttribute('role', 'alert');
  _offlineBanner.textContent = t('common.offlineBanner');
  document.body.prepend(_offlineBanner);
  return _offlineBanner;
}

export function showOfflineBanner() {
  const banner = _ensureOfflineBanner();
  banner.textContent = t('common.offlineBanner');
  requestAnimationFrame(() => banner.classList.add('visible'));
}

export function hideOfflineBanner() {
  _offlineBanner?.classList.remove('visible');
}

// ── Syncing Indicator ─────────────────────────────────────────────────────────

let _syncBar = null;

function _ensureSyncBar() {
  if (_syncBar) return _syncBar;
  _syncBar = document.createElement('div');
  _syncBar.className = 'syncing-bar';
  _syncBar.setAttribute('aria-label', t('common.syncing'));
  document.body.prepend(_syncBar);
  return _syncBar;
}

export function showSyncingIndicator() {
  _ensureSyncBar().classList.add('visible');
}

export function hideSyncingIndicator() {
  _syncBar?.classList.remove('visible');
}

// ── Toast / Snackbar ──────────────────────────────────────────────────────────

let _toast = null;
let _toastTimer = null;

function _ensureToast() {
  if (_toast) return _toast;
  _toast = document.createElement('div');
  _toast.className = 'toast';
  _toast.setAttribute('role', 'status');
  document.body.appendChild(_toast);
  return _toast;
}

/**
 * Show a brief toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} durationMs
 */
export function showToast(message, type = 'info', durationMs = 3000) {
  const el = _ensureToast();
  el.textContent = message;
  el.className = 'toast'; // reset
  if (type === 'success') el.classList.add('toast-success');
  if (type === 'error')   el.classList.add('toast-error');

  clearTimeout(_toastTimer);
  requestAnimationFrame(() => {
    el.classList.add('visible');
    _toastTimer = setTimeout(() => el.classList.remove('visible'), durationMs);
  });
}

// ── Connectivity auto-wiring ──────────────────────────────────────────────────

export function initOfflineListeners() {
  window.addEventListener('offline', showOfflineBanner);
  window.addEventListener('online', hideOfflineBanner);
  // Show banner immediately if already offline
  if (!navigator.onLine) showOfflineBanner();
}

// ── Dev-only state cycler (triple-tap header) ─────────────────────────────────

/**
 * Attach a triple-tap handler to the page header for cycling UI states.
 * @param {HTMLElement} trigger  The header element to triple-tap
 * @param {HTMLElement} container  The main content container
 * @param {Function} renderNormal  Function that renders the normal (success) state
 */
export function attachDevStateCycler(trigger, container, renderNormal) {
  if (!trigger || !container) return;

  const states = ['success', 'loading', 'empty', 'error'];
  let currentIdx = 0;
  let tapCount = 0;
  let tapTimer = null;

  trigger.addEventListener('click', () => {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 500);

    if (tapCount >= 3) {
      tapCount = 0;
      currentIdx = (currentIdx + 1) % states.length;
      const state = states[currentIdx];

      switch (state) {
        case 'loading':
          showLoading(container);
          showToast('🔧 DEV: Loading state', 'info', 1500);
          break;
        case 'empty':
          showEmpty(container, { icon: '🎯', title: 'No goals yet', message: 'Tap + New Goal to get started.', ctaText: '+ New Goal', ctaHref: 'create-goal.html' });
          showToast('🔧 DEV: Empty state', 'info', 1500);
          break;
        case 'error':
          showError(container, { message: 'Could not load data.', retryFn: () => { renderNormal(); currentIdx = 0; } });
          showToast('🔧 DEV: Error state', 'info', 1500);
          break;
        default:
          renderNormal();
          showToast('🔧 DEV: Normal state', 'info', 1500);
          currentIdx = 0;
          break;
      }
    }
  });
}
