'use strict';

/**
 * savingsEngine.js — Core mathematical engine for micro-savings calculations.
 *
 * All date calculations occur in Asia/Kolkata.
 * Strictly implements the specified formulas and edge cases for:
 *   - Progress
 *   - Health classification
 *   - Projections & Predictions
 */

const TIMEZONE = 'Asia/Kolkata';

/**
 * Returns YYYY-MM-DD string in Asia/Kolkata.
 * @param {string|Date} date
 * @returns {string}
 */
function getISTDateString(date) {
  const d = date ? new Date(date) : new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);
}

/**
 * Returns current Date aligned to start of day in Asia/Kolkata.
 * @returns {Date}
 */
function getTodayIST() {
  const istStr = getISTDateString(new Date());
  return new Date(`${istStr}T00:00:00+05:30`);
}

/**
 * Calculates whole days between two dates in Asia/Kolkata.
 * Positive if d2 is after d1.
 * @param {string|Date} d1
 * @param {string|Date} d2
 * @returns {number}
 */
function daysBetween(d1, d2) {
  const date1 = new Date(`${getISTDateString(d1)}T00:00:00+05:30`);
  const date2 = new Date(`${getISTDateString(d2)}T00:00:00+05:30`);
  const diffMs = date2.getTime() - date1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Adds whole or fractional days to a base date in IST.
 * @param {Date} baseDate
 * @param {number} days
 * @returns {string} ISO Date string in IST
 */
function addDaysToDate(baseDate, days) {
  const result = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  return result.toISOString();
}

/**
 * Evaluates full metrics for a goal.
 *
 * @param {Object} goal
 * @param {number} goal.targetAmount
 * @param {number} goal.savedAmount
 * @param {string|Date} goal.deadline
 * @param {string|Date} goal.createdAt
 * @param {Date} [customToday] Optional override for testing
 * @returns {Object} Complete savings engine evaluation
 */
function evaluateGoal(goal, customToday = null) {
  const targetAmount = Number(goal.targetAmount) || 0;
  const savedAmount  = Math.max(0, Number(goal.savedAmount) || 0);
  const deadline     = goal.deadline;
  const createdAt    = goal.createdAt || new Date().toISOString();
  const today        = customToday || getTodayIST();

  // 1. Core formula values
  const remaining = Math.max(targetAmount - savedAmount, 0);
  const totalDays = Math.max(1, daysBetween(createdAt, deadline));
  const daysElapsed = Math.max(0, daysBetween(createdAt, today));
  const daysRemaining = Math.max(daysBetween(today, deadline), 0);

  const requiredDailySaving = daysRemaining > 0 ? (remaining / daysRemaining) : remaining;
  const currentSavingRate = daysElapsed > 0 ? (savedAmount / daysElapsed) : (savedAmount > 0 ? savedAmount : 0);

  const projectedDaysToFinish = currentSavingRate > 0 ? (remaining / currentSavingRate) : null;
  const projectedCompletionDate = projectedDaysToFinish !== null
    ? addDaysToDate(today, projectedDaysToFinish)
    : null;

  const isCompleted = savedAmount >= targetAmount;
  const percentage = Math.min(100, Math.round((savedAmount / (targetAmount || 1)) * 100));

  // 2. Health Classification & Explanation
  let healthStatus = 'ON_TRACK';
  let healthReason = '';

  if (isCompleted) {
    healthStatus = 'COMPLETED';
    healthReason = 'Goal completed! Congratulations on reaching your savings milestone.';
  } else if (daysRemaining <= 0) {
    healthStatus = 'BEHIND';
    healthReason = 'Deadline passed. You can extend your deadline or add the remaining amount.';
  } else if (currentSavingRate === 0) {
    // Zero deposits edge cases based on time elapsed
    const remainingRatio = daysRemaining / totalDays;
    if (remainingRatio >= 0.7) {
      healthStatus = 'ON_TRACK';
      healthReason = `Just getting started! Save ₹${Math.ceil(requiredDailySaving)}/day to reach your goal on time.`;
    } else if (remainingRatio >= 0.4) {
      healthStatus = 'AT_RISK';
      healthReason = `No savings recorded yet and ${daysRemaining} days left. You need ₹${Math.ceil(requiredDailySaving)}/day to catch up.`;
    } else {
      healthStatus = 'BEHIND';
      healthReason = `Critical: Time is running out with zero deposits. You need ₹${Math.ceil(requiredDailySaving)}/day.`;
    }
  } else if (projectedDaysToFinish > daysRemaining * 1.2) {
    healthStatus = 'BEHIND';
    const extraDays = Math.ceil(projectedDaysToFinish - daysRemaining);
    healthReason = `At ₹${Math.round(currentSavingRate)}/day you'll finish ${extraDays} days after your deadline. Need ₹${Math.ceil(requiredDailySaving)}/day.`;
  } else if (projectedDaysToFinish > daysRemaining) {
    healthStatus = 'AT_RISK';
    const extraDays = Math.ceil(projectedDaysToFinish - daysRemaining);
    healthReason = `Slightly behind schedule (by ${extraDays} days). Increase savings from ₹${Math.round(currentSavingRate)}/day to ₹${Math.ceil(requiredDailySaving)}/day.`;
  } else {
    healthStatus = 'ON_TRACK';
    const daysAhead = Math.floor(daysRemaining - projectedDaysToFinish);
    if (daysAhead > 0) {
      healthReason = `Great pace! At ₹${Math.round(currentSavingRate)}/day you're on track to finish ${daysAhead} days early.`;
    } else {
      healthReason = `On track! Continue saving ₹${Math.round(currentSavingRate)}/day to reach your target right on time.`;
    }
  }

  // 3. Prediction values
  const projectedFinalAmount = Math.round(savedAmount + currentSavingRate * daysRemaining);
  const shortfall = Math.max(targetAmount - projectedFinalAmount, 0);
  const daysAheadOrBehind = projectedDaysToFinish !== null
    ? Math.round((daysRemaining - projectedDaysToFinish) * 10) / 10
    : -daysRemaining;

  return {
    // Progress
    progress: {
      targetAmount,
      savedAmount,
      remaining: Math.round(remaining),
      percentage,
      totalDays,
      daysElapsed,
      daysRemaining,
      isCompleted,
    },
    // Health
    health: {
      status: healthStatus,
      reason: healthReason,
      requiredDailySaving: Math.round(requiredDailySaving * 100) / 100,
      currentSavingRate: Math.round(currentSavingRate * 100) / 100,
      daysRemaining,
    },
    // Prediction
    prediction: {
      currentSavingRate: Math.round(currentSavingRate * 100) / 100,
      requiredDailySaving: Math.round(requiredDailySaving * 100) / 100,
      projectedFinalAmount,
      shortfall,
      projectedCompletionDate,
      daysAheadOrBehind,
    },
  };
}

module.exports = {
  evaluateGoal,
  daysBetween,
  getISTDateString,
  getTodayIST,
};
