/**
 * app.js — Application entry point.
 *
 * Responsibilities:
 *  - Init language from localStorage
 *  - Wire offline/online listeners
 *  - Landing page language picker
 *  - Bottom nav active-state management
 *
 * No Firebase dependency in this phase — landing loads directly.
 */

import { t, setLanguage, getLanguage } from './i18n.js';
import { initOfflineListeners } from './ui-states.js';
import { signInWithGoogle } from './auth.js';

// ── Init ──────────────────────────────────────────────────────────────────────

// Offline banner on every page
initOfflineListeners();

// ── Google Sign-In on Landing Page ────────────────────────────────────────────
const googleLoginBtn = document.getElementById('btn-google-login');
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', async () => {
    const textEl = document.getElementById('landing-google-btn-text');
    try {
      googleLoginBtn.disabled = true;
      if (textEl) textEl.textContent = 'Signing in with Google...';
      await signInWithGoogle();
      window.location.href = 'pages/dashboard.html';
    } catch (err) {
      if (textEl) textEl.textContent = 'Sign In with Google';
      googleLoginBtn.disabled = false;
      alert(err.message || 'Google Sign-In was cancelled.');
    }
  });
}

// ── Service Worker Registration ───────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('[SW] Registered with scope:', reg.scope))
      .catch((err) => console.warn('[SW] Registration failed:', err.message));
  });
}

// ── Landing page language picker ──────────────────────────────────────────────

const langPicker = document.getElementById('lang-picker');
if (langPicker) {
  const currentLang = getLanguage();

  // Highlight current language on load
  langPicker.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === currentLang) {
      btn.classList.add('border-green-600', 'bg-green-50', 'text-green-700');
      btn.classList.remove('border-gray-200');
    }
  });

  // Language selection
  langPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;

    const lang = btn.dataset.lang;
    setLanguage(lang);

    // Update visual selection
    langPicker.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.remove('border-green-600', 'bg-green-50', 'text-green-700');
      b.classList.add('border-gray-200');
    });
    btn.classList.add('border-green-600', 'bg-green-50', 'text-green-700');
    btn.classList.remove('border-gray-200');

    // Update landing page text with selected language
    _updateLandingText();
  });
}

function _updateLandingText() {
  const el = (id) => document.getElementById(id);
  if (el('landing-app-name'))   el('landing-app-name').textContent   = t('landing.appName');
  if (el('landing-tagline'))    el('landing-tagline').textContent    = t('landing.tagline');
  if (el('btn-start-saving'))   el('btn-start-saving').textContent   = t('landing.startSaving');
  if (el('btn-login'))          el('btn-login').textContent          = t('landing.login');
  if (el('landing-choose-lang')) el('landing-choose-lang').textContent = t('landing.chooseLanguage');
}

// Apply language on load (in case page was refreshed with hi/mr selected)
if (document.getElementById('landing-app-name')) {
  _updateLandingText();
}

// ── Bottom nav active-state ───────────────────────────────────────────────────

const bottomNav = document.querySelector('.bottom-nav');
if (bottomNav) {
  const currentPath = window.location.pathname;
  bottomNav.querySelectorAll('.bottom-nav-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    // Match by filename
    const page = href.split('/').pop().replace('.html', '');
    if (currentPath.includes(page)) {
      item.classList.add('active');
    }
  });
}
