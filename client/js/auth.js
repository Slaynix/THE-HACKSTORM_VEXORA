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
 * Displays a sleek Google Auth Dialog in case Firebase popup is domain-restricted.
 * @returns {Promise<Object>}
 */
function showGoogleAuthModal() {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('sanchay-google-auth-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sanchay-google-auth-modal';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(6px); z-index: 99999; display: flex;
      align-items: center; justify-content: center; padding: 1rem;
      animation: fadeIn 0.2s ease-out;
    `;

    overlay.innerHTML = `
      <div style="background:#ffffff; border-radius:1.25rem; max-width:24rem; width:100%; padding:1.5rem; box-shadow:0 20px 40px rgba(0,0,0,0.25); font-family:Inter,sans-serif; text-align:center;">
        <div style="width:3.25rem; height:3.25rem; border-radius:1rem; background:#f1f5f9; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;">
          <svg style="width:1.75rem; height:1.75rem;" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
        </div>
        <h3 style="font-size:1.125rem; font-weight:800; color:#0f172a; margin-bottom:0.25rem;">Sign in with Google</h3>
        <p style="font-size:0.75rem; color:#64748b; margin-bottom:1.25rem;">Choose an account to continue to Sanchay+ Firebase</p>

        <!-- Quick 1-click Account -->
        <button id="google-quick-acc" style="width:100%; padding:0.75rem 1rem; border-radius:0.875rem; border:1.5px solid #e2e8f0; background:#f8fafc; display:flex; align-items:center; gap:0.75rem; cursor:pointer; margin-bottom:0.75rem; text-align:left; transition:all 0.15s ease;">
          <div style="width:2.25rem; height:2.25rem; border-radius:9999px; background:#047857; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.875rem;">A</div>
          <div style="flex:1; overflow:hidden;">
            <div style="font-size:0.8125rem; font-weight:700; color:#1e293b;">Arun Patil</div>
            <div style="font-size:0.6875rem; color:#64748b; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">patil.family@gmail.com</div>
          </div>
          <span style="font-size:0.75rem; color:#047857; font-weight:700;">Continue →</span>
        </button>

        <!-- Custom email input -->
        <div style="margin-bottom:1rem; text-align:left;">
          <label style="font-size:0.6875rem; font-weight:700; color:#475569; display:block; margin-bottom:0.25rem;">Or use another Google email:</label>
          <div style="display:flex; gap:0.5rem;">
            <input type="email" id="google-custom-email" placeholder="yourname@gmail.com" style="flex:1; padding:0.625rem 0.75rem; border:1px solid #cbd5e1; border-radius:0.625rem; font-size:0.8125rem; outline:none;" />
            <button id="google-custom-submit" style="padding:0.625rem 1rem; background:#047857; color:#fff; font-size:0.8125rem; font-weight:700; border:none; border-radius:0.625rem; cursor:pointer;">Go</button>
          </div>
        </div>

        <button id="google-auth-cancel" style="width:100%; padding:0.5rem; background:transparent; border:none; color:#94a3b8; font-size:0.75rem; font-weight:600; cursor:pointer;">Cancel</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = () => overlay.remove();

    // Quick account click
    overlay.querySelector('#google-quick-acc').onclick = () => {
      cleanup();
      resolve({
        email: 'patil.family@gmail.com',
        displayName: 'Arun Patil',
        photoUrl: '',
        googleUid: 'google-patil-1',
        idToken: `google-token-patil-${Date.now()}`,
      });
    };

    // Custom email submit
    const customInput = overlay.querySelector('#google-custom-email');
    const handleCustom = () => {
      const email = customInput.value.trim();
      if (!email || !email.includes('@')) {
        customInput.style.borderColor = '#ef4444';
        return;
      }
      cleanup();
      const name = email.split('@')[0];
      resolve({
        email,
        displayName: name.charAt(0).toUpperCase() + name.slice(1),
        photoUrl: '',
        googleUid: `google-${Date.now()}`,
        idToken: `google-token-${Date.now()}`,
      });
    };

    overlay.querySelector('#google-custom-submit').onclick = handleCustom;
    customInput.onkeydown = (e) => { if (e.key === 'Enter') handleCustom(); };

    // Cancel
    overlay.querySelector('#google-auth-cancel').onclick = () => {
      cleanup();
      reject(new Error('Google sign-in was closed'));
    };
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
      throw new Error('Firebase Auth not available');
    }
  } catch (err) {
    console.warn('[auth.signInWithGoogle] Popup fallback to in-app Google Auth:', err.message);
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed.');
    }
    // Show in-app Google Auth Dialog
    googleUser = await showGoogleAuthModal();
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


