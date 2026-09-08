/**
 * goals.js — Goals CRUD and rendering module.
 *
 * Responsibilities:
 *   createGoal(data)        — Creates a goal (mock memory + Phase 2 API)
 *   listGoals()             — Returns list of goals
 *   getGoal(id)             — Returns goal by ID
 *   updateGoal(id, data)    — Updates goal
 *   deleteGoal(id)          — Deletes goal
 *   renderGoalCard(goal)    — Returns an HTML element for a clickable goal card
 *   renderGoalsList(el)     — Populates a container with goal cards
 *   goalHealthBadge(status) — Returns accessible badge HTML string
 *   initGoalsPage()         — Initialises goals.html
 */

import { formatINR, daysUntil, t, applyI18n } from './i18n.js';
import { MOCK_GOALS, getCategoryInfo } from './mock-data.js';
import { showLoading, showEmpty, showError, attachDevStateCycler, initOfflineListeners } from './ui-states.js';
import { authFetch } from './auth.js';
import {
  cacheGoals,
  getCachedGoals,
  getCachedGoal,
  enqueuePendingOperation,
  generateClientTxnId,
} from './db.js';

const API_BASE = '/api/goals';

// ── In-memory active goals store (initialized with mock data) ─────────────────
let activeGoals = [...MOCK_GOALS];

// ── API / Storage methods ─────────────────────────────────────────────────────

export async function createGoal(data) {
  const cat = getCategoryInfo(data.category);
  const clientTxnId = data.clientTxnId || generateClientTxnId();
  const payload = {
    name: data.name,
    category: data.category || 'other',
    icon: data.icon || cat.icon || '🎯',
    targetAmount: Number(data.targetAmount) || 0,
    deadline: data.deadline,
    clientTxnId,
  };

  try {
    const res = await authFetch('/api/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const savedGoal = await res.json();
      activeGoals.unshift(savedGoal);
      await cacheGoals(activeGoals);
      return savedGoal;
    }
  } catch (err) {
    console.warn('[goals] Create goal API unreachable, using local store:', err);
  }

  // Offline fallback
  const newGoal = {
    id: `goal-${Date.now()}`,
    ...payload,
    savedAmount: 0,
    createdAt: new Date().toISOString(),
    healthStatus: 'ON_TRACK',
    syncStatus: 'pending',
    pending: true,
  };
  activeGoals.unshift(newGoal);
  await cacheGoals(activeGoals);
  await enqueuePendingOperation('CREATE_GOAL', newGoal, clientTxnId);
  return newGoal;
}

export async function listGoals() {
  try {
    const res = await authFetch('/api/goals');
    if (res.ok) {
      const remote = await res.json();
      if (Array.isArray(remote) && remote.length > 0) {
        activeGoals = remote;
        await cacheGoals(remote);
        return activeGoals;
      }
    }
  } catch (_) {}

  // Fallback to IndexedDB
  const cached = await getCachedGoals();
  if (cached && cached.length > 0) {
    activeGoals = cached;
    return cached;
  }

  return [...activeGoals];
}

export async function getGoal(id) {
  try {
    const res = await authFetch(`/api/goals/${encodeURIComponent(id)}`);
    if (res.ok) {
      const g = await res.json();
      return g;
    }
  } catch (_) {}

  const cached = await getCachedGoal(id);
  if (cached) return cached;

  return activeGoals.find(g => g.id === id) || null;
}

