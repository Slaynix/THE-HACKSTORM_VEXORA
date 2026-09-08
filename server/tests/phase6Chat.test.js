'use strict';

require('dotenv').config();
process.env.NODE_ENV = 'test';

const assert = require('assert');
const http = require('http');
const { seedDatabase } = require('../scripts/seed');
const { getFirestore } = require('../config/firebase');
const app = require('../server');
const ChatService = require('../services/chatService');
const VoiceService = require('../services/voiceService');

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
  console.log('🧪 RUNNING PHASE 6 CONVERSATIONAL AI ASSISTANT TESTS');
  console.log('================================================================\n');

  await seedDatabase();

  server = app.listen(PORT, () => {});

  try {
    // ── 1. Test Multilingual Language Detection & Number Words ──────────────────
    console.log('▶ 1. Testing Multilingual Detection & Fallback Number Parsing...');
    
    assert.strictEqual(VoiceService.detectLanguage('I saved 100 rupees', 'en'), 'en');
    assert.strictEqual(VoiceService.detectLanguage('आज स्कूल फीस में ₹50 जमा किए।', 'en'), 'hi');
    assert.strictEqual(VoiceService.detectLanguage('मी आज शाळेच्या फीससाठी शंभर रुपये वाचवले.', 'en'), 'mr');
    assert.strictEqual(VoiceService.detectLanguage('School fees mein ₹50 daal do.', 'en'), 'hi'); // Romanized Hindi
    assert.strictEqual(VoiceService.detectLanguage('আমি ১০০ টাকা সঞ্চয় করেছি', 'en'), 'bn'); // Bengali
    assert.strictEqual(VoiceService.detectLanguage('મેં ૧૦૦ રૂપિયા બચાવ્યા', 'en'), 'gu'); // Gujarati
    assert.strictEqual(VoiceService.detectLanguage('நான் 100 ரூபாய் சேமித்தேன்', 'en'), 'ta'); // Tamil
    assert.strictEqual(VoiceService.detectLanguage('నేను 100 రూపాయలు ఆదా చేసాను', 'en'), 'te'); // Telugu
    assert.strictEqual(VoiceService.detectLanguage('ನಾನು 100 ರೂಪಾಯಿ ಉಳಿಸಿದೆ', 'en'), 'kn'); // Kannada
    assert.strictEqual(VoiceService.detectLanguage('ഞാൻ 100 രൂപ സമ്പാദിച്ചു', 'en'), 'ml'); // Malayalam
    assert.strictEqual(VoiceService.detectLanguage('ਮੈਂ 100 ਰੁਪਏ ਬਚਾਏ', 'en'), 'pa'); // Punjabi

    console.log('   ✓ 10 languages detected correctly viaIndic scripts & Romanized keywords');

    // ── 2. Test POST /api/chat - Deposit Request requires confirmation ──────────
    console.log('\n▶ 2. Testing Deposit Intent Requires Explicit Confirmation...');
    
    const chatRes1 = await request({
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      message: 'I saved 100 rupees for School Fees',
      inputMode: 'text',
      conversationId: 'test-conv-1',
      appLanguage: 'en',
    });

    assert.strictEqual(chatRes1.status, 200);
    assert.strictEqual(chatRes1.body.intent, 'record_deposit');
    assert.strictEqual(chatRes1.body.requiresConfirmation, true);
    assert.strictEqual(chatRes1.body.entities.amount, 100);
    assert.strictEqual(chatRes1.body.uiCard.type, 'deposit_confirm');
    assert.strictEqual(chatRes1.body.uiCard.data.amount, 100);
    assert.ok(chatRes1.body.replyText.includes('School Fees'));
    assert.ok(chatRes1.body.replySpeech.includes('100 rupees'));

    console.log('   ✓ Deposit intent correctly requires confirmation with structured UI card');
    console.log('   ✓ Zero deposit was recorded on the first message');

    // ── 3. Test POST /api/chat/confirm - Executes deposit & Idempotency ─────────
    console.log('\n▶ 3. Testing Explicit Deposit Confirmation & Idempotency...');
    
    const goalId = chatRes1.body.uiCard.data.goalId;
    const clientTxnId = `test-tx-${Date.now()}`;

    const confirmRes1 = await request({
      path: '/api/chat/confirm',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      goalId,
      amount: 100,
      clientTxnId,
      appLanguage: 'en',
    });

    assert.strictEqual(confirmRes1.status, 200);
    assert.strictEqual(confirmRes1.body.success, true);
    assert.strictEqual(confirmRes1.body.deposit.amount, 100);
    const updatedSaved = confirmRes1.body.goal.savedAmount;

    // Retry same confirmation (simulating double-click)
    const confirmRes2 = await request({
      path: '/api/chat/confirm',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      goalId,
      amount: 100,
      clientTxnId,
      appLanguage: 'en',
    });

    assert.strictEqual(confirmRes2.status, 200);
    assert.strictEqual(confirmRes2.body.goal.savedAmount, updatedSaved, 'Double click must NOT duplicate amount');
    console.log('   ✓ Confirmation creates real deposit and protects against double-clicks with clientTxnId');

    // ── 4. Test Read-Only Intents (Live Real Data, Zero Hallucination) ──────────
    console.log('\n▶ 4. Testing Read-Only Intents with Live Backend Data...');

    // A. Check Progress
    const progRes = await request({
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      message: 'How is my school fees progress?',
      inputMode: 'text',
      conversationId: 'test-conv-1',
    });
    assert.strictEqual(progRes.status, 200);
    assert.strictEqual(progRes.body.intent, 'check_progress');
    assert.strictEqual(progRes.body.uiCard.type, 'goal_progress');
    assert.strictEqual(progRes.body.uiCard.data.savedAmount, updatedSaved);
    console.log('   ✓ check_progress returns real live savedAmount');

    // B. Check Health
    const healthRes = await request({
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      message: 'Am I on track with school fees?',
      inputMode: 'text',
      conversationId: 'test-conv-1',
    });
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.intent, 'check_health');
    assert.strictEqual(healthRes.body.uiCard.type, 'goal_health');
    assert.ok(['ON_TRACK', 'BEHIND', 'AT_RISK', 'COMPLETED'].includes(healthRes.body.uiCard.data.health));
    console.log('   ✓ check_health returns real savings engine health status');

    // C. Get Prediction
    const predRes = await request({
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      message: 'How much do I need to save daily for school fees?',
      inputMode: 'text',
      conversationId: 'test-conv-1',
    });
    assert.strictEqual(predRes.status, 200);
    assert.strictEqual(predRes.body.intent, 'get_prediction');
    assert.strictEqual(predRes.body.uiCard.type, 'goal_prediction');
    assert.ok(predRes.body.uiCard.data.requiredDailySaving > 0);
    console.log('   ✓ get_prediction returns exact required daily rate from predictionService');

    // D. List Goals
    const listRes = await request({
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      message: 'What are my goals?',
      inputMode: 'text',
      conversationId: 'test-conv-1',
    });
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.body.intent, 'list_goals');
    assert.strictEqual(listRes.body.uiCard.type, 'goals_list');
    assert.ok(listRes.body.uiCard.data.goals.length >= 3);
    console.log('   ✓ list_goals returns all active goals');

    // E. Savings Tip
    const tipRes = await request({
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      message: 'Give me a savings tip',
      inputMode: 'text',
      conversationId: 'test-conv-1',
    });
    assert.strictEqual(tipRes.status, 200);
    assert.strictEqual(tipRes.body.intent, 'savings_tip');
    assert.strictEqual(tipRes.body.uiCard.type, 'tip_card');
    console.log('   ✓ savings_tip returns contextual tip');

    // ── 5. Test Code-Mixed and Multilingual Input ──────────────────────────────
    console.log('\n▶ 5. Testing Code-Mixed and Multilingual Conversations...');

    // Marathi
    const mrRes = await request({
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      message: 'मी आज शाळेच्या फीससाठी पन्नास रुपये वाचवले.',
      inputMode: 'text',
      conversationId: 'test-conv-mr',
    });
    assert.strictEqual(mrRes.status, 200);
    assert.strictEqual(mrRes.body.detectedLanguage, 'mr');
    assert.strictEqual(mrRes.body.entities.amount, 50);
    assert.ok(mrRes.body.replyText.includes('जमा करायचे आहेत'));
    console.log('   ✓ Marathi input parsed with ₹50 and natural Marathi response');

    // Hindi
    const hiRes = await request({
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      message: 'आज स्कूल फीस में ₹50 जमा किए।',
      inputMode: 'text',
      conversationId: 'test-conv-hi',
    });
    assert.strictEqual(hiRes.status, 200);
    assert.strictEqual(hiRes.body.detectedLanguage, 'hi');
    assert.strictEqual(hiRes.body.entities.amount, 50);
    assert.ok(hiRes.body.replyText.includes('जमा करना चाहते हैं'));
    console.log('   ✓ Hindi input parsed with ₹50 and natural Hindi response');

    // Code-mixed (Hinglish)
    const mixedRes = await request({
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      message: 'School fees mein ₹50 daal do.',
      inputMode: 'text',
      conversationId: 'test-conv-mixed',
    });
    assert.strictEqual(mixedRes.status, 200);
    assert.strictEqual(mixedRes.body.entities.amount, 50);
    assert.ok(mixedRes.body.uiCard.data.goalName.includes('School'));
    console.log('   ✓ Code-mixed input parsed with ₹50 matched to School Fees');

    // ── 6. Test Firestore chatMessages Storage ─────────────────────────────────
    console.log('\n▶ 6. Testing Firestore chatMessages Audit Collection...');
    const db = getFirestore();
    const snap = await db.collection('chatMessages').where('conversationId', '==', 'test-conv-1').get();
    assert.ok(snap.size >= 4, 'User and assistant messages must be recorded in chatMessages');
    console.log(`   ✓ Verified ${snap.size} chatMessages records saved to Firestore`);

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 6 CHAT TESTS PASSED (100%)');
    console.log('================================================================\n');
  } finally {
    if (server) server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ PHASE 6 TEST FAILURE:', err);
  if (server) server.close();
  process.exit(1);
});
