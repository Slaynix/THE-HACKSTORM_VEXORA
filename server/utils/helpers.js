'use strict';

/**
 * Formats a number as Indian Rupees with proper digit grouping.
 * e.g. formatINR(100000) → "₹1,00,000"
 *
 * @param {number} amount
 * @returns {string}
 */
function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Returns the current date/time string in Asia/Kolkata timezone.
 * @returns {string} ISO-like string e.g. "2026-09-08T11:47:43+05:30"
 */
function nowIST() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

/**
 * Calculates the number of days remaining until a deadline (Asia/Kolkata).
 * @param {string|Date} deadline
 * @returns {number}  Positive = days left; 0 = today; negative = overdue
 */
function daysUntil(deadline) {
  const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const end   = new Date(deadline);
  const diffMs = end - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determines goal health state based on progress and time remaining.
 *
 * @param {number} savedAmount
 * @param {number} targetAmount
 * @param {string|Date} deadline
 * @param {string|Date} createdAt
 * @returns {'ON_TRACK'|'AT_RISK'|'BEHIND'}
 */
function goalHealthState(savedAmount, targetAmount, deadline, createdAt) {
  const totalDays    = Math.ceil((new Date(deadline) - new Date(createdAt)) / (1000 * 60 * 60 * 24));
  const daysLeft     = daysUntil(deadline);
  const timeElapsed  = (totalDays - daysLeft) / totalDays;   // 0–1
  const amountDone   = savedAmount / targetAmount;            // 0–1

  if (amountDone >= 1)              return 'ON_TRACK';
  if (amountDone >= timeElapsed)    return 'ON_TRACK';
  if (amountDone >= timeElapsed * 0.75) return 'AT_RISK';
  return 'BEHIND';
}

module.exports = { formatINR, nowIST, daysUntil, goalHealthState };
