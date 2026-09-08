/**
 * dashboard.js — Dashboard page controller.
 *
 * Renders:
 *   1. Primary Hero Card (Today's saving target + prominent CTA + empathetic streak message)
 *   2. Secondary Active Goal Summary Card (School Fees with live backend health.reason)
 *   3. Quick Actions row (Voice Save with explicit confirmation, Add Savings, Create Goal)
 *   4. Stats overview
 *   5. Recent savings
 *   6. Active goals list
 */

import { formatINR, formatDate, getTimeOfDay, t, applyI18n } from './i18n.js';
import {
  MOCK_GOALS,
  getTotalSavings,
  getTodaysTarget,
  getSavingStreak,
  getRecentDeposits,
  getUnreadCount,
  getGoalById,
} from './mock-data.js';
import { getMockUser, authFetch } from './auth.js';
import { renderGoalCard, listGoals, goalHealthBadge } from './goals.js';
import { showLoading, attachDevStateCycler, initOfflineListeners } from './ui-states.js';
import { openVoiceModal } from './voice.js';

// ── DOM References ────────────────────────────────────────────────────────────
const greetingEl         = document.getElementById('dashboard-greeting');
const familyLabelEl      = document.getElementById('dashboard-family-label');
const notifBadgeEl       = document.getElementById('notif-badge');
const navNotifBadgeEl    = document.getElementById('nav-notif-badge');
const connStatusPillEl   = document.getElementById('connection-status-pill');
const connStatusTextEl   = document.getElementById('connection-status-text');

// Primary Hero Card
const heroTargetEl       = document.getElementById('hero-today-target');
const heroAddBtnEl       = document.getElementById('hero-add-saving-btn');
const heroStreakBadgeEl  = document.getElementById('hero-streak-badge');
const heroStreakCountEl  = document.getElementById('hero-streak-count');
const heroStreakMsgEl    = document.getElementById('hero-streak-message');

// Secondary Active Goal Card
const spotlightIconEl    = document.getElementById('spotlight-goal-icon');
const spotlightNameEl    = document.getElementById('spotlight-goal-name');
const spotlightMetaEl    = document.getElementById('spotlight-goal-meta');
const spotlightBadgeEl   = document.getElementById('spotlight-health-badge');
const spotlightSavedEl   = document.getElementById('spotlight-saved-target');
const spotlightPctEl     = document.getElementById('spotlight-percent');
const spotlightFillEl    = document.getElementById('spotlight-progress-fill');
const spotlightReasonEl  = document.getElementById('spotlight-reason-text');

// Quick Actions
const qaVoiceBtnEl       = document.getElementById('qa-voice-btn');

// Stats Row
const statTotalEl        = document.getElementById('stat-total-savings');
const statGoalsEl        = document.getElementById('stat-active-goals');
const statTargetEl       = document.getElementById('stat-todays-target');
const statStreakEl       = document.getElementById('stat-streak');

// Lists
const recentSavingsEl    = document.getElementById('recent-savings-list');
const goalsListEl        = document.getElementById('goals-list');

import { getSyncState } from './sync.js';
import { isReachable, checkReachability } from './connectivity.js';

// ── Render Dashboard ──────────────────────────────────────────────────────────

