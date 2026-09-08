/**
 * deposits.js — Deposit (savings entry) module and controller.
 *
 * Responsibilities:
 *   addDeposit(goalId, data) — Records a deposit (API with offline fallback), updates goal saved amount
 *   listDeposits(goalId)     — Returns deposits for a goal
 *   initAddSavingPage()      — Handles add-saving.html form, voice triggers, and milestone celebration
 */

import { formatINR, formatDate, t, applyI18n } from './i18n.js';
import {
  MOCK_DEPOSITS,
  MOCK_GOALS,
  getGoalById,
} from './mock-data.js';
import { listGoals, getGoal, updateGoal } from './goals.js';
import { getParam, navigateTo } from './router.js';
import { showToast, initOfflineListeners } from './ui-states.js';
import { authFetch } from './auth.js';
import { openVoiceModal } from './voice.js';
import {
  generateClientTxnId,
  saveDepositLocally,
  enqueuePendingOperation,
  getCachedDeposits,
  updateCachedGoal,
} from './db.js';

let activeDeposits = [...MOCK_DEPOSITS];

// ── Storage / API functions ───────────────────────────────────────────────────

export async function addDeposit(goalId, data) {
  const clientTxnId = data.clientTxnId || generateClientTxnId();

  const depositPayload = {
    amount: Number(data.amount) || 0,
    memberId: data.memberId || 'mem-1',
    memberName: data.memberName || 'Family Member',
    note: data.note || data.notes || '',
    notes: data.note || data.notes || '',
    date: data.date || new Date().toISOString(),
    depositDate: data.depositDate || data.date || new Date().toISOString(),
    source: data.source || 'manual',
    clientTxnId,
  };

  let savedDeposit = null;
  let updatedGoal = null;
  let newlyCrossedMilestones = [];
  let streak = null;

  // 1. Try real backend API
  try {
    const res = await authFetch(`/api/goals/${encodeURIComponent(goalId)}/deposits`, {
      method: 'POST',
      body: JSON.stringify(depositPayload),
    });

    if (res.ok) {
      const json = await res.json();
      savedDeposit = { ...json.deposit, syncStatus: 'synced', pending: false };
      updatedGoal = json.goal;
      newlyCrossedMilestones = json.newlyCrossedMilestones || [];
      streak = json.streak || null;
      await saveDepositLocally(savedDeposit);
    }
  } catch (err) {
    console.warn('[deposits] Offline or API unreachable, queueing in IndexedDB:', err);
  }

  // 2. Fallback to IndexedDB & pending queue
  if (!savedDeposit) {
    savedDeposit = {
      id: `dep-${Date.now()}`,
      goalId,
      ...depositPayload,
      syncStatus: 'pending',
      pending: true,
    };
    activeDeposits.unshift(savedDeposit);

    await saveDepositLocally(savedDeposit);
    await enqueuePendingOperation('ADD_DEPOSIT', { ...savedDeposit, goalId }, clientTxnId);

    // Optimistic progress math
    const goal = await getGoal(goalId);
    if (goal) {
      const updatedSaved = (goal.savedAmount || 0) + savedDeposit.amount;
      const progressPercent = Math.min(100, Math.round((updatedSaved / (goal.targetAmount || 1)) * 100));
      updatedGoal = { ...goal, savedAmount: updatedSaved, progressPercent };
      await updateCachedGoal(goalId, { savedAmount: updatedSaved, progressPercent });
      await updateGoal(goalId, { savedAmount: updatedSaved, progressPercent });
    }
  } else {
    activeDeposits.unshift(savedDeposit);
  }

  return { deposit: savedDeposit, goal: updatedGoal, newlyCrossedMilestones, streak };
}

export async function listDeposits(goalId) {
  if (!goalId) {
    const cached = await getCachedDeposits();
    return cached.length > 0 ? cached : [...activeDeposits];
  }

  try {
    const res = await authFetch(`/api/goals/${encodeURIComponent(goalId)}/deposits`);
    if (res.ok) {
      const remote = await res.json();
      if (Array.isArray(remote)) {
        return remote;
      }
    }
  } catch (_) {}

  // Fallback to IndexedDB cache
  const cached = await getCachedDeposits(goalId);
  if (cached && cached.length > 0) return cached;

  return activeDeposits.filter(d => d.goalId === goalId);
}

