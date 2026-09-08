'use strict';

const assert = require('assert');
const { getFirestore } = require('../config/firebase');
const GoalsService = require('../services/goalsService');
const DepositsService = require('../services/depositsService');
const StreakService = require('../services/streakService');
const NotificationService = require('../services/notificationService');
const { evaluateGoal, getISTDateString } = require('../services/savingsEngine');

async function runPhase5EndToEndTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 5 END-TO-END FEATURE LOGIC & WORKFLOW TESTS');
  console.log('================================================================\n');

  const db = getFirestore();
  const familyId = 'fam-phase5-test';
  const userId = 'user-phase5-test';

  // Cleanup any old test docs
  const oldGoals = await db.collection('goals').where('familyId', '==', familyId).get();
  const oldDeps = await db.collection('deposits').where('familyId', '==', familyId).get();
  const oldMiles = await db.collection('milestones').where('familyId', '==', familyId).get();
  const oldNotifs = await db.collection('notifications').where('familyId', '==', familyId).get();
  const clearBatch = db.batch();
  oldGoals.forEach(d => clearBatch.delete(d.ref));
  oldDeps.forEach(d => clearBatch.delete(d.ref));
  oldMiles.forEach(d => clearBatch.delete(d.ref));
  oldNotifs.forEach(d => clearBatch.delete(d.ref));
  await clearBatch.commit();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SAVINGS GOALS: Create, Edit, Read live fields
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ 1. Testing Savings Goals CRUD & Live Field Parity...');

  const deadline = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString();
  const createdGoal = await GoalsService.create(familyId, userId, {
    name: 'Monsoon Repairs',
    category: 'home',
    icon: '🏠',
    targetAmount: 10000,
    deadline,
  });

  assert.strictEqual(createdGoal.name, 'Monsoon Repairs');
  assert.strictEqual(createdGoal.targetAmount, 10000);
  assert.strictEqual(createdGoal.savedAmount, 0);
  assert.strictEqual(createdGoal.remaining, 10000);
  assert.strictEqual(createdGoal.progress.percentage, 0);
  assert.strictEqual(createdGoal.health.status, 'ON_TRACK');
  console.log('   ✓ Goal created with live fields: saved=0, remaining=10000, status=ON_TRACK');

  // Edit Goal
  const updatedGoal = await GoalsService.update(createdGoal.id, familyId, {
    name: 'Monsoon Roof Repairs',
    targetAmount: 12000,
  });

  assert.strictEqual(updatedGoal.name, 'Monsoon Roof Repairs');
  assert.strictEqual(updatedGoal.targetAmount, 12000);
  assert.strictEqual(updatedGoal.remaining, 12000);
  console.log('   ✓ Goal updated: name="Monsoon Roof Repairs", target=₹12,000, remaining=₹12,000');

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. MULTI-MEMBER DEPOSITS & LIVE METRICS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ 2. Testing Multi-Member Deposits & Real-Time Recalculations...');

  // Deposit 1: Arun saves ₹3,000 (25% milestone threshold)
  const txnId1 = `txn-test-${Date.now()}-1`;
  const res1 = await DepositsService.add(
    createdGoal.id,
    familyId,
    'mem-arun',
    'Arun Patil',
    { amount: 3000, notes: 'Crop sale savings', clientTxnId: txnId1 }
  );

  assert.strictEqual(res1.goal.savedAmount, 3000);
  assert.strictEqual(res1.goal.progress.percentage, 25);
  assert.strictEqual(res1.newlyCrossedMilestones.length, 1);
  assert.strictEqual(res1.newlyCrossedMilestones[0].percentage, 25);
  console.log('   ✓ Deposit 1 by Arun: ₹3,000 -> Goal at 25%, milestone 25% triggered');

  // Deposit 2: Sunita saves ₹3,000 (50% milestone threshold)
  const txnId2 = `txn-test-${Date.now()}-2`;
  const res2 = await DepositsService.add(
    createdGoal.id,
    familyId,
    'mem-sunita',
    'Sunita Patil',
    { amount: 3000, notes: 'Tailoring income', clientTxnId: txnId2 }
  );

  assert.strictEqual(res2.goal.savedAmount, 6000);
  assert.strictEqual(res2.goal.progress.percentage, 50);
  assert.strictEqual(res2.newlyCrossedMilestones.length, 1);
  assert.strictEqual(res2.newlyCrossedMilestones[0].percentage, 50);
  console.log('   ✓ Deposit 2 by Sunita: ₹3,000 -> Goal at 50%, milestone 50% triggered');

  // Deposit 3: Riya saves ₹3,000 (75% milestone threshold)
  const txnId3 = `txn-test-${Date.now()}-3`;
  const res3 = await DepositsService.add(
    createdGoal.id,
    familyId,
    'mem-riya',
    'Riya Patil',
    { amount: 3000, notes: 'Part-time tutor stipend', clientTxnId: txnId3 }
  );

  assert.strictEqual(res3.goal.savedAmount, 9000);
  assert.strictEqual(res3.goal.progress.percentage, 75);
  assert.strictEqual(res3.newlyCrossedMilestones.length, 1);
  assert.strictEqual(res3.newlyCrossedMilestones[0].percentage, 75);
  console.log('   ✓ Deposit 3 by Riya: ₹3,000 -> Goal at 75%, milestone 75% triggered');

  // Deposit 4: Arun saves ₹3,000 (100% milestone threshold -> COMPLETED)
  const txnId4 = `txn-test-${Date.now()}-4`;
  const res4 = await DepositsService.add(
    createdGoal.id,
    familyId,
    'mem-arun',
    'Arun Patil',
    { amount: 3000, notes: 'Final share for roof', clientTxnId: txnId4 }
  );

  assert.strictEqual(res4.goal.savedAmount, 12000);
  assert.strictEqual(res4.goal.progress.percentage, 100);
  assert.strictEqual(res4.goal.status, 'COMPLETED');
  assert.strictEqual(res4.newlyCrossedMilestones.length, 1);
  assert.strictEqual(res4.newlyCrossedMilestones[0].percentage, 100);
  console.log('   ✓ Deposit 4 by Arun: ₹3,000 -> Goal at 100%, status=COMPLETED, milestone 100% triggered');

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. FAMILY CONTRIBUTION BREAKDOWN
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ 3. Testing Family Contribution Breakdown by Member...');

  const fullGoal = await GoalsService.getById(createdGoal.id, familyId);
  assert(Array.isArray(fullGoal.contributions), 'Contributions array should be present');
  assert.strictEqual(fullGoal.contributions.length, 3);

  // Contributions sorted desc by total amount: Arun = 6000 (50%), Sunita = 3000 (25%), Riya = 3000 (25%)
  const arunContrib = fullGoal.contributions.find(c => c.memberName === 'Arun Patil');
  const sunitaContrib = fullGoal.contributions.find(c => c.memberName === 'Sunita Patil');
  const riyaContrib = fullGoal.contributions.find(c => c.memberName === 'Riya Patil');

  assert.strictEqual(arunContrib.totalAmount, 6000);
  assert.strictEqual(arunContrib.depositCount, 2);
  assert.strictEqual(arunContrib.percentage, 50);

  assert.strictEqual(sunitaContrib.totalAmount, 3000);
  assert.strictEqual(sunitaContrib.depositCount, 1);
  assert.strictEqual(sunitaContrib.percentage, 25);

  assert.strictEqual(riyaContrib.totalAmount, 3000);
  assert.strictEqual(riyaContrib.depositCount, 1);
  assert.strictEqual(riyaContrib.percentage, 25);

  console.log(`   ✓ Arun contributed: ₹${arunContrib.totalAmount} (${arunContrib.percentage}%) across ${arunContrib.depositCount} deposits`);
  console.log(`   ✓ Sunita contributed: ₹${sunitaContrib.totalAmount} (${sunitaContrib.percentage}%) across ${sunitaContrib.depositCount} deposits`);
  console.log(`   ✓ Riya contributed: ₹${riyaContrib.totalAmount} (${riyaContrib.percentage}%) across ${riyaContrib.depositCount} deposits`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. MILESTONE IDEMPOTENCY & NOTIFICATION AUDIT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ 4. Testing Milestone & Deposit Idempotency...');

  // Re-triggering the same deposit request with txnId4
  const duplicateRes = await DepositsService.add(
    createdGoal.id,
    familyId,
    'mem-arun',
    'Arun Patil',
    { amount: 3000, notes: 'Final share for roof', clientTxnId: txnId4 }
  );

  assert.strictEqual(duplicateRes.goal.savedAmount, 12000, 'Saved amount must not double count');
  assert.strictEqual(duplicateRes.newlyCrossedMilestones.length, 0, 'No duplicate milestones returned');

  // Verify exactly 4 milestone docs exist in Firestore for this goal: 25, 50, 75, 100
  const milestonesSnap = await db.collection('milestones').where('goalId', '==', createdGoal.id).get();
  assert.strictEqual(milestonesSnap.size, 4, `Expected exactly 4 milestone documents, got ${milestonesSnap.size}`);

  const percentages = [];
  milestonesSnap.forEach(d => percentages.push(d.data().percentage));
  percentages.sort((a, b) => a - b);
  assert.deepStrictEqual(percentages, [25, 50, 75, 100]);
  console.log('   ✓ Exactly 4 milestones exist (25, 50, 75, 100) with zero duplicates on retry');

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. SAVING STREAK LOGIC (Asia/Kolkata Calendar Days)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ 5. Testing Saving Streak Invariants in Asia/Kolkata...');

  const streakFamily = 'fam-streak-test';
  await db.collection('savingStreaks').doc(streakFamily).delete();

  // Day 1: Deposit on 2026-09-01 -> streak = 1
  const s1 = await StreakService.recalculateStreak(streakFamily, '2026-09-01T10:00:00+05:30');
  assert.strictEqual(s1.currentStreak, 1);
  assert.strictEqual(s1.longestStreak, 1);
  assert.strictEqual(s1.lastSavingDate, '2026-09-01');
  console.log('   ✓ First deposit: streak=1, longest=1, lastSavingDate=2026-09-01');

  // Day 1 (Second deposit on same calendar day): streak should not increment nor decrement
  const s1Midday = await StreakService.recalculateStreak(streakFamily, '2026-09-01T16:00:00+05:30');
  assert.strictEqual(s1Midday.currentStreak, 1, 'Mid-day deposit must not double-increment');
  assert.strictEqual(s1Midday.longestStreak, 1);
  console.log('   ✓ Mid-day deposit on same day: streak preserved at 1 (never decrements or double-increments)');

  // Day 2 (Consecutive day): Deposit on 2026-09-02 -> streak = 2
  const s2 = await StreakService.recalculateStreak(streakFamily, '2026-09-02T09:30:00+05:30');
  assert.strictEqual(s2.currentStreak, 2);
  assert.strictEqual(s2.longestStreak, 2);
  assert.strictEqual(s2.lastSavingDate, '2026-09-02');
  console.log('   ✓ Consecutive day (2026-09-02): streak increments to 2, longest=2');

  // Day 3 (Consecutive day): Deposit on 2026-09-03 -> streak = 3
  const s3 = await StreakService.recalculateStreak(streakFamily, '2026-09-03T11:00:00+05:30');
  assert.strictEqual(s3.currentStreak, 3);
  assert.strictEqual(s3.longestStreak, 3);
  console.log('   ✓ Consecutive day (2026-09-03): streak increments to 3, longest=3');

  // Day 6 (Gap > 1 day, skipped 4 and 5): Deposit on 2026-09-06 -> streak resets to 1, longest preserved at 3
  const s4 = await StreakService.recalculateStreak(streakFamily, '2026-09-06T14:00:00+05:30');
  assert.strictEqual(s4.currentStreak, 1, 'Gap > 1 day must reset streak to 1');
  assert.strictEqual(s4.longestStreak, 3, 'Longest streak must be preserved at 3');
  assert.strictEqual(s4.lastSavingDate, '2026-09-06');
  console.log('   ✓ Gap > 1 day (2026-09-06): streak resets to 1, longest preserved at 3');

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. CASCADE CLEANUP ON GOAL DELETION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ 6. Testing Cascade Deletion & Orphan Prevention...');

  const deleteSuccess = await GoalsService.delete(createdGoal.id, familyId);
  assert.strictEqual(deleteSuccess, true);

  // Verify goal doc is gone
  const goalDocAfter = await db.collection('goals').doc(createdGoal.id).get();
  assert.strictEqual(goalDocAfter.exists, false, 'Goal document should be deleted');

  // Verify deposits for this goal are cascade deleted
  const depositsAfter = await db.collection('deposits').where('goalId', '==', createdGoal.id).get();
  assert.strictEqual(depositsAfter.size, 0, `Deposits should be deleted, found ${depositsAfter.size}`);

  // Verify milestones for this goal are cascade deleted
  const milestonesAfter = await db.collection('milestones').where('goalId', '==', createdGoal.id).get();
  assert.strictEqual(milestonesAfter.size, 0, `Milestones should be deleted, found ${milestonesAfter.size}`);

  console.log('   ✓ Goal deleted cleanly: 0 orphaned deposits and 0 orphaned milestones remain in Firestore');

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. MARK COMPLETE WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ 7. Testing Explicit Mark-Complete Workflow...');

  const goalToComplete = await GoalsService.create(familyId, userId, {
    name: 'Diwali Gifts',
    category: 'festival',
    targetAmount: 5000,
    deadline,
  });

  const completed = await GoalsService.update(goalToComplete.id, familyId, {
    status: 'COMPLETED',
  });

  assert.strictEqual(completed.status, 'COMPLETED');
  const completedSnap = await db.collection('goals').doc(goalToComplete.id).get();
  assert.strictEqual(completedSnap.data().status, 'COMPLETED');

  // Verify 100% milestone doc created
  const m100 = await db.collection('milestones')
    .where('goalId', '==', goalToComplete.id)
    .where('percentage', '==', 100)
    .get();
  assert.strictEqual(m100.size, 1);

  console.log('   ✓ Goal explicitly marked COMPLETED: status updated and 100% milestone recorded');

  // Cleanup
  await GoalsService.delete(goalToComplete.id, familyId);

  console.log('\n================================================================');
  console.log('🎉 ALL PHASE 5 END-TO-END FEATURE LOGIC TESTS PASSED (100%)');
  console.log('================================================================\n');
}

if (require.main === module) {
  runPhase5EndToEndTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ [Phase 5 Test Failed]:', err);
      process.exit(1);
    });
}

module.exports = { runPhase5EndToEndTests };
