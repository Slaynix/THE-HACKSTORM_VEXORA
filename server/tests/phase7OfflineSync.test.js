'use strict';

process.env.NODE_ENV = 'test';

const assert = require('assert');
const http = require('http');
const { seedDatabase } = require('../scripts/seed');
const { getFirestore } = require('../config/firebase');
const app = require('../server');

const PORT = 3097;
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
  console.log('🧪 RUNNING PHASE 7 OFFLINE-FIRST ARCHITECTURE & SYNC TESTS');
  console.log('================================================================\n');

  await seedDatabase();
  const db = getFirestore();

  server = app.listen(PORT, () => {});

  try {
    // ── 1. Test Reachability Probe (/health) ──────────────────────────────────
    console.log('▶ 1. Testing Reachability Probe Endpoint (/health)...');
    const healthRes = await request({ path: '/health', method: 'GET' });
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.status, 'ok');
    console.log('   ✓ /health responds with 200 OK for reachability probes');

    // ── 2. Test Offline Deposit Sync with Unique clientTxnId ──────────────────
    console.log('\n▶ 2. Testing Offline Deposit Sync (/api/sync)...');
    const goalsSnap = await db.collection('goals').where('familyId', '==', 'fam-patil-1').get();
    const schoolGoal = goalsSnap.docs.map(d => ({ id: d.id, ...d.data() })).find(g => g.name.includes('School'));
    assert.ok(schoolGoal, 'School Fees goal must exist');
    const initialSaved = schoolGoal.savedAmount;

    const testTxnId = `uuid-offline-deposit-${Date.now()}`;
    const syncRes1 = await request({
      path: '/api/sync',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      operations: [
        {
          type: 'ADD_DEPOSIT',
          localId: testTxnId,
          data: {
            goalId: schoolGoal.id,
            amount: 250,
            memberId: 'user-patil-1',
            memberName: 'Arun Patil',
            clientTxnId: testTxnId,
            note: 'Saved in offline mode',
          },
        },
      ],
    });

    assert.strictEqual(syncRes1.status, 200);
    assert.strictEqual(syncRes1.body.appliedCount, 1);
    const opOutcome1 = syncRes1.body.results.find(r => r.localId === testTxnId);
    assert.strictEqual(opOutcome1.status, 'APPLIED');
    assert.ok(opOutcome1.serverId, 'Server must return assigned deposit ID');

    // Verify in Firestore
    const updatedGoalSnap = await db.collection('goals').doc(schoolGoal.id).get();
    assert.strictEqual(updatedGoalSnap.data().savedAmount, initialSaved + 250);
    console.log(`   ✓ Offline deposit applied. Goal balance: ₹${initialSaved} -> ₹${updatedGoalSnap.data().savedAmount}`);

    // ── 3. Test Idempotent Double-Sync (Same clientTxnId Replay) ─────────────
    console.log('\n▶ 3. Testing Idempotent Replay (Double Reconnect Simulation)...');

    const syncRes2 = await request({
      path: '/api/sync',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      operations: [
        {
          type: 'ADD_DEPOSIT',
          localId: testTxnId,
          data: {
            goalId: schoolGoal.id,
            amount: 250,
            memberId: 'user-patil-1',
            memberName: 'Arun Patil',
            clientTxnId: testTxnId,
            note: 'Saved in offline mode',
          },
        },
      ],
    });

    assert.strictEqual(syncRes2.status, 200);
    assert.strictEqual(syncRes2.body.appliedCount, 0, 'Replayed transaction must NOT increment appliedCount');
    const opOutcome2 = syncRes2.body.results.find(r => r.localId === testTxnId);
    assert.strictEqual(opOutcome2.status, 'EXISTS', 'Replayed transaction must return status: EXISTS');
    assert.strictEqual(opOutcome2.serverId, opOutcome1.serverId, 'Must reference the exact existing serverId');

    // Verify Firestore totals did not double
    const doubleCheckSnap = await db.collection('goals').doc(schoolGoal.id).get();
    assert.strictEqual(doubleCheckSnap.data().savedAmount, initialSaved + 250, 'Balance must NOT change on duplicate sync');

    // Verify exactly one deposit exists with that clientTxnId
    const depCheck = await db.collection('deposits').where('clientTxnId', '==', testTxnId).get();
    assert.strictEqual(depCheck.size, 1, 'Exactly one deposit record must exist');
    console.log('   ✓ Duplicate sync attempt safely recognized as EXISTS with zero balance corruption');

    // ── 4. Test Offline Goal Creation with clientTxnId ────────────────────────
    console.log('\n▶ 4. Testing Offline Goal Creation & Idempotent Upsert...');
    const goalTxnId = `uuid-offline-goal-${Date.now()}`;

    const goalSync1 = await request({
      path: '/api/sync',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      operations: [
        {
          type: 'CREATE_GOAL',
          localId: goalTxnId,
          data: {
            name: 'Solar Pump',
            category: 'farming',
            targetAmount: 40000,
            deadline: '2026-12-31',
            clientTxnId: goalTxnId,
          },
        },
      ],
    });

    assert.strictEqual(goalSync1.status, 200);
    assert.strictEqual(goalSync1.body.appliedCount, 1);
    const goalOutcome1 = goalSync1.body.results.find(r => r.localId === goalTxnId);
    assert.strictEqual(goalOutcome1.status, 'APPLIED');

    // Replay same goal creation
    const goalSync2 = await request({
      path: '/api/sync',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      operations: [
        {
          type: 'CREATE_GOAL',
          localId: goalTxnId,
          data: {
            name: 'Solar Pump',
            category: 'farming',
            targetAmount: 40000,
            deadline: '2026-12-31',
            clientTxnId: goalTxnId,
          },
        },
      ],
    });

    assert.strictEqual(goalSync2.status, 200);
    assert.strictEqual(goalSync2.body.appliedCount, 0);
    const goalOutcome2 = goalSync2.body.results.find(r => r.localId === goalTxnId);
    assert.strictEqual(goalOutcome2.status, 'EXISTS');
    console.log('   ✓ Offline goal creation successfully applied and idempotent on replay');

    // ── 5. Test Mixed Batch (New + Existing) ──────────────────────────────────
    console.log('\n▶ 5. Testing Mixed Batch Sync Operations...');
    const newTxnId = `uuid-offline-deposit-${Date.now()}-2`;

    const mixedRes = await request({
      path: '/api/sync',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      operations: [
        {
          type: 'ADD_DEPOSIT',
          localId: testTxnId, // Already exists
          data: { goalId: schoolGoal.id, amount: 250, clientTxnId: testTxnId },
        },
        {
          type: 'ADD_DEPOSIT',
          localId: newTxnId, // Brand new
          data: { goalId: schoolGoal.id, amount: 150, clientTxnId: newTxnId, memberName: 'Riya' },
        },
      ],
    });

    assert.strictEqual(mixedRes.status, 200);
    assert.strictEqual(mixedRes.body.appliedCount, 1);
    assert.strictEqual(mixedRes.body.results.find(r => r.localId === testTxnId).status, 'EXISTS');
    assert.strictEqual(mixedRes.body.results.find(r => r.localId === newTxnId).status, 'APPLIED');
    console.log('   ✓ Mixed batch accurately separated existing vs new operations');

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 7 OFFLINE & SYNC TESTS PASSED (100%)');
    console.log('================================================================\n');
  } finally {
    if (server) server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ PHASE 7 TEST FAILURE:', err);
  if (server) server.close();
  process.exit(1);
});
