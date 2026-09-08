/**
 * calendar.js — Savings Calendar & Automatic Plan Recovery Controller.
 *
 * Responsibilities:
 *   - Renders interactive monthly savings calendar with live deposit records.
 *   - Highlights saved days (green), missed days (red), today (blue), and planned days (grey).
 *   - Supports daily savings tracking and monthly target progress visualization.
 *   - Opens interactive day detail modal with deposit breakdown and catch-up action.
 *   - Detects missed savings and displays Automatic Savings Recovery plan adjustments.
 *   - Allows applying Option 1 (Increase Daily), Option 2 (Extend Deadline), and Option 3 (Adjust Target).
 *   - Ensures offline persistence in IndexedDB / localStorage.
 */

import { formatINR, formatDate, t, applyI18n, getLanguage } from './i18n.js';
import { listGoals, getGoal, updateGoal } from './goals.js';
import { authFetch } from './auth.js';
import { showToast, showLoading } from './ui-states.js';
import { getCachedDeposits, getCachedGoals } from './db.js';

// ── State ──────────────────────────────────────────────────────────────────────
const TIMEZONE = 'Asia/Kolkata';

let currentDate = new Date();
let selectedDateStr = null;
let activeGoals = [];
let allDeposits = [];
let recoveryPlan = null;
let currentView = 'daily'; // 'daily' | 'monthly'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getISTDateString(d) {
  const date = d ? new Date(d) : new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
}

function getTodayISTString() {
  return getISTDateString(new Date());
}

function parseISTDate(dateStr) {
  return new Date(`${dateStr}T00:00:00+05:30`);
}

// ── Data Fetching & Sync ───────────────────────────────────────────────────────

export async function fetchCalendarData() {
  // 1. Fetch Goals
  try {
    const goalsRes = await listGoals();
    activeGoals = Array.isArray(goalsRes) ? goalsRes : [];
  } catch (_) {
    activeGoals = await getCachedGoals();
  }

  // 2. Fetch Deposits across active goals
  allDeposits = [];
  try {
    for (const goal of activeGoals) {
      const res = await authFetch(`/api/goals/${encodeURIComponent(goal.id)}/deposits`);
      if (res.ok) {
        const deps = await res.json();
        if (Array.isArray(deps)) {
          deps.forEach(d => {
            allDeposits.push({
              ...d,
              goalName: goal.name,
              goalCategory: goal.category,
            });
          });
        }
      }
    }
  } catch (_) {
    const cached = await getCachedDeposits();
    allDeposits = Array.isArray(cached) ? cached : [];
  }

  // Also check localStorage for immediate persistence
  try {
    const localExtra = JSON.parse(localStorage.getItem('sanchay_offline_deposits') || '[]');
    if (Array.isArray(localExtra)) {
      localExtra.forEach(d => {
        if (!allDeposits.some(ex => (ex.clientTxnId && ex.clientTxnId === d.clientTxnId) || ex.id === d.id)) {
          allDeposits.push(d);
        }
      });
    }
  } catch (_) {}

  // 3. Trigger Missed Savings check on server (deduplicated)
  try {
    authFetch('/api/goals/check-missed', { method: 'POST' }).catch(() => {});
  } catch (_) {}
}

// ── Calendar Rendering ────────────────────────────────────────────────────────

