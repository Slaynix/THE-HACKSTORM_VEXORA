'use strict';

const assert = require('assert');
const { evaluateGoal, daysBetween } = require('../services/savingsEngine');

console.log('--- RUNNING SAVINGS ENGINE TESTS ---');

// ── Test 1: Hand-calculated School Fees example ─────────────────────────────────
// Given: targetAmount: 20000, savedAmount: 12500, totalDays: 100, daysElapsed: 53, daysRemaining: 47
{
  const today = new Date('2026-08-23T00:00:00+05:30');
  const createdAt = '2026-07-01T00:00:00+05:30';
  const deadline = '2026-10-09T00:00:00+05:30';

  const goal = {
    targetAmount: 20000,
    savedAmount: 12500,
    createdAt,
    deadline,
  };

  const result = evaluateGoal(goal, today);

  console.log('Test 1 (School Fees):', {
    remaining: result.progress.remaining,
    daysRemaining: result.progress.daysRemaining,
    requiredDaily: result.health.requiredDailySaving,
    currentRate: result.health.currentSavingRate,
    health: result.health.status,
    daysAhead: result.prediction.daysAheadOrBehind,
  });

  assert.strictEqual(result.progress.remaining, 7500, 'Remaining should be 7500');
  assert.strictEqual(result.progress.daysRemaining, 47, 'Days remaining should be 47');
  assert.strictEqual(result.progress.percentage, 63, 'Percentage should be 63%');
  assert.strictEqual(result.health.status, 'ON_TRACK', 'Goal should be ON_TRACK');
  assert(result.health.currentSavingRate > 200, 'Current rate should be ~235.85');
  assert(result.health.requiredDailySaving > 150, 'Required daily should be ~159.57');
  assert(result.prediction.daysAheadOrBehind > 14, 'Should be ahead of schedule by ~15 days');
  assert.strictEqual(result.prediction.shortfall, 0, 'Shortfall should be 0');
  console.log('✓ Test 1 passed!');
}

// ── Test 2: Goal already completed ─────────────────────────────────────────────
{
  const goal = {
    targetAmount: 10000,
    savedAmount: 10000,
    createdAt: '2026-08-01T00:00:00+05:30',
    deadline: '2026-11-01T00:00:00+05:30',
  };

  const result = evaluateGoal(goal);
  assert.strictEqual(result.progress.isCompleted, true);
  assert.strictEqual(result.progress.percentage, 100);
  assert.strictEqual(result.progress.remaining, 0);
  assert.strictEqual(result.health.status, 'COMPLETED');
  assert(result.health.reason.includes('Goal completed'));
  console.log('✓ Test 2 (Completed Goal) passed!');
}

// ── Test 3: Deadline already passed and not completed ──────────────────────────
{
  const today = new Date('2026-09-08T00:00:00+05:30');
  const goal = {
    targetAmount: 5000,
    savedAmount: 2000,
    createdAt: '2026-07-01T00:00:00+05:30',
    deadline: '2026-09-01T00:00:00+05:30', // passed 7 days ago
  };

  const result = evaluateGoal(goal, today);
  assert.strictEqual(result.progress.daysRemaining, 0);
  assert.strictEqual(result.health.status, 'BEHIND');
  assert(result.health.reason.includes('Deadline passed'));
  console.log('✓ Test 3 (Deadline Passed) passed!');
}

// ── Test 4: Zero deposits yet (≥ 70% time left → ON_TRACK) ────────────────────
{
  const today = new Date('2026-09-08T00:00:00+05:30');
  const goal = {
    targetAmount: 15000,
    savedAmount: 0,
    createdAt: '2026-09-01T00:00:00+05:30',
    deadline: '2026-12-01T00:00:00+05:30', // 84 days left out of 91 days (~92%)
  };

  const result = evaluateGoal(goal, today);
  assert.strictEqual(result.health.status, 'ON_TRACK');
  assert(result.health.reason.includes('Just getting started'));
  assert.strictEqual(result.prediction.shortfall, 15000);
  console.log('✓ Test 4 (Zero deposits, starting out) passed!');
}

// ── Test 5: At Risk (saving slightly behind, within 20% grace) ────────────────
{
  // Remaining = 5000, daysRemaining = 50. Rate = 90/day.
  // Projected days = 5000 / 90 = 55.5 days.
  // 55.5 > 50 days, but <= 50 * 1.2 = 60 days. → AT_RISK.
  const today = new Date('2026-08-01T00:00:00+05:30');
  const goal = {
    targetAmount: 9500,
    savedAmount: 4500, // saved 4500 in 50 days (rate 90/day)
    createdAt: '2026-06-12T00:00:00+05:30',
    deadline: '2026-09-20T00:00:00+05:30', // 50 days left from Aug 1
  };

  const result = evaluateGoal(goal, today);
  assert.strictEqual(result.health.status, 'AT_RISK');
  assert(result.health.reason.includes('behind schedule'));
  console.log('✓ Test 5 (At Risk status) passed!');
}

// ── Test 6: Behind (> 20% over budget) ─────────────────────────────────────────
{
  // Target 10000, Saved 1000 over 50 days (rate = 20/day)
  // Remaining 9000. 100 days remaining.
  // Projected days = 9000 / 20 = 450 days. 450 > 100 * 1.2 = 120 → BEHIND.
  const today = new Date('2026-08-01T00:00:00+05:30');
  const goal = {
    targetAmount: 10000,
    savedAmount: 1000,
    createdAt: '2026-06-12T00:00:00+05:30',
    deadline: '2026-11-09T00:00:00+05:30',
  };

  const result = evaluateGoal(goal, today);
  assert.strictEqual(result.health.status, 'BEHIND');
  assert(result.prediction.shortfall > 0);
  console.log('✓ Test 6 (Behind status) passed!');
}

console.log('ALL SAVINGS ENGINE TESTS PASSED SUCCESSFULLY! 🎉\n');
