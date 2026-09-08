'use strict';

const assert = require('assert');
const http = require('http');

process.env.NODE_ENV = 'test';
const app = require('../server');

const PORT = 3099;
let server;

function request(method, path, body = null, headers = {}) {
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
        path,
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

async function runTests() {
  server = app.listen(PORT);
  console.log(`\n--- RUNNING API END-TO-END TESTS on port ${PORT} ---`);

  try {
    // 1. Healthcheck
    {
      const res = await request('GET', '/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'ok');
      console.log('✓ GET /health passed');
    }

    // 2. Auth: Register
    let authHeader = {};
    {
      const res = await request('POST', '/api/auth/register', {
        familyName: 'Sharma',
        memberName: 'Kavita',
        phoneNumber: '+919812345678',
        preferredLanguage: 'hi',
      });
      assert.strictEqual(res.status, 201);
      assert(res.data.token, 'Should return token');
      assert.strictEqual(res.data.family.name, 'Sharma');
      assert.strictEqual(res.data.user.memberName, 'Kavita');
      console.log('✓ POST /api/auth/register passed');
    }

    // 3. Auth: Login & Logout
    {
      const resLogin = await request('POST', '/api/auth/login', { phoneNumber: '+919876543210' });
      assert.strictEqual(resLogin.status, 200);
      assert(resLogin.data.token);
      authHeader = { Authorization: `Bearer ${resLogin.data.token}` };

      const resLogout = await request('POST', '/api/auth/logout', null, authHeader);
      assert.strictEqual(resLogout.status, 200);
      console.log('✓ POST /api/auth/login & /logout passed');
    }

    // 4. Family & Members
    {
      // GET /api/family
      const resFam = await request('GET', '/api/family', null, authHeader);
      assert.strictEqual(resFam.status, 200);
      assert.strictEqual(resFam.data.id, 'fam-patil-1');

      // PUT /api/family
      const resFamUpdate = await request('PUT', '/api/family', { preferredLanguage: 'mr' }, authHeader);
      assert.strictEqual(resFamUpdate.status, 200);
      assert.strictEqual(resFamUpdate.data.family.preferredLanguage, 'mr');

      // GET /api/family/members
      const resMembers = await request('GET', '/api/family/members', null, authHeader);
      assert.strictEqual(resMembers.status, 200);
      assert(Array.isArray(resMembers.data));
      assert(resMembers.data.length >= 3);

      // POST /api/family/members
      const resAddMember = await request('POST', '/api/family/members', { name: 'Aarav', role: 'Son' }, authHeader);
      assert.strictEqual(resAddMember.status, 201);
      const newMemberId = resAddMember.data.member.id;

      // DELETE /api/family/members/:id
      const resDelMember = await request('DELETE', `/api/family/members/${newMemberId}`, null, authHeader);
      assert.strictEqual(resDelMember.status, 200);

      console.log('✓ Family and Members endpoints passed');
    }

    // 5. Goals CRUD & Validation
    let createdGoalId = null;
    {
      // GET /api/goals
      const resGoals = await request('GET', '/api/goals', null, authHeader);
      assert.strictEqual(resGoals.status, 200);
      assert(Array.isArray(resGoals.data));
      assert(resGoals.data.length >= 3);

      // Validation rejection on negative target
      const resBadAmount = await request('POST', '/api/goals', {
        name: 'Invalid Goal',
        targetAmount: -500,
        deadline: '2026-12-31T00:00:00+05:30',
      }, authHeader);
      assert.strictEqual(resBadAmount.status, 400);
      assert(resBadAmount.data.error, 'Validation error expected');

      // Validation rejection on past deadline
      const resPastDate = await request('POST', '/api/goals', {
        name: 'Past Goal',
        targetAmount: 5000,
        deadline: '2020-01-01T00:00:00+05:30',
      }, authHeader);
      assert.strictEqual(resPastDate.status, 400);
      assert(resPastDate.data.error);

      // POST /api/goals (valid creation)
      const resCreate = await request('POST', '/api/goals', {
        name: 'Tractor Repair',
        category: 'farming',
        icon: '🌾',
        targetAmount: 25000,
        deadline: '2026-12-31T23:59:59+05:30',
      }, authHeader);
      assert.strictEqual(resCreate.status, 201);
      assert(resCreate.data.id);
      assert.strictEqual(resCreate.data.name, 'Tractor Repair');
      assert.strictEqual(resCreate.data.progress.savedAmount, 0);
      assert.strictEqual(resCreate.data.health.status, 'ON_TRACK');
      createdGoalId = resCreate.data.id;

      // GET /api/goals/:id
      const resGet = await request('GET', `/api/goals/${createdGoalId}`, null, authHeader);
      assert.strictEqual(resGet.status, 200);
      assert.strictEqual(resGet.data.id, createdGoalId);

      // PUT /api/goals/:id
      const resUpdate = await request('PUT', `/api/goals/${createdGoalId}`, { name: 'Farm Tractor Repair' }, authHeader);
      assert.strictEqual(resUpdate.status, 200);
      assert.strictEqual(resUpdate.data.name, 'Farm Tractor Repair');

      console.log('✓ Goals CRUD & input validation passed');
    }

    // 6. Deposits
    let testDepositId = null;
    {
      // GET /api/goals/:id/deposits
      const resList = await request('GET', `/api/goals/${createdGoalId}/deposits`, null, authHeader);
      assert.strictEqual(resList.status, 200);
      assert.strictEqual(resList.data.length, 0);

      // Validation check on 0 or negative deposit
      const resBadDep = await request('POST', `/api/goals/${createdGoalId}/deposits`, { amount: 0 }, authHeader);
      assert.strictEqual(resBadDep.status, 400);

      // POST /api/goals/:id/deposits
      const resAdd = await request('POST', `/api/goals/${createdGoalId}/deposits`, {
        amount: 2500,
        note: 'Crop sale advance',
      }, authHeader);
      assert.strictEqual(resAdd.status, 201);
      assert.strictEqual(resAdd.data.deposit.amount, 2500);
      assert.strictEqual(resAdd.data.goal.savedAmount, 2500);
      assert.strictEqual(resAdd.data.goal.progress.percentage, 10);
      testDepositId = resAdd.data.deposit.id;

      // PUT /api/deposits/:id
      const resUpdateDep = await request('PUT', `/api/deposits/${testDepositId}`, { amount: 3000 }, authHeader);
      assert.strictEqual(resUpdateDep.status, 200);
      assert.strictEqual(resUpdateDep.data.amount, 3000);

      // Verify goal automatically recalculated
      const resCheckGoal = await request('GET', `/api/goals/${createdGoalId}`, null, authHeader);
      assert.strictEqual(resCheckGoal.data.savedAmount, 3000);

      // DELETE /api/deposits/:id
      const resDelDep = await request('DELETE', `/api/deposits/${testDepositId}`, null, authHeader);
      assert.strictEqual(resDelDep.status, 200);

      // Verify goal recalculated to 0
      const resCheckGoalAfter = await request('GET', `/api/goals/${createdGoalId}`, null, authHeader);
      assert.strictEqual(resCheckGoalAfter.data.savedAmount, 0);

      console.log('✓ Goal deposits and automatic total recalculation passed');
    }

    // 7. Analytics: Progress, Health, Prediction
    {
      const resProgress = await request('GET', '/api/goals/goal-1/progress', null, authHeader);
      assert.strictEqual(resProgress.status, 200);
      assert.strictEqual(resProgress.data.goalId, 'goal-1');
      assert(resProgress.data.percentage > 0);

      const resHealth = await request('GET', '/api/goals/goal-1/health', null, authHeader);
      assert.strictEqual(resHealth.status, 200);
      assert(resHealth.data.status);
      assert(resHealth.data.reason);

      const resPrediction = await request('GET', '/api/goals/goal-1/prediction', null, authHeader);
      assert.strictEqual(resPrediction.status, 200);
      assert(resPrediction.data.currentSavingRate !== undefined);
      assert(resPrediction.data.requiredDailySaving !== undefined);

      console.log('✓ Analytics endpoints (/progress, /health, /prediction) passed');
    }

    // 8. Notifications
    {
      const resNotifs = await request('GET', '/api/notifications', null, authHeader);
      assert.strictEqual(resNotifs.status, 200);
      assert(Array.isArray(resNotifs.data));

      const resRead = await request('PUT', '/api/notifications/notif-1/read', null, authHeader);
      assert.strictEqual(resRead.status, 200);
      assert.strictEqual(resRead.data.read, true);

      console.log('✓ Notifications endpoints passed');
    }

    // 9. Voice Parser
    {
      // English test
      const resVoiceEn = await request('POST', '/api/voice/parse', {
        transcript: 'Save 200 rupees for School Fees',
      }, authHeader);
      assert.strictEqual(resVoiceEn.status, 200);
      assert.strictEqual(resVoiceEn.data.parsed.amount, 200);
      assert.strictEqual(resVoiceEn.data.parsed.category, 'education');

      // Hindi/Hinglish test
      const resVoiceHi = await request('POST', '/api/voice/parse', {
        transcript: 'Phone ke liye 50 rupaye jama karo',
      }, authHeader);
      assert.strictEqual(resVoiceHi.status, 200);
      assert.strictEqual(resVoiceHi.data.parsed.amount, 50);
      assert.strictEqual(resVoiceHi.data.parsed.category, 'phone');

      console.log('✓ Voice parsing endpoints (English & Hindi) passed');
    }

    // 10. Sync Batch Endpoint
    {
      const resSync = await request('POST', '/api/sync', {
        operations: [
          {
            localId: 'loc-1',
            type: 'ADD_DEPOSIT',
            data: {
              goalId: 'goal-1',
              amount: 150,
              note: 'Offline saved change',
            },
          },
        ],
      }, authHeader);

      assert.strictEqual(resSync.status, 200);
      assert.strictEqual(resSync.data.success, true);
      assert.strictEqual(resSync.data.appliedCount, 1);
      console.log('✓ Offline batch /api/sync passed');
    }

    // 11. Security & Error Handling Checks
    {
      // 404 Route Not Found
      const res404 = await request('GET', '/api/nonexistent-route');
      assert.strictEqual(res404.status, 404);
      assert.strictEqual(res404.data.error, 'Route not found');

      // No stack trace in errors
      assert.strictEqual(res404.data.stack, undefined, 'Stack trace must not leak');
      console.log('✓ Security and Error handling checks passed');
    }

    // Cleanup: Delete created goal
    if (createdGoalId) {
      await request('DELETE', `/api/goals/${createdGoalId}`, null, authHeader);
    }

    console.log('\n========================================');
    console.log('ALL API ENDPOINTS TESTED AND VERIFIED! 🚀');
    console.log('========================================\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  if (server) server.close();
  process.exit(1);
});
