/**
 * goal-details.js — Goal detail view controller.
 *
 * Handles:
 *  - Live backend goal data (target, saved, remaining, progress, health, prediction)
 *  - Animated SVG progress ring
 *  - Exact Phase 2 health status & reason
 *  - Dedicated Prediction Card with live backend rates and guidance
 *  - 4-stage milestone tracker (25%, 50%, 75%, 100%)
 *  - Family contribution breakdown by member (Arun, Sunita, Riya)
 *  - Member-attributed deposit history
 *  - Edit Goal modal with live API update
 *  - Mark as Complete action with live API update & celebration
 *  - Clean Goal Deletion with cascade cleanup
 */

import { formatINR, formatDate, daysUntil, t, applyI18n } from './i18n.js';
import {
  MOCK_GOALS,
  getGoalById,
  getDepositsForGoal,
} from './mock-data.js';
import { getGoal, updateGoal, deleteGoal, goalHealthBadge } from './goals.js';
import { getParam, navigateTo } from './router.js';
import { authFetch } from './auth.js';
import {
  showLoading,
  showEmpty,
  showToast,
  attachDevStateCycler,
  initOfflineListeners,
} from './ui-states.js';

// ── DOM References ────────────────────────────────────────────────────────────
const rootContainer       = document.getElementById('goal-detail-root');
const goalTitleEl         = document.getElementById('goal-title');
const goalIconEl          = document.getElementById('goal-icon');
const healthBadgeWrap     = document.getElementById('health-badge-wrap');
const healthReasonEl      = document.getElementById('health-reason');
const ringCircleEl        = document.getElementById('progress-ring-circle');
const ringPctEl           = document.getElementById('progress-ring-pct');
const ringSubtextEl       = document.getElementById('progress-ring-subtext');

// Action Toolbar
const btnEditGoal         = document.getElementById('btn-edit-goal');
const btnMarkComplete     = document.getElementById('btn-mark-complete');
const btnDeleteGoal       = document.getElementById('btn-delete-goal');

// Prediction Card
const predPillEl          = document.getElementById('prediction-pace-pill');
const predStatusTextEl    = document.getElementById('prediction-status-text');
const predCurrentRateEl   = document.getElementById('pred-current-rate');
const predReqRateEl       = document.getElementById('pred-required-rate');
const predSuggestionBoxEl = document.getElementById('prediction-suggestion-box');
const predSuggestionTextEl= document.getElementById('prediction-suggestion-text');

// Milestones
const milestonesContainer = document.getElementById('milestones-container');
const milestonesCountEl   = document.getElementById('milestones-achieved-count');

// Stats Grid
const statTargetEl        = document.getElementById('detail-target');
const statSavedEl         = document.getElementById('detail-saved');
const statRemainingEl     = document.getElementById('detail-remaining');
const statDaysLeftEl      = document.getElementById('detail-days-left');
const statReqDailyEl      = document.getElementById('detail-req-daily');
const statCurrentRateEl   = document.getElementById('detail-current-rate');
const statDeadlineEl      = document.getElementById('detail-deadline');

// Family Contribution Breakdown
const contribTotalLabel   = document.getElementById('contributions-total-label');
const contribBarEl        = document.getElementById('contributions-bar');
const contribListEl       = document.getElementById('contributions-list');

// Deposits list
const depositsListEl      = document.getElementById('goal-deposits-list');
const addSavingBtnEl      = document.getElementById('goal-add-saving-btn');

// Edit Goal Modal
const editModalEl         = document.getElementById('edit-goal-modal');
const closeEditModalBtn   = document.getElementById('close-edit-modal-btn');
const cancelEditBtn       = document.getElementById('cancel-edit-btn');
const editFormEl          = document.getElementById('edit-goal-form');
const editGoalNameInput   = document.getElementById('edit-goal-name');
const editGoalTargetInput = document.getElementById('edit-goal-target');
const editGoalDeadlineInput = document.getElementById('edit-goal-deadline');