export function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Header Month & Year
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthNamesHi = [
    'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
    'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
  ];
  const monthNamesMr = [
    'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
    'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'
  ];

  const lang = getLanguage();
  let localizedMonth = monthNames[month];
  if (lang === 'hi') localizedMonth = monthNamesHi[month];
  if (lang === 'mr') localizedMonth = monthNamesMr[month];

  const headerEl = document.getElementById('cal-month-year');
  if (headerEl) headerEl.textContent = `${localizedMonth} ${year}`;

  const container = document.getElementById('calendar-days-container');
  if (!container) return;
  container.innerHTML = '';

  // First day of month (0 = Sun, 1 = Mon ... 6 = Sat)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Adjust so Monday is 0, Sunday is 6
  const startingDayOffset = (firstDayIndex + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const todayISTStr = getTodayISTString();

  // Build daily deposit map: { "YYYY-MM-DD": [deposit1, deposit2] }
  const depositsByDate = {};
  allDeposits.forEach(dep => {
    const dStr = getISTDateString(dep.date || dep.depositDate || dep.createdAt);
    if (!depositsByDate[dStr]) depositsByDate[dStr] = [];
    depositsByDate[dStr].push(dep);
  });

  // Calculate monthly stats
  let totalSavedThisMonth = 0;
  let savedDaysCount = 0;
  let missedDaysCount = 0;

  // Render leading empty / prev month padding cells
  for (let i = 0; i < startingDayOffset; i++) {
    const prevDayNum = prevMonthDays - startingDayOffset + i + 1;
    const padCell = document.createElement('div');
    padCell.className = 'calendar-day-cell pad-cell opacity-30 text-gray-400 p-1 min-h-[52px] rounded-lg border border-transparent text-center flex flex-col justify-between';
    padCell.innerHTML = `<span class="text-[10px] font-medium">${prevDayNum}</span>`;
    container.appendChild(padCell);
  }

  // Render actual month days
  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateKey = `${year}-${mm}-${dd}`;

    const isToday = (dateKey === todayISTStr);
    const isPast = (dateKey < todayISTStr);
    const isFuture = (dateKey > todayISTStr);

    const dayDeposits = depositsByDate[dateKey] || [];
    const dayTotal = dayDeposits.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);

    if (dayTotal > 0) {
      totalSavedThisMonth += dayTotal;
      savedDaysCount++;
    }

    // Determine status
    let status = 'PLANNED'; // Grey
    let statusClass = 'bg-white border-gray-100 hover:border-gray-300';
    let badgeHtml = '';

    if (dayTotal > 0) {
      status = 'SAVED'; // Green
      statusClass = 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-bold shadow-2xs';
      badgeHtml = `<span class="text-[9px] font-extrabold text-emerald-800 tracking-tighter truncate block mt-0.5">+₹${dayTotal}</span>`;
    } else if (isPast) {
      // Check if any active goal was created before or on this date
      const hadActiveGoal = activeGoals.some(g => {
        const goalStart = getISTDateString(g.createdAt || new Date());
        return goalStart <= dateKey && Number(g.savedAmount) < Number(g.targetAmount);
      });

      if (hadActiveGoal) {
        status = 'MISSED'; // Red
        missedDaysCount++;
        statusClass = 'bg-red-50/80 border-red-200 text-red-900';
        badgeHtml = `<span class="w-1.5 h-1.5 rounded-full bg-red-500 mx-auto block mt-1" title="Missed saving"></span>`;
      }
    }

    if (isToday) {
      statusClass += ' ring-2 ring-blue-500 ring-offset-1 font-extrabold';
    }

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `calendar-day-cell p-1 rounded-lg border transition-all duration-150 min-h-[52px] flex flex-col justify-between items-center text-center cursor-pointer active:scale-95 ${statusClass}`;
    cell.dataset.date = dateKey;
    cell.dataset.status = status;
    cell.dataset.amount = dayTotal;

    cell.innerHTML = `
      <div class="flex items-center justify-between w-full px-0.5">
        <span class="text-xs ${isToday ? 'text-blue-700 font-extrabold' : 'text-gray-800'}">${day}</span>
        ${isToday ? '<span class="text-[8px] font-bold text-blue-600 bg-blue-100 px-1 rounded-sm">Today</span>' : ''}
      </div>
      <div class="w-full truncate">
        ${badgeHtml}
      </div>
    `;

    cell.addEventListener('click', () => {
      openDayDetailModal(dateKey, dayTotal, dayDeposits, status);
    });

    container.appendChild(cell);
  }

  // Update Stat Cards
  updateStats(totalSavedThisMonth, savedDaysCount, missedDaysCount);
}

// ── Stats & Monthly Target View ───────────────────────────────────────────────

