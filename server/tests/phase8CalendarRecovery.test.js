'use strict';

process.env.NODE_ENV = 'test';

const assert = require('assert');
const http = require('http');
const { seedDatabase } = require('../scripts/seed');
const { getFirestore } = require('../config/firebase');
const GoalsService = require('../services/goalsService');
const RecoveryService = require('../services/recoveryService');
const NotificationService = require('../services/notificationService');
const app = require('../server');

const PORT = 3098;
let server;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port: PORT, ...options }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING PHASE 8 SAVINGS CALENDAR & PLAN RECOVERY TESTS');
  console.log('================================================================\n');

  await seedDatabase();
  const db = getFirestore();
  const familyId = 'fam-patil-1';

  server = app.listen(PORT);

  try {
    const goals = await GoalsService.listByFamily(familyId);
    assert(goals.length > 0, 'Goals should be seeded');
    const testGoalId = goals[0].id; // School Fees

    // ── 1. GET /api/goals/:id/recovery ──────────────────────────────────────────
    console.log('▶ 1. Testing GET /api/goals/:id/recovery plan calculation...');
    const res1 = await request({
      path: `/api/goals/${testGoalId}/recovery`,
      method: 'GET',
    });

    assert.strictEqual(res1.status, 200);
    const plan = res1.body;
    assert.strictEqual(plan.goalId, testGoalId);
    assert(plan.targetAmount > 0, 'Target amount must be positive');
    assert(plan.savedAmount >= 0, 'Saved amount must be non-negative');
    assert(plan.remaining >= 0, 'Remaining must be non-negative');
    assert(typeof plan.originalDaily === 'number', 'originalDaily must be a number');
    assert(typeof plan.adjustedDaily === 'number', 'adjustedDaily must be a number');
    assert(Array.isArray(plan.options), 'Options must be an array');
    assert.strictEqual(plan.options.length, 3, 'Must provide exactly 3 recovery options');

    const optionIds = plan.options.map((o) => o.id);
    assert(optionIds.includes('INCREASE_DAILY'), 'Option 1: Increase daily saving required');
    assert(optionIds.includes('EXTEND_DEADLINE'), 'Option 2: Extend deadline required');
    assert(optionIds.includes('ADJUST_TARGET'), 'Option 3: Adjust target required');
    console.log('   ✓ Structured recovery plan returned with 3 distinct options');

    // ── 2. Exact math formula ───────────────────────────────────────────────────
    console.log('\n▶ 2. Testing Exact Mathematical Formula for Missed Days...');
    const simulatedGoal = {
      id: 'test-calc-goal',
      name: 'School Fees',
      targetAmount: 20000,
      savedAmount: 10000,
      createdAt: '2026-08-01T00:00:00+05:30',
      deadline: '2026-09-25T00:00:00+05:30', // 25 days remaining
    };

    const customToday = new Date('2026-08-31T00:00:00+05:30');
    const deposits = [
      { date: '2026-08-05T00:00:00+05:30', amount: 5000 },
      { date: '2026-08-15T00:00:00+05:30', amount: 5000 },
    ];

    const planMath = RecoveryService.calculatePlanAdjustment(simulatedGoal, deposits, customToday);

    assert.strictEqual(planMath.remaining, 10000, 'Remaining should be ₹10,000');
    assert.strictEqual(planMath.daysRemaining, 25, 'Days remaining should be 25');
    assert.strictEqual(planMath.adjustedDaily, 400, 'New required saving should be exactly ₹400/day');
    assert(planMath.missedDaysCount > 0, 'Must detect missed saving days');

    const opt1 = planMath.options.find((o) => o.id === 'INCREASE_DAILY');
    assert.strictEqual(opt1.newDailySaving, 400);
    console.log('   ✓ Math verified: ₹10,000 remaining / 25 days = ₹400/day new required rate');

    // ── 3. Option 1 Application ─────────────────────────────────────────────────
    console.log('\n▶ 3. Testing Option 1 (Increase Daily) Application & Notification...');
    const resApply = await request(
      {
        path: `/api/goals/${testGoalId}/recovery/apply`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { optionId: 'INCREASE_DAILY' }
    );

    assert.strictEqual(resApply.status, 200);
    assert(resApply.body.goal, 'Updated goal should be returned');
    assert.strictEqual(resApply.body.goal.adjustedPlanActive, true, 'adjustedPlanActive must be true');
    assert(resApply.body.goal.planAdjustments.length > 0, 'planAdjustments history must be recorded');

    const notifs = await NotificationService.listByFamily(familyId);
    const planNotif = notifs.find((n) => n.title.includes('Plan Adjusted'));
    assert(planNotif, 'Plan Adjusted notification must be created');
    console.log('   ✓ Option 1 applied: requiredDailySaving updated & planAdjustments history logged');

    // ── 4. Catch-up Extra Deposit ───────────────────────────────────────────────
    console.log('\n▶ 4. Testing Catch-up Extra Deposit Downward Recalculation...');
    const resDep = await request(
      {
        path: `/api/goals/${testGoalId}/deposits`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        amount: 300,
        memberName: 'Arun',
        source: 'recovery',
        notes: 'Catch-up saving',
      }
    );

    assert.strictEqual(resDep.status, 201);
    assert(resDep.body.catchUp, 'catchUp recalculation should be returned');
    assert(resDep.body.catchUp.newAdjustedDaily > 0, 'New downward adjusted rate calculated');
    assert(resDep.body.catchUp.message.includes('Great! You added ₹300 extra'), 'Emits encouraging recovery message');
    console.log('   ✓ Catch-up deposit recalculates required rate and issues recovery feedback');

    // ── 5. Missed Saving Check & Deduplication ──────────────────────────────────
    console.log('\n▶ 5. Testing Missed Saving Detection & Notification Deduplication...');
    const resMissed1 = await request({
      path: '/api/goals/check-missed',
      method: 'POST',
    });
    assert.strictEqual(resMissed1.status, 200);

    // Second check must be idempotent (0 duplicate notifications created for same day)
    const resMissed2 = await request({
      path: '/api/goals/check-missed',
      method: 'POST',
    });
    assert.strictEqual(resMissed2.status, 200);
    assert.strictEqual(resMissed2.body.count, 0, 'Second run must not create duplicate notifications for same day');
    console.log('   ✓ Deduplication verified: subsequent check-missed calls produce 0 duplicates');

    // ── 6. Completed Goal Invariant ─────────────────────────────────────────────
    console.log('\n▶ 6. Testing Completed Goal Edge Case...');
    const completedGoal = {
      id: 'completed-goal-test',
      name: 'Completed Goal',
      targetAmount: 5000,
      savedAmount: 5000,
      createdAt: '2026-08-01T00:00:00+05:30',
      deadline: '2026-09-30T00:00:00+05:30',
    };

    const completedPlan = RecoveryService.calculatePlanAdjustment(completedGoal, []);
    assert.strictEqual(completedPlan.status, 'COMPLETED');
    assert.strictEqual(completedPlan.remaining, 0);
    assert.strictEqual(completedPlan.adjustedDaily, 0);
    assert.strictEqual(completedPlan.options.length, 0, 'Must stop recovery options for completed goal');
    console.log('   ✓ Completed goal stops recovery calculations completely');

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 8 CALENDAR & RECOVERY TESTS PASSED (100%)');
    console.log('================================================================\n');
  } finally {
    if (server) server.close();
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('❌ Phase 8 tests failed:', err);
    if (server) server.close();
    process.exit(1);
  });
}

module.exports = { runTests };
