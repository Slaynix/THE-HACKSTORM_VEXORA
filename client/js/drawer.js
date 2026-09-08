/**
 * drawer.js — Universal Slide Drawer for Sanchay+
 * 
 * Provides an all-in-one slide-out menu that opens and closes smoothly,
 * organizing all 11+ features in clean sections without taking up screen space.
 */

import { getLanguage, setLanguage, t } from './i18n.js';
import { authFetch } from './auth.js';

// ── Inject Dedicated CSS for 60fps Smooth Transitions ─────────────────────────
function injectDrawerStyles() {
  if (document.getElementById('sanchay-drawer-styles')) return;

  const style = document.createElement('style');
  style.id = 'sanchay-drawer-styles';
  style.textContent = `
    /* Backdrop overlay */
    .sanchay-drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 9998;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .sanchay-drawer-backdrop.is-open {
      opacity: 1;
      pointer-events: auto;
    }

    /* Slide-out drawer panel */
    .sanchay-drawer-panel {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 320px;
      max-width: 86vw;
      background: #ffffff;
      z-index: 9999;
      transform: translateX(-100%);
      transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 10px 0 35px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .sanchay-drawer-panel.is-open {
      transform: translateX(0);
    }

    /* Drawer header */
    .sanchay-drawer-header {
      padding: 1.25rem 1.25rem 1rem;
      border-bottom: 1px solid #f1f5f9;
      background: linear-gradient(135deg, #065f46 0%, #047857 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Drawer content scroll area */
    .sanchay-drawer-content {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 0.875rem 1.5rem;
      -webkit-overflow-scrolling: touch;
    }

    /* Item styling */
    .drawer-nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 0.875rem;
      border-radius: 0.875rem;
      color: #1e293b;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
      margin-bottom: 0.25rem;
    }
    .drawer-nav-item:hover {
      background: #ecfdf5;
      color: #065f46;
      transform: translateX(3px);
    }
    .drawer-nav-item.is-active {
      background: #d1fae5;
      color: #065f46;
      font-weight: 700;
    }
    .drawer-nav-item .nav-icon-box {
      width: 2rem;
      height: 2rem;
      border-radius: 0.625rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.125rem;
      background: #f8fafc;
      flex-shrink: 0;
    }
    .drawer-nav-item:hover .nav-icon-box {
      background: #ffffff;
    }

    .drawer-section-label {
      font-size: 0.6875rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #94a3b8;
      padding: 0.75rem 0.75rem 0.375rem;
    }

    /* Floating quick menu button */
    .sanchay-floating-menu-btn {
      position: fixed;
      bottom: 5.25rem;
      left: 1rem;
      z-index: 9990;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #047857;
      color: #ffffff;
      padding: 0.625rem 1rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(4, 120, 87, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .sanchay-floating-menu-btn:hover {
      background: #065f46;
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(4, 120, 87, 0.45);
    }
    .sanchay-floating-menu-btn:active {
      transform: scale(0.96);
    }
  `;
  document.head.appendChild(style);
}