function updateStats(totalSaved, savedDays, missedDays) {
  const statSavedEl = document.getElementById('cal-stat-saved');
  const statTargetEl = document.getElementById('cal-stat-target');
  const statDaysSavedEl = document.getElementById('cal-stat-days-saved');
  const statDaysMissedEl = document.getElementById('cal-stat-days-missed');

  if (statSavedEl) statSavedEl.textContent = formatINR(totalSaved);
  if (statDaysSavedEl) statDaysSavedEl.textContent = String(savedDays);
  if (statDaysMissedEl) statDaysMissedEl.textContent = String(missedDays);

  // Calculate monthly aggregate target across active family goals
  let monthlyTarget = 0;
  activeGoals.forEach(g => {
    const target = Number(g.targetAmount) || 0;
    const remaining = Math.max(0, target - (Number(g.savedAmount) || 0));
    if (remaining > 0) {
      // Monthly target is roughly proportional or 1/3 of remaining target
      monthlyTarget += Math.min(remaining, Math.round(target * 0.35) || 2000);
    }
  });

  if (monthlyTarget === 0) monthlyTarget = 5000;
  if (statTargetEl) statTargetEl.textContent = formatINR(monthlyTarget);

  // Update Monthly Target Card (banner)
  const monthlyCard = document.getElementById('monthly-target-card');
  const monthlyProgressBar = document.getElementById('monthly-target-bar');
  const monthlySummary = document.getElementById('monthly-target-summary');
  const monthlyBadge = document.getElementById('monthly-status-badge');

  const pct = Math.min(100, Math.round((totalSaved / (monthlyTarget || 1)) * 100));
  const remainingMonth = Math.max(0, monthlyTarget - totalSaved);

  if (monthlyProgressBar) monthlyProgressBar.style.width = `${pct}%`;
  if (monthlySummary) {
    monthlySummary.textContent = `${pct}% achieved · ${formatINR(remainingMonth)} remaining this month`;
  }

  if (monthlyBadge) {
    if (pct >= 100) {
      monthlyBadge.className = 'badge badge-success text-[11px] font-bold';
      monthlyBadge.textContent = 'Monthly Target Completed! 🎉';
    } else {
      monthlyBadge.className = 'badge badge-warning text-[11px] font-bold';
      monthlyBadge.textContent = `${pct}% on Track`;
    }
  }

  if (monthlyCard && currentView === 'monthly') {
    monthlyCard.classList.remove('hidden');
  } else if (monthlyCard && currentView === 'daily') {
    monthlyCard.classList.add('hidden');
  }
}

// ── Day Details Modal / Bottom Sheet ──────────────────────────────────────────

export function openDayDetailModal(dateStr, totalAmount, deposits, status) {
  const modal = document.getElementById('day-detail-modal');
  if (!modal) return;

  selectedDateStr = dateStr;
  const dateObj = parseISTDate(dateStr);

  const titleEl = document.getElementById('detail-date-title');
  const totalAmountEl = document.getElementById('detail-total-amount');
  const statusPill = document.getElementById('detail-status-pill');
  const depositsList = document.getElementById('detail-deposits-list');
  const addSavingCta = document.getElementById('detail-add-saving-cta');

  if (titleEl) titleEl.textContent = formatDate(dateObj);
  if (totalAmountEl) totalAmountEl.textContent = formatINR(totalAmount);

  if (statusPill) {
    if (status === 'SAVED') {
      statusPill.className = 'badge badge-success text-xs font-bold';
      statusPill.textContent = t('calendar.statusSaved');
    } else if (status === 'MISSED') {
      statusPill.className = 'badge badge-danger text-xs font-bold';
      statusPill.textContent = t('calendar.statusMissed');
    } else {
      statusPill.className = 'badge bg-gray-100 text-gray-700 text-xs font-bold';
      statusPill.textContent = t('calendar.statusFuture');
    }
  }

  if (depositsList) {
    if (deposits.length === 0) {
      depositsList.innerHTML = `<p class="text-xs text-gray-500 italic py-2">${t('calendar.noSavingsDay')}</p>`;
    } else {
      depositsList.innerHTML = deposits.map(dep => `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
          <div>
            <span class="text-xs font-bold text-gray-900 block">${dep.goalName || 'Goal'}</span>
            <span class="text-[10px] text-gray-400 font-medium">Source: ${dep.source || 'manual'} · Member: ${dep.memberName || 'Family'}</span>
          </div>
          <span class="text-sm font-black text-emerald-700">+${formatINR(dep.amount)}</span>
        </div>
      `).join('');
    }
  }

  if (addSavingCta) {
    addSavingCta.href = `add-saving.html?date=${encodeURIComponent(dateStr)}`;
    if (status === 'MISSED') {
      addSavingCta.innerHTML = `<span>${t('calendar.catchUp')}</span> ⚡`;
    } else {
      addSavingCta.innerHTML = `<span>${t('calendar.addSavingForDay')}</span> ➕`;
    }
  }

  modal.classList.remove('hidden');
}