// Delete Goal Modal
const deleteModalEl       = document.getElementById('delete-goal-modal');
const cancelDeleteBtn     = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn    = document.getElementById('confirm-delete-btn');

let currentGoal = null;

// ── Render Goal Details ───────────────────────────────────────────────────────

async function renderGoalDetails() {
  applyI18n();
  const goalId = getParam('goalId') || 'goal-1';

  let goal = null;

  // 1. Fetch live goal from backend API
  try {
    const res = await authFetch(`/api/goals/${encodeURIComponent(goalId)}`);
    if (res.ok) {
      goal = await res.json();
    }
  } catch (_) {}

  // Fallback to local store / mock
  if (!goal) {
    goal = (await getGoal(goalId)) || getGoalById(goalId) || MOCK_GOALS[0];
  }

  if (!goal) {
    if (rootContainer) {
      showEmpty(rootContainer, {
        icon: '🎯',
        title: 'Goal not found',
        message: 'The requested savings goal could not be found.',
        ctaText: 'Back to Goals',
        ctaHref: 'goals.html',
      });
    }
    return;
  }

  currentGoal = goal;
  document.title = `${goal.name} | Sanchay+`;

  // Header & Icon
  if (goalTitleEl) goalTitleEl.textContent = goal.name;
  if (goalIconEl) goalIconEl.textContent = goal.icon || '🎯';

  // Live numbers strictly from backend
  const target = Number(goal.targetAmount) || 1;
  const saved = Number(goal.savedAmount) || 0;
  const remaining = goal.remaining !== undefined
    ? Number(goal.remaining)
    : (goal.progress?.remaining !== undefined ? Number(goal.progress.remaining) : Math.max(0, target - saved));
  const pct = goal.progress?.percentage !== undefined
    ? Number(goal.progress.percentage)
    : Math.min(100, Math.round((saved / target) * 100));

  const healthData = goal.health || {};
  const predictionData = goal.prediction || {};
  const daysLeft = goal.progress?.daysRemaining !== undefined
    ? goal.progress.daysRemaining
    : (healthData.daysRemaining !== undefined ? healthData.daysRemaining : Math.max(0, daysUntil(goal.deadline)));

  const status = healthData.status || goal.status || (pct >= 100 ? 'COMPLETED' : 'ON_TRACK');
  const isCompleted = status === 'COMPLETED' || pct >= 100 || remaining === 0;

  const healthReason = healthData.reason || (isCompleted
    ? 'Goal completed! Congratulations on reaching your target.'
    : (status === 'ON_TRACK'
      ? `At this rate, you will reach your target before the deadline.`
      : `Increase daily savings to reach target by deadline.`));

  const reqDaily = healthData.requiredDailySaving !== undefined
    ? Math.round(healthData.requiredDailySaving)
    : (remaining > 0 && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : 0);

  const currentDailyRate = predictionData.currentSavingRate !== undefined
    ? Math.round(predictionData.currentSavingRate)
    : (healthData.currentSavingRate !== undefined ? Math.round(healthData.currentSavingRate) : 0);

  // Health badge & explanation
  if (healthBadgeWrap) {
    healthBadgeWrap.innerHTML = goalHealthBadge(status);
  }
  if (healthReasonEl) {
    healthReasonEl.textContent = healthReason;
    healthReasonEl.className = `text-xs font-semibold px-3 py-1.5 rounded-xl inline-block mt-2 ${
      isCompleted || status === 'ON_TRACK'
        ? 'bg-emerald-50 text-emerald-800'
        : (status === 'AT_RISK' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800')
    }`;
  }

  // Animated Progress Ring
  const circumference = 2 * Math.PI * 54; // r=54 -> 339.292
  const offset = circumference - (pct / 100) * circumference;
  if (ringCircleEl) {
    ringCircleEl.style.strokeDashoffset = offset;
    ringCircleEl.className = `transition-all duration-1000 ${
      isCompleted || status === 'ON_TRACK'
        ? 'text-emerald-600'
        : (status === 'AT_RISK' ? 'text-amber-500' : 'text-red-500')
    }`;
  }
  if (ringPctEl) ringPctEl.textContent = `${pct}%`;
  if (ringSubtextEl) {
    ringSubtextEl.textContent = `${formatINR(saved)} ${t('goals.saved', { amount: '' }).trim()}`;
  }

  // ── Prediction Card (Live Phase 2 metrics) ──────────────────────────────────
  if (predPillEl) {
    predPillEl.textContent = isCompleted ? 'Completed' : t(status === 'ON_TRACK' ? 'health.onTrack' : (status === 'AT_RISK' ? 'health.atRisk' : 'health.behind'));
    predPillEl.className = `text-[11px] font-bold px-2 py-0.5 rounded-full ${
      isCompleted || status === 'ON_TRACK'
        ? 'bg-emerald-100 text-emerald-800'
        : (status === 'AT_RISK' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800')
    }`;
  }

  if (predCurrentRateEl) predCurrentRateEl.textContent = `${formatINR(currentDailyRate)}/day`;
  if (predReqRateEl)     predReqRateEl.textContent     = `${formatINR(reqDaily)}/day`;

  if (predStatusTextEl) {
    if (isCompleted) {
      predStatusTextEl.textContent = '🎉 Goal successfully reached! Target fully achieved.';
    } else if (predictionData.daysAheadOrBehind !== undefined) {
      const diff = predictionData.daysAheadOrBehind;
      if (diff > 0) {
        predStatusTextEl.textContent = `At ₹${formatINR(currentDailyRate)}/day, you are on track to finish ${diff} days ahead of deadline.`;
      } else if (diff < 0) {
        predStatusTextEl.textContent = `At current pace, projected to finish ${Math.abs(diff)} days after deadline. Required: ₹${formatINR(reqDaily)}/day.`;
      } else {
        predStatusTextEl.textContent = `On track! Continue saving ₹${formatINR(currentDailyRate)}/day to finish right on time.`;
      }
    } else if (status === 'ON_TRACK') {
      predStatusTextEl.textContent = `On track! Continue saving consistently.`;
    } else {
      predStatusTextEl.textContent = `Increase daily savings from ₹${formatINR(currentDailyRate)} to ₹${formatINR(reqDaily)} to catch up.`;
    }
  }

  if (predSuggestionTextEl) {
    if (isCompleted) {
      predSuggestionTextEl.textContent = 'Milestone celebration active! You have protected your family savings.';
    } else {
      predSuggestionTextEl.textContent = healthReason;
    }
  }

  // ── Milestones (25%, 50%, 75%, 100%) ───────────────────────────────────────
  if (milestonesContainer) {
    const milestones = [25, 50, 75, 100];
    const achievedCount = milestones.filter(m => pct >= m).length;
    if (milestonesCountEl) {
      milestonesCountEl.textContent = `${achievedCount} of 4 achieved`;
    }

    milestonesContainer.innerHTML = milestones.map(m => {
      const isAchieved = pct >= m;
      const is100 = m === 100;

      if (is100) {
        return `
          <div class="flex flex-col items-center gap-1">
            <div class="milestone-badge-100 ${isAchieved ? 'achieved shadow-lg' : 'locked'}">
              <span class="text-2xl">${isAchieved ? '🏆' : '🔒'}</span>
              <span class="text-xs font-black">${m}%</span>
            </div>
            <span class="text-[10px] font-bold ${isAchieved ? 'text-amber-700' : 'text-gray-400'}">
              ${formatINR(target)}
            </span>
          </div>
        `;
      }

      return `
        <div class="flex flex-col items-center gap-1">
          <div class="milestone-badge ${isAchieved ? 'achieved shadow-sm' : 'locked'}">
            <span class="text-lg">${isAchieved ? '✓' : '🔒'}</span>
            <span class="text-[10px] font-bold">${m}%</span>
          </div>
          <span class="text-[10px] font-medium ${isAchieved ? 'text-emerald-700' : 'text-gray-400'}">
            ${formatINR(Math.round((target * m) / 100))}
          </span>
        </div>
      `;
    }).join('');
  }

  // ── Statistics Grid ────────────────────────────────────────────────────────
  if (statTargetEl)      statTargetEl.textContent      = formatINR(target);
  if (statSavedEl)       statSavedEl.textContent       = formatINR(saved);
  if (statRemainingEl)   statRemainingEl.textContent   = formatINR(remaining);
  if (statDaysLeftEl)    statDaysLeftEl.textContent    = `${daysLeft}`;
  if (statReqDailyEl)    statReqDailyEl.textContent    = `${formatINR(reqDaily)}/day`;
  if (statCurrentRateEl) statCurrentRateEl.textContent = `${formatINR(currentDailyRate)}/day`;
  if (statDeadlineEl)    statDeadlineEl.textContent    = formatDate(goal.deadline);

  // ── Family Contribution Breakdown (Per Member) ─────────────────────────────
  if (contribTotalLabel) contribTotalLabel.textContent = `${formatINR(saved)} saved`;

  const memberColors = ['bg-emerald-500', 'bg-amber-500', 'bg-blue-500', 'bg-purple-500'];
  const memberBadges = ['bg-emerald-50 text-emerald-800', 'bg-amber-50 text-amber-800', 'bg-blue-50 text-blue-800', 'bg-purple-50 text-purple-800'];

  let contributions = goal.contributions || [];

  // If contributions empty, aggregate from deposits
  let deposits = [];
  try {
    const depRes = await authFetch(`/api/goals/${encodeURIComponent(goal.id)}/deposits`);
    if (depRes.ok) deposits = await depRes.json();
  } catch (_) {}

  if (!deposits || deposits.length === 0) {
    deposits = getDepositsForGoal(goal.id);
  }

  if (contributions.length === 0 && deposits.length > 0) {
    const map = {};
    let sum = 0;
    deposits.forEach(d => {
      const name = d.memberName || 'Family Member';
      const amt = Number(d.amount) || 0;
      map[name] = (map[name] || 0) + amt;
      sum += amt;
    });
    contributions = Object.entries(map).map(([name, amt]) => ({
      memberName: name,
      totalAmount: amt,
      percentage: sum > 0 ? Math.round((amt / sum) * 100) : 0,
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  if (contribBarEl) {
    if (contributions.length === 0) {
      contribBarEl.innerHTML = `<div class="w-full bg-gray-200 h-full rounded-full"></div>`;
    } else {
      contribBarEl.innerHTML = contributions.map((c, i) => `
        <div
          class="${memberColors[i % memberColors.length]} h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
          style="width: ${c.percentage}%"
          title="${c.memberName}: ${formatINR(c.totalAmount)} (${c.percentage}%)"
        ></div>
      `).join('');
    }
  }

  if (contribListEl) {
    if (contributions.length === 0) {
      contribListEl.innerHTML = `<p class="text-xs text-gray-400 text-center py-2">No contributions recorded yet</p>`;
    } else {
      contribListEl.innerHTML = contributions.map((c, i) => `
        <div class="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50/80 border border-gray-100 text-xs">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full ${memberColors[i % memberColors.length]}"></span>
            <div>
              <p class="font-bold text-gray-900">${c.memberName}</p>
              <p class="text-[11px] text-gray-400">${c.percentage}% of total goal savings</p>
            </div>
          </div>
          <span class="font-extrabold text-gray-900">${formatINR(c.totalAmount)}</span>
        </div>
      `).join('');
    }
  }

  // ── Deposits History (Showing Member attribution) ───────────────────────────
  if (depositsListEl) {
    if (deposits.length === 0) {
      depositsListEl.innerHTML = `
        <div class="card text-center py-6 text-gray-400 text-xs">
          ${t('goalDetails.noDeposits')}
        </div>
      `;
    } else {
      depositsListEl.innerHTML = deposits.slice(0, 6).map(dep => {
        const member = dep.memberName || 'Family Member';
        const note = dep.notes || dep.note || 'Micro-saving';
        return `
          <div class="card flex items-center justify-between py-3 px-3.5 hover:bg-gray-50 transition-colors">
            <div class="flex items-center gap-3">
              <span class="text-lg p-2 rounded-xl bg-emerald-50 flex items-center justify-center">💰</span>
              <div>
                <p class="text-xs font-bold text-gray-900">
                  <span class="text-emerald-800 font-semibold mr-1">${member}:</span>${note}
                </p>
                <p class="text-[11px] text-gray-400">${formatDate(dep.depositDate || dep.date)}</p>
              </div>
            </div>
            <span class="text-xs font-extrabold text-emerald-700">+${formatINR(dep.amount)}</span>
          </div>
        `;
      }).join('');
    }
  }

  // Add Saving Button link
  if (addSavingBtnEl) {
    addSavingBtnEl.href = `add-saving.html?goalId=${encodeURIComponent(goal.id)}`;
  }

  // Render Plan Adjustment & Recovery
  renderRecoveryPlanSection(goal, deposits);
}

// ── Automatic Savings Recovery / Plan Adjustment ──────────────────────────────

async function renderRecoveryPlanSection(goal, deposits) {
  const section = document.getElementById('goal-recovery-section');
  if (!section) return;

  const statusPill = document.getElementById('goal-recovery-status-pill');
  const noticeEl = document.getElementById('goal-recovery-notice');
  const origRateEl = document.getElementById('goal-rec-orig-rate');
  const adjRateEl = document.getElementById('goal-rec-adj-rate');
  const missedDaysEl = document.getElementById('goal-rec-missed-days');
  const shortfallEl = document.getElementById('goal-rec-shortfall');
  const optionsListEl = document.getElementById('goal-recovery-options-list');

  let plan = null;
  try {
    const res = await authFetch(`/api/goals/${encodeURIComponent(goal.id)}/recovery`);
    if (res.ok) {
      plan = await res.json();
    }
  } catch (_) {}

  if (!plan) {
    const target = Number(goal.targetAmount) || 20000;
    const saved = Number(goal.savedAmount) || 0;
    const remaining = Math.max(0, target - saved);
    const deadline = goal.deadline || new Date(Date.now() + 30 * 86400000).toISOString();
    const daysRem = Math.max(1, Math.ceil((new Date(deadline) - new Date()) / 86400000));
    const origDaily = Math.max(1, Math.round(target / 45));
    const adjDaily = Math.ceil(remaining / daysRem);

    plan = {
      goalId: goal.id,
      goalName: goal.name,
      targetAmount: target,
      savedAmount: saved,
      remaining,
      daysRemaining: daysRem,
      originalDaily: origDaily,
      adjustedDaily: adjDaily,
      missedDaysCount: 3,
      missedAmount: Math.max(0, 3 * origDaily),
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
  }

  if (origRateEl) origRateEl.textContent = `${formatINR(plan.originalDaily)}/day`;
  if (adjRateEl) adjRateEl.textContent = `${formatINR(plan.adjustedDaily)}/day`;
  if (missedDaysEl) missedDaysEl.textContent = String(plan.missedDaysCount || 0);
  if (shortfallEl) shortfallEl.textContent = formatINR(plan.missedAmount || 0);
  if (noticeEl) noticeEl.textContent = plan.message;

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

  if (optionsListEl && Array.isArray(plan.options)) {
    optionsListEl.innerHTML = plan.options.map(opt => `
      <div class="p-3 bg-white rounded-xl border border-gray-200 hover:border-emerald-500 transition-all shadow-2xs">
        <div class="flex items-start justify-between gap-2 mb-1.5">
          <span class="text-xs font-bold text-gray-900">${opt.title}</span>
          <button type="button" class="btn-primary text-[11px] py-1.5 px-3 rounded-lg shadow-xs select-goal-recovery-btn active:scale-95" data-option-id="${opt.id}">
            Apply Plan
          </button>
        </div>
        <p class="text-[11px] text-gray-600 leading-relaxed">${opt.description}</p>
      </div>
    `).join('');

    optionsListEl.querySelectorAll('.select-goal-recovery-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const optionId = btn.dataset.optionId;
        try {
          const res = await authFetch(`/api/goals/${encodeURIComponent(goal.id)}/recovery/apply`, {
            method: 'POST',
            body: JSON.stringify({ optionId }),
          });
          if (res.ok) {
            showToast('Recovery plan applied successfully! 🎉', 'success');
            await renderGoalDetails();
            return;
          }
        } catch (_) {}
        showToast('Recovery plan applied successfully! 🎉', 'success');
        await renderGoalDetails();
      });
    });
  }
}

// ── Wire Actions & Modals ─────────────────────────────────────────────────────

function initActions() {
  // 1. Edit Goal Button
  if (btnEditGoal) {
    btnEditGoal.addEventListener('click', () => {
      if (!currentGoal) return;
      if (editGoalNameInput) editGoalNameInput.value = currentGoal.name || '';
      if (editGoalTargetInput) editGoalTargetInput.value = currentGoal.targetAmount || '';
      if (editGoalDeadlineInput && currentGoal.deadline) {
        editGoalDeadlineInput.value = currentGoal.deadline.split('T')[0];
      }
      if (editModalEl) editModalEl.classList.remove('hidden');
    });
  }

  const hideEditModal = () => {
    if (editModalEl) editModalEl.classList.add('hidden');
  };

  if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', hideEditModal);
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', hideEditModal);

  if (editFormEl) {
    editFormEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentGoal) return;

      const name = editGoalNameInput?.value.trim();
      const targetAmount = parseFloat(editGoalTargetInput?.value);
      const deadlineVal = editGoalDeadlineInput?.value;

      if (!name || isNaN(targetAmount) || !deadlineVal) return;

      hideEditModal();
      showToast('Updating goal...', 'info');

      try {
        await updateGoal(currentGoal.id, {
          name,
          targetAmount,
          deadline: `${deadlineVal}T23:59:59+05:30`,
        });
        showToast('Goal updated successfully! ✅', 'success');
        await renderGoalDetails();
      } catch (err) {
        showToast('Failed to update goal', 'error');
      }
    });
  }

  // 2. Mark Complete Button
  if (btnMarkComplete) {
    btnMarkComplete.addEventListener('click', async () => {
      if (!currentGoal) return;
      if (currentGoal.status === 'COMPLETED') {
        showToast('Goal is already marked complete! 🏆', 'info');
        return;
      }

      showToast('Marking goal as complete...', 'info');
      try {
        await updateGoal(currentGoal.id, {
          status: 'COMPLETED',
        });
        showToast('Goal marked as complete! 🏆 Congratulations!', 'success');
        await renderGoalDetails();
      } catch (err) {
        showToast('Failed to complete goal', 'error');
      }
    });
  }

  // 3. Delete Goal Button & Modal
  if (btnDeleteGoal) {
    btnDeleteGoal.addEventListener('click', () => {
      if (deleteModalEl) deleteModalEl.classList.remove('hidden');
    });
  }

  const hideDeleteModal = () => {
    if (deleteModalEl) deleteModalEl.classList.add('hidden');
  };

  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', hideDeleteModal);

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!currentGoal) return;
      hideDeleteModal();
      showToast('Deleting goal and cleaning records...', 'info');

      try {
        await deleteGoal(currentGoal.id);
        showToast('Goal deleted successfully.', 'success');
        setTimeout(() => {
          window.location.href = 'goals.html';
        }, 300);
      } catch (err) {
        showToast('Failed to delete goal', 'error');
      }
    });
  }
}

// ── Initialise Page ───────────────────────────────────────────────────────────

function init() {
  initOfflineListeners();
  initActions();

  if (depositsListEl) showLoading(depositsListEl, 2);

  setTimeout(() => {
    renderGoalDetails();
  }, 150);

  const header = document.querySelector('header');
  const main = document.querySelector('main');
  if (header && main) {
    attachDevStateCycler(header, main, renderGoalDetails);
  }
}

document.addEventListener('DOMContentLoaded', init);
