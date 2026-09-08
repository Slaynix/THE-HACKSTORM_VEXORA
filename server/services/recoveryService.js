'use strict';

/**
 * recoveryService.js — Automatic savings recovery and plan adjustment engine.
 *
 * Responsibilities:
 *   - Detects missed saving days for active goals.
 *   - Recalculates future required savings plan when days are missed.
 *   - Generates 3 actionable recovery options:
 *       Option 1: Increase daily saving (keep deadline)
 *       Option 2: Extend the deadline (keep original daily saving)
 *       Option 3: Adjust the goal target
 *   - Applies selected recovery options and persists plan adjustments.
 *   - Recalculates dynamically when user adds extra catch-up savings.
 *   - Emits non-duplicate notifications for missed savings and plan adjustments.
 */

const { getFirestore } = require('../config/firebase');
const { evaluateGoal, getTodayIST, daysBetween, addDaysToDate, getISTDateString } = require('./savingsEngine');
const NotificationService = require('./notificationService');

const RecoveryService = {
  /**
   * Computes the recovery and plan adjustment status for a goal.
   *
   * @param {Object} goal
   * @param {Array} deposits - All deposits for this goal
   * @param {Date} [customToday]
   * @returns {Object}
   */
  calculatePlanAdjustment(goal, deposits = [], customToday = null) {
    const today = customToday || getTodayIST();
    const evaluation = evaluateGoal(goal, today);

    const targetAmount = Number(goal.targetAmount) || 0;
    const savedAmount = Number(goal.savedAmount) || 0;
    const remaining = Math.max(0, targetAmount - savedAmount);
    const deadline = goal.deadline;
    const createdAt = goal.createdAt || new Date().toISOString();

    const totalDays = Math.max(1, daysBetween(createdAt, deadline));
    const daysElapsed = Math.max(0, daysBetween(createdAt, today));
    const daysRemaining = Math.max(0, daysBetween(today, deadline));

    // Original required pace from inception
    const originalDaily = Math.max(1, Math.round(targetAmount / totalDays));

    // If goal already achieved, stop recovery calculations
    if (savedAmount >= targetAmount) {
      return {
        goalId: goal.id,
        goalName: goal.name,
        targetAmount,
        savedAmount,
        remaining: 0,
        daysRemaining,
        originalDaily,
        adjustedDaily: 0,
        missedDaysCount: 0,
        missedAmount: 0,
        status: 'COMPLETED',
        message: 'Goal already achieved! No recovery needed.',
        options: [],
        planAdjustments: goal.planAdjustments || [],
      };
    }

    // Identify days with saving activity
    const savedDatesSet = new Set();
    deposits.forEach((dep) => {
      const depDate = dep.date || dep.depositDate || dep.createdAt;
      if (depDate) {
        savedDatesSet.add(getISTDateString(depDate));
      }
    });

    // Check missed days from createdAt up to yesterday (or today if no deposit today)
    let missedDaysCount = 0;
    const missedDates = [];
    const startDate = new Date(`${getISTDateString(createdAt)}T00:00:00+05:30`);
    const todayISTStr = getISTDateString(today);

    for (let i = 0; i < daysElapsed; i++) {
      const checkDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = getISTDateString(checkDate);
      // Skip future dates
      if (dateStr >= todayISTStr) break;

      if (!savedDatesSet.has(dateStr)) {
        missedDaysCount++;
        missedDates.push(dateStr);
      }
    }

    // Calculate adjusted required daily rate
    const adjustedDaily = daysRemaining > 0
      ? Math.ceil(remaining / daysRemaining)
      : remaining;

    // Expected savings up to today based on original rate
    const expectedSavedToDate = Math.min(targetAmount, daysElapsed * originalDaily);
    const missedAmount = Math.max(0, expectedSavedToDate - savedAmount);

    // Status determination
    let status = 'ON_TRACK';
    let message = 'Your savings are on track.';

    if (daysRemaining === 0 && remaining > 0) {
      status = 'DEADLINE_PASSED';
      message = `Goal deadline passed with ₹${remaining.toLocaleString('en-IN')} remaining.`;
    } else if (adjustedDaily > originalDaily || missedDaysCount > 0) {
      status = 'ADJUSTMENT_NEEDED';
      message = `Your saving plan has been adjusted. ₹${remaining.toLocaleString('en-IN')} remaining in ${daysRemaining} days. New required saving: ₹${adjustedDaily.toLocaleString('en-IN')}/day.`;
    }

    // ── Generate the 3 Clear Recovery Options ─────────────────────────────────

    // Option 1: Increase daily saving (keep existing deadline)
    const option1 = {
      id: 'INCREASE_DAILY',
      title: 'Increase Daily Saving',
      description: `Save ₹${adjustedDaily.toLocaleString('en-IN')}/day to finish on schedule by ${new Date(deadline).toLocaleDateString('en-IN')}.`,
      newDailySaving: adjustedDaily,
      newDeadline: deadline,
      newTargetAmount: targetAmount,
      action: 'UPDATE_RATE',
    };

    // Option 2: Extend the deadline (keep comfortable original daily saving)
    const neededDaysAtOriginalRate = Math.ceil(remaining / (originalDaily || 1));
    const newDeadlineDate = new Date(today.getTime() + neededDaysAtOriginalRate * 24 * 60 * 60 * 1000);
    const extendedDays = Math.max(1, neededDaysAtOriginalRate - daysRemaining);

    const option2 = {
      id: 'EXTEND_DEADLINE',
      title: 'Extend Deadline',
      description: `Keep saving ₹${originalDaily.toLocaleString('en-IN')}/day and extend target date by ${extendedDays} days (to ${newDeadlineDate.toLocaleDateString('en-IN')}).`,
      newDailySaving: originalDaily,
      newDeadline: newDeadlineDate.toISOString(),
      extendedDays,
      newTargetAmount: targetAmount,
      action: 'EXTEND_DEADLINE',
    };

    // Option 3: Adjust the goal target (reach what is feasible by deadline)
    const feasibleTarget = savedAmount + (daysRemaining * originalDaily);
    const option3 = {
      id: 'ADJUST_TARGET',
      title: 'Adjust Goal Target',
      description: `Adjust target to ₹${feasibleTarget.toLocaleString('en-IN')} to finish comfortably by ${new Date(deadline).toLocaleDateString('en-IN')} at ₹${originalDaily.toLocaleString('en-IN')}/day.`,
      newDailySaving: originalDaily,
      newDeadline: deadline,
      newTargetAmount: Math.max(savedAmount, feasibleTarget),
      action: 'ADJUST_TARGET',
    };

    return {
      goalId: goal.id,
      goalName: goal.name,
      targetAmount,
      savedAmount,
      remaining,
      daysRemaining,
      originalDaily,
      adjustedDaily,
      missedDaysCount,
      missedDates,
      missedAmount,
      status,
      message,
      options: [option1, option2, option3],
      planAdjustments: goal.planAdjustments || [],
    };
  },

  /**
   * Applies a selected recovery option to a goal in Firestore.
   *
   * @param {string} goalId
   * @param {string} familyId
   * @param {Object} payload - { optionId, memberId }
   * @returns {Promise<Object>}
   */
  async applyRecoveryOption(goalId, familyId, payload) {
    const db = getFirestore();
    const docRef = db.collection('goals').doc(goalId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error('Goal not found');
    }

    const goal = snap.data();
    if (familyId && goal.familyId !== familyId) {
      throw new Error('Unauthorized goal access');
    }

    // Get goal deposits to calculate adjustment details
    const depSnap = await db.collection('deposits').where('goalId', '==', goalId).get();
    const deposits = [];
    depSnap.forEach((d) => deposits.push(d.data()));

    const plan = this.calculatePlanAdjustment({ id: goalId, ...goal }, deposits);
    const chosenOption = plan.options.find((opt) => opt.id === payload.optionId);

    if (!chosenOption) {
      throw new Error(`Invalid recovery option: ${payload.optionId}`);
    }

    const now = new Date().toISOString();
    const updateData = {
      updatedAt: now,
    };

    let notifBody = '';

    if (chosenOption.id === 'INCREASE_DAILY') {
      updateData.requiredDailySaving = chosenOption.newDailySaving;
      updateData.adjustedPlanActive = true;
      notifBody = `Your plan has been adjusted. You now need to save ₹${chosenOption.newDailySaving}/day to reach "${goal.name}" by the deadline.`;
    } else if (chosenOption.id === 'EXTEND_DEADLINE') {
      updateData.deadline = chosenOption.newDeadline;
      updateData.adjustedPlanActive = true;
      notifBody = `Goal "${goal.name}" deadline extended to ${new Date(chosenOption.newDeadline).toLocaleDateString('en-IN')}. Daily saving kept at ₹${chosenOption.newDailySaving}/day.`;
    } else if (chosenOption.id === 'ADJUST_TARGET') {
      updateData.targetAmount = chosenOption.newTargetAmount;
      updateData.adjustedPlanActive = true;
      notifBody = `Goal "${goal.name}" target adjusted to ₹${chosenOption.newTargetAmount}. Daily saving kept at ₹${chosenOption.newDailySaving}/day.`;
    }

    // Maintain history of plan adjustments
    const adjustmentRecord = {
      appliedAt: now,
      optionId: chosenOption.id,
      title: chosenOption.title,
      description: chosenOption.description,
      previousDailySaving: plan.originalDaily,
      newDailySaving: chosenOption.newDailySaving,
      appliedByMemberId: payload.memberId || 'member',
    };

    const existingAdjustments = Array.isArray(goal.planAdjustments) ? goal.planAdjustments : [];
    updateData.planAdjustments = [...existingAdjustments, adjustmentRecord];

    await docRef.update(updateData);

    // Send Plan Adjustment Notification with deduplication
    const notifKey = `plan_adj_${goalId}_${getISTDateString(now)}`;
    const existingNotifSnap = await db.collection('notifications')
      .where('familyId', '==', goal.familyId)
      .where('dedupKey', '==', notifKey)
      .get();

    if (existingNotifSnap.empty) {
      await NotificationService.createNotification(goal.familyId, {
        type: 'reminder',
        title: 'Plan Adjusted 📈',
        body: notifBody,
        dedupKey: notifKey,
        date: now,
      });
    }

    const updatedGoalSnap = await docRef.get();
    return {
      goal: { id: goalId, ...updatedGoalSnap.data() },
      adjustment: adjustmentRecord,
      message: notifBody,
    };
  },

  /**
   * Evaluates if a newly recorded deposit acts as a catch-up recovery,
   * recalculating the required future amount and creating a recovery notification.
   *
   * @param {Object} goal
   * @param {number} depositAmount
   * @returns {Promise<Object|null>}
   */
  async handleCatchUpDeposit(goal, depositAmount) {
    if (!goal || !goal.adjustedPlanActive || goal.savedAmount >= goal.targetAmount) {
      return null;
    }

    const db = getFirestore();
    const today = getTodayIST();
    const daysRemaining = Math.max(1, daysBetween(today, goal.deadline));
    const newRemaining = Math.max(0, Number(goal.targetAmount) - Number(goal.savedAmount));
    const newAdjustedDaily = Math.ceil(newRemaining / daysRemaining);

    const now = new Date().toISOString();
    const recoveryNotifBody = `Great! You added ₹${depositAmount} extra. Your required daily saving is now ₹${newAdjustedDaily}/day for "${goal.name}".`;

    // Only send notification if meaningful extra amount added
    const notifKey = `catchup_${goal.id}_${getISTDateString(now)}`;
    const existingNotifSnap = await db.collection('notifications')
      .where('familyId', '==', goal.familyId)
      .where('dedupKey', '==', notifKey)
      .get();

    if (existingNotifSnap.empty) {
      await NotificationService.createNotification(goal.familyId, {
        type: 'reminder',
        title: 'Savings Catch-Up! 🎯',
        body: recoveryNotifBody,
        dedupKey: notifKey,
        date: now,
      });
    }

    return {
      newRemaining,
      daysRemaining,
      newAdjustedDaily,
      message: recoveryNotifBody,
    };
  },

  /**
   * Checks for missed planned savings today across all active family goals,
   * creating a single deduplicated reminder per missed goal.
   *
   * @param {string} familyId
   * @returns {Promise<Array>}
   */
  async checkAndNotifyMissedSavings(familyId) {
    const db = getFirestore();
    const today = getTodayIST();
    const todayStr = getISTDateString(today);

    // Get active goals for family
    const goalsSnap = await db.collection('goals')
      .where('familyId', '==', familyId)
      .where('status', 'in', ['IN_PROGRESS', 'ON_TRACK', 'BEHIND', 'AT_RISK'])
      .get();

    const notificationsCreated = [];

    for (const doc of goalsSnap.docs) {
      const goal = { id: doc.id, ...doc.data() };
      if (goal.savedAmount >= goal.targetAmount) continue;

      // Check if deposit was made today
      const depSnap = await db.collection('deposits')
        .where('goalId', '==', goal.id)
        .get();

      let hasDepositToday = false;
      depSnap.forEach((d) => {
        const dep = d.data();
        const dDate = dep.date || dep.depositDate || dep.createdAt;
        if (dDate && getISTDateString(dDate) === todayStr) {
          hasDepositToday = true;
        }
      });

      if (!hasDepositToday) {
        // Compute daily target amount
        const totalDays = Math.max(1, daysBetween(goal.createdAt || today, goal.deadline));
        const dailyTarget = Math.max(10, Math.round(goal.targetAmount / totalDays));

        const dedupKey = `missed_${goal.id}_${todayStr}`;
        const existingSnap = await db.collection('notifications')
          .where('familyId', '==', familyId)
          .where('dedupKey', '==', dedupKey)
          .get();

        if (existingSnap.empty) {
          const notif = await NotificationService.createNotification(familyId, {
            type: 'reminder',
            title: 'Missed Saving Today ⏰',
            body: `You missed today's saving of ₹${dailyTarget} for ${goal.name}.`,
            dedupKey,
            date: today.toISOString(),
          });
          notificationsCreated.push(notif);
        }
      }
    }

    return notificationsCreated;
  },
};

module.exports = RecoveryService;