async function renderDashboardContent() {
  applyI18n();
  const user = getMockUser();

  // 1. Time of day greeting
  const timeOfDay = getTimeOfDay(); // 'morning' | 'afternoon' | 'evening'
  let greetKey = 'dashboard.greetMorning';
  if (timeOfDay === 'afternoon') greetKey = 'dashboard.greetAfternoon';
  if (timeOfDay === 'evening')   greetKey = 'dashboard.greetEvening';

  if (greetingEl) {
    greetingEl.textContent = t(greetKey, { name: user.memberName || 'Friend' });
  }

  if (familyLabelEl) {
    familyLabelEl.textContent = t('dashboard.familySuffix', { name: user.familyName || 'Patil' });
  }

  // 2. Connection status
  _updateConnectionStatus();

  // 3. Notification badges
  const unreadCount = getUnreadCount();
  if (unreadCount > 0) {
    notifBadgeEl?.classList.remove('hidden');
    navNotifBadgeEl?.classList.remove('hidden');
  } else {
    notifBadgeEl?.classList.add('hidden');
    navNotifBadgeEl?.classList.add('hidden');
  }

  // 4. Fetch Goals (from API when available, fallback to mock)
  let goals = [];
  try {
    const res = await authFetch('/api/goals');
    if (res.ok) {
      goals = await res.json();
    }
  } catch (_) {}

  if (!goals || goals.length === 0) {
    goals = await listGoals();
  }

  // Calculate totals and live streak from backend
  const totalSaved = goals.reduce((sum, g) => sum + (Number(g.savedAmount) || 0), 0) || getTotalSavings();
  let streakDays = 5;

  try {
    const streakRes = await authFetch('/api/family/streak');
    if (streakRes.ok) {
      const streakData = await streakRes.json();
      if (streakData && streakData.currentStreak !== undefined) {
        streakDays = streakData.currentStreak;
      }
    }
  } catch (_) {
    streakDays = getSavingStreak() || 5;
  }

  // Primary Goal for Secondary Summary Card (prefer School Fees or first active goal)
  const primaryGoal = goals.find(g => g.name.toLowerCase().includes('school')) || goals[0] || MOCK_GOALS[0];

  // Calculate today's target directly from primary goal's backend daily requirement
  let todayTarget = 100;
  if (primaryGoal) {
    if (primaryGoal.health?.requiredDailySaving) {
      todayTarget = Math.max(10, Math.ceil(primaryGoal.health.requiredDailySaving));
    } else {
      const target = Number(primaryGoal.targetAmount) || 20000;
      const saved = Number(primaryGoal.savedAmount) || 0;
      const remaining = Math.max(0, target - saved);
      const daysLeft = primaryGoal.progress?.daysRemaining || primaryGoal.health?.daysRemaining || 47;
      todayTarget = daysLeft > 0 ? Math.max(50, Math.ceil(remaining / daysLeft)) : 100;
    }
  }

  // Populate Primary Hero Card
  if (heroTargetEl) heroTargetEl.textContent = formatINR(todayTarget);
  if (heroAddBtnEl) heroAddBtnEl.href = `add-saving.html?amount=${todayTarget}&goalId=${encodeURIComponent(primaryGoal?.id || '')}`;
  if (heroStreakCountEl) heroStreakCountEl.textContent = t('dashboard.streakDays', { count: streakDays });
  if (heroStreakMsgEl) {
    heroStreakMsgEl.textContent = streakDays >= 3
      ? t('dashboard.streakEncourage', { count: streakDays })
      : t('dashboard.streakGentle');
  }

  // Populate Secondary Active Goal Card strictly from live backend fields
  if (primaryGoal) {
    const saved = Number(primaryGoal.savedAmount) || 0;
    const target = Number(primaryGoal.targetAmount) || 1;
    const remaining = primaryGoal.remaining !== undefined
      ? Number(primaryGoal.remaining)
      : (primaryGoal.progress?.remaining !== undefined ? Number(primaryGoal.progress.remaining) : Math.max(0, target - saved));
    const pct = primaryGoal.progress?.percentage !== undefined
      ? Number(primaryGoal.progress.percentage)
      : Math.min(100, Math.round((saved / target) * 100));

    const status = primaryGoal.health?.status || primaryGoal.status || (pct >= 100 ? 'COMPLETED' : 'ON_TRACK');
    const isCompleted = status === 'COMPLETED' || pct >= 100 || remaining === 0;

    const daysLeft = primaryGoal.progress?.daysRemaining !== undefined
      ? primaryGoal.progress.daysRemaining
      : (primaryGoal.health?.daysRemaining !== undefined ? primaryGoal.health.daysRemaining : 47);

    const reqDaily = primaryGoal.health?.requiredDailySaving !== undefined
      ? Math.round(primaryGoal.health.requiredDailySaving)
      : (remaining > 0 && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : 0);

    const reason = primaryGoal.health?.reason || (isCompleted
      ? 'Goal completed! Congratulations on reaching your savings milestone.'
      : (status === 'ON_TRACK'
        ? `At this rate, you're on track to reach your goal on time.`
        : `Save ₹${reqDaily}/day to catch up with your target.`));

    if (spotlightIconEl) spotlightIconEl.textContent = primaryGoal.icon || '📚';
    if (spotlightNameEl) spotlightNameEl.textContent = primaryGoal.name;
    if (spotlightMetaEl) {
      spotlightMetaEl.textContent = t('dashboard.remainingMeta', {
        days: daysLeft,
        rate: formatINR(reqDaily),
      });
    }
    if (spotlightBadgeEl) {
      spotlightBadgeEl.innerHTML = goalHealthBadge(status);
    }
    if (spotlightSavedEl) {
      spotlightSavedEl.textContent = `${formatINR(saved)} / ${formatINR(target)}`;
    }
    if (spotlightPctEl) spotlightPctEl.textContent = `${pct}%`;
    if (spotlightFillEl) {
      spotlightFillEl.style.width = `${pct}%`;
      spotlightFillEl.className = `h-full rounded-full transition-all duration-700 ${
        isCompleted || status === 'ON_TRACK' ? 'bg-emerald-600' : (status === 'AT_RISK' ? 'bg-amber-500' : 'bg-red-500')
      }`;
    }
    if (spotlightReasonEl) spotlightReasonEl.textContent = reason;
  }

  // Populate Stats Row
  if (statTotalEl)  statTotalEl.textContent  = formatINR(totalSaved);
  if (statGoalsEl)  statGoalsEl.textContent  = `${goals.length}`;
  if (statTargetEl) statTargetEl.textContent = formatINR(todayTarget);
  if (statStreakEl) statStreakEl.textContent = t('dashboard.streakDays', { count: streakDays });

  // Populate Recent Savings
  if (recentSavingsEl) {
    let recentDeposits = [];
    try {
      if (primaryGoal?.id) {
        const depRes = await authFetch(`/api/goals/${encodeURIComponent(primaryGoal.id)}/deposits`);
        if (depRes.ok) {
          recentDeposits = await depRes.json();
        }
      }
    } catch (_) {}

    if (!recentDeposits || recentDeposits.length === 0) {
      recentDeposits = getRecentDeposits(4);
    }

    if (recentDeposits.length === 0) {
      recentSavingsEl.innerHTML = `
        <div class="card text-center py-4 text-gray-400 text-xs">
          ${t('goalDetails.noDeposits')}
        </div>
      `;
    } else {
      recentSavingsEl.innerHTML = recentDeposits.slice(0, 4).map(dep => {
        const goal = goals.find(g => g.id === dep.goalId) || getGoalById(dep.goalId);
        const goalName = goal ? goal.name : 'Savings';
        const icon = goal ? (goal.icon || '💰') : '💰';
        const member = dep.memberName || 'Arun';
        return `
          <div class="card flex items-center justify-between py-3 px-3.5 hover:bg-gray-50 transition-colors">
            <div class="flex items-center gap-3">
              <span class="text-xl p-1.5 rounded-xl bg-emerald-50 flex items-center justify-center">${icon}</span>
              <div>
                <p class="text-xs font-bold text-gray-900">${goalName}</p>
                <p class="text-[11px] text-gray-500"><span class="text-emerald-800 font-semibold">${member}:</span> ${dep.notes || dep.note ? `${dep.notes || dep.note} • ` : ''}${formatDate(dep.depositDate || dep.date)}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="text-xs font-extrabold text-emerald-700">+${formatINR(dep.amount)}</span>
              ${dep.syncStatus === 'pending' || dep.pending ? `
                <span class="block text-[9px] font-bold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-0.5 border border-amber-200">Pending Sync</span>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Populate Active Goals List (showing cards for all active goals)
  if (goalsListEl) {
    if (goals.length === 0) {
      goalsListEl.innerHTML = `
        <div class="card text-center py-6 text-gray-500">
          <p class="text-3xl mb-1">🎯</p>
          <p class="text-sm font-medium text-gray-700">No active goals</p>
          <a href="create-goal.html" class="btn-primary mt-3 text-xs py-2 px-4">+ New Goal</a>
        </div>
      `;
    } else {
      goalsListEl.innerHTML = '';
      goals.slice(0, 4).forEach(goal => {
        goalsListEl.appendChild(renderGoalCard(goal));
      });
    }
  }
}

/**
 * Updates top-bar connection indicator based on truthful sync and reachability state.
 */
function _updateConnectionStatus() {
  if (!connStatusPillEl) return;
  const syncState = getSyncState();

  if (syncState === 'syncing') {
    connStatusPillEl.className = 'status-pill-syncing';
    connStatusPillEl.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
      <span>${t('common.syncing')}</span>
    `;
  } else if (syncState === 'offline' || !isReachable()) {
    connStatusPillEl.className = 'status-pill-offline';
    connStatusPillEl.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
      <span>${t('settings.offline')}</span>
    `;
  } else {
    connStatusPillEl.className = 'status-pill-synced';
    connStatusPillEl.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      <span>${t('common.synced')}</span>
    `;
  }
}

// ── Initialise Page ───────────────────────────────────────────────────────────

function init() {
  initOfflineListeners();

  // Wire Voice Save quick action -> opens AI Assistant in voice mode
  if (qaVoiceBtnEl) {
    qaVoiceBtnEl.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'assistant.html?voice=true';
    });
  }

  window.addEventListener('online', _updateConnectionStatus);
  window.addEventListener('offline', _updateConnectionStatus);
  window.addEventListener('sync:stateChanged', _updateConnectionStatus);
  window.addEventListener('sync:completed', () => {
    renderDashboardContent();
  });
  window.addEventListener('connectivity:changed', _updateConnectionStatus);

  // Show loading skeleton initially
  if (goalsListEl) showLoading(goalsListEl, 2);
  if (recentSavingsEl) showLoading(recentSavingsEl, 2);

  setTimeout(() => {
    renderDashboardContent();
  }, 200);

  // Triple-tap header for dev UI state preview
  const header = document.querySelector('header');
  const main = document.querySelector('main');
  if (header && main) {
    attachDevStateCycler(header, main, renderDashboardContent);
  }
}

document.addEventListener('DOMContentLoaded', init);
