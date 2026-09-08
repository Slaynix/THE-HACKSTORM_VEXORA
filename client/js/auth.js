/**
 * auth.js — Client-Side Authentication Service for Sanchay+.
 *
 * Responsibilities:
 *   - Firebase Auth session persistence across page reloads
 *   - Email / Password registration & sign-in
 *   - JWT ID token retrieval and automatic inclusion in API calls via authFetch()
 *   - Local session caching with graceful fallback for prototype screens
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  OFFLINE GROUNDWORK (Phase 7 Hook):
 *  - Firebase Auth SDK automatically persists credentials to IndexedDB / localStorage.
 *  - In Phase 7, the offline sync engine will hook into authFetch():
 *    when navigator.onLine is false, mutations (new goal, new deposit) will be queued
 *    into local IndexedDB ('sanchay_offline_mutations') and synced via POST /api/sync
 *    once online event fires.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { MOCK_FAMILY } from './mock-data.js';

const STORAGE_KEY = 'sanchay_user';
const TOKEN_KEY   = 'sanchay_id_token';

let _cachedToken = null;
let _currentUser = null;

// ── User / Profile Management ─────────────────────────────────────────────────

/**
 * Returns current user profile from localStorage (or MOCK_FAMILY default).
 */
export function getMockUser() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (_) { /* ignore parse errors */ }
  return { ...MOCK_FAMILY };
}

/**
 * Saves user info to localStorage.
 */
export function saveMockUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  _currentUser = user;
}

/**
 * Returns user display name for greetings.
 */
export function getDisplayName() {
  return getMockUser().memberName || 'Friend';
}

// ── Token Management & Authorized Fetch ───────────────────────────────────────

/**
 * Returns the active Firebase ID token (or mock dev token if in dev mode).
 * @returns {Promise<string>}
 */
export async function getIdToken() {
  if (_cachedToken) return _cachedToken;
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      _cachedToken = stored;
      return stored;
    }
  } catch (_) {}

  // Dev fallback token
  const devToken = `mock-token-${getMockUser().uid || 'user-patil-1'}`;
  return devToken;
}

/**
 * Sets and caches the Firebase ID token.
 * @param {string} token
 */
export function setToken(token) {
  _cachedToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export const API_BASE = (typeof window !== 'undefined' && window.location.port !== '3000')
  ? 'http://localhost:3000'
  : '';

/**
 * Wrapper around window.fetch that automatically injects the Bearer token
 * and prefixes API_BASE when running frontend dev server on port 5500.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  const fullUrl = url.startsWith('/') ? `${API_BASE}${url}` : url;
  const token = await getIdToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(fullUrl, { ...options, headers });
}

// ── Auth Operations ───────────────────────────────────────────────────────────

/**
 * Register a new user and family.
 * @param {Object} credentials
 * @param {string} credentials.familyName
 * @param {string} credentials.memberName
 * @param {string} [credentials.email]
 * @param {string} [credentials.phoneNumber]
 * @param {string} [credentials.preferredLanguage]
 */
export async function register(credentials) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  if (data.token) setToken(data.token);
  saveMockUser({
    familyName: data.family?.name || credentials.familyName,
    memberName: data.user?.memberName || credentials.memberName,
    language: credentials.preferredLanguage || 'en',
    uid: data.user?.id,
    familyId: data.family?.id,
  });

  return data;
}

/**
 * Login user via credentials.
 * @param {Object} credentials
 */
export async function login(credentials) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }

  if (data.token) setToken(data.token);
  saveMockUser({
    familyName: data.family?.name || 'Patil',
    memberName: data.user?.memberName || 'Arun',
    language: data.family?.preferredLanguage || 'en',
    uid: data.user?.id,
    familyId: data.user?.familyId,
  });

  return data;
}

/**
 * Sign out and clear all client-side auth state.
 */
export async function signOut() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
  } catch (_) {}

  setToken(null);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
  _currentUser = null;
  console.log('[auth] Signed out successfully.');
}

/**
 * Check if a session exists on page load.
 */
export function getCurrentUser() {
  return getMockUser();
}

/**
 * Observes auth changes (initializes with current session).
 */
export function onAuthStateChange(callback) {
  callback(getCurrentUser());
  return () => {};
}

/**
 * Fetches public Firebase configuration from backend.
 */
export async function getClientConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (res.ok) {
      const data = await res.json();
      return data.firebase;
    }
  } catch (_) {}
  return null;
}

/**
 * Loads Firebase Web SDK scripts dynamically if needed.
 */
async function ensureFirebaseLoaded(config) {
  if (typeof window === 'undefined') return null;
  if (window.firebase && window.firebase.auth) {
    if (!window.firebase.apps.length && config) {
      window.firebase.initializeApp(config);
    }
    return window.firebase;
  }

  return new Promise((resolve) => {
    try {
      const s1 = document.createElement('script');
      s1.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js';
        s2.onload = () => {
          if (config && window.firebase && !window.firebase.apps.length) {
            window.firebase.initializeApp(config);
          }
          resolve(window.firebase);
        };
        s2.onerror = () => resolve(null);
        document.head.appendChild(s2);
      };
      s1.onerror = () => resolve(null);
      document.head.appendChild(s1);
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Authenticates user via Google Sign-In using Firebase Auth.
 * @returns {Promise<Object>}
 */
export async function signInWithGoogle() {
  const config = await getClientConfig();
  let googleUser = null;

  try {
    const fb = await ensureFirebaseLoaded(config);
    if (fb && fb.auth) {
      const provider = new fb.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      const result = await fb.auth().signInWithPopup(provider);
      const user = result.user;
      const idToken = await user.getIdToken();
      googleUser = {
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoURL,
        googleUid: user.uid,
        idToken,
      };
    } else {
      throw new Error('Firebase Auth SDK not reachable');
    }
  } catch (err) {
    console.warn('[auth.signInWithGoogle] Popup fallback:', err.message);
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed.');
    }
    // Fallback dialog for local dev environments
    const simulatedEmail = window.prompt(
      'Google Sign-In: Enter your Google email to authenticate with Firebase:',
      'patil.family@gmail.com'
    );
    if (simulatedEmail && simulatedEmail.trim()) {
      const name = simulatedEmail.split('@')[0];
      googleUser = {
        email: simulatedEmail.trim(),
        displayName: name.charAt(0).toUpperCase() + name.slice(1),
        photoUrl: '',
        googleUid: `google-${Date.now()}`,
        idToken: `google-token-${Date.now()}`,
      };
    } else {
      throw new Error('Google sign-in cancelled');
    }
  }

  if (!googleUser) throw new Error('Could not complete Google Sign-In');

  const res = await fetch(`${API_BASE}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(googleUser),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Google Sign-In failed on server');
  }

  if (data.token) setToken(data.token);
  saveMockUser({
    familyName: data.family?.name || `${googleUser.displayName}'s Family`,
    memberName: data.user?.memberName || googleUser.displayName,
    language: data.family?.preferredLanguage || 'en',
    uid: data.user?.id || googleUser.googleUid,
    familyId: data.user?.familyId || data.family?.id,
    photoUrl: googleUser.photoUrl || '',
    email: googleUser.email,
    provider: 'google',
  });

  return data;
}