export async function updateGoal(id, data) {
  try {
    const res = await authFetch(`/api/goals/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      const idx = activeGoals.findIndex(g => g.id === id);
      if (idx !== -1) activeGoals[idx] = updated;
      return updated;
    }
  } catch (_) {}

  const idx = activeGoals.findIndex(g => g.id === id);
  if (idx !== -1) {
    activeGoals[idx] = { ...activeGoals[idx], ...data };
    return activeGoals[idx];
  }
  return null;
}

export async function deleteGoal(id) {
  try {
    await authFetch(`/api/goals/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (_) {}
  activeGoals = activeGoals.filter(g => g.id !== id);
}

// ── Health State Badge ────────────────────────────────────────────────────────

/**
 * Health-state badge HTML with icon and text (never color-alone).
 * @param {'ON_TRACK'|'AT_RISK'|'BEHIND'} status
 * @returns {string} HTML string
 */
export function goalHealthBadge(status) {
  if (status === 'COMPLETED') {
    return `<span class="badge-on-track bg-emerald-100 text-emerald-800"><span aria-hidden="true">🏆</span> <span>${t('goals.completed') || 'Completed'}</span></span>`;
  }
  const statusKey = status === 'ON_TRACK' ? 'health.onTrack' : (status === 'AT_RISK' ? 'health.atRisk' : 'health.behind');
  const label = t(statusKey);
  const map = {
    ON_TRACK: `<span class="badge-on-track"><span aria-hidden="true">✓</span> <span>${label}</span></span>`,
    AT_RISK:  `<span class="badge-at-risk"><span aria-hidden="true">⚠</span> <span>${label}</span></span>`,
    BEHIND:   `<span class="badge-behind"><span aria-hidden="true">✗</span> <span>${label}</span></span>`,
    COMPLETED: `<span class="badge-on-track bg-emerald-100 text-emerald-800"><span aria-hidden="true">🏆</span> <span>${t('goals.completed') || 'Completed'}</span></span>`,
  };
  return map[status] ?? map['BEHIND'];
}

// ── Goal Card Component ───────────────────────────────────────────────────────

/**
 * Renders a single goal card DOM element.
 * Navigates to goal-details.html?goalId=... on click/tap.
 * Strictly reads live backend fields: name, category, target, deadline, saved, remaining, progress, health.
 *
 * @param {Object} goal
 * @returns {HTMLElement}
 */
export function renderGoalCard(goal) {
  const target = Number(goal.targetAmount) || 1;
  const saved = Number(goal.savedAmount) || 0;
  const remaining = goal.remaining !== undefined
    ? Number(goal.remaining)
    : (goal.progress?.remaining !== undefined ? Number(goal.progress.remaining) : Math.max(0, target - saved));
  const pct = goal.progress?.percentage !== undefined
    ? Number(goal.progress.percentage)
    : Math.min(100, Math.round((saved / target) * 100));

  const healthStatus = goal.health?.status || goal.status || goal.healthStatus || (pct >= 100 ? 'COMPLETED' : 'ON_TRACK');
  const isCompleted = healthStatus === 'COMPLETED' || remaining === 0 || pct >= 100;

  const days = goal.progress?.daysRemaining !== undefined
    ? goal.progress.daysRemaining
    : (goal.health?.daysRemaining !== undefined ? goal.health.daysRemaining : daysUntil(goal.deadline));

  let timeText = '';
  if (isCompleted) {
    timeText = t('goals.completed');
  } else if (days > 0) {
    timeText = t('goals.daysLeft', { count: days });
  } else if (days === 0) {
    timeText = t('goals.dueToday');
  } else {
    timeText = t('goals.overdue', { count: Math.abs(days) });
  }

  const reqDaily = goal.health?.requiredDailySaving !== undefined
    ? Math.round(goal.health.requiredDailySaving)
    : ((remaining > 0 && days > 0) ? Math.max(1, Math.ceil(remaining / days)) : 0);

  const card = document.createElement('a');
  card.href = `goal-details.html?goalId=${encodeURIComponent(goal.id)}`;
  card.className = 'card block hover:shadow-md active:scale-[0.99] transition-all duration-150 group';
  card.setAttribute('aria-label', `${goal.name}: ${formatINR(saved)} saved of ${formatINR(target)}`);

  // Progress bar color according to health status
  const barColor = isCompleted || healthStatus === 'ON_TRACK'
    ? 'bg-emerald-600'
    : (healthStatus === 'AT_RISK' ? 'bg-amber-500' : 'bg-red-500');

  card.innerHTML = `
    <div class="flex items-start justify-between gap-2 mb-3">
      <div class="flex items-center gap-3">
        <span class="text-3xl p-2 rounded-2xl bg-emerald-50 flex items-center justify-center">${goal.icon || '🎯'}</span>
        <div>
          <h2 class="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors text-base">${goal.name}</h2>
          <span class="text-xs text-gray-500">${timeText}</span>
        </div>
      </div>
      <div>
        ${goalHealthBadge(healthStatus)}
      </div>
    </div>

    <!-- Progress bar -->
    <div class="w-full bg-gray-100 rounded-full h-2.5 mb-2.5 overflow-hidden">
      <div class="${barColor} h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
    </div>

    <!-- Amounts & Daily rate -->
    <div class="flex items-center justify-between text-xs">
      <div>
        <span class="font-bold text-gray-900">${formatINR(saved)}</span>
        <span class="text-gray-400"> / ${formatINR(target)}</span>
      </div>
      <div class="font-semibold text-emerald-700">
        ${pct}%
      </div>
    </div>
    ${!isCompleted && reqDaily > 0 ? `
      <div class="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-500">
        <span>${t('goals.requiredDaily', { amount: reqDaily })}</span>
        <span class="text-emerald-600 font-medium group-hover:translate-x-0.5 transition-transform">Details →</span>
      </div>
    ` : ''}
  `;

  return card;
}

// ── Goals List Renderer ───────────────────────────────────────────────────────

/**
 * Populates a container element with goal cards or empty state.
 * @param {HTMLElement} container
 */
export async function renderGoalsList(container) {
  if (!container) return;
  applyI18n();
  const goals = await listGoals();

  if (goals.length === 0) {
    showEmpty(container, {
      icon: '🎯',
      title: t('common.noData'),
      message: 'You have not created any savings goals yet.',
      ctaText: t('goals.createButton'),
      ctaHref: 'create-goal.html',
    });
    return;
  }

  container.innerHTML = '';
  goals.forEach(goal => {
    container.appendChild(renderGoalCard(goal));
  });
}

// ── Create Goal Form Initialiser ─────────────────────────────────────────────

export function initCreateGoalForm() {
  applyI18n();
  const form = document.getElementById('create-goal-form');
  const catGrid = document.getElementById('category-grid');
  const nameInput = document.getElementById('goal-name');
  const amountInput = document.getElementById('goal-amount');
  const deadlineInput = document.getElementById('goal-deadline');
  const submitBtn = document.getElementById('create-goal-btn');
  const amountPreview = document.getElementById('amount-preview');

  if (!form) return;
  initOfflineListeners();

  // Set min date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];
  if (deadlineInput) {
    deadlineInput.min = minDateStr;
  }

  let selectedCategory = 'other';
  let lastSuggestedName = '';

  // Handle category selection
  if (catGrid) {
    const cards = catGrid.querySelectorAll('.category-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedCategory = card.dataset.category || 'other';

        const defaultName = card.dataset.defaultName || '';
        const defaultAmount = card.dataset.defaultAmount || '';

        if (!nameInput.value || nameInput.value === lastSuggestedName) {
          nameInput.value = defaultName;
          lastSuggestedName = defaultName;
        }
        if (!amountInput.value && defaultAmount) {
          amountInput.value = defaultAmount;
          if (amountPreview) amountPreview.textContent = formatINR(Number(defaultAmount));
        }
        validate();
      });
    });
  }

  // Live amount preview
  if (amountInput) {
    amountInput.addEventListener('input', () => {
      const val = parseFloat(amountInput.value);
      if (amountPreview) {
        amountPreview.textContent = !isNaN(val) && val > 0 ? formatINR(val) : '';
      }
      validate();
    });
  }

  if (nameInput) nameInput.addEventListener('input', validate);
  if (deadlineInput) deadlineInput.addEventListener('input', validate);

  function validate() {
    const nameValid = nameInput && nameInput.value.trim().length > 0;
    const amountVal = amountInput ? parseFloat(amountInput.value) : 0;
    const amountValid = !isNaN(amountVal) && amountVal > 0;
    const deadlineVal = deadlineInput ? deadlineInput.value : '';
    const deadlineValid = deadlineVal && deadlineVal >= minDateStr;

    const isValid = nameValid && amountValid && deadlineValid;
    if (submitBtn) {
      submitBtn.disabled = !isValid;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn && submitBtn.disabled) return;

    const cat = getCategoryInfo(selectedCategory);
    const newGoal = await createGoal({
      name: nameInput.value.trim(),
      category: selectedCategory,
      icon: cat.icon || '🎯',
      targetAmount: parseFloat(amountInput.value),
      deadline: `${deadlineInput.value}T23:59:59+05:30`,
    });

    window.location.href = `goal-details.html?goalId=${encodeURIComponent(newGoal.id)}`;
  });

  validate();
}

// ── Goals Page Initialiser (for goals.html) ───────────────────────────────────

export function initGoalsPage() {
  const container = document.getElementById('goals-container');
  if (!container) return;

  initOfflineListeners();

  function load() {
    showLoading(container, 3);
    setTimeout(() => {
      renderGoalsList(container);
    }, 300);
  }

  load();

  const header = document.querySelector('header');
  if (header) {
    attachDevStateCycler(header, container, () => renderGoalsList(container));
  }
}

// Auto-run if on goals.html
if (typeof window !== 'undefined' && window.location.pathname.includes('goals.html')) {
  document.addEventListener('DOMContentLoaded', initGoalsPage);
}


