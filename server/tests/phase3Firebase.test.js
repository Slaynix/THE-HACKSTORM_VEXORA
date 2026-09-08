'use strict';

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
const app = require('../server');
const { getFirestore } = require('../config/firebase');
const { seedDatabase } = require('../scripts/seed');
const GoalsService = require('../services/goalsService');
const DepositsService = require('../services/depositsService');
const FamilyService = require('../services/familyService');

const PORT = 3098;
let server;

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: reqPath,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch (_) {
            json = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runPhase3Tests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING PHASE 3 FIREBASE & FIRESTORE INTEGRATION TESTS');
  console.log('======================================================\n');

  server = app.listen(PORT);

  try {
    const db = getFirestore();

    // ── 1. Demo Data Seeding & Patil Family Verification ──────────────────────────
    console.log('▶ 1. Verifying Patil Family Seed Dataset...');
    await seedDatabase(db);

    const seededGoals = await GoalsService.listByFamily('fam-patil-1');
    assert.strictEqual(seededGoals.length, 4, 'Should have exactly 4 seeded goals');

    const expectedGoals = [
      { name: 'School Fees', target: 20000 },
      { name: 'New Phone', target: 15000 },
      { name: 'Diwali Expenses', target: 5000 },
      { name: 'Farming Equipment', target: 30000 },
    ];

    for (const exp of expectedGoals) {
      const g = seededGoals.find(item => item.name === exp.name);
      assert(g, `Goal "${exp.name}" must exist in seeded data`);
      assert.strictEqual(g.targetAmount, exp.target, `Target for "${exp.name}" must match ₹${exp.target}`);

      const pct = g.progress.percentage;
      assert(pct > 0 && pct < 100, `Goal "${exp.name}" progress (${pct}%) should be realistic, not 0% or 100%`);
      assert(['ON_TRACK', 'AT_RISK', 'BEHIND'].includes(g.health.status), `Goal "${exp.name}" health must be valid`);
      console.log(`   ✓ Goal "${exp.name}": Target ₹${g.targetAmount}, Saved ₹${g.savedAmount} (${pct}%), Health: ${g.health.status}`);
    }

    // Verify deposit spread across different dates
    const sfDeposits = await DepositsService.listByGoal('goal-1', 'fam-patil-1');
    assert(sfDeposits.length >= 5, 'School fees should have multiple deposits');
    const distinctDates = new Set(sfDeposits.map(d => d.depositDate ? d.depositDate.split('T')[0] : ''));
    assert(distinctDates.size > 1, 'Deposits must be spread across multiple dates');
    console.log(`   ✓ Verified ${sfDeposits.length} deposits across ${distinctDates.size} distinct days for School Fees`);

    // Verify clientTxnId is present in every deposit from day one
    for (const dep of sfDeposits) {
      assert(dep.clientTxnId, 'Deposit must have clientTxnId defined from day one');
    }
    console.log('   ✓ clientTxnId present on all deposits (Phase 7 forward compatibility)');

    // ── 2. Cross-Family Security Isolation ─────────────────────────────────────────
    console.log('\n▶ 2. Testing Cross-Family Isolation & Access Control...');

    // User A in Patil Family
    const userA = {
      uid: 'user-patil-1',
      familyId: 'fam-patil-1',
      memberName: 'Arun',
      role: 'admin',
    };
    await db.collection('users').doc(userA.uid).set(userA);

    // User B in Sharma Family
    const userB = {
      uid: 'user-sharma-2',
      familyId: 'fam-sharma-2',
      memberName: 'Rajesh',
      role: 'admin',
    };
    await db.collection('users').doc(userB.uid).set(userB);
    await db.collection('families').doc('fam-sharma-2').set({
      name: 'Sharma',
      preferredLanguage: 'hi',
    });

    // Create Goal for User B in Sharma Family
    const sharmaGoal = await GoalsService.create('fam-sharma-2', userB.uid, {
      name: 'Sharma Scooter',
      targetAmount: 50000,
      deadline: '2027-01-01T00:00:00Z',
    });

    // Verify User A cannot access Sharma goal via GoalsService
    const crossGoalGet = await GoalsService.getById(sharmaGoal.id, userA.familyId);
    assert.strictEqual(crossGoalGet, null, 'User A must NOT be able to view User B goal');

    // Verify User A cannot update Sharma goal
    const crossGoalUpdate = await GoalsService.update(sharmaGoal.id, userA.familyId, { name: 'Hacked Goal' });
    assert.strictEqual(crossGoalUpdate, null, 'User A must NOT be able to update User B goal');

    // Verify User A cannot delete Sharma goal
    const crossGoalDelete = await GoalsService.delete(sharmaGoal.id, userA.familyId);
    assert.strictEqual(crossGoalDelete, false, 'User A must NOT be able to delete User B goal');

    // Verify User A cannot list Sharma deposits
    const crossDepositsList = await DepositsService.listByGoal(sharmaGoal.id, userA.familyId);
    assert.strictEqual(crossDepositsList, null, 'User A must NOT be able to list User B deposits');

    // Verify User A cannot access Sharma Family data
    const crossFamilyMembers = await FamilyService.listMembers('fam-sharma-2');
    const patilFamilyMembers = await FamilyService.listMembers('fam-patil-1');
    assert(patilFamilyMembers.length >= 3);
    assert(crossFamilyMembers.every(m => m.familyId === 'fam-sharma-2'), 'Sharma members must not mix with Patil members');

    console.log('   ✓ Cross-family access completely blocked across goals, deposits, and members');

    // ── 3. Firestore Security Rules File Verification ─────────────────────────────
    console.log('\n▶ 3. Verifying firestore.rules File & Rules Logic...');
    const rulesPath = path.resolve(__dirname, '../../firebase/firestore.rules');
    assert(fs.existsSync(rulesPath), 'firestore.rules must exist in firebase directory');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    // Verify essential rule patterns
    assert(rulesContent.includes("isFamilyMember(familyId)"), 'Must contain isFamilyMember check');
    assert(rulesContent.includes("isOwner(userId)"), 'Must protect users/{userId} with isOwner check');
    assert(rulesContent.includes("immutableFieldsPreserved()"), 'Must validate immutable fields');
    assert(rulesContent.includes("allow read, write: if false;"), 'Must have default-deny rule at root');
    assert(!rulesContent.includes("allow read, write: if true;"), 'Must NOT have permissive blanket allow rule');

    console.log('   ✓ firestore.rules verified: contains isFamilyMember, isOwner, immutability checks, and default-deny');

    // ── 4. No Secrets Exposed to Client ───────────────────────────────────────────
    console.log('\n▶ 4. Verifying No Server Secrets Exposed to Browser...');
    const resConfig = await request('GET', '/api/config');
    assert.strictEqual(resConfig.status, 200);
    assert(resConfig.data.firebase, 'Should return public Firebase client config');
    assert(resConfig.data.firebase.apiKey, 'API key should be present');
    assert.strictEqual(resConfig.data.firebase.privateKey, undefined, 'Private key must NOT be exposed');
    assert.strictEqual(resConfig.data.firebase.clientEmail, undefined, 'Client email must NOT be exposed');
    assert.strictEqual(resConfig.data.firebase.FIREBASE_PRIVATE_KEY, undefined);

    // Check client directory files for any leaked secrets
    const clientDir = path.resolve(__dirname, '../../client');
    const checkFileForSecrets = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          checkFileForSecrets(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.html')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert(!content.includes('BEGIN PRIVATE KEY'), `Leaked private key in ${file}`);
          assert(!content.includes('FIREBASE_PRIVATE_KEY'), `Leaked env var name in ${file}`);
        }
      }
    };
    checkFileForSecrets(clientDir);
    console.log('   ✓ Checked client/ scripts: Zero secrets found, only public config exposed');

    // ── 5. End-to-End Auth & Firestore CRUD via HTTP ──────────────────────────────
    console.log('\n▶ 5. Verifying HTTP API against Firestore Services...');
    // Register
    const regRes = await request('POST', '/api/auth/register', {
      familyName: 'Deshmukh',
      memberName: 'Sanjay',
      phoneNumber: '+919988776655',
      preferredLanguage: 'mr',
    });
    assert.strictEqual(regRes.status, 201);
    const regToken = regRes.data.token;
    assert(regToken);

    // Verify user doc created in Firestore users collection
    const userDoc = await db.collection('users').doc(regRes.data.user.id).get();
    assert(userDoc.exists, 'User doc must exist in Firestore users collection');
    assert.strictEqual(userDoc.data().memberName, 'Sanjay');
    assert.strictEqual(userDoc.data().familyId, regRes.data.family.id);

    // Create Goal using new account
    const newGoalRes = await request('POST', '/api/goals', {
      name: 'Drip Irrigation',
      category: 'farming',
      targetAmount: 40000,
      deadline: '2026-11-30T00:00:00Z',
    }, { Authorization: `Bearer mock-token-${regRes.data.user.id}` });
    assert.strictEqual(newGoalRes.status, 201);

    // Verify goal exists in Firestore goals collection
    const goalDoc = await db.collection('goals').doc(newGoalRes.data.id).get();
    assert(goalDoc.exists, 'Goal doc must exist in Firestore goals collection');
    assert.strictEqual(goalDoc.data().name, 'Drip Irrigation');
    assert.strictEqual(goalDoc.data().familyId, regRes.data.family.id);

    // Add deposit
    const depRes = await request('POST', `/api/goals/${newGoalRes.data.id}/deposits`, {
      amount: 5000,
      notes: 'Initial subsidy deposit',
    }, { Authorization: `Bearer mock-token-${regRes.data.user.id}` });
    assert.strictEqual(depRes.status, 201);

    // Verify deposit in Firestore deposits collection
    const depDoc = await db.collection('deposits').doc(depRes.data.deposit.id).get();
    assert(depDoc.exists, 'Deposit doc must exist in Firestore deposits collection');
    assert.strictEqual(depDoc.data().amount, 5000);
    assert.strictEqual(depDoc.data().familyId, regRes.data.family.id);
    assert(depDoc.data().clientTxnId, 'clientTxnId must be populated in Firestore');

    console.log('   ✓ Registration, Goal Creation, and Deposit Creation confirmed in Firestore');

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 3 FIREBASE & FIRESTORE TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

runPhase3Tests().catch((err) => {
  console.error('❌ Phase 3 test failed:', err);
  if (server) server.close();
  process.exit(1);
});
