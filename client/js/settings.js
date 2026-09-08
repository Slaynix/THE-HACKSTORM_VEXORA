/**
 * settings.js — Settings page controller.
 *
 * Handles:
 *  - Language preference selection (English, हिंदी, मराठी) with immediate i18n update
 *  - Notification toggle switch (with aria-checked state)
 *  - Family and member information display from localStorage
 *  - Online / Offline connection status monitor with reassuring copy
 *  - Sign out (resets user storage and redirects to landing)
 */

import { setLanguage, t, applyI18n, getLanguage } from './i18n.js';
import { getMockUser, saveMockUser, signOut, signInWithGoogle } from './auth.js';
import { showToast, initOfflineListeners } from './ui-states.js';
import { navigateToLanding } from './router.js';

// ── DOM References ────────────────────────────────────────────────────────────
const familyNameEl     = document.getElementById('settings-family-name');
const memberNameEl     = document.getElementById('settings-member-name');
const emailRowEl       = document.getElementById('settings-email-row');
const emailEl          = document.getElementById('settings-email');
const googleBtnEl      = document.getElementById('settings-google-signin-btn');
const googleBtnTextEl  = document.getElementById('settings-google-btn-text');
const authBadgeEl      = document.getElementById('settings-auth-badge');
const onlineStatusEl   = document.getElementById('settings-online-status');
const statusDotEl      = document.getElementById('settings-status-dot');
const notifToggleEl    = document.getElementById('settings-notif-toggle');
const notifToggleDot   = document.getElementById('settings-notif-dot');
const signOutBtn       = document.getElementById('settings-sign-out-btn');
const langOptions      = document.querySelectorAll('.lang-option');
const reassureCopyEl   = document.getElementById('settings-reassure-copy');

// ── Connection Status ─────────────────────────────────────────────────────────

function updateNetworkStatus() {
  const isOnline = navigator.onLine;
  if (onlineStatusEl) {
    onlineStatusEl.textContent = isOnline ? t('settings.online') : t('settings.offline');
  }
  if (reassureCopyEl) {
    reassureCopyEl.textContent = t('settings.offlineReassure');
  }
  if (statusDotEl) {
    if (isOnline) {
      statusDotEl.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
    } else {
      statusDotEl.className = 'w-2.5 h-2.5 rounded-full bg-gray-400';
    }
  }
}

function refreshUserProfile() {
  const user = getMockUser();
  if (familyNameEl) familyNameEl.textContent = user.familyName || 'Patil';
  if (memberNameEl) memberNameEl.textContent = user.memberName || 'Arun';

  if (user.email) {
    if (emailRowEl) emailRowEl.classList.remove('hidden');
    if (emailEl) emailEl.textContent = user.email;
    if (googleBtnTextEl) googleBtnTextEl.textContent = `Connected as ${user.email.split('@')[0]}`;
    if (authBadgeEl) {
      authBadgeEl.textContent = 'Google Synced';
      authBadgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800';
    }
  } else {
    if (emailRowEl) emailRowEl.classList.add('hidden');
    if (googleBtnTextEl) googleBtnTextEl.textContent = 'Sign In with Google (Firebase)';
    if (authBadgeEl) {
      authBadgeEl.textContent = 'Demo Mode';
      authBadgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800';
    }
  }
}

// ── Initialise Page ───────────────────────────────────────────────────────────

function init() {
  initOfflineListeners();
  applyI18n();
  updateNetworkStatus();

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  // 1. Populate Family & Google Info
  const user = getMockUser();
  refreshUserProfile();

  // Wire Google Sign-in
  if (googleBtnEl) {
    googleBtnEl.addEventListener('click', async () => {
      try {
        googleBtnEl.disabled = true;
        if (googleBtnTextEl) googleBtnTextEl.textContent = 'Signing in with Google...';
        await signInWithGoogle();
        showToast('✓ Signed in with Google via Firebase!', 'success');
        refreshUserProfile();
      } catch (err) {
        showToast(err.message || 'Google Sign-In cancelled', 'error');
        refreshUserProfile();
      } finally {
        googleBtnEl.disabled = false;
      }
    });
  }

  // 2. Setup Language selector
  const currentLang = getLanguage();
  _updateLangRadioStates(currentLang);

  langOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const lang = opt.dataset.lang;
      setLanguage(lang);
      saveMockUser({ ...getMockUser(), language: lang });
      _updateLangRadioStates(lang);
      applyI18n();
      updateNetworkStatus();
      showToast(`Language set to ${opt.textContent.trim()}`, 'success');
    });
  });

  function _updateLangRadioStates(selected) {
    langOptions.forEach(o => {
      const isSelected = o.dataset.lang === selected;
      if (isSelected) {
        o.classList.add('border-emerald-600', 'bg-emerald-50', 'text-emerald-800');
        o.classList.remove('border-gray-200');
        o.setAttribute('aria-checked', 'true');
      } else {
        o.classList.remove('border-emerald-600', 'bg-emerald-50', 'text-emerald-800');
        o.classList.add('border-gray-200');
        o.setAttribute('aria-checked', 'false');
      }
    });
  }

  // 3. Notification toggle
  let notifsEnabled = true;
  if (notifToggleEl) {
    notifToggleEl.addEventListener('click', () => {
      notifsEnabled = !notifsEnabled;
      notifToggleEl.setAttribute('aria-checked', notifsEnabled ? 'true' : 'false');
      if (notifsEnabled) {
        notifToggleEl.className = 'toggle-switch on';
        showToast('Daily reminders enabled 🔔', 'info');
      } else {
        notifToggleEl.className = 'toggle-switch off';
        showToast('Daily reminders paused', 'info');
      }
    });
  }

  // 4. Voice Assistant Mute Toggle
  const muteVoiceToggleEl = document.getElementById('settings-mute-voice-toggle');
  let isVoiceMuted = localStorage.getItem('sanchay_mute_voice') === 'true';
  if (muteVoiceToggleEl) {
    _updateMuteToggleState(isVoiceMuted);
    muteVoiceToggleEl.addEventListener('click', () => {
      isVoiceMuted = !isVoiceMuted;
      localStorage.setItem('sanchay_mute_voice', isVoiceMuted);
      _updateMuteToggleState(isVoiceMuted);
      showToast(isVoiceMuted ? 'Voice Assistant muted 🔇' : 'Voice Assistant unmuted 🔊', 'info');
    });
  }

  function _updateMuteToggleState(muted) {
    if (!muteVoiceToggleEl) return;
    muteVoiceToggleEl.setAttribute('aria-checked', muted ? 'true' : 'false');
    muteVoiceToggleEl.className = muted ? 'toggle-switch on' : 'toggle-switch off';
  }

  // 5. Sign Out
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await signOut();
      showToast('Signed out', 'info');
      setTimeout(() => {
        navigateToLanding();
      }, 300);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);