// ── Add Saving Page Controller ────────────────────────────────────────────────

export async function initAddSavingPage() {
  applyI18n();

  const form             = document.getElementById('add-saving-form');
  const formCard         = document.getElementById('form-card');
  const successView      = document.getElementById('saving-success-view');
  const goalSelect       = document.getElementById('saving-goal-select');
  const memberSelect     = document.getElementById('saving-member-select');
  const customAmountEl   = document.getElementById('custom-amount-input');
  const dateInputEl      = document.getElementById('saving-date');
  const noteInputEl      = document.getElementById('saving-note');
  const submitBtn        = document.getElementById('saving-submit-btn');
  const quickAmountBtns  = document.querySelectorAll('.quick-amount-btn');
  const voiceTriggerBtn  = document.getElementById('voice-save-trigger');
  const srAnnouncementEl = document.getElementById('sr-announcement');

  // Success view elements
  const successAmountEl  = document.getElementById('success-amount-text');
  const successGoalEl    = document.getElementById('success-goal-text');
  const successViewGoal  = document.getElementById('success-view-goal-btn');
  const successAddMore   = document.getElementById('success-add-another-btn');

  // Milestone celebration elements
  const milestoneCard    = document.getElementById('milestone-celebration-card');
  const milestoneBadgeEl = document.getElementById('milestone-badge-display');
  const milestoneTitleEl = document.getElementById('milestone-celebration-title');
  const milestoneMsgEl   = document.getElementById('milestone-celebration-msg');

  if (!form) return;
  initOfflineListeners();

  // Set default date to today (YYYY-MM-DD in IST)
  if (dateInputEl) {
    const todayStr = new Date().toISOString().split('T')[0];
    dateInputEl.value = todayStr;
    dateInputEl.max = todayStr;
  }

  // Populate family members dropdown
  let members = [];
  try {
    const memRes = await authFetch('/api/family/members');
    if (memRes.ok) members = await memRes.json();
  } catch (_) {}
  if (!members || members.length === 0) {
    members = [
      { id: 'mem-arun', name: 'Arun Patil', role: 'Head of Family' },
      { id: 'mem-sunita', name: 'Sunita Patil', role: 'Mother' },
      { id: 'mem-riya', name: 'Riya Patil', role: 'Daughter' },
    ];
  }

  if (memberSelect) {
    memberSelect.innerHTML = '';
    members.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = m.id || m.uid || `mem-${idx + 1}`;
      opt.dataset.name = m.name;
      opt.textContent = `${m.name} (${m.role || 'Member'})`;
      if (m.name && m.name.includes('Arun')) {
        opt.selected = true;
      }
      memberSelect.appendChild(opt);
    });
  }

  // Populate goals dropdown
  let goals = [];
  try {
    const res = await authFetch('/api/goals');
    if (res.ok) goals = await res.json();
  } catch (_) {}
  if (!goals || goals.length === 0) {
    goals = await listGoals();
  }

  const preselectedGoalId = getParam('goalId');
  const preselectedAmount = parseFloat(getParam('amount')) || 0;

  if (goalSelect) {
    goalSelect.innerHTML = `<option value="">${t('addSaving.selectGoalPlaceholder')}</option>`;
    goals.forEach(goal => {
      const opt = document.createElement('option');
      opt.value = goal.id;
      opt.textContent = `${goal.icon || '🎯'} ${goal.name} (Saved: ${formatINR(goal.savedAmount)})`;
      if (preselectedGoalId && goal.id === preselectedGoalId) {
        opt.selected = true;
      }
      goalSelect.appendChild(opt);
    });

    // If only 1 goal exists or none selected, pick first
    if (!goalSelect.value && goals.length > 0 && !preselectedGoalId) {
      goalSelect.value = goals[0].id;
    }
  }

  let selectedAmount = 0;

  function updateSubmitButton() {
    const goalId = goalSelect?.value;
    const isValid = selectedAmount > 0 && !!goalId;

    if (submitBtn) {
      submitBtn.disabled = !isValid;
      if (selectedAmount > 0) {
        submitBtn.innerHTML = `<span>💰</span> <span>${t('addSaving.confirm', { amount: formatINR(selectedAmount) })}</span>`;
      } else {
        submitBtn.innerHTML = `<span data-i18n="addSaving.confirmDisabled">${t('addSaving.confirmDisabled')}</span>`;
      }
    }
  }

  // Pre-fill amount if passed in query param
  if (preselectedAmount > 0) {
    selectedAmount = preselectedAmount;
    if (customAmountEl) customAmountEl.value = preselectedAmount;
    quickAmountBtns.forEach(btn => {
      if (parseFloat(btn.dataset.amount) === preselectedAmount) {
        btn.classList.add('selected');
      }
    });
  }

  // Quick amount buttons
  quickAmountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const amt = parseFloat(btn.dataset.amount);
      quickAmountBtns.forEach(b => b.classList.remove('selected'));

      if (selectedAmount === amt && !customAmountEl?.value) {
        selectedAmount = 0;
        if (customAmountEl) customAmountEl.value = '';
      } else {
        btn.classList.add('selected');
        selectedAmount = amt;
        if (customAmountEl) customAmountEl.value = amt;
      }
      updateSubmitButton();
    });
  });

  // Custom amount input
  if (customAmountEl) {
    customAmountEl.addEventListener('input', () => {
      const val = parseFloat(customAmountEl.value) || 0;
      selectedAmount = val;

      quickAmountBtns.forEach(b => {
        if (parseFloat(b.dataset.amount) === val) {
          b.classList.add('selected');
        } else {
          b.classList.remove('selected');
        }
      });

      updateSubmitButton();
    });
  }

  if (goalSelect) {
    goalSelect.addEventListener('change', updateSubmitButton);
  }

  // Wire Voice Save trigger
  if (voiceTriggerBtn) {
    voiceTriggerBtn.addEventListener('click', () => {
      openVoiceModal({
        defaultGoalId: goalSelect?.value,
        onConfirmed: async ({ goalId, amount }) => {
          // Refresh goals and show success
          const targetGoal = goals.find(g => g.id === goalId) || (await getGoal(goalId));
          _showSuccessView(amount, targetGoal?.name || 'your goal', goalId, 0, 100);
        },
      });
    });
  }

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const goalId = goalSelect?.value;
    if (!goalId || selectedAmount <= 0) return;

    submitBtn.disabled = true;
    submitBtn.textContent = t('common.syncing');

    const selectedMemberOpt = memberSelect?.selectedOptions[0];
    const memberId = memberSelect?.value || 'mem-arun';
    const memberName = selectedMemberOpt?.dataset?.name || selectedMemberOpt?.textContent?.split('(')[0]?.trim() || 'Arun Patil';

    const note = noteInputEl?.value.trim() || '';
    const dateVal = dateInputEl?.value || new Date().toISOString().split('T')[0];

    // Prior goal progress for milestone detection
    const priorGoal = goals.find(g => g.id === goalId) || (await getGoal(goalId)) || {};
    const priorSaved = Number(priorGoal.savedAmount) || 0;
    const targetAmount = Number(priorGoal.targetAmount) || 1;
    const oldPct = Math.round((priorSaved / targetAmount) * 100);

    const result = await addDeposit(goalId, {
      amount: selectedAmount,
      memberId,
      memberName,
      note,
      date: `${dateVal}T12:00:00+05:30`,
      depositDate: `${dateVal}T12:00:00+05:30`,
    });

    const currentGoal = result.goal || (await getGoal(goalId)) || priorGoal;
    const goalName = currentGoal ? currentGoal.name : 'your goal';
    const newSaved = Number(currentGoal.savedAmount) || (priorSaved + selectedAmount);
    const newPct = currentGoal.progress?.percentage !== undefined
      ? currentGoal.progress.percentage
      : Math.round((newSaved / targetAmount) * 100);

    _showSuccessView(
      selectedAmount,
      goalName,
      goalId,
      oldPct,
      newPct,
      result.newlyCrossedMilestones,
      result.streak,
      memberName
    );
    showToast(`Successfully saved ${formatINR(selectedAmount)}! 🎉`, 'success');
  });

  function _showSuccessView(amount, goalName, goalId, oldPct, newPct, newlyCrossedMilestones = [], streak = null, memberName = '') {
    if (formCard && successView) {
      formCard.classList.add('hidden');
      successView.classList.remove('hidden');

      if (successAmountEl) successAmountEl.textContent = formatINR(amount);
      if (successGoalEl) {
        successGoalEl.textContent = memberName
          ? `${memberName} saved ${formatINR(amount)} toward ${goalName}!`
          : t('addSaving.successMsg', { amount: formatINR(amount), goal: goalName });
      }

      if (successViewGoal) {
        successViewGoal.href = `goal-details.html?goalId=${encodeURIComponent(goalId)}`;
      }

      // Check if a milestone was reached or newly crossed
      let reachedMilestone = null;
      if (newlyCrossedMilestones && newlyCrossedMilestones.length > 0) {
        // Take highest newly crossed milestone
        const sorted = [...newlyCrossedMilestones].sort((a, b) => b.percentage - a.percentage);
        reachedMilestone = sorted[0].percentage;
      } else {
        const milestones = [100, 75, 50, 25];
        reachedMilestone = milestones.find(m => newPct >= m && (oldPct < m || newPct >= 100));
      }

      if (reachedMilestone && milestoneCard && milestoneBadgeEl && milestoneTitleEl && milestoneMsgEl) {
        milestoneCard.classList.remove('hidden');

        if (reachedMilestone === 100) {
          milestoneBadgeEl.innerHTML = `
            <div class="milestone-badge-100 achieved shadow-md">
              <span class="text-3xl">🏆</span>
              <span class="text-xs font-black">100%</span>
            </div>
          `;
          milestoneTitleEl.textContent = t('milestone.celebration100');
          milestoneMsgEl.textContent = t('milestone.msg100');
        } else {
          milestoneBadgeEl.innerHTML = `
            <div class="milestone-badge achieved shadow-sm">
              <span class="text-xl">✓</span>
              <span class="text-xs font-bold">${reachedMilestone}%</span>
            </div>
          `;
          milestoneTitleEl.textContent = t('milestone.celebrationTitle');
          milestoneMsgEl.textContent = t(`milestone.msg${reachedMilestone}`);
        }

        // Screen reader announcement
        if (srAnnouncementEl) {
          srAnnouncementEl.textContent = `${formatINR(amount)} saved toward ${goalName}. ${milestoneTitleEl.textContent}: ${milestoneMsgEl.textContent}`;
        }
      } else {
        if (milestoneCard) milestoneCard.classList.add('hidden');
        if (srAnnouncementEl) {
          srAnnouncementEl.textContent = `${formatINR(amount)} saved toward ${goalName}`;
        }
      }
    }
  }

  // Add another action
  if (successAddMore) {
    successAddMore.addEventListener('click', () => {
      selectedAmount = 0;
      if (customAmountEl) customAmountEl.value = '';
      if (noteInputEl) noteInputEl.value = '';
      quickAmountBtns.forEach(b => b.classList.remove('selected'));
      updateSubmitButton();

      if (milestoneCard) milestoneCard.classList.add('hidden');
      if (formCard && successView) {
        successView.classList.add('hidden');
        formCard.classList.remove('hidden');
      }
    });
  }

  updateSubmitButton();
}

// Auto-run if on add-saving.html
if (typeof window !== 'undefined' && window.location.pathname.includes('add-saving.html')) {
  document.addEventListener('DOMContentLoaded', initAddSavingPage);
}