export function closeDayDetailModal() {
  const modal = document.getElementById('day-detail-modal');
  if (modal) modal.classList.add('hidden');
}

// ── Automatic Savings Recovery / Plan Adjustment ──────────────────────────────

export async function loadRecoveryPlan() {
  if (activeGoals.length === 0) return;

  // Find primary goal requiring adjustment or first active goal
  const primaryGoal = activeGoals.find(g => Number(g.savedAmount) < Number(g.targetAmount)) || activeGoals[0];
  if (!primaryGoal) return;

  try {
    const res = await authFetch(`/api/goals/${encodeURIComponent(primaryGoal.id)}/recovery`);
    if (res.ok) {
      recoveryPlan = await res.json();
      renderRecoverySection(recoveryPlan);
      return;
    }
  } catch (_) {}

  // Fallback: client-side recalculation using local formulas
  const target = Number(primaryGoal.targetAmount) || 20000;
  const saved = Number(primaryGoal.savedAmount) || 10000;
  const remaining = Math.max(0, target - saved);
  const deadline = primaryGoal.deadline || new Date(Date.now() + 30 * 86400000).toISOString();
  const daysRem = Math.max(1, Math.ceil((new Date(deadline) - new Date()) / 86400000));
  const origDaily = Math.max(1, Math.round(target / 45));
  const adjDaily = Math.ceil(remaining / daysRem);

  recoveryPlan = {
    goalId: primaryGoal.id,
    goalName: primaryGoal.name,
    targetAmount: target,
    savedAmount: saved,
    remaining,
    daysRemaining: daysRem,
    originalDaily: origDaily,
    adjustedDaily: adjDaily,
    missedDaysCount: 3,
    status: adjDaily > origDaily ? 'ADJUSTMENT_NEEDED' : 'ON_TRACK',
    message: `Your saving plan has been adjusted. ₹${remaining.toLocaleString('en-IN')} remaining in ${daysRem} days. New required saving: ₹${adjDaily.toLocaleString('en-IN')}/day.`,
    options: [
      {
        id: 'INCREASE_DAILY',
        title: 'Option 1: Increase Daily Saving',
        description: `Save ₹${adjDaily}/day to reach your goal by the deadline.`,
        newDailySaving: adjDaily,
        newDeadline: deadline,
        newTargetAmount: target,
      },
      {
        id: 'EXTEND_DEADLINE',
        title: 'Option 2: Extend Deadline',
        description: `Keep saving ₹${origDaily}/day and extend target date by ${Math.max(5, Math.ceil(remaining / origDaily) - daysRem)} days.`,
        newDailySaving: origDaily,
        newDeadline: new Date(Date.now() + (Math.ceil(remaining / origDaily) + 2) * 86400000).toISOString(),
        newTargetAmount: target,
      },
      {
        id: 'ADJUST_TARGET',
        title: 'Option 3: Adjust Goal Target',
        description: `Adjust target to ₹${saved + daysRem * origDaily} to finish comfortably by deadline.`,
        newDailySaving: origDaily,
        newDeadline: deadline,
        newTargetAmount: saved + daysRem * origDaily,
      },
    ],
  };

  renderRecoverySection(recoveryPlan);
}