// ── Render Drawer DOM ─────────────────────────────────────────────────────────
function renderDrawerDOM() {
  if (document.getElementById('sanchay-slide-drawer')) return;

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'sanchay-drawer-backdrop';
  backdrop.className = 'sanchay-drawer-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  // Panel
  const panel = document.createElement('aside');
  panel.id = 'sanchay-slide-drawer';
  panel.className = 'sanchay-drawer-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Features Navigation Drawer');

  // Detect active page to highlight current link
  const currentPath = window.location.pathname;

  panel.innerHTML = `
    <!-- Header -->
    <div class="sanchay-drawer-header">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-xl shadow-inner">
          🪙
        </div>
        <div>
          <h2 class="text-base font-extrabold tracking-tight text-white leading-tight">Sanchay+</h2>
          <p class="text-[11px] text-emerald-100 font-medium">Small savings. Big goals.</p>
        </div>
      </div>
      <button id="sanchay-drawer-close" class="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 active:scale-90 transition-all" aria-label="Close menu">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>

    <!-- Scrollable Content -->
    <div class="sanchay-drawer-content">

      <!-- Section 1: Highlighted Smart Features -->
      <div class="drawer-section-label">🌟 Smart Features</div>

      <a href="/pages/calendar.html" class="drawer-nav-item ${currentPath.includes('calendar') ? 'is-active' : ''}">
        <span class="nav-icon-box">📅</span>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <span>Savings Calendar</span>
            <span class="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">New</span>
          </div>
          <p class="text-[11px] text-gray-500 font-normal">Day & monthly tracker</p>
        </div>
      </a>

      <a href="/pages/goal-details.html?goalId=goal-2" class="drawer-nav-item">
        <span class="nav-icon-box">🔄</span>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <span>Savings Plan Recovery</span>
            <span class="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">New</span>
          </div>
          <p class="text-[11px] text-gray-500 font-normal">3 smart recovery options</p>
        </div>
      </a>

      <a href="/pages/assistant.html" class="drawer-nav-item ${currentPath.includes('assistant') && !window.location.search.includes('voice') ? 'is-active' : ''}">
        <span class="nav-icon-box">🤖</span>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <span>AI Assistant</span>
            <span class="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800">Gemini</span>
          </div>
          <p class="text-[11px] text-gray-500 font-normal">10 Indic languages</p>
        </div>
      </a>

      <a href="/pages/assistant.html?voice=true" class="drawer-nav-item ${window.location.search.includes('voice') ? 'is-active' : ''}">
        <span class="nav-icon-box">🎙️</span>
        <div class="flex-1">
          <span>Voice Savings Mode</span>
          <p class="text-[11px] text-gray-500 font-normal">Speak to record savings</p>
        </div>
      </a>

      <!-- Section 2: Core Banking & Goals -->
      <div class="drawer-section-label mt-3">📊 Core Planner</div>

      <a href="/pages/dashboard.html" class="drawer-nav-item ${currentPath.includes('dashboard') || currentPath === '/' ? 'is-active' : ''}">
        <span class="nav-icon-box">🏠</span>
        <div class="flex-1">
          <span>Dashboard</span>
          <p class="text-[11px] text-gray-500 font-normal">Streak, spotlight & stats</p>
        </div>
      </a>

      <a href="/pages/goals.html" class="drawer-nav-item ${currentPath.includes('goals.html') ? 'is-active' : ''}">
        <span class="nav-icon-box">🎯</span>
        <div class="flex-1">
          <span>My Goals</span>
          <p class="text-[11px] text-gray-500 font-normal">Active targets & health</p>
        </div>
      </a>

      <a href="/pages/add-saving.html" class="drawer-nav-item ${currentPath.includes('add-saving') ? 'is-active' : ''}">
        <span class="nav-icon-box">💰</span>
        <div class="flex-1">
          <span>Add Saving</span>
          <p class="text-[11px] text-gray-500 font-normal">Quick ₹10–₹200 buttons</p>
        </div>
      </a>

      <a href="/pages/create-goal.html" class="drawer-nav-item ${currentPath.includes('create-goal') ? 'is-active' : ''}">
        <span class="nav-icon-box">➕</span>
        <div class="flex-1">
          <span>Create New Goal</span>
          <p class="text-[11px] text-gray-500 font-normal">Custom target & deadline</p>
        </div>
      </a>

      <a href="/pages/notifications.html" class="drawer-nav-item ${currentPath.includes('notifications') ? 'is-active' : ''}">
        <span class="nav-icon-box">🔔</span>
        <div class="flex-1">
          <span>Notifications</span>
          <p class="text-[11px] text-gray-500 font-normal">Milestones & alerts</p>
        </div>
      </a>

      <!-- Section 3: Tools & Settings -->
      <div class="drawer-section-label mt-3">⚙️ Preferences & Data</div>

      <a href="/pages/settings.html" class="drawer-nav-item ${currentPath.includes('settings') ? 'is-active' : ''}">
        <span class="nav-icon-box">⚙️</span>
        <div class="flex-1">
          <span>Settings</span>
          <p class="text-[11px] text-gray-500 font-normal">Profile, family, voice mute</p>
        </div>
      </a>

      <a href="/pages/features.html" class="drawer-nav-item ${currentPath.includes('features') ? 'is-active' : ''}">
        <span class="nav-icon-box">✨</span>
        <div class="flex-1">
          <span>All Features Hub</span>
          <p class="text-[11px] text-gray-500 font-normal">Full feature directory</p>
        </div>
      </a>

      <!-- Re-seed / Reset button -->
      <div class="mt-4 pt-3 border-t border-gray-100">
        <button id="sanchay-drawer-reseed-btn" class="w-full py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-2">
          <span>🔄</span> <span>Reset Demo Data</span>
        </button>
      </div>

    </div>

    <!-- Drawer Footer: Quick Language Toggle -->
    <div class="p-3 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
      <span class="text-xs font-bold text-gray-500">Language:</span>
      <div class="flex items-center gap-1.5" id="drawer-lang-selector">
        <button data-lang="en" class="px-2 py-1 rounded-lg text-xs font-bold ${getLanguage() === 'en' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}">EN</button>
        <button data-lang="hi" class="px-2 py-1 rounded-lg text-xs font-bold ${getLanguage() === 'hi' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}">हिंदी</button>
        <button data-lang="mr" class="px-2 py-1 rounded-lg text-xs font-bold ${getLanguage() === 'mr' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}">मराठी</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  // Auto-inject a floating slide trigger button so it's ALWAYS accessible even if header lacks button
  if (!document.getElementById('sanchay-floating-menu-btn')) {
    const floatBtn = document.createElement('button');
    floatBtn.id = 'sanchay-floating-menu-btn';
    floatBtn.className = 'sanchay-floating-menu-btn';
    floatBtn.setAttribute('aria-label', 'Open All Features Drawer');
    floatBtn.innerHTML = `
      <svg style="width:1.25rem;height:1.25rem;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      <span>All Features</span>
    `;
    document.body.appendChild(floatBtn);
  }
}

// ── Open / Close Mechanics ───────────────────────────────────────────────────
export function openDrawer() {
  const backdrop = document.getElementById('sanchay-drawer-backdrop');
  const panel = document.getElementById('sanchay-slide-drawer');
  if (backdrop && panel) {
    backdrop.classList.add('is-open');
    panel.classList.add('is-open');
    document.body.style.overflow = 'hidden'; // Prevent background scroll while open
  }
}

export function closeDrawer() {
  const backdrop = document.getElementById('sanchay-drawer-backdrop');
  const panel = document.getElementById('sanchay-slide-drawer');
  if (backdrop && panel) {
    backdrop.classList.remove('is-open');
    panel.classList.remove('is-open');
    document.body.style.overflow = '';
  }
}

export function toggleDrawer() {
  const panel = document.getElementById('sanchay-slide-drawer');
  if (panel && panel.classList.contains('is-open')) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

// ── Event Wiring ─────────────────────────────────────────────────────────────
function wireDrawerEvents() {
  const backdrop = document.getElementById('sanchay-drawer-backdrop');
  const closeBtn = document.getElementById('sanchay-drawer-close');
  const floatBtn = document.getElementById('sanchay-floating-menu-btn');
  const panel = document.getElementById('sanchay-slide-drawer');

  // Backdrop click closes drawer
  backdrop?.addEventListener('click', closeDrawer);

  // Close 'X' button
  closeBtn?.addEventListener('click', closeDrawer);

  // Floating trigger
  floatBtn?.addEventListener('click', toggleDrawer);

  // Also listen for any element with .btn-open-drawer or #btn-open-drawer or [data-drawer-trigger]
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('#btn-open-drawer, .btn-open-drawer, [data-drawer-trigger]');
    if (trigger) {
      e.preventDefault();
      toggleDrawer();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel?.classList.contains('is-open')) {
      closeDrawer();
    }
  });

  // Language buttons in drawer
  const langSelector = document.getElementById('drawer-lang-selector');
  langSelector?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    const lang = btn.dataset.lang;
    setLanguage(lang);
    window.location.reload();
  });

  // Reset Demo Data button
  const reseedBtn = document.getElementById('sanchay-drawer-reseed-btn');
  reseedBtn?.addEventListener('click', async () => {
    try {
      reseedBtn.innerHTML = '<span>⏳</span> <span>Resetting...</span>';
      reseedBtn.disabled = true;
      const res = await authFetch('/api/seed', { method: 'POST' });
      if (res.ok) {
        reseedBtn.innerHTML = '<span>✓</span> <span>Data Reset!</span>';
        setTimeout(() => window.location.reload(), 600);
      }
    } catch (err) {
      alert('Error resetting data: ' + err.message);
      reseedBtn.innerHTML = '<span>🔄</span> <span>Reset Demo Data</span>';
      reseedBtn.disabled = false;
    }
  });
}

// ── Auto-Initialize on script execution ───────────────────────────────────────
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectDrawerStyles();
      renderDrawerDOM();
      wireDrawerEvents();
    });
  } else {
    injectDrawerStyles();
    renderDrawerDOM();
    wireDrawerEvents();
  }
}