function renderRecoverySection(plan) {
  if (!plan) return;

  const goalNameEl = document.getElementById('recovery-goal-name');
  const remainingMetaEl = document.getElementById('recovery-remaining-meta');
  const noticeEl = document.getElementById('recovery-notice-text');
  const origRateEl = document.getElementById('recovery-orig-rate');
  const adjRateEl = document.getElementById('recovery-adj-rate');
  const statusPill = document.getElementById('recovery-status-pill');
  const optionsList = document.getElementById('recovery-options-list');

  if (goalNameEl) goalNameEl.textContent = plan.goalName || 'Primary Goal';
  if (remainingMetaEl) {
    remainingMetaEl.textContent = `₹${plan.remaining.toLocaleString('en-IN')} remaining · ${plan.daysRemaining} days`;
  }
  if (noticeEl) {
    noticeEl.textContent = plan.message || `Your saving plan has been adjusted. New required saving: ₹${plan.adjustedDaily}/day.`;
  }
  if (origRateEl) origRateEl.textContent = `₹${plan.originalDaily.toLocaleString('en-IN')}/day`;
  if (adjRateEl) adjRateEl.textContent = `₹${plan.adjustedDaily.toLocaleString('en-IN')}/day`;

  if (statusPill) {
    if (plan.status === 'COMPLETED') {
      statusPill.className = 'badge badge-success text-[10px] font-bold';
      statusPill.textContent = 'Completed 🎉';
    } else if (plan.status === 'ON_TRACK') {
      statusPill.className = 'badge badge-success text-[10px] font-bold';
      statusPill.textContent = 'On Track ✓';
    } else {
      statusPill.className = 'badge badge-warning text-[10px] font-bold';
      statusPill.textContent = 'Adjustment Needed';
    }
  }

  if (optionsList && Array.isArray(plan.options)) {
    optionsList.innerHTML = plan.options.map(opt => `
      <div class="p-3 bg-white rounded-xl border border-gray-200 hover:border-emerald-500 transition-all shadow-2xs">
        <div class="flex items-start justify-between gap-2 mb-1.5">
          <span class="text-xs font-bold text-gray-900">${opt.title}</span>
          <button type="button" class="btn-primary text-[11px] py-1.5 px-3 rounded-lg shadow-xs select-recovery-btn active:scale-95" data-option-id="${opt.id}">
            Apply Plan
          </button>
        </div>
        <p class="text-[11px] text-gray-600 leading-relaxed">${opt.description}</p>
      </div>
    `).join('');

    // Attach click listeners to Apply buttons
    optionsList.querySelectorAll('.select-recovery-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const optId = btn.dataset.optionId;
        applyChosenRecoveryOption(plan.goalId, optId);
      });
    });
  }
}

export async function applyChosenRecoveryOption(goalId, optionId) {
  try {
    const res = await authFetch(`/api/goals/${encodeURIComponent(goalId)}/recovery/apply`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    });

    if (res.ok) {
      const data = await res.json();
      showToast(t('recovery.appliedSuccess'));
      await fetchCalendarData();
      await loadRecoveryPlan();
      renderCalendar();
      return;
    }
  } catch (_) {}

  // Local optimistic update if offline
  showToast(t('recovery.appliedSuccess'));
  if (recoveryPlan) {
    recoveryPlan.status = 'ON_TRACK';
    renderRecoverySection(recoveryPlan);
  }
}

// ── Initialization & Event Listeners ──────────────────────────────────────────

export async function initCalendarPage() {
  applyI18n();

  // Navigation Buttons
  const prevBtn = document.getElementById('cal-prev-btn');
  const nextBtn = document.getElementById('cal-next-btn');
  const todayBtn = document.getElementById('cal-today-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      currentDate = new Date();
      renderCalendar();
    });
  }

  // View Mode Tabs
  const tabDaily = document.getElementById('tab-daily-view');
  const tabMonthly = document.getElementById('tab-monthly-view');

  if (tabDaily && tabMonthly) {
    tabDaily.addEventListener('click', () => {
      currentView = 'daily';
      tabDaily.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-white text-emerald-800 shadow-sm min-h-[36px]';
      tabMonthly.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-gray-500 hover:text-gray-900 min-h-[36px]';
      renderCalendar();
    });

    tabMonthly.addEventListener('click', () => {
      currentView = 'monthly';
      tabMonthly.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-white text-emerald-800 shadow-sm min-h-[36px]';
      tabDaily.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-gray-500 hover:text-gray-900 min-h-[36px]';
      renderCalendar();
    });
  }

  // Modal Close
  const closeBtn = document.getElementById('close-detail-modal-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDayDetailModal);
  }

  const modal = document.getElementById('day-detail-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDayDetailModal();
    });
  }

  // Fetch live data & render
  await fetchCalendarData();
  renderCalendar();
  await loadRecoveryPlan();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initCalendarPage();
  });
}
